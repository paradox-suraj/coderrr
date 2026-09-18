/**
 * Execution Route Caller Identity & Rate Limit Key Resolver
 *
 * Securely derives caller identity without trusting client-supplied headers.
 * Never reads or trusts `x-user-id` from HTTP request headers.
 */

export interface CallerIdentity {
  userId?: string;
  clientIp: string;
  isAnonymous: boolean;
  rateLimitKey: string;
  limitPerMinute: number;
}

/**
 * Extracts the trusted client IP from reverse proxy headers.
 * Takes the leftmost IP from x-forwarded-for (the client IP), sanitized.
 */
export function getTrustedClientIp(headers: Headers): string {
  const forwardedFor = headers.get('x-forwarded-for');
  if (forwardedFor) {
    const firstIp = forwardedFor.split(',')[0].trim();
    if (firstIp && !firstIp.includes('/') && firstIp.length <= 45) {
      return firstIp;
    }
  }

  const realIp = headers.get('x-real-ip');
  if (realIp && realIp.trim().length <= 45) {
    return realIp.trim();
  }

  return '127.0.0.1';
}

/**
 * Resolves caller identity strictly from verified server auth and trusted IP.
 * Any client-passed `x-user-id` header is discarded.
 */
export function resolveCallerIdentity(
  req: Request,
  verifiedUserId: string | null | undefined
): CallerIdentity {
  const clientIp = getTrustedClientIp(req.headers);

  if (verifiedUserId && typeof verifiedUserId === 'string' && verifiedUserId.trim().length > 0) {
    return {
      userId: verifiedUserId.trim(),
      clientIp,
      isAnonymous: false,
      rateLimitKey: `exec:user:${verifiedUserId.trim()}`,
      limitPerMinute: 20,
    };
  }

  // Anonymous caller: strictly bound to trusted client IP
  return {
    userId: undefined,
    clientIp,
    isAnonymous: true,
    rateLimitKey: `exec:ip:${clientIp}`,
    limitPerMinute: 8,
  };
}
