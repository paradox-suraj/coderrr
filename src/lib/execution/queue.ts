/**
 * Execution Job Queue
 *
 * Provides an in-process FIFO queue for C++/Java code execution jobs.
 * Each submission enqueues immediately and returns a jobId (202 Accepted).
 * Results are stored in-memory with a 5-minute TTL, then auto-evicted.
 *
 * Architecture:
 *   POST /api/execute  → enqueue(job) → return { jobId }
 *   GET  /api/execute/:jobId → getResult(jobId) → { status, result? }
 *
 * The worker loop processes one job at a time from the queue,
 * calls Piston through the circuit breaker, and stores the result.
 *
 * Limitations:
 *   - Single-process only. If multiple replicas are used, switch to
 *     Upstash Redis + a shared result store. The API contract is unchanged.
 *   - Max 20 pending jobs; excess jobs are rejected with 503.
 */

import { CircuitBreaker, CircuitOpenError } from './circuitBreaker';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ExecutionJob {
  id: string;
  language: 'cpp' | 'java';
  code: string;
  testCases?: unknown[];
  userId?: string;
  createdAt: number;
  correlationId: string;
}

export type JobStatus = 'pending' | 'running' | 'done' | 'failed';

export interface JobResult {
  status: JobStatus;
  result?: PistonExecutionResult;
  error?: string;
  createdAt: number;
  completedAt?: number;
  correlationId: string;
}

export interface PistonExecutionResult {
  stdout: string;
  stderr: string;
  executionTimeMs: number;
  passed: boolean;
  testResults?: unknown[];
  submissionStatus: 'Accepted' | 'Wrong Answer' | 'Runtime Error' | 'Compile Error';
  error?: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const MAX_QUEUE_DEPTH = 20;
const RESULT_TTL_MS = 5 * 60 * 1000; // 5 minutes
const PISTON_TIMEOUT_MS = 10_000;     // 10 s hard timeout per job
const EVICTION_INTERVAL_MS = 60_000;  // evict stale results every minute

// ── Shared State (module-level singletons) ────────────────────────────────────

const queue: ExecutionJob[] = [];
const resultStore = new Map<string, JobResult>();

export const pistonCircuit = new CircuitBreaker({
  name: 'piston',
  failureThreshold: 3,
  recoveryTimeoutMs: 30_000,
});

// ── Worker Loop ───────────────────────────────────────────────────────────────

let workerRunning = false;

async function processNext(): Promise<void> {
  if (workerRunning || queue.length === 0) return;
  workerRunning = true;

  const job = queue.shift()!;

  // Mark as running
  const existing = resultStore.get(job.id);
  if (existing) {
    resultStore.set(job.id, { ...existing, status: 'running' });
  }

  console.info(JSON.stringify({
    event: 'job.start',
    jobId: job.id,
    language: job.language,
    correlationId: job.correlationId,
    queueDepthAfter: queue.length,
  }));

  try {
    const result = await pistonCircuit.call(() => callPiston(job));

    resultStore.set(job.id, {
      status: 'done',
      result,
      createdAt: job.createdAt,
      completedAt: Date.now(),
      correlationId: job.correlationId,
    });

    console.info(JSON.stringify({
      event: 'job.done',
      jobId: job.id,
      status: result.submissionStatus,
      correlationId: job.correlationId,
      durationMs: Date.now() - job.createdAt,
    }));
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    const isCircuitOpen = err instanceof CircuitOpenError;

    resultStore.set(job.id, {
      status: 'failed',
      error: message,
      createdAt: job.createdAt,
      completedAt: Date.now(),
      correlationId: job.correlationId,
      result: {
        stdout: '',
        stderr: isCircuitOpen
          ? 'Sandbox temporarily unavailable. Please try again in 30 seconds.'
          : `Execution failed: ${message}`,
        executionTimeMs: Date.now() - job.createdAt,
        passed: false,
        submissionStatus: 'Runtime Error',
        error: message,
      },
    });

    console.error(JSON.stringify({
      event: 'job.failed',
      jobId: job.id,
      error: message,
      circuitOpen: isCircuitOpen,
      correlationId: job.correlationId,
    }));
  } finally {
    workerRunning = false;
    // Schedule next job (yielding to allow other async work)
    if (queue.length > 0) {
      setImmediate(processNext);
    }
  }
}

// ── Piston API Call ───────────────────────────────────────────────────────────

const PISTON_LANGUAGE_MAP: Record<string, { language: string; version: string }> = {
  cpp: { language: 'cpp', version: '10.2.0' },
  java: { language: 'java', version: '15.0.2' },
};

import { getPistonEndpoint, getPistonStatus } from '@/lib/execution/pistonConfig';

async function callPiston(job: ExecutionJob): Promise<PistonExecutionResult> {
  const pistonConfig = PISTON_LANGUAGE_MAP[job.language];
  const endpoint = getPistonEndpoint();
  if (!endpoint) {
    const status = getPistonStatus();
    return {
      run: {
        stdout: '',
        stderr: `Remote execution environment not configured: ${status.reason || 'PISTON_URL missing'}. C++ and Java require a configured Piston runner.`,
        code: 1,
      },
    };
  }
  const apiKey = process.env.PISTON_KEY;

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (apiKey) headers['Authorization'] = apiKey;

  const controller = new AbortController();
  const timeoutHandle = setTimeout(() => controller.abort(), PISTON_TIMEOUT_MS);

  const startTime = Date.now();
  let response: Response;

  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        language: pistonConfig.language,
        version: pistonConfig.version,
        files: [
          {
            name: job.language === 'java' ? 'Main.java' : `main.${job.language}`,
            content: job.code,
          },
        ],
      }),
      signal: controller.signal,
    });
  } catch (e: unknown) {
    if (e instanceof Error && e.name === 'AbortError') {
      throw new Error('Piston execution timed out after 10s');
    }
    throw e;
  } finally {
    clearTimeout(timeoutHandle);
  }

  const elapsedMs = Date.now() - startTime;

  if (!response.ok) {
    const errText = await response.text().catch(() => 'unknown');
    throw new Error(`Piston HTTP ${response.status}: ${errText.slice(0, 200)}`);
  }

  const raw = await response.json();
  const compile = raw.compile || {};
  const run = raw.run || {};

  const stdout: string = run.stdout || '';
  const stderr: string = [compile.stderr, run.stderr].filter(Boolean).join('\n');
  const passed = run.code === 0 && !compile.stderr;

  const testCases = job.testCases as Array<{ id?: string; input: string; expectedOutput: string }> | undefined;
  const testResults = (testCases || []).map((tc, idx) => {
    const actual = stdout.trim();
    const expected = tc.expectedOutput.trim();
    const casePassed = passed && (actual.includes(expected) || actual === expected);
    return {
      caseId: tc.id || `case-${idx + 1}`,
      passed: casePassed,
      input: tc.input,
      expectedOutput: tc.expectedOutput,
      actualOutput: actual || (compile.stderr ? '[Compile Error]' : '[No Output]'),
      stdout,
      stderr,
      executionTimeMs: elapsedMs,
      error: compile.stderr || run.stderr,
    };
  });

  const allPassed = passed && (testResults.length === 0 || testResults.every((t) => t.passed));
  const submissionStatus: PistonExecutionResult['submissionStatus'] = allPassed
    ? 'Accepted'
    : compile.stderr
    ? 'Compile Error'
    : run.stderr
    ? 'Runtime Error'
    : 'Wrong Answer';

  return {
    stdout,
    stderr,
    executionTimeMs: elapsedMs,
    passed: allPassed,
    testResults: testResults.length > 0 ? testResults : undefined,
    submissionStatus,
    error: stderr ? (compile.stderr ? 'Compilation Error' : 'Runtime Error') : undefined,
  };
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Enqueue a job. Returns the jobId immediately.
 * Throws if the queue is full (caller should return 503).
 */
