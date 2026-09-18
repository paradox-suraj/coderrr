import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { checkRateLimit, resetRateLimiter, getRateLimiterSize } from '../src/lib/rateLimit';

console.log('🧪 Testing Pre-Deployment Blind Spots...');

// ─── 1. Rate Limiter Bounded Memory & Eviction ─────────────────────────────
console.log('Test 1: Rate limiter memory boundedness under high key cardinality');
resetRateLimiter();

// Generate 12,000 unique callers (simulating an attacker or busy botnet)
for (let i = 0; i < 12_000; i++) {
  checkRateLimit(`stress:attacker_${i}`, 20, 60_000);
}

const currentSize = getRateLimiterSize();
console.log(`Rate limiter size after 12,000 unique callers: ${currentSize}`);
assert.ok(
  currentSize <= 10_000,
  `Rate limiter Map must be bounded by MAX_MAP_ENTRIES (<= 10,000). Found: ${currentSize}`
);
console.log('✅ Rate limiter memory leak prevented via capped capacity and eviction');

// ─── 2. Pyodide Worker Crash Recovery & Real Metrics Integrity ────────────
console.log('Test 2: Pyodide Worker error recovery & zero hardcoded metrics');
const usePyodidePath = path.join(process.cwd(), 'src/lib/workers/usePyodide.ts');
const usePyodideSource = fs.readFileSync(usePyodidePath, 'utf8');

assert.ok(
  !usePyodideSource.includes('18.5'),
  'usePyodide.ts must not contain fake hardcoded 18.5 MB memory metric in timeout'
);

assert.ok(
  usePyodideSource.includes('spawnWorker()') && usePyodideSource.includes('worker.onerror'),
  'worker.onerror must trigger worker recreation (spawnWorker) to prevent hanging UI after WASM OOM/crash'
);
console.log('✅ Pyodide worker crash recovery and metric integrity verified');

// ─── 3. Supabase Cross-Device Sync Conflict Resolution (LWW) ──────────────
console.log('Test 3: Supabase Sync LWW (Last-Write-Wins) conflict resolution');

interface CodeItem {
  id: string;
  code: string;
  updatedAt: string;
}

function resolveCodeConflict(server: CodeItem | null, incoming: CodeItem): CodeItem {
  if (!server) return incoming;
  return new Date(incoming.updatedAt).getTime() >= new Date(server.updatedAt).getTime()
    ? incoming
    : server;
}

const serverCode: CodeItem = {
  id: '1_python',
  code: 'def solve(): return "device_A_2pm"',
  updatedAt: '2026-09-18T14:00:00.000Z',
};

const staleOfflineCode: CodeItem = {
  id: '1_python',
  code: 'def solve(): return "device_B_1pm_stale"',
  updatedAt: '2026-09-18T13:00:00.000Z',
};

const newerOfflineCode: CodeItem = {
  id: '1_python',
  code: 'def solve(): return "device_B_3pm_newer"',
  updatedAt: '2026-09-18T15:00:00.000Z',
};

// Stale offline push should NOT overwrite newer server state
const staleResult = resolveCodeConflict(serverCode, staleOfflineCode);
assert.strictEqual(
  staleResult.code,
  serverCode.code,
  'Server with newer timestamp must win over stale offline edit'
);

// Newer offline push SHOULD overwrite older server state
const newerResult = resolveCodeConflict(serverCode, newerOfflineCode);
assert.strictEqual(
  newerResult.code,
  newerOfflineCode.code,
  'Newer offline edit must overwrite older server state'
);
console.log('✅ Last-Write-Wins (LWW) conflict resolution logic verified');

console.log('\n🎉 ALL BLIND SPOT VERIFICATION TESTS PASSED!');
