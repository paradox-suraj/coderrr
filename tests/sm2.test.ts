import { calculateSM2 } from '../src/lib/db/sm2';
import { AlgoJeetDB } from '../src/lib/db/index';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ Assertion Failed: ${message}`);
    process.exit(1);
  }
  console.log(`✅ ${message}`);
}

console.log('🧪 Testing SM-2 Algorithm & DB Models...');

// 1. Initial review with perfect recall (quality 5)
const step1 = calculateSM2(5, 2.5, 0, 0);
assert(step1.repetitions === 1, 'Repetition count is 1 after first success');
assert(step1.intervalDays === 1, 'First interval is 1 day');
assert(step1.easeFactor === 2.6, 'Ease factor increased from 2.5 to 2.6 on quality 5');

// 2. Second review with good recall (quality 4)
const step2 = calculateSM2(4, step1.easeFactor, step1.intervalDays, step1.repetitions);
assert(step2.repetitions === 2, 'Repetition count is 2 after second success');
assert(step2.intervalDays === 6, 'Second interval is 6 days');
assert(step2.easeFactor === 2.6, 'Ease factor remains unchanged on quality 4');

// 3. Third review with quality 5
const step3 = calculateSM2(5, step2.easeFactor, step2.intervalDays, step2.repetitions);
assert(step3.repetitions === 3, 'Repetition count is 3 after third success');
assert(step3.intervalDays === Math.round(6 * 2.6), `Third interval multiplied by EF (${Math.round(6 * 2.6)} days)`);

// 4. Lapse test (quality < 3)
const lapse = calculateSM2(2, step3.easeFactor, step3.intervalDays, step3.repetitions);
assert(lapse.repetitions === 0, 'Repetitions reset to 0 upon lapse');
assert(lapse.intervalDays === 1, 'Interval reset to 1 day upon lapse');
assert(lapse.easeFactor < step3.easeFactor, 'Ease factor drops on lapse');

// 5. Minimum ease factor clamp (1.3)
const clamped = calculateSM2(0, 1.3, 10, 3);
assert(clamped.easeFactor === 1.3, 'Ease factor is clamped at minimum 1.3');

// 6. DB instantiation smoke test
const testDb = new AlgoJeetDB();
assert(testDb.name === 'AlgoJeetDB', 'AlgoJeetDB instantiates with correct name');
assert(testDb.tables.length === 3, 'AlgoJeetDB configures 3 stores (userProgress, userCode, sprints)');

console.log('\n🎉 All SM-2 and DB model tests passed successfully!\n');
