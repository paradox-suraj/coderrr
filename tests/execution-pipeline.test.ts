/**
 * Unit tests — Execution Pipeline
 *
 * Tests:
 *   1. CircuitBreaker — state transitions, OPEN fast-fail, HALF_OPEN probe
 *   2. ExecutionQueue — enqueue, queue depth limit, result store, TTL concept
 *   3. Rate Limiter — burst window enforcement
 *
 * Run: tsx tests/execution-pipeline.test.ts
 */




import { CircuitBreaker, CircuitOpenError } from '../src/lib/execution/circuitBreaker';
import {
  enqueueJob,
  getJobResult,
  getQueueDepth,
  _resetQueueForTesting,
  _getResultStoreSize,
} from '../src/lib/execution/queue';
import { checkRateLimit, resetRateLimiter } from '../src/lib/rateLimit';

// ── Helpers ──────────────────────────────────────────────────────────────────

let pass = 0;
let fail = 0;

function assert(condition: boolean, label: string): void {
  if (condition) {
    console.log(`  ✓ ${label}`);
    pass++;
  } else {
    console.error(`  ✗ ${label}`);
    fail++;
  }
}

function assertEqual<T>(actual: T, expected: T, label: string): void {
  assert(actual === expected, `${label} (expected: ${JSON.stringify(expected)}, got: ${JSON.stringify(actual)})`);
}

async function assertThrowsAsync(
  fn: () => Promise<unknown>,
  errorType: new (...args: any[]) => any,
  label: string
): Promise<void> {
  try {
    await fn();
    console.error(`  ✗ ${label} — expected throw but didn't`);
    fail++;
  } catch (e) {
    if (e instanceof errorType) {
      console.log(`  ✓ ${label}`);
      pass++;
    } else {
      console.error(`  ✗ ${label} — wrong error type: ${(e as Error).name}: ${(e as Error).message}`);
      fail++;
    }
  }
}

