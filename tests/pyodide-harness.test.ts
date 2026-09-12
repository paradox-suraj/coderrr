// Direct Node.js smoke test for Pyodide worker harness logic

function wrapPythonCode(code: string): string {
  return `
import sys
import io
import time
import json

__out = io.StringIO()
__err = io.StringIO()
__orig_stdout = sys.stdout
__orig_stderr = sys.stderr

sys.stdout = __out
sys.stderr = __err

__start = time.perf_counter()
__error_msg = None

try:
${code
  .split('\n')
  .map((line) => '    ' + line)
  .join('\n')}
except Exception as e:
    import traceback
    __error_msg = traceback.format_exc()
finally:
    __end = time.perf_counter()
    sys.stdout = __orig_stdout
    sys.stderr = __orig_stderr

__exec_ms = round((__end - __start) * 1000, 3)
__result = {
    "stdout": __out.getvalue(),
    "stderr": __err.getvalue(),
    "executionTimeMs": __exec_ms,
    "error": __error_msg
}
json.dumps(__result)
`;
}

const testCode = `
def twoSum(nums, target):
    lookup = {}
    for i, num in enumerate(nums):
        if target - num in lookup:
            return [lookup[target - num], i]
        lookup[num] = i

res = twoSum([2, 7, 11, 15], 9)
print(f"Computed Two Sum successfully: {res}")
`;

console.log('🧪 Verifying Pyodide execution harness generation...');
const harness = wrapPythonCode(testCode);

if (!harness.includes('Computed Two Sum successfully')) {
  console.error('❌ Failed: Code was not injected into harness');
  process.exit(1);
}

if (!harness.includes('sys.stdout = __out') || !harness.includes('json.dumps(__result)')) {
  console.error('❌ Failed: Missing stdout redirection or json return serialization');
  process.exit(1);
}

console.log('✅ Python execution harness wrapper verified successfully!');
