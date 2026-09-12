// Web Worker executing JavaScript in an isolated worker thread with console interception and testcase harness

export interface JSTestCaseResult {
  caseId: string;
  passed: boolean;
  input: string;
  expectedOutput: string;
  actualOutput: string;
  stdout?: string;
  stderr?: string;
  executionTimeMs: number;
  error?: string;
}

export interface JSWorkerInput {
  type: 'run';
  id?: string;
  code?: string;
  testCases?: Array<{
    id?: string;
    input: string;
    expectedOutput?: string;
  }>;
}

export interface JSWorkerResult {
  type: 'result' | 'error';
  id?: string;
  stdout?: string;
  stderr?: string;
  executionTimeMs?: number;
  passed?: boolean;
  testResults?: JSTestCaseResult[];
  error?: string;
}

function parseJsAssignments(inputStr: string): string[] {
  const statements: string[] = [];
  let current: string[] = [];
  let bracketDepth = 0;
  let inQuote = false;
  let quoteChar = '';

  for (const ch of inputStr) {
    if (inQuote) {
      current.push(ch);
      if (ch === quoteChar) inQuote = false;
    } else if (ch === '"' || ch === "'") {
      inQuote = true;
      quoteChar = ch;
      current.push(ch);
    } else if (ch === '[' || ch === '{' || ch === '(') {
      bracketDepth++;
      current.push(ch);
    } else if (ch === ']' || ch === '}' || ch === ')') {
      bracketDepth--;
      current.push(ch);
    } else if (ch === ',' && bracketDepth === 0) {
      const stmt = current.join('').trim();
      if (stmt) statements.push(stmt);
      current = [];
    } else {
      current.push(ch);
    }
  }
  if (current.length) {
    const stmt = current.join('').trim();
    if (stmt) statements.push(stmt);
  }
  return statements;
}

function normalizeCompare(actual: string, expected: string): boolean {
  if (actual === expected) return true;
  const aClean = actual.replace(/\s+/g, '').toLowerCase();
  const eClean = expected.replace(/\s+/g, '').toLowerCase();
  if (aClean === eClean) return true;

  try {
    const aJson = JSON.parse(actual);
    const eJson = JSON.parse(expected);
    if (JSON.stringify(aJson) === JSON.stringify(eJson)) return true;
    if (Array.isArray(aJson) && Array.isArray(eJson) && aJson.length === eJson.length) {
      const aSort = [...aJson].sort();
      const eSort = [...eJson].sort();
      if (JSON.stringify(aSort) === JSON.stringify(eSort)) return true;
    }
  } catch {
    // Ignore JSON parse errors
  }
  return false;
}

self.addEventListener('message', async (event: MessageEvent<JSWorkerInput>) => {
  const { type, id, code, testCases } = event.data;

  if (type === 'run') {
    const logs: string[] = [];
    const errors: string[] = [];
    const testResults: JSTestCaseResult[] = [];

    // Override console methods to capture outputs
    const originalLog = console.log;
    const originalError = console.error;
    const originalWarn = console.warn;

    console.log = (...args: any[]) => {
      logs.push(args.map((a) => (typeof a === 'object' ? JSON.stringify(a, null, 2) : String(a))).join(' '));
    };

    console.error = (...args: any[]) => {
      errors.push(args.map((a) => (typeof a === 'object' ? JSON.stringify(a, null, 2) : String(a))).join(' '));
    };

    console.warn = (...args: any[]) => {
      logs.push('[WARN] ' + args.map((a) => (typeof a === 'object' ? JSON.stringify(a, null, 2) : String(a))).join(' '));
    };

    const startTime = performance.now();
    let runtimeError: string | undefined;

    const hasTestCases = Array.isArray(testCases) && testCases.length > 0;

    try {
      const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;

      if (hasTestCases) {
        for (let i = 0; i < testCases.length; i++) {
          const tc = testCases[i];
          const caseId = tc.id || `case-${i + 1}`;
          const caseStart = performance.now();
          const caseLogs: string[] = [];
          const caseErrors: string[] = [];

          // Temporary console hijack per test case
          const tempLog = console.log;
          console.log = (...args: any[]) => {
            caseLogs.push(args.map((a) => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' '));
            tempLog(...args);
          };

          let actualStr = '';
          let casePassed = false;
          let caseErr: string | undefined;

          try {
            const stmts = parseJsAssignments(tc.input);
            const declarations = stmts.map((s) => 'let ' + s + ';').join('\n');
            const varNames = stmts.map((s) => s.split('=')[0].trim()).join(', ');

            const harness = `
              ${code || ''}
              ${declarations}
              if (typeof Solution === 'function') {
                const __sol = new Solution();
                const __methods = Object.getOwnPropertyNames(Solution.prototype).filter(m => m !== 'constructor');
                const __method = __methods[0] || 'solution';
                return __sol[__method](${varNames});
              }
              for (const __name of ['twoSum', 'validWordAbbreviation', 'singleNumber', 'solve', 'solution']) {
                try {
                  const __fn = eval('typeof ' + __name + ' === "function" ? ' + __name + ' : null');
                  if (__fn) return __fn(${varNames});
                } catch (_) {}
              }
              return undefined;
            `;

            const fn = new AsyncFunction(harness);
            const ret = await fn();
            actualStr = JSON.stringify(ret);
            casePassed = normalizeCompare(actualStr, tc.expectedOutput || '');
          } catch (err: any) {
            caseErr = err.message || String(err);
            actualStr = '[Runtime Error]';
            casePassed = false;
          } finally {
            console.log = tempLog;
            const caseTime = Math.round((performance.now() - caseStart) * 100) / 100;
            testResults.push({
              caseId,
              passed: casePassed,
              input: tc.input,
              expectedOutput: tc.expectedOutput || '',
              actualOutput: actualStr,
              stdout: caseLogs.join('\n'),
              stderr: caseErrors.join('\n') || caseErr,
              executionTimeMs: caseTime,
              error: caseErr,
            });
          }
        }
      } else {
        // Execute user code directly in AsyncFunction scope
        const fn = new AsyncFunction(code || '');
        const result = await fn();

        if (result !== undefined) {
          logs.push(`\nReturn value: ${typeof result === 'object' ? JSON.stringify(result, null, 2) : String(result)}`);
        }
      }
    } catch (err: any) {
      runtimeError = err.stack || err.message || String(err);
      errors.push(runtimeError!);
    } finally {
      const elapsedMs = Math.round((performance.now() - startTime) * 100) / 100;
      console.log = originalLog;
      console.error = originalError;
      console.warn = originalWarn;

      const overallPassed = hasTestCases
        ? testResults.every((t) => t.passed) && !runtimeError
        : !runtimeError;

      self.postMessage({
        type: 'result',
        id,
        stdout: logs.join('\n'),
        stderr: errors.join('\n'),
        executionTimeMs: elapsedMs,
        passed: overallPassed,
        testResults: hasTestCases ? testResults : undefined,
        error: runtimeError,
      } as JSWorkerResult);
    }
  }
});