export function enqueueJob(job: Omit<ExecutionJob, 'id' | 'createdAt'>): string {
  if (queue.length >= MAX_QUEUE_DEPTH) {
    throw new Error(`Queue full (${MAX_QUEUE_DEPTH} jobs pending). Please retry shortly.`);
  }

  const id = crypto.randomUUID();
  const fullJob: ExecutionJob = { ...job, id, createdAt: Date.now() };

  resultStore.set(id, {
    status: 'pending',
    createdAt: fullJob.createdAt,
    correlationId: fullJob.correlationId,
  });

  queue.push(fullJob);

  console.info(JSON.stringify({
    event: 'job.enqueued',
    jobId: id,
    language: job.language,
    correlationId: job.correlationId,
    queueDepth: queue.length,
  }));

  // Kick off worker (idempotent — safe to call repeatedly)
  setImmediate(processNext);

  return id;
}

/** Get the current status of a job. Returns null if jobId is unknown. */
export function getJobResult(jobId: string): JobResult | null {
  return resultStore.get(jobId) ?? null;
}

/** Current queue depth (pending jobs not yet started). */
export function getQueueDepth(): number {
  return queue.length;
}

/** Whether the worker is currently processing a job. */
export function isWorkerBusy(): boolean {
  return workerRunning;
}

// ── TTL Eviction ──────────────────────────────────────────────────────────────

function evictStaleResults(): void {
  const now = Date.now();
  let evicted = 0;
  for (const [id, result] of resultStore.entries()) {
    if (now - result.createdAt > RESULT_TTL_MS) {
      resultStore.delete(id);
      evicted++;
    }
  }
  if (evicted > 0) {
    console.info(JSON.stringify({ event: 'resultStore.eviction', evicted, remaining: resultStore.size }));
  }
}

// Start eviction loop only in a server context (not during tests)
if (typeof setInterval !== 'undefined' && process.env.NODE_ENV !== 'test') {
  setInterval(evictStaleResults, EVICTION_INTERVAL_MS).unref?.();
}

// ── Test Utilities (exported for unit tests only) ─────────────────────────────

export function _resetQueueForTesting(): void {
  queue.length = 0;
  resultStore.clear();
  workerRunning = false;
  pistonCircuit.reset();
}

export function _getResultStoreSize(): number {
  return resultStore.size;
}
