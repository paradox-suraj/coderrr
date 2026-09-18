/**
 * POST /api/execute
 *
 * Validates the request, applies rate limiting, enqueues the job,
 * and returns {jobId} with HTTP 202 immediately — never blocks on Piston.
 *
 * Client polls GET /api/execute/[jobId] for the result.
 */

import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { isClerkConfigured } from '@/lib/auth/clerkConfig';
import { checkRateLimit } from '@/lib/rateLimit';
import { enqueueJob, getQueueDepth } from '@/lib/execution/queue';
import { getCorrelationId, createLogger } from '@/lib/logger';
import { resolveCallerIdentity } from '@/lib/execution/identity';

const MAX_CODE_SIZE = 64 * 1024;       // 64 KB
const MAX_TEST_CASES = 20;
const MAX_EXPECTED_OUTPUT_SIZE = 10 * 1024; // 10 KB per test case

export async function POST(req: Request) {
  const correlationId = getCorrelationId(req.headers);
  const log = createLogger(correlationId);

  // ── Kill Switch ────────────────────────────────────────────────────────────
  if (process.env.EXECUTE_KILL_SWITCH === 'true' || process.env.DISABLE_EXECUTE_API === 'true') {
    log.warn('execute.kill_switch_active');
    return NextResponse.json(
      { error: 'Remote code execution is temporarily disabled.' },
      { status: 503 }
    );
  }

  // ── Identity & Rate Limiting ───────────────────────────────────────────────
  let verifiedUserId: string | null = null;
  if (isClerkConfigured()) {
    try {
      const session = await auth();
      verifiedUserId = session.userId;
    } catch {
      // Unauthenticated session
    }
  }

  const caller = resolveCallerIdentity(req, verifiedUserId);

  // Global concurrency / flood protection: 200 req/min system-wide
  const globalCheck = checkRateLimit('exec:global:ceiling', 200, 60_000);
  if (!globalCheck.allowed) {
    log.warn('rate_limit.global_ceiling_exceeded');
    return NextResponse.json(
      { error: 'Execution system is under heavy load. Please retry in a few seconds.' },
      { status: 429, headers: { 'Retry-After': '5' } }
    );
  }

  // Caller rate limit: 20 req/min for authenticated user, 8 req/min for IP
  const { allowed, retryAfterMs } = checkRateLimit(
    caller.rateLimitKey,
    caller.limitPerMinute,
    60_000
  );

  if (!allowed) {
    log.warn('rate_limit.exceeded', { key: caller.rateLimitKey, retryAfterMs });
    return NextResponse.json(
      { error: 'Too Many Requests — please slow down and retry shortly.' },
      {
        status: 429,
        headers: { 'Retry-After': String(Math.ceil(retryAfterMs / 1000)) },
      }
    );
  }

  // ── Body Parsing ───────────────────────────────────────────────────────────
  const bodyText = await req.text().catch(() => '');

  if (bodyText.length > MAX_CODE_SIZE) {
    log.warn('validation.code_too_large', { size: bodyText.length });
    return NextResponse.json(
      { error: `Code size (${bodyText.length} B) exceeds the 64 KB limit.` },
      { status: 413 }
    );
  }

  let body: { language?: unknown; code?: unknown; testCases?: unknown };
  try {
    body = JSON.parse(bodyText);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  // ── Input Validation ───────────────────────────────────────────────────────
  const { language, code, testCases } = body;

  if (language !== 'cpp' && language !== 'java') {
    return NextResponse.json(
      { error: 'Invalid language. Only "cpp" and "java" are supported by the cloud sandbox.' },
      { status: 400 }
    );
  }

  if (typeof code !== 'string' || code.trim().length === 0) {
    return NextResponse.json({ error: 'code must be a non-empty string.' }, { status: 400 });
  }

  if (testCases !== undefined) {
    if (!Array.isArray(testCases)) {
      return NextResponse.json({ error: 'testCases must be an array.' }, { status: 400 });
    }
    if (testCases.length > MAX_TEST_CASES) {
      return NextResponse.json(
        { error: `testCases array exceeds the ${MAX_TEST_CASES}-item limit.` },
        { status: 400 }
      );
    }
    for (const tc of testCases as Array<unknown>) {
      if (
        typeof tc !== 'object' ||
        tc === null ||
        typeof (tc as Record<string, unknown>).expectedOutput !== 'string' ||
        ((tc as Record<string, unknown>).expectedOutput as string).length > MAX_EXPECTED_OUTPUT_SIZE
      ) {
        return NextResponse.json(
          { error: 'Each testCase must have an expectedOutput string ≤ 10 KB.' },
          { status: 400 }
        );
      }
    }
  }

  // ── Queue Depth Check ──────────────────────────────────────────────────────
  const depth = getQueueDepth();
  if (depth >= 20) {
    log.warn('queue.full', { depth });
    return NextResponse.json(
      { error: 'Sandbox is temporarily busy. Please retry in a few seconds.' },
      { status: 503 }
    );
  }

  // ── Enqueue & Respond 202 ─────────────────────────────────────────────────
  let jobId: string;
  try {
    jobId = enqueueJob({
      language: language as 'cpp' | 'java',
      code: code as string,
      testCases: testCases as unknown[] | undefined,
      userId: caller.userId,
      correlationId,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Queue error';
    log.error('queue.enqueue_failed', { error: msg });
    return NextResponse.json({ error: msg }, { status: 503 });
  }

  log.info('job.accepted', { jobId, language, queueDepth: depth + 1 });

  return NextResponse.json(
    { jobId, message: 'Job accepted. Poll GET /api/execute/{jobId} for result.' },
    {
      status: 202,
      headers: {
        'X-Job-Id': jobId,
        'X-Correlation-Id': correlationId,
      },
    }
  );
}
