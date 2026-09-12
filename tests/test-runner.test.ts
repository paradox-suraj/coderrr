import fs from 'fs';
import path from 'path';
import { parseTestCasesFromHtml, compareOutputs, TestCase } from '../src/lib/runners/testCaseParser';
import { calculateSM2 } from '../src/lib/db/sm2';
import { isCodeValidForLanguage } from '../src/lib/db/index';
import { LANGUAGE_CONFIGS } from '../src/lib/runners/codeExecutor';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ Assertion Failed: ${message}`);
    process.exit(1);
  }
  console.log(`✅ ${message}`);
}

console.log('🧪 Starting Code Runner & Multi-Language Test Suite...\n');

// ==========================================
// 1. Test Case Parsing from Real Problem HTML
// ==========================================
console.log('--- 1. Testing TestCase Parser ---');

// Problem 1: Two Sum
const p1Path = path.join(process.cwd(), 'public/data/descriptions/1.json');
const p1Data = JSON.parse(fs.readFileSync(p1Path, 'utf-8'));
const p1Cases = parseTestCasesFromHtml(p1Data.descriptionHtml);

assert(p1Cases.length === 3, `Parsed 3 test cases for Two Sum (found: ${p1Cases.length})`);
assert(p1Cases[0].input.includes('nums = [2,7,11,15]'), 'Case 1 input contains nums array');
assert(p1Cases[0].input.includes('target = 9'), 'Case 1 input contains target');
assert(p1Cases[0].expectedOutput === '[0,1]', `Case 1 expected output is [0,1] (got: ${p1Cases[0].expectedOutput})`);
assert(Boolean(p1Cases[0].explanation), 'Case 1 explanation extracted successfully');
assert(p1Cases[1].expectedOutput === '[1,2]', `Case 2 expected output is [1,2]`);
assert(p1Cases[2].expectedOutput === '[0,1]', `Case 3 expected output is [0,1]`);

// Problem 408: Valid Word Abbreviation
const p408Path = path.join(process.cwd(), 'public/data/descriptions/408.json');
const p408Data = JSON.parse(fs.readFileSync(p408Path, 'utf-8'));
const p408Cases = parseTestCasesFromHtml(p408Data.descriptionHtml);

assert(p408Cases.length === 2, `Parsed 2 test cases for Valid Word Abbreviation (found: ${p408Cases.length})`);
assert(p408Cases[0].input.includes('internationalization'), 'Case 1 input contains word');
assert(p408Cases[0].expectedOutput === 'true', `Case 1 expected output is true (got: ${p408Cases[0].expectedOutput})`);
assert(p408Cases[1].expectedOutput === 'false', `Case 2 expected output is false (got: ${p408Cases[1].expectedOutput})`);

// Modern LeetCode Format with <div class="example-block">
const modernHtml = `
<div class="example-block">
  <p><strong>Input:</strong> <span class="example-io">nums = [4,1,2,1,2]</span></p>
  <p><strong>Output:</strong> <span class="example-io">4</span></p>
  <p><strong>Explanation:</strong> 4 appears once.</p>
</div>
<div class="example-block">
  <p><strong>Input:</strong> <span class="example-io">nums = [1]</span></p>
  <p><strong>Output:</strong> <span class="example-io">1</span></p>
