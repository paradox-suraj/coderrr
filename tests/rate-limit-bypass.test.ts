import { checkRateLimit } from '../src/lib/rateLimit';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ Assertion Failed: ${message}`);
    process.exit(1);
  }
  console.log(`✅ ${message}`);
}

console.log('🧪 Testing Rate Limit Bypass Vulnerability...');

// Helper to simulate endpoint key derivation in current code vs fixed code
function deriveKeyPreFix(headers: Record<string, string>): string {
  const userId = headers['x-user-id'];
  const ip = headers['x-forwarded-for'] || '127.0.0.1';
  return userId ? `exec:user:${userId}` : `exec:ip:${ip}`;
}

// 1. In pre-fix code, an attacker rotates x-user-id on each request
let preFixBlocked = false;
for (let i = 0; i < 50; i++) {
  const fakeUserId = `attacker-bot-${i}`;
  const key = deriveKeyPreFix({ 'x-user-id': fakeUserId, 'x-forwarded-for': '198.51.100.1' });
  const { allowed } = checkRateLimit(key, 8, 60_000);
  if (!allowed) {
    preFixBlocked = true;
    break;
  }
}

// In the pre-fix code, ALL 50 requests are allowed because each fake user ID gets its own bucket!
console.log('Pre-fix test: Was attacker blocked while rotating x-user-id?', preFixBlocked);
assert(
  !preFixBlocked,
  'Pre-fix confirmed: Rotating x-user-id allows unlimited requests (0 blocked out of 50)'
);

// 2. Post-fix regression test:
// Import the hardened route resolver or simulate hardened server-side identity derivation
import { resolveCallerIdentity } from '../src/lib/execution/identity';

let postFixBlockedCount = 0;
// With the hardened identity resolver, forged x-user-id is ignored and mapped to IP
for (let i = 0; i < 20; i++) {
  const fakeUserId = `attacker-bot-${i}`;
  const req = new Request('http://localhost:3000/api/execute', {
    method: 'POST',
    headers: {
      'x-user-id': fakeUserId,
      'x-forwarded-for': '203.0.113.42',
    },
  });
  
  // Note: authSession is null for unauthenticated client
  const identity = resolveCallerIdentity(req, null);
  const { allowed } = checkRateLimit(identity.rateLimitKey, 8, 60_000);
  if (!allowed) {
    postFixBlockedCount++;
  }
}

assert(
  postFixBlockedCount > 0,
  `Post-fix gate: Forged x-user-id MUST NOT bypass rate limit! Blocked requests: ${postFixBlockedCount}/20`
);

console.log('🎉 Rate Limit Bypass Prevention Verified!');
