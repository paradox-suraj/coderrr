import { NextResponse } from 'next/server';

/**
 * GET /api/health
 * Basic liveness check. Returns 200 if the server is running.
 */
export async function GET() {
  return NextResponse.json({
    ok: true,
    service: 'algojeet-pro',
    ts: new Date().toISOString(),
  });
}
