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

export function checkRateLimit(
  key: string,
  maxRequests: number,
  windowMs: number
): { allowed: boolean; retryAfterMs: number } {
  const now = Date.now();

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

  timestamps.push(now);
  rateLimiter.set(storeKey, timestamps);
  return { allowed: true, retryAfterMs: 0 };
}

export function cleanup(): void {
  const now = Date.now();
  for (const [key, timestamps] of rateLimiter.entries()) {
    const valid = timestamps.filter((ts) => ts > now - 3_600_000);
    if (valid.length === 0) {
      rateLimiter.delete(key);
    } else {
      rateLimiter.set(key, valid);
    }
  }
}

export function resetRateLimiter(): void {
  rateLimiter.clear();
}