</div>
`;
const modernCases = parseTestCasesFromHtml(modernHtml);
assert(modernCases.length === 2, `Parsed 2 modern example-block test cases (found: ${modernCases.length})`);
assert(modernCases[0].input === 'nums = [4,1,2,1,2]', 'Modern Case 1 input parsed');
assert(modernCases[0].expectedOutput === '4', 'Modern Case 1 expected output is 4');
assert(modernCases[1].input === 'nums = [1]', 'Modern Case 2 input parsed');

// Empty / Null HTML Safety
assert(parseTestCasesFromHtml('').length === 0, 'Empty HTML returns 0 cases');
assert(parseTestCasesFromHtml(undefined).length === 0, 'Undefined HTML returns 0 cases');

// ==========================================
// 2. Testing Output Comparison (compareOutputs)
// ==========================================
console.log('\n--- 2. Testing Output Comparison Logic ---');

// Arrays with whitespace differences
assert(compareOutputs('[0, 1]', '[0,1]'), 'Array whitespace difference normalized');
assert(compareOutputs(' [ 0 , 1 ] ', '[0,1]'), 'Array loose padding normalized');

// Boolean casing differences (Python vs JS/JSON)
assert(compareOutputs('True', 'true'), 'Boolean True vs true matched');
assert(compareOutputs('False', 'false'), 'Boolean False vs false matched');
assert(compareOutputs('false', 'False'), 'Boolean false vs False matched');

// Numbers
assert(compareOutputs('4', '4.0'), 'Integer 4 equals 4.0');
assert(compareOutputs('100', '100'), 'Integer 100 equals 100');

// Strings
assert(compareOutputs('"apple"', 'apple'), 'Quoted string equals unquoted string');
assert(compareOutputs("'hello'", '"hello"'), 'Single quoted string equals double quoted string');

// Legitimate Mismatches
assert(!compareOutputs('[0, 2]', '[0, 1]'), 'Different array elements correctly reported as mismatch');
assert(!compareOutputs('true', 'false'), 'true does not match false');
assert(!compareOutputs('10', '20'), 'Different numbers correctly fail');

// ==========================================
// 3. JavaScript In-Browser Test Execution Simulation
// ==========================================
console.log('\n--- 3. Testing JavaScript Execution Logic ---');

// Simulate the JS worker harness logic
function executeJsSolution(code: string, testCases: TestCase[]) {
  const cleanCode = code.replace(/import\s+[\s\S]*?from\s+['"][^'"]+['"];?/g, '');
  const factory = new Function(`
    ${cleanCode}
    if (typeof Solution !== 'undefined') {
      return new Solution();
    }
    return null;
  `);

  const instance = factory();
  assert(instance !== null, 'Solution instance instantiated successfully');

  // Find target method
  const proto = Object.getPrototypeOf(instance);
  const methodNames = Object.getOwnPropertyNames(proto).filter(
    (name) => name !== 'constructor' && typeof instance[name] === 'function'
  );
  const targetMethod = methodNames[0];
  assert(Boolean(targetMethod), `Target method detected: ${targetMethod}`);

  const results = [];
  for (const tc of testCases) {
    const rawInput = tc.input.trim();
    // Split assignments safely
    const argVals = [];
    const parts = rawInput.split(/,\s*(?=[a-zA-Z_]\w*\s*=)/);
    for (const part of parts) {
      const eqIdx = part.indexOf('=');
      const valStr = eqIdx !== -1 ? part.substring(eqIdx + 1).trim() : part.trim();
      let val;
      try {
        val = JSON.parse(valStr);
      } catch {
        val = new Function(`return (${valStr});`)();
      }
      argVals.push(val);
    }

    const start = Date.now();
    const actual = instance[targetMethod](...argVals);
    const duration = Date.now() - start;
    const actualStr = JSON.stringify(actual);
    const passed = compareOutputs(actualStr, tc.expectedOutput);

    results.push({
      caseId: tc.id,
      passed,
      input: tc.input,
      expectedOutput: tc.expectedOutput,
      actualOutput: actualStr,
      executionTimeMs: duration,
    });
  }

  return results;
}

const jsSolutionCode = `
class Solution {
  twoSum(nums, target) {
    const map = new Map();
    for (let i = 0; i < nums.length; i++) {
      const diff = target - nums[i];
      if (map.has(diff)) {
        return [map.get(diff), i];
      }
      map.set(nums[i], i);
    }
    return [];
  }
}
`;

const jsResults = executeJsSolution(jsSolutionCode, p1Cases);
assert(jsResults.length === 3, 'All 3 test cases evaluated');
assert(jsResults[0].passed, 'Case 1 passed for JS Two Sum');
assert(jsResults[1].passed, 'Case 2 passed for JS Two Sum');
assert(jsResults[2].passed, 'Case 3 passed for JS Two Sum');
assert(jsResults.every((r) => r.passed), 'Full submission passed for JavaScript Solution');

// ==========================================
// 4. Python Split Assignment Logic Check
// ==========================================
console.log('\n--- 4. Testing Python Assignment Split Logic ---');

function splitAssignments(s: string): string[] {
  const parts: string[] = [];
  let current = '';
  let bracketDepth = 0;
  let inString: string | null = null;
  let escape = false;

  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (escape) {
      current += ch;
      escape = false;
      continue;
    }
    if (ch === '\\') {
      current += ch;
      escape = true;
      continue;
    }
    if (inString) {
      current += ch;
      if (ch === inString) {
        inString = null;
      }
      continue;
    }
    if (ch === '"' || ch === "'") {
      inString = ch;
      current += ch;
      continue;
    }
    if (ch === '[' || ch === '(' || ch === '{') {
      bracketDepth++;
      current += ch;
      continue;
    }
    if (ch === ']' || ch === ')' || ch === '}') {
      bracketDepth--;
      current += ch;
      continue;
    }
    if (ch === ',' && bracketDepth === 0) {
      const rest = s.substring(i + 1).trim();
      if (/^[a-zA-Z_]\w*\s*=/.test(rest)) {
        parts.push(current.trim());
        current = '';
        continue;
      }
    }
    current += ch;
  }
  if (current.trim()) {
    parts.push(current.trim());
  }
  return parts;
}

const split1 = splitAssignments('nums = [2, 7, 11, 15], target = 9');
assert(split1.length === 2, `Expected 2 parts, got ${split1.length}`);
assert(split1[0] === 'nums = [2, 7, 11, 15]', 'nums assignment retained internal commas');
assert(split1[1] === 'target = 9', 'target assignment separated correctly');

const splitWithQuotes = splitAssignments('word = "apple, pie", abbr = "a2e"');
assert(splitWithQuotes.length === 2, `Quotes protected comma, got 2 parts`);
assert(splitWithQuotes[0] === 'word = "apple, pie"', 'word assignment preserved comma in quotes');

// ==========================================
// 5. SM-2 Spaced Repetition Progression Verification
// ==========================================
console.log('\n--- 5. Testing SM-2 Spaced Repetition on Submission ---');

const firstSolve = calculateSM2(4, 2.5, 0, 0);
assert(firstSolve.repetitions === 1, 'First solve gives 1 repetition');
assert(firstSolve.intervalDays === 1, 'First solve schedules next review in 1 day');
assert(Boolean(firstSolve.nextReviewDate), 'nextReviewDate is populated');

const secondSolve = calculateSM2(4, firstSolve.easeFactor, firstSolve.intervalDays, firstSolve.repetitions);
assert(secondSolve.repetitions === 2, 'Second solve gives 2 repetitions');
assert(secondSolve.intervalDays === 6, 'Second solve schedules next review in 6 days');

// ==========================================
// 6. Testing Language Syntax Validation & Isolation
// ==========================================
console.log('\n--- 6. Testing Language Syntax Validation & Isolation ---');

const samplePython = `# Problem: #1: Two Sum
# Python 3.12 (Pyodide WebAssembly)
class Solution:
    def twoSum(self, nums, target):
        return [0, 1]
