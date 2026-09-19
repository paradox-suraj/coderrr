import 'fake-indexeddb/auto';
import { Dexie } from 'dexie';
import {
  db,
  ensureDbReady,
  upsertProblemProgress,
  saveProblemCode,
  getProblemProgress,
  getProblemCode,
  exportDatabaseToJson,
  importDatabaseFromJson
} from '../src/lib/db/index';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ Assertion Failed: ${message}`);
    process.exit(1);
  }
  console.log(`✅ ${message}`);
}

console.log('🧪 Testing Data Loss Prevention, Specialized Error Handling & Portability...');

async function testComprehensiveDataSafety() {
  // ── Step 1: Seed Initial User Data ──────────────────────────────────────────
  await ensureDbReady();
  await upsertProblemProgress({
    problemId: '42',
    status: 'solved',
    revisions: 3,
    easeFactor: 2.6,
    intervalDays: 6,
    nextReviewDate: '2026-09-25T00:00:00.000Z',
    lastSolved: '2026-09-18T00:00:00.000Z',
  });
  await saveProblemCode('42', 'def trappingRainWater(): pass', 'python', 'Dynamic programming memoization');

  const initialProgress = await getProblemProgress('42');
  const initialCode = await getProblemCode('42', 'python');
  assert(initialProgress?.status === 'solved', 'Initial progress record seeded');
  assert(initialCode?.notes === 'Dynamic programming memoization', 'Initial code record seeded');

  // ── Step 2: Test DatabaseClosedError (transient error with retry) ───────────
  console.log('\n--- Testing DatabaseClosedError Non-Destructive Recovery ---');
  let closedSimulated = false;
  const origOpen = db.open.bind(db);

  (db as any).open = async () => {
    if (!closedSimulated) {
      closedSimulated = true;
      const closedErr: any = new Error('Database is closed');
      closedErr.name = 'DatabaseClosedError';
      throw closedErr;
    }
    return origOpen();
  };

  db.close();
  await ensureDbReady();
  (db as any).open = origOpen;

  const afterClosedProgress = await db.userProgress.get('42');
  assert(afterClosedProgress?.status === 'solved', 'Records survive DatabaseClosedError without deletion');

  // ── Step 3: Test VersionError (multi-tab schema mismatch) ────────────────────
  console.log('\n--- Testing VersionError Non-Destructive Handling ---');
  let versionSimulated = false;
  (db as any).open = async () => {
    if (!versionSimulated) {
      versionSimulated = true;
      const versionErr: any = new Error('Database version error');
      versionErr.name = 'VersionError';
      throw versionErr;
    }
    return origOpen();
  };

  db.close();
  await ensureDbReady();
  (db as any).open = origOpen;

  await ensureDbReady(); // Reconnect
  const afterVersionProgress = await db.userProgress.get('42');
  assert(afterVersionProgress?.status === 'solved', 'Records survive VersionError without deletion');

  // ── Step 4: Test BlockedError (another tab holding old lock) ─────────────────
  console.log('\n--- Testing BlockedError Non-Destructive Handling ---');
  let blockedSimulated = false;
  (db as any).open = async () => {
    if (!blockedSimulated) {
      blockedSimulated = true;
      const blockedErr: any = new Error('Database upgrade blocked');
      blockedErr.name = 'BlockedError';
      throw blockedErr;
    }
    return origOpen();
  };

  db.close();
  await ensureDbReady();
  (db as any).open = origOpen;

  await ensureDbReady(); // Reconnect
  const afterBlockedProgress = await db.userProgress.get('42');
  assert(afterBlockedProgress?.status === 'solved', 'Records survive BlockedError without deletion');

  // ── Step 5: Test UpgradeError (quarantine instead of deletion) ───────────────
  console.log('\n--- Testing UpgradeError Non-Destructive Quarantine ---');
  let upgradeSimulated = false;
  (db as any).open = async () => {
    if (!upgradeSimulated) {
      upgradeSimulated = true;
      const upgradeErr: any = new Error('Schema upgrade failed');
      upgradeErr.name = 'UpgradeError';
      throw upgradeErr;
    }
    return origOpen();
  };

  db.close();
  await ensureDbReady();
  (db as any).open = origOpen;

  await ensureDbReady(); // Reconnect
  const afterUpgradeProgress = await db.userProgress.get('42');
  const afterUpgradeCode = await db.userCode.get('42_python');
  assert(afterUpgradeProgress?.status === 'solved', 'Records survive UpgradeError: Dexie.delete() was NOT called');
  assert(afterUpgradeCode !== undefined, 'User code survives UpgradeError');

  // ── Step 6: Test Data Export & Import (Portability & Safety Insurance) ──────
  console.log('\n--- Testing Full JSON Export & Import Insurance ---');
  const exportedJson = await exportDatabaseToJson();
  assert(typeof exportedJson === 'string', 'Export produced JSON string');
  assert(exportedJson.includes('"formatVersion": 1'), 'Export contains format metadata');
  assert(exportedJson.includes('trappingRainWater'), 'Export contains user code');

  // Import into a fresh isolated Dexie database
  const targetDb = new Dexie('AlgoJeetDB_ImportVerify') as any;
  targetDb.version(1).stores({
    userProgress: '&problemId, status, nextReviewDate, lastSolved',
    userCode: '&id, problemId, language',
    sprints: '++id, date',
  });
  await targetDb.open();

  const importResult = await importDatabaseFromJson(exportedJson, targetDb);
  assert(importResult.progressCount >= 1, 'Imported at least 1 progress record');
  assert(importResult.codeCount >= 1, 'Imported at least 1 code record');

  const importedProgress = await targetDb.table('userProgress').get('42');
  const importedCode = await targetDb.table('userCode').get('42_python');
  assert(importedProgress?.status === 'solved', 'Imported progress record matches original');
  assert(importedCode?.code.includes('trappingRainWater'), 'Imported code matches original');

  await targetDb.delete();

  console.log('\n🎉 ALL Zero-Destruction & Data Portability Gates PASSED!\n');
}

testComprehensiveDataSafety().catch((err) => {
  console.error('Data Safety Test Failure:', err);
  process.exit(1);
});
