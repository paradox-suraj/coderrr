/**
 * AlgoJeet Pro — Execution Pipeline Load Test (k6)
 *
 * Usage:
 *   k6 run load-tests/execution.js --env BASE_URL=http://localhost:3000
 *
 * Requirements: k6 >= 0.50   (https://k6.io/docs/get-started/installation/)
 *
 * What it tests:
 *   50 VUs × 60 s
 *   Each VU:
 *     1. POST /api/execute  → expect 202 (or 429 if rate-limited)
 *     2. Poll GET /api/execute/:jobId every 1 s until done/failed/timeout (30 s)
 *     3. Assert final status is 'done' or 'failed' (never a silent hang)
 *
 * Acceptance criteria:
 *   - p95 time-to-result < 15 s
 *   - HTTP error rate (non-429, non-503) < 1%
 *   - Zero hung polls (status never 'pending' after 30 s)
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend, Counter, Rate } from 'k6/metrics';

// ── Metrics ───────────────────────────────────────────────────────────────────
const timeToResult = new Trend('time_to_result_ms', true);
const hungPolls = new Counter('hung_polls');
const rateLimited = new Counter('rate_limited');
const sandboxErrors = new Counter('sandbox_errors');
const successRate = new Rate('success_rate');

// ── Config ────────────────────────────────────────────────────────────────────
export const options = {
  vus: 50,
  duration: '60s',
  thresholds: {
    'time_to_result_ms{p(95)}': ['value < 15000'],
    'http_req_failed': ['rate < 0.01'],   // < 1% non-4xx errors
    'hung_polls': ['count == 0'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

const CPP_CODE = `
#include <iostream>
using namespace std;
int main() {
  cout << "Hello from load test" << endl;
  return 0;
}
`.trim();

// ── Main VU function ──────────────────────────────────────────────────────────
export default function runExecutionScenario() {
  const startMs = Date.now();

  // Step 1: Submit job
  const submitRes = http.post(
    `${BASE_URL}/api/execute`,
    JSON.stringify({ language: 'cpp', code: CPP_CODE }),
    {
      headers: { 'Content-Type': 'application/json' },
      tags: { endpoint: 'submit' },
    }
  );

  if (submitRes.status === 429) {
    rateLimited.add(1);
    sleep(2);
    return;
  }

  if (submitRes.status === 503) {
    sandboxErrors.add(1);
    sleep(1);
    return;
  }

  const submitOk = check(submitRes, {
    'submit: status 202': (r) => r.status === 202,
    'submit: has jobId': (r) => {
      try { return Boolean(JSON.parse(r.body).jobId); } catch { return false; }
    },
  });

  if (!submitOk) {
    sandboxErrors.add(1);
    successRate.add(false);
    return;
  }

  const { jobId } = JSON.parse(submitRes.body);

  // Step 2: Poll for result
  const pollDeadline = Date.now() + 30_000;
  let finalStatus = null;

  while (Date.now() < pollDeadline) {
    sleep(1);
    const pollRes = http.get(`${BASE_URL}/api/execute/${jobId}`, {
      tags: { endpoint: 'poll' },
    });

    if (pollRes.status !== 200) continue;

    let body;
    try { body = JSON.parse(pollRes.body); } catch { continue; }

    if (body.status === 'pending' || body.status === 'running') continue;

    finalStatus = body.status;
    break;
  }

  const durationMs = Date.now() - startMs;

  if (!finalStatus) {
    // Timed out waiting — this is a hung poll
    hungPolls.add(1);
    successRate.add(false);
    return;
  }

  timeToResult.add(durationMs);
  successRate.add(finalStatus === 'done' || finalStatus === 'failed');
  sleep(0.5);
}