`;

const sampleJs = `// Problem: #1: Two Sum
// JavaScript (ES2024 Web Worker)
class Solution {
    twoSum(nums, target) {
        return [0, 1];
    }
}
`;

const sampleCpp = `// Problem: #1: Two Sum
// C++ (GCC 10.2 / C++20)
#include <iostream>
using namespace std;
class Solution {
public:
    vector<int> twoSum(vector<int>& nums, int target) { return {}; }
};
`;

const sampleJava = `// Problem: #1: Two Sum
// Java (OpenJDK 15)
import java.util.*;
class Solution {
    public int[] twoSum(int[] nums, int target) { return new int[]{}; }
}
public class Main {
    public static void main(String[] args) {}
}
`;

assert(isCodeValidForLanguage(samplePython, 'python'), 'Python code is valid for python');
assert(!isCodeValidForLanguage(samplePython, 'javascript'), 'Python code is rejected for javascript');
assert(!isCodeValidForLanguage(samplePython, 'cpp'), 'Python code is rejected for cpp');
assert(!isCodeValidForLanguage(samplePython, 'java'), 'Python code is rejected for java');

assert(isCodeValidForLanguage(sampleJs, 'javascript'), 'JavaScript code is valid for javascript');
assert(!isCodeValidForLanguage(sampleJs, 'python'), 'JavaScript code is rejected for python');

assert(isCodeValidForLanguage(sampleCpp, 'cpp'), 'C++ code is valid for cpp');
assert(!isCodeValidForLanguage(sampleCpp, 'javascript'), 'C++ code with using namespace std is rejected for javascript');

assert(isCodeValidForLanguage(sampleJava, 'java'), 'Java code is valid for java');
assert(!isCodeValidForLanguage(sampleJava, 'cpp'), 'Java code with public class Main is rejected for cpp');

// ==========================================
// 7. Testing Problem-Aware Starter Code Generation Across Languages
// ==========================================
console.log('\n--- 7. Testing Problem-Aware Starter Code Generation ---');

// Test 1: Two Sum (#1)
const p1Py = LANGUAGE_CONFIGS.python.defaultCode('Two Sum', '1', p1Data.descriptionHtml);
assert(p1Py.includes('def twoSum(self, nums, target)'), 'Python #1 Two Sum declares def twoSum(self, nums, target)');
assert(p1Py.includes('# Problem: #1: Two Sum'), 'Python #1 header correct');

const p1Js = LANGUAGE_CONFIGS.javascript.defaultCode('Two Sum', '1', p1Data.descriptionHtml);
assert(p1Js.includes('twoSum(nums, target)'), 'JavaScript #1 Two Sum declares twoSum(nums, target)');
assert(p1Js.includes('// JavaScript (ES2024 Web Worker)'), 'JavaScript header correct');

const p1Cpp = LANGUAGE_CONFIGS.cpp.defaultCode('Two Sum', '1', p1Data.descriptionHtml);
assert(p1Cpp.includes('vector<int> twoSum(vector<int>& nums, int target)'), 'C++ #1 Two Sum declares vector<int> twoSum(vector<int>& nums, int target)');

const p1Java = LANGUAGE_CONFIGS.java.defaultCode('Two Sum', '1', p1Data.descriptionHtml);
assert(p1Java.includes('int[] twoSum(int[] nums, int target)'), 'Java #1 Two Sum declares int[] twoSum(int[] nums, int target)');
assert(p1Java.includes('class Solution'), 'Java #1 contains class Solution');
assert(p1Java.includes('class Main'), 'Java #1 contains class Main');

// Test 2: Valid Word Abbreviation (#408)
const p408Py = LANGUAGE_CONFIGS.python.defaultCode('Valid Word Abbreviation', '408', p408Data.descriptionHtml);
assert(p408Py.includes('def validWordAbbreviation(self, word, abbr)'), 'Python #408 declares def validWordAbbreviation(self, word, abbr)');

const p408Js = LANGUAGE_CONFIGS.javascript.defaultCode('Valid Word Abbreviation', '408', p408Data.descriptionHtml);
assert(p408Js.includes('validWordAbbreviation(word, abbr)'), 'JavaScript #408 declares validWordAbbreviation(word, abbr)');

const p408Cpp = LANGUAGE_CONFIGS.cpp.defaultCode('Valid Word Abbreviation', '408', p408Data.descriptionHtml);
assert(p408Cpp.includes('bool validWordAbbreviation(string word, string abbr)'), 'C++ #408 declares bool validWordAbbreviation');

const p408Java = LANGUAGE_CONFIGS.java.defaultCode('Valid Word Abbreviation', '408', p408Data.descriptionHtml);
assert(p408Java.includes('boolean validWordAbbreviation(String word, String abbr)'), 'Java #408 declares boolean validWordAbbreviation(String word, String abbr)');

console.log('\n🎉 ALL CODE RUNNER & TEST HARNESS TESTS PASSED SUCCESSFULLY!\n');

