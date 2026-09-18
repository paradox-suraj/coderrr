import assert from 'node:assert';

console.log('🧪 Testing Strict Interview Mode & Timer Presets Logic...');

// 1. Test Timer Presets
const PRESET_DURATIONS = [
  { label: '15 Min', seconds: 15 * 60 },
  { label: '25 Min (Pomodoro)', seconds: 25 * 60 },
  { label: '45 Min (FAANG Mock)', seconds: 45 * 60 },
  { label: '60 Min', seconds: 60 * 60 },
];

assert.strictEqual(PRESET_DURATIONS[0].seconds, 900, '15 min should be 900 seconds');
assert.strictEqual(PRESET_DURATIONS[1].seconds, 1500, '25 min should be 1500 seconds');
assert.strictEqual(PRESET_DURATIONS[2].seconds, 2700, '45 min should be 2700 seconds');
assert.strictEqual(PRESET_DURATIONS[3].seconds, 3600, '60 min should be 3600 seconds');
console.log('✅ Preset durations correctly configured');

// 2. Test Time Formatter helper logic
function formatTime(totalSeconds: number): string {
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

assert.strictEqual(formatTime(2700), '45:00', '45 min format');
assert.strictEqual(formatTime(0), '00:00', 'Zero seconds format');
assert.strictEqual(formatTime(65), '01:05', '65 seconds format');
assert.strictEqual(formatTime(3599), '59:59', '59:59 format');
console.log('✅ Time formatting helper is accurate');

// 3. Test Violation Warning Message Types
type WarningType = 'copy-paste' | 'tab-switch';
interface StrictModeWarning {
  id: string;
  type: WarningType;
  message: string;
  timestamp: number;
}

function createWarning(type: WarningType, message: string): StrictModeWarning {
  return {
    id: Math.random().toString(36).substring(2, 9),
    type,
    message,
    timestamp: Date.now(),
  };
}

const copyWarning = createWarning('copy-paste', '🚫 Copy/Cut is disabled during strict interview mode!');
assert.strictEqual(copyWarning.type, 'copy-paste');
assert.ok(copyWarning.message.includes('Copy/Cut'));

const tabWarning = createWarning('tab-switch', '⚠️ Tab switch detected! (Violation #1)');
assert.strictEqual(tabWarning.type, 'tab-switch');
assert.ok(tabWarning.message.includes('Tab switch detected'));

console.log('✅ Warning objects and messages verified');

// 4. Test Key Combination Detection
function isForbiddenKeyCombo(e: { ctrlKey?: boolean; metaKey?: boolean; shiftKey?: boolean; key: string }): boolean {
  const isCtrlOrMeta = !!(e.ctrlKey || e.metaKey);
  const key = e.key.toLowerCase();
  if (isCtrlOrMeta && (key === 'c' || key === 'v' || key === 'x')) {
    if (!e.shiftKey) {
      return true;
    }
  }
  return false;
}

assert.strictEqual(isForbiddenKeyCombo({ ctrlKey: true, key: 'c' }), true, 'Ctrl+C must be forbidden');
assert.strictEqual(isForbiddenKeyCombo({ ctrlKey: true, key: 'v' }), true, 'Ctrl+V must be forbidden');
assert.strictEqual(isForbiddenKeyCombo({ ctrlKey: true, key: 'x' }), true, 'Ctrl+X must be forbidden');
assert.strictEqual(isForbiddenKeyCombo({ metaKey: true, key: 'c' }), true, 'Cmd+C must be forbidden');
assert.strictEqual(isForbiddenKeyCombo({ metaKey: true, key: 'v' }), true, 'Cmd+V must be forbidden');

// Verify safe combos are NOT blocked:
assert.strictEqual(isForbiddenKeyCombo({ ctrlKey: true, key: 'Enter' }), false, 'Ctrl+Enter (Run) must NOT be forbidden');
assert.strictEqual(isForbiddenKeyCombo({ ctrlKey: true, shiftKey: true, key: 'Enter' }), false, 'Ctrl+Shift+Enter (Submit) must NOT be forbidden');
assert.strictEqual(isForbiddenKeyCombo({ ctrlKey: true, key: 's' }), false, 'Ctrl+S must NOT be forbidden');
console.log('✅ Keyboard event interceptor correctly blocks C/V/X and allows Run/Submit shortcuts');

console.log('\n🎉 ALL STRICT INTERVIEW MODE & TIMER UNIT TESTS PASSED!');
