import { NextResponse } from 'next/server';
import { pistonCircuit, getQueueDepth, isWorkerBusy } from '@/lib/execution/queue';
import { getPistonStatus } from '@/lib/execution/pistonConfig';

/**
 * GET /api/health/execution
 * Execution subsystem health: circuit breaker state, queue depth, worker status,
 * and Piston runner capabilities.
 */
export async function GET() {
  const circuitHealth = pistonCircuit.getHealth();
  const queueDepth = getQueueDepth();
  const workerBusy = isWorkerBusy();
  const pistonStatus = getPistonStatus();

  const ok = circuitHealth.state !== 'OPEN';

  return NextResponse.json(
    {
      ok,
      ts: new Date().toISOString(),
      piston: {
        configured: pistonStatus.configured,
        endpoint: pistonStatus.endpoint,
        hasKey: pistonStatus.hasKey,
        reason: pistonStatus.reason,
      },
      supportedLanguages: pistonStatus.supportedLanguages,
      circuit: {
        state: circuitHealth.state,
        failureCount: circuitHealth.failureCount,
        lastFailureAt: circuitHealth.lastFailureAt
          ? new Date(circuitHealth.lastFailureAt).toISOString()
          : null,
        totalCalls: circuitHealth.totalCalls,
        totalFailures: circuitHealth.totalFailures,
      },
      queue: {
        depth: queueDepth,
        workerBusy,
      },
    },
    { status: ok ? 200 : 503 }
  );
}
