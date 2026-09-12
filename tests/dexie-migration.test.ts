import 'fake-indexeddb/auto';
import { Dexie } from 'dexie';
import { AlgoJeetDB, ensureDbReady } from '../src/lib/db/index';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ Assertion Failed: ${message}`);
    process.exit(1);
  }
  console.log(`✅ ${message}`);
}

console.log('🧪 Testing Dexie Version Migration & Error Recovery...');

async function runTests() {
  // Test 1: Simulating an existing user on Version 1 with stored records
  const legacyDb = new Dexie('AlgoJeetDB_MigrationTest');
  legacyDb.version(1).stores({
    userProgress: '&problemId, status, nextReviewDate, lastSolved',
    userCode: '&problemId',
    sprints: '++id, date',
  });
  await legacyDb.open();
  await legacyDb.table('userProgress').put({
    problemId: '253',
    status: 'solved',
    revisions: 2,
    easeFactor: 2.6,
    intervalDays: 6,
    nextReviewDate: '2026-09-20T00:00:00.000Z',
    lastSolved: '2026-09-14T00:00:00.000Z',
  });
  await legacyDb.table('userCode').put({
    problemId: '253',
    code: 'class Solution: def minMeetingRooms(self): pass',
    notes: 'Use min-heap of end times',
    updatedAt: new Date().toISOString(),
  });
  await legacyDb.close();
  assert(true, 'Legacy version 1 DB populated with user progress and code');

  // Test 2: Upgrading using the two-step table recreation (v1 -> v2 tempUserCode -> v3 userCode)
  const upgradedDb = new Dexie('AlgoJeetDB_MigrationTest');
  upgradedDb.version(1).stores({
    userProgress: '&problemId, status, nextReviewDate, lastSolved',
    userCode: '&problemId',
    sprints: '++id, date',
  });
  upgradedDb.version(2).stores({
    userCode: null,
    tempUserCode: '&id, problemId, language',
  }).upgrade(async (tx) => {
    const oldRecords = await tx.table('userCode').toArray();
    for (const record of oldRecords) {
      await tx.table('tempUserCode').add({
        id: `${record.problemId}_python`,
        problemId: record.problemId,
        language: 'python',
        code: record.code,
        notes: record.notes,
        updatedAt: record.updatedAt || new Date().toISOString(),
      });
    }
  });
  upgradedDb.version(3).stores({
    tempUserCode: null,
    userCode: '&id, problemId, language',
  }).upgrade(async (tx) => {
    const tempRecords = await tx.table('tempUserCode').toArray();
    for (const record of tempRecords) {
      await tx.table('userCode').add(record);
    }
  });

  await upgradedDb.open();
  assert(upgradedDb.verno === 3, 'Database successfully upgraded to Version 3 without UpgradeError');

  // Verify data preservation
  const progressRecord = await upgradedDb.table('userProgress').get('253');
  assert(progressRecord && progressRecord.status === 'solved', 'userProgress preserved after v3 migration');

  const codeRecord = await upgradedDb.table('userCode').get('253_python');
  assert(codeRecord && codeRecord.code.includes('minMeetingRooms'), 'userCode preserved with composite key `253_python`');
  assert(codeRecord.notes === 'Use min-heap of end times', 'userCode notes preserved');

  await upgradedDb.close();

  // Test 3: ensureDbReady auto-recovery handles DatabaseClosedError / UpgradeError
  const testRecovery = await ensureDbReady();
  assert(testRecovery.isOpen(), 'ensureDbReady returns an active, open database connection');

  console.log('\n🎉 All Dexie Migration & Recovery Tests Passed Successfully!\n');
}

runTests().catch((err) => {
  console.error('❌ Migration test failed:', err);
  process.exit(1);
});
