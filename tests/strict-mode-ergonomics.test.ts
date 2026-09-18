import assert from 'node:assert';
import {
  evaluateFocusSwitch,
  isClipboardBlocked,
  formatSimulationWarning,
} from '../src/lib/hooks/useStrictInterviewMode';

console.log('🧪 Testing LOW-01: Strict Interview Mode Reframing & Ergonomics...');

// 1. Test Grace Period & Debounced Focus Switching
console.log('Test 1: Focus switch grace period verification (>= 500ms)');

// A quick switch (e.g. 250ms notification or alt-tab preview) should NOT trigger
const shortSwitch = evaluateFocusSwitch({
  blurDurationMs: 250,
  gracePeriodMs: 750,
  lastAlertElapsedMs: 5000,
});
assert.strictEqual(
  shortSwitch.shouldAlert,
  false,
  'Quick switch (< 750ms) must be ignored to prevent false positives from OS notifications or window manager focus'
);

// A legitimate window switch (e.g. 2000ms) should trigger
const legitimateSwitch = evaluateFocusSwitch({
  blurDurationMs: 2000,
  gracePeriodMs: 750,
  lastAlertElapsedMs: 5000,
});
assert.strictEqual(
  legitimateSwitch.shouldAlert,
  true,
  'Switch >= 750ms must trigger a simulation note'
);

// Rapid successive switch events within debounce window (< 1000ms since last alert) should not double-count
const debouncedSwitch = evaluateFocusSwitch({
  blurDurationMs: 1500,
  gracePeriodMs: 750,
  lastAlertElapsedMs: 400,
});
assert.strictEqual(
  debouncedSwitch.shouldAlert,
  false,
  'Rapid successive switch events must be debounced to prevent duplicate warnings'
);
console.log('✅ Focus switch debouncing and grace period logic verified');

// 2. Test Opt-in Clipboard Restrictions
console.log('Test 2: Opt-in clipboard restriction');

// Default behavior: strict mode enabled, but clipboard blocking NOT opted-in
assert.strictEqual(
  isClipboardBlocked({ strictModeEnabled: true, blockClipboard: false }),
  false,
  'Clipboard must NOT be blocked by default when strict mode is active'
);

// When explicitly opted in:
assert.strictEqual(
  isClipboardBlocked({ strictModeEnabled: true, blockClipboard: true }),
  true,
  'Clipboard should only be blocked when blockClipboard is explicitly opted in'
);

// When strict mode itself is disabled:
assert.strictEqual(
  isClipboardBlocked({ strictModeEnabled: false, blockClipboard: true }),
  false,
  'Clipboard must not be blocked when strict mode is off'
);
console.log('✅ Opt-in clipboard restriction verified');

// 3. Test Professional Phrasing (No "anti-cheat" or "violation")
console.log('Test 3: Professional simulation phrasing');

const focusMsg = formatSimulationWarning('tab-switch', { count: 1, durationMs: 2000 });
assert.ok(!focusMsg.toLowerCase().includes('anti-cheat'), 'Message must not contain "anti-cheat"');
assert.ok(!focusMsg.toLowerCase().includes('violation'), 'Message must not contain "violation"');
assert.ok(focusMsg.toLowerCase().includes('focus'), 'Message should describe focus change');

const clipMsg = formatSimulationWarning('copy-paste');
assert.ok(!clipMsg.toLowerCase().includes('anti-cheat'), 'Message must not contain "anti-cheat"');
assert.ok(!clipMsg.toLowerCase().includes('violation'), 'Message must not contain "violation"');
assert.ok(clipMsg.toLowerCase().includes('simulation') || clipMsg.toLowerCase().includes('hackerrank'), 'Message should explain simulation context');
console.log('✅ Reframed non-punitive messaging verified');

console.log('\n🎉 ALL LOW-01 ERGONOMICS TESTS PASSED!');
