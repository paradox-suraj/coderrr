# AlgoJeet Pro — Architecture & Design Document

This document records every significant architectural decision, trade-off, and rollback plan.
Updated before each implementation, per project rules.

---

## Execution Pipeline (Phase 1)

### As-built (September 2026)

```
Browser (C++/Java click Run)
  │
  ├─ POST /api/execute
  │    ├─ Rate limit check (sliding window: 20 req/min auth, 8 anon + burst 5/5s)
  │    ├─ Input validation (size, language, testCases)
  │    ├─ Queue depth check (max 20 pending)
  │    ├─ enqueueJob() → returns jobId immediately
  │    └─ 202 Accepted { jobId }
  │
  ├─ In-process queue (src/lib/execution/queue.ts)
  │    ├─ FIFO, max 20 pending jobs
  │    ├─ One worker processes jobs sequentially
  │    ├─ Results stored in Map<jobId, JobResult> with 5 min TTL
  │    └─ Auto-eviction every 60 s
  │
  ├─ Circuit Breaker (src/lib/execution/circuitBreaker.ts)
  │    ├─ CLOSED → OPEN after 3 consecutive Piston failures
  │    ├─ OPEN → HALF_OPEN after 30 s
  │    └─ HALF_OPEN → CLOSED after one successful probe
  │
  ├─ Piston Sandbox (external HTTPS)
  │    ├─ Hard timeout: 10 s (AbortController)
  │    └─ Languages: C++ (GCC 10.2), Java (OpenJDK 15)
  │
  └─ GET /api/execute/:jobId (polling, 1 s interval, 30 s client timeout)
       └─ { status: 'pending'|'running'|'done'|'failed', result? }
```

### Trade-offs

| Choice | Rationale |
|---|---|
| In-process queue | No external infra required. Replaceable with Upstash Redis by swapping `queue.ts` alone — API contract unchanged. |
| Polling (not SSE) | SSE keeps connections open; polling is simpler and sufficient at current scale. |
| Result in `Map` | Results are ephemeral; durability not required. Survives process restarts by failing fast (client retries). |
| Sequential worker | Avoids overloading Piston. Configurable to N-concurrent in the future by replacing `workerRunning` bool with a semaphore. |

### Rollback Plan

If Phase 1 must be reverted:

1. `git revert <sha-of-phase-1-commit>`
2. Push to `main` — CI/CD will rebuild.
3. The old blocking `route.ts` will restore automatically.
4. No database migration is needed (result store is in-memory only).

---

## Rate Limiting (Phase 1 + Phase 3)

Two-window sliding limiter per key:

| Window | Execute (auth) | Execute (anon) | Sync |
|---|---|---|---|
| Sustained (60 s) | 20 req | 8 req | 30 req |
| Burst (5 s) | 5 req | 5 req | 5 req |

Implemented in-memory (`src/lib/rateLimit.ts`). Resets on process restart — acceptable for a single-server deployment. For multi-replica, replace with Upstash Redis via `@upstash/ratelimit`.

---

## Observability (Phase 2)

**Structured JSON logging**: every API route emits JSON log lines with:
- `ts` — ISO 8601 timestamp
- `level` — `info` | `warn` | `error`
- `event` — dot-notation event name (e.g. `job.start`, `job.done`)
- `correlationId` — threaded from `x-request-id` header (or auto-generated UUID)
- Additional context fields per event

**Health endpoints**:
- `GET /api/health` — liveness (returns 200 if server is running)
- `GET /api/health/execution` — circuit state + queue depth; returns 503 when circuit OPEN

**Error tracking**: Console-based structured logging only. No external service dependency. To add Sentry: install `@sentry/nextjs`, create `sentry.{server,client,edge}.config.ts`, and set `SENTRY_DSN` env var.

---

## Data Durability (Phase 6)

### Sync Architecture

```
Browser (Dexie IndexedDB)  ←→  POST/GET /api/sync  ←→  Supabase Postgres
```

**Strategy**: last-write-wins on `updatedAt` / `lastSolved` timestamps.
- On sign-in: pull server → merge into Dexie (server wins if newer).
- After each solve: push Dexie → upsert to Supabase.
- Tables: `user_progress`, `user_code`, `sprints` (see `supabase/migrations/001_initial.sql`).

### Backups

**Free tier** (current): Supabase provides daily automated pg_dump backups with 7-day retention.
To restore: contact Supabase support or use the dashboard "Restore" button.

**Pro tier**: Enables point-in-time recovery (PITR) with up to 28-day retention.
To restore: `supabase db restore --target <ISO-timestamp>`.

### Test Restore Checklist

Run monthly:
1. Create a second Supabase project ("restore-test").
2. Apply schema: `psql -f supabase/migrations/001_initial.sql`.
3. Import the latest backup dump.
4. Point the app at the test project (swap `SUPABASE_URL`).
5. Sign in → verify progress, code, and sprints are visible.
6. Delete the test project.

---

## Deployment (Phase 5)

**CI**: GitHub Actions (`.github/workflows/ci-cd.yml`)
- Jobs: lint → typecheck → test → build (all must pass before merge to `main`)
- Health-check job stubbed — activate when a staging URL exists

**Rollback Procedure**:
1. Identify the last good commit: `git log --oneline`.
2. Option A — fast: Vercel dashboard → "Instant Rollback" to previous deployment.
3. Option B — code: `git revert <bad-sha>` → push → CI rebuilds and redeploys.
4. Database: no schema migration is required for execution-pipeline changes. For Supabase schema changes, reverse the migration SQL manually.

---

## Sitemap & SEO (Phase 7)

- `src/app/sitemap.ts` — full sitemap: 654 company pages + top 500 problems + static routes.
- `src/app/robots.ts` — allows all crawlers, disallows `/api/` and auth pages.
- Per-page OG metadata: already in place on `/problem/[id]` and `/companies/[slug]`.

---

## Accessibility (Phase 7)

WCAG 2.1 Level AA compliance enforced via:
- `e2e/a11y.spec.ts` — Playwright + `@axe-core/playwright` audit on 7 pages.
- Run: `pnpm e2e -- --project=chromium e2e/a11y.spec.ts`
- Monaco Editor is excluded from automated axe scans (known limitations); review manually.

---

## Open Known Issues

| # | Issue | Status |
|---|---|---|
| 1 | In-process queue resets on server restart — pending jobs lost | Acceptable for single-server; switch to Redis for multi-replica |
| 2 | Rate limiter state resets on process restart | Same as above |
| 3 | Piston public endpoint requires whitelisting since Feb 2026 | Documented in the app UI; self-host instructions provided |
