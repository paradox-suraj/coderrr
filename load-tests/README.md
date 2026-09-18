# Load Testing — AlgoJeet Pro

## Prerequisites

Install [k6](https://k6.io/docs/get-started/installation/):

```bash
# macOS
brew install k6

# Ubuntu / Debian
sudo gpg -k
sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg \
  --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" \
  | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update && sudo apt-get install k6

# Windows
winget install k6 --source winget
```

## Running the Load Test

**Important**: Run against a staging/local server, never against production with real user traffic.

```bash
# Against local dev server
pnpm dev   # In one terminal

# In another terminal:
k6 run load-tests/execution.js --env BASE_URL=http://localhost:3000

# Against a staging URL
k6 run load-tests/execution.js --env BASE_URL=https://staging.algojeet.app
```

## What's Being Tested

The `execution.js` script spins up **50 virtual users for 60 seconds**. Each VU:

1. `POST /api/execute` with a simple C++ "Hello World" program
2. Polls `GET /api/execute/:jobId` every 1 s, up to 30 s
3. Records the time from submission to final result

## Acceptance Criteria

| Metric | Target |
|---|---|
| `time_to_result_ms` (p95) | < 15,000 ms |
| `http_req_failed` (non-4xx) | < 1% |
| `hung_polls` | 0 |

## Interpreting Results

```
✓ time_to_result_ms..........: avg=3212ms p(95)=9870ms
✓ http_req_failed............: 0.12%
✓ hung_polls.................: 0
✓ rate_limited...............: 47 (expected — rate limiter working)
```

- **`rate_limited`**: Expected — shows the rate limiter is working under load.
- **`sandbox_errors`**: Unexpected — check Piston availability and circuit breaker health via `GET /api/health/execution`.
- **`hung_polls`**: Must be 0. Any non-zero value means a job never resolved — investigate the queue worker.

## Simulating Piston Failure (Circuit Breaker Test)

Set `PISTON_URL` to an invalid endpoint to force sandbox failures:

```bash
PISTON_URL=http://localhost:9999/nonexistent pnpm dev
k6 run load-tests/execution.js --env BASE_URL=http://localhost:3000
```

After 3 failures, all new jobs should return `status:'failed'` within < 500 ms (circuit OPEN fast-fail).
Check `GET /api/health/execution` to confirm `circuit.state === "OPEN"`.

## Committing Results

After each run, save the summary:

```bash
k6 run load-tests/execution.js --env BASE_URL=http://localhost:3000 \
  --summary-export=load-tests/results/$(date +%Y%m%d_%H%M%S).json
```

This provides a baseline for regression comparisons on future deploys.
