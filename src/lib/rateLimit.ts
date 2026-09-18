/**
 * Sliding-window rate limiter.
 *
 * Two independent windows are checked per call:
 *   1. Sustained window — e.g. 20 req / 60 s  (passed by caller)
 *   2. Burst window    — max 5 req / 5 s       (always applied; prevents tight loops)
 *
 * Both windows must pass for the request to be allowed.
 * The burst key is derived automatically from the caller's key.
 */

const rateLimiter = new Map<string, number[]>();

const BURST_WINDOW_MS = 5_000;  // 5 seconds
const BURST_MAX = 5;            // max 5 requests per burst window
const MAX_MAP_ENTRIES = 10_000; // Hard ceiling to prevent memory leaks from unbounded key creation
let operationCounter = 0;

export function getRateLimiterSize(): number {
  return rateLimiter.size;
}

export function checkRateLimit(
  key: string,
  maxRequests: number,
  windowMs: number
): { allowed: boolean; retryAfterMs: number } {
  const now = Date.now();

  // Periodic proactive eviction every 1,000 checks or when nearing capacity
  operationCounter++;
  if (operationCounter % 1_000 === 0 || rateLimiter.size >= MAX_MAP_ENTRIES) {
    cleanup(now);
  }

  // ── 1. Sustained window ────────────────────────────────────────────────────
  const sustainedResult = _checkWindow(`sustained:${key}`, maxRequests, windowMs, now);
  if (!sustainedResult.allowed) return sustainedResult;

  // ── 2. Burst window ────────────────────────────────────────────────────────
  const burstResult = _checkWindow(`burst:${key}`, BURST_MAX, BURST_WINDOW_MS, now);
  if (!burstResult.allowed) return burstResult;

  return { allowed: true, retryAfterMs: 0 };
}

function _checkWindow(
  storeKey: string,
  maxRequests: number,
  windowMs: number,
  now: number
): { allowed: boolean; retryAfterMs: number } {
  const windowStart = now - windowMs;
  let timestamps = rateLimiter.get(storeKey) || [];

  // Filter to current window
  timestamps = timestamps.filter((ts) => ts > windowStart);

  if (timestamps.length >= maxRequests) {
    const oldest = timestamps[0];
    const retryAfterMs = oldest - windowStart;
    return { allowed: false, retryAfterMs };
  }

  // Enforce bounded memory ceiling: evict oldest entry if capacity reached
  if (rateLimiter.size >= MAX_MAP_ENTRIES && !rateLimiter.has(storeKey)) {
    const oldestKey = rateLimiter.keys().next().value;
    if (oldestKey) rateLimiter.delete(oldestKey);
  }

  timestamps.push(now);
  rateLimiter.set(storeKey, timestamps);
  return { allowed: true, retryAfterMs: 0 };
}

export function cleanup(now = Date.now()): void {
  // Evict entries where all timestamps are older than 60 seconds (max window)
  const cutoff = now - 60_000;
  for (const [key, timestamps] of rateLimiter.entries()) {
    const valid = timestamps.filter((ts) => ts > cutoff);
    if (valid.length === 0) {
      rateLimiter.delete(key);
    } else {
      rateLimiter.set(key, valid);
    }
  }

  // If still above capacity during active traffic spike, trim down to 80% capacity
  if (rateLimiter.size >= MAX_MAP_ENTRIES) {
    const targetSize = Math.floor(MAX_MAP_ENTRIES * 0.8);
    const toRemove = rateLimiter.size - targetSize;
    let count = 0;
    for (const key of rateLimiter.keys()) {
      rateLimiter.delete(key);
      count++;
      if (count >= toRemove) break;
    }
  }
}

export function resetRateLimiter(): void {
  rateLimiter.clear();
  operationCounter = 0;
}
