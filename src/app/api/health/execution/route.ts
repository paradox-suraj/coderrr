import { NextResponse } from 'next/server';
import { pistonCircuit, getQueueDepth, isWorkerBusy } from '@/lib/execution/queue';

/**
 * GET /api/health/execution
 * Execution subsystem health: circuit breaker state, queue depth, worker status.
 * Used by CI/CD health gates.
 */
export async function GET() {
  const circuitHealth = pistonCircuit.getHealth();
  const queueDepth = getQueueDepth();
  const workerBusy = isWorkerBusy();

  const ok = circuitHealth.state !== 'OPEN';

  return NextResponse.json(
    {
      ok,
      ts: new Date().toISOString(),
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
