import fs from 'fs';
import path from 'path';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ Assertion Failed: ${message}`);
    process.exit(1);
  }
  console.log(`✅ ${message}`);
}

console.log('🧪 Testing Offline Self-Hosted Runtime Assets & Config...');

// 1. Verify Pyodide local assets exist and are populated
const pyodideDir = path.resolve(__dirname, '../public/pyodide');
const pyodideFiles = ['pyodide.js', 'pyodide.asm.js', 'pyodide.asm.wasm', 'python_stdlib.zip'];

for (const file of pyodideFiles) {
  const filePath = path.join(pyodideDir, file);
  assert(fs.existsSync(filePath), `Self-hosted Pyodide asset must exist: ${file}`);
  const stat = fs.statSync(filePath);
  assert(stat.size > 1000, `Self-hosted Pyodide asset must have valid size (${stat.size} B): ${file}`);
}

// 2. Verify Monaco vs local distribution exists and is populated
const monacoDir = path.resolve(__dirname, '../public/monaco/vs');
const monacoFiles = ['loader.js', 'editor/editor.main.js', 'editor/editor.main.css'];

for (const file of monacoFiles) {
  const filePath = path.join(monacoDir, file);
  assert(fs.existsSync(filePath), `Self-hosted Monaco asset must exist: ${file}`);
  const stat = fs.statSync(filePath);
  assert(stat.size > 500, `Self-hosted Monaco asset must have valid size: ${file}`);
}

// 3. Verify pyodide.worker.ts uses self-hosted local path first
const workerPath = path.resolve(__dirname, '../src/lib/workers/pyodide.worker.ts');
const workerContent = fs.readFileSync(workerPath, 'utf-8');
assert(
  workerContent.includes("'/pyodide/pyodide.js'") || workerContent.includes('"/pyodide/pyodide.js"'),
  'pyodide.worker.ts must reference local /pyodide/pyodide.js path for self-hosted execution'
);

// 4. Verify local Python WASM execution via installed pyodide package
async function verifyOfflinePythonExecution() {
  const { loadPyodide } = await import('pyodide');
  const pyodide = await loadPyodide({
    indexURL: pyodideDir,
  });

  const result = pyodide.runPython(`
def two_sum(nums, target):
    seen = {}
    for i, n in enumerate(nums):
        diff = target - n
        if diff in seen:
            return [seen[diff], i]
        seen[n] = i
    return []

two_sum([2, 7, 11, 15], 9)
  `);

  const arrayResult = result.toJs();
  assert(
    Array.isArray(arrayResult) && arrayResult[0] === 0 && arrayResult[1] === 1,
    `Local offline Pyodide executed successfully (got: ${JSON.stringify(arrayResult)})`
  );
}

verifyOfflinePythonExecution().then(() => {
  console.log('🎉 All Offline Runtime Assets and Local Execution Tests Passed!');
}).catch((err) => {
  console.error('Offline execution failed:', err);
  process.exit(1);
});
