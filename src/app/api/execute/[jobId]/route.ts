/**
 * GET /api/execute/[jobId]
 *
 * Polls the result of a code execution job.
 *
 * Response shape:
 *   { status: 'pending' }              — job is queued or running
 *   { status: 'done', result: {...} }  — execution complete
 *   { status: 'failed', error: '...' } — execution failed (with result stub)
 *
 * HTTP 404 if the jobId is unknown or has expired (> 5 min TTL).
 */

import { NextResponse } from 'next/server';
import { getJobResult } from '@/lib/execution/queue';

interface RouteParams {
  params: Promise<{ jobId: string }>;
}

export async function GET(_req: Request, { params }: RouteParams) {
  const { jobId } = await params;

  if (!jobId || typeof jobId !== 'string') {
    return NextResponse.json({ error: 'Missing jobId.' }, { status: 400 });
  }

  const job = getJobResult(jobId);

  if (!job) {
    return NextResponse.json(
      { error: 'Job not found. It may have expired (5 min TTL) or never existed.' },
      { status: 404 }
    );
  }

  // Always reflect correlationId for end-to-end tracing
  const headers = { 'X-Correlation-Id': job.correlationId };

  if (job.status === 'pending' || job.status === 'running') {
    return NextResponse.json({ status: job.status }, { status: 200, headers });
  }

  // done or failed — return the full result
  return NextResponse.json(
    {
      status: job.status,
      result: job.result,
      error: job.error,
      durationMs: job.completedAt ? job.completedAt - job.createdAt : undefined,
    },
    { status: 200, headers }
  );
}