async function main() {

// ── Test: CircuitBreaker ──────────────────────────────────────────────────────

console.log('\n── CircuitBreaker ──');

{
  const cb = new CircuitBreaker({ failureThreshold: 3, recoveryTimeoutMs: 50_000 });

  // Starts CLOSED
  assertEqual(cb.getHealth().state, 'CLOSED', 'Starts CLOSED');
  assertEqual(cb.getHealth().failureCount, 0, 'Initial failure count 0');

  // Successful call
  const result = await cb.call(async () => 42);
  assertEqual(result, 42, 'Passes through return value');
  assertEqual(cb.getHealth().successCount, 1, 'Counts successes');

  // Two failures — stays CLOSED (threshold is 3)
  const failFn = async () => { throw new Error('simulated failure'); };
  try { await cb.call(failFn); } catch {}
  try { await cb.call(failFn); } catch {}
  assertEqual(cb.getHealth().state, 'CLOSED', 'Stays CLOSED before threshold');
  assertEqual(cb.getHealth().failureCount, 2, 'Failure count is 2');

  // Third failure — opens circuit
  try { await cb.call(failFn); } catch {}
  assertEqual(cb.getHealth().state, 'OPEN', 'Opens after 3rd failure');

  // Now it should fast-fail
  await assertThrowsAsync(
    () => cb.call(async () => 'should not run'),
    CircuitOpenError,
    'Fast-fails with CircuitOpenError when OPEN'
  );
  assertEqual(cb.getHealth().totalCalls, 5, 'totalCalls tracked (1 success + 3 failures + 1 fast-fail)');
}

// HALF_OPEN transition
{
  const cb = new CircuitBreaker({ failureThreshold: 1, recoveryTimeoutMs: 0 });
  try { await cb.call(async () => { throw new Error('fail'); }); } catch {}
  assertEqual(cb.getHealth().state, 'OPEN', 'OPEN after 1 failure (threshold=1)');

  // recoveryTimeoutMs=0 so next call should move to HALF_OPEN immediately
  await cb.call(async () => 'probe success').catch(() => {});
  const state = cb.getHealth().state;
  assert(state === 'CLOSED', `HALF_OPEN probe success → CLOSED (state: ${state})`);
}

// HALF_OPEN probe failure → re-OPEN
{
  const cb = new CircuitBreaker({ failureThreshold: 1, recoveryTimeoutMs: 0 });
  try { await cb.call(async () => { throw new Error('fail'); }); } catch {}

  // Probe fails → OPEN again
  try { await cb.call(async () => { throw new Error('probe fail'); }); } catch {}
  assertEqual(cb.getHealth().state, 'OPEN', 'HALF_OPEN probe fail → re-OPEN');
}

// ── Test: ExecutionQueue ──────────────────────────────────────────────────────

console.log('\n── ExecutionQueue ──');

_resetQueueForTesting();

{
  const jobId = enqueueJob({
    language: 'cpp',
    code: 'int main() { return 0; }',
    correlationId: 'test-corr-1',
  });
  assert(typeof jobId === 'string' && jobId.length > 10, 'enqueueJob returns a UUID string');

  const result = getJobResult(jobId);
  assert(result !== null, 'Result immediately available after enqueue');
  assertEqual(result?.status, 'pending', 'Initial status is pending');
  assertEqual(result?.correlationId, 'test-corr-1', 'correlationId stored');

  _resetQueueForTesting();
}

// Queue depth check
{
  _resetQueueForTesting();

  // Fill the queue with 20 jobs
  for (let i = 0; i < 20; i++) {
    enqueueJob({
      language: 'java',
      code: 'class Main {}',
      correlationId: `test-${i}`,
    });
  }
  assertEqual(getQueueDepth(), 20, 'Queue depth is 20 after 20 enqueues');

  // 21st job should throw
  let threw = false;
  try {
    enqueueJob({ language: 'cpp', code: 'x', correlationId: 'overflow' });
  } catch {
    threw = true;
  }
  assert(threw, '21st enqueue throws when queue is full');

  _resetQueueForTesting();
}

// Result store independence
{
  _resetQueueForTesting();
  const id1 = enqueueJob({ language: 'cpp', code: 'a', correlationId: 'c1' });
  const id2 = enqueueJob({ language: 'java', code: 'b', correlationId: 'c2' });
  assert(id1 !== id2, 'Each job gets a unique ID');
  assertEqual(_getResultStoreSize(), 2, 'Result store has 2 entries');
  _resetQueueForTesting();
  assertEqual(_getResultStoreSize(), 0, 'Reset clears result store');
}

// Unknown jobId
{
  const result = getJobResult('nonexistent-id-12345');
  assert(result === null, 'getJobResult returns null for unknown jobId');
}

// ── Test: Rate Limiter (burst window) ──────────────────────────────────────────

console.log('\n── Rate Limiter (burst window) ──');

{
  resetRateLimiter();

  // First 5 rapid calls should be allowed
  for (let i = 0; i < 5; i++) {
    const { allowed } = checkRateLimit('test-burst', 100, 60_000);
    assert(allowed, `Call ${i + 1} allowed (within burst limit)`);
  }

  // 6th rapid call should be blocked by burst window
  const { allowed, retryAfterMs } = checkRateLimit('test-burst', 100, 60_000);
  assert(!allowed, '6th call blocked by burst window');
  assert(retryAfterMs > 0, 'retryAfterMs > 0 for blocked call');

  resetRateLimiter();
}

// Sustained window
{
  resetRateLimiter();

  for (let i = 0; i < 3; i++) {
    checkRateLimit('test-sustained', 3, 60_000);
  }
  const { allowed } = checkRateLimit('test-sustained', 3, 60_000);
  assert(!allowed, '4th call blocked by sustained window (max 3)');

  resetRateLimiter();
}

// Different keys are independent
{
  resetRateLimiter();
  for (let i = 0; i < 5; i++) {
    checkRateLimit('key-a', 100, 60_000);
  }
  const { allowed } = checkRateLimit('key-b', 100, 60_000);
  assert(allowed, 'Different keys are independent');
  resetRateLimiter();
}

// ── Summary ──────────────────────────────────────────────────────────────────

  console.log(`\nExecution Pipeline Tests: ${pass} passed, ${fail} failed\n`);
  if (fail > 0) process.exit(1);

} // end main()

main().catch((err) => { console.error(err); process.exit(1); });
