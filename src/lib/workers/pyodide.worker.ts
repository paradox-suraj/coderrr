// Web Worker executing Python code via Pyodide in WebAssembly sandbox

declare function importScripts(...urls: string[]): void;
declare function loadPyodide(config?: any): Promise<any>;

export interface PyodideWorkerInput {
  type: 'init' | 'run';
  id?: string;
  code?: string;
  testCases?: Array<{
    id?: string;
    input: string;
    expectedOutput?: string;
  }>;
}

export interface PyodideTestCaseResult {
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

export interface PyodideWorkerResult {
  type: 'ready' | 'running' | 'result' | 'error';
  id?: string;
  stdout?: string;
  stderr?: string;
  executionTimeMs?: number;
  passed?: boolean;
  testResults?: PyodideTestCaseResult[];
  error?: string;
  message?: string;
  memoryUsageMb?: number;
}

let pyodideInstance: any = null;
let isLoading = false;

async function initPyodide(): Promise<any> {
  if (pyodideInstance) return pyodideInstance;
  if (isLoading) return null;
  isLoading = true;

  try {
    // Attempt loading self-hosted distribution first for offline capability
    try {
      importScripts('/pyodide/pyodide.js');
      pyodideInstance = await loadPyodide({
        indexURL: '/pyodide/',
      });
    } catch (localErr) {
      console.warn('[PyodideWorker] Local Pyodide assets unreachable, attempting CDN fallback:', localErr);
      importScripts('https://cdn.jsdelivr.net/pyodide/v0.26.2/full/pyodide.js');
      pyodideInstance = await loadPyodide({
        indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.26.2/full/',
      });
    }

    self.postMessage({
      type: 'ready',
      message: 'Pyodide runtime initialized successfully (Python 3.12+ WASM)',
    } as PyodideWorkerResult);

    return pyodideInstance;
  } catch (err: any) {
    self.postMessage({
      type: 'error',
      error: err.message || 'Failed to initialize Pyodide runtime',
    } as PyodideWorkerResult);
    throw err;
  } finally {
    isLoading = false;
  }
}

async function runPythonCode(
  id?: string,
  code = '',
  testCases: Array<{ id?: string; input: string; expectedOutput?: string }> = []
) {
  if (!pyodideInstance) {
    try {
      await initPyodide();
    } catch (err: any) {
      self.postMessage({
        type: 'result',
        id,
        stdout: '',
        stderr: err.message || 'Pyodide not loaded',
        executionTimeMs: 0,
        passed: false,
        error: 'Failed to initialize Pyodide runtime',
      } as PyodideWorkerResult);
      return;
    }
  }

  const hasTestCases = Array.isArray(testCases) && testCases.length > 0;
  const serializedCases = JSON.stringify(testCases);

  const harness = `
import sys
import io
import time
import json
import traceback
import math
import collections
import heapq
from typing import *
from collections import defaultdict, deque, Counter

def __split_assignments(input_str):
    statements = []
    current = []
    bracket_depth = 0
    in_quote = False
    quote_char = ''
    for ch in input_str:
        if in_quote:
            current.append(ch)
            if ch == quote_char:
                in_quote = False
        elif ch in ('"', "'"):
            in_quote = True
            quote_char = ch
            current.append(ch)
        elif ch in ('[', '{', '('):
            bracket_depth += 1
            current.append(ch)
        elif ch in (']', '}', ')'):
            bracket_depth -= 1
            current.append(ch)
        elif ch == ',' and bracket_depth == 0:
            stmt = ''.join(current).strip()
            if stmt:
                statements.append(stmt)
            current = []
        else:
            current.append(ch)
    if current:
        stmt = ''.join(current).strip()
        if stmt:
            statements.append(stmt)
    return '\\n'.join(statements)

def __normalize_cmp(act, exp):
    if act == exp:
        return True
    s_act = act.replace(' ', '').lower()
    s_exp = exp.replace(' ', '').lower()
    if s_act == s_exp:
        return True
    try:
        j_act = json.loads(act)
        j_exp = json.loads(exp)
        if j_act == j_exp:
            return True
        if isinstance(j_act, list) and isinstance(j_exp, list) and len(j_act) == len(j_exp):
            if sorted(str(x) for x in j_act) == sorted(str(x) for x in j_exp):
                return True
    except:
        pass
    return False

__out = io.StringIO()
__err = io.StringIO()
__orig_stdout = sys.stdout
__orig_stderr = sys.stderr

sys.stdout = __out
sys.stderr = __err

__start = time.perf_counter()
__error_msg = None
__test_results = []
__has_cases = ${hasTestCases ? 'True' : 'False'}
__raw_cases = json.loads(${JSON.stringify(serializedCases)})

try:
    __user_scope = {
        'List': List, 'Dict': Dict, 'Tuple': Tuple, 'Set': Set, 'Optional': Optional,
        'Any': Any, 'Union': Union, 'defaultdict': defaultdict, 'deque': deque,
        'Counter': Counter, 'heapq': heapq, 'math': math
    }
    exec(${JSON.stringify(code)}, __user_scope)

    __fn = None
    if 'Solution' in __user_scope:
        __sol_val = __user_scope['Solution']
        if isinstance(__sol_val, type):
            __inst = __sol_val()
            __methods = [m for m in dir(__inst) if not m.startswith('_') and callable(getattr(__inst, m))]
            if __methods:
                __fn = getattr(__inst, __methods[0])
        elif callable(__sol_val):
            __fn = __sol_val

    if not __fn:
        __builtins_set = {
            'List', 'Dict', 'Tuple', 'Set', 'Optional', 'Any', 'Union',
            'defaultdict', 'deque', 'Counter', 'heapq', 'math', '__split_assignments', '__normalize_cmp',
            'print', 'len', 'range', 'enumerate', 'int', 'str', 'float', 'bool', 'list', 'dict', 'set', 'tuple',
            'min', 'max', 'sum', 'abs', 'all', 'any', 'zip', 'map', 'filter', 'sorted', 'reversed'
        }
        for k, v in list(__user_scope.items()):
            if callable(v) and not k.startswith('_') and k not in __builtins_set:
                __fn = v
                break

    if __has_cases:
        for idx, tc in enumerate(__raw_cases):
            c_id = tc.get('id', f'case-{idx+1}')
            c_in = tc.get('input', '')
            c_exp = tc.get('expectedOutput', '')

            c_start = time.perf_counter()
            c_out = io.StringIO()
            c_err = io.StringIO()
            c_act_str = ''
            c_passed = False
            c_err_msg = None

            if not __fn:
                c_err_msg = 'No Solution class or function found (e.g. def twoSum).'
                c_passed = False
                c_act_str = '[Error] Function not found'
            else:
                sys.stdout = c_out
                sys.stderr = c_err
                try:
                    c_stmts = __split_assignments(c_in)
                    c_vars = {}
                    exec(c_stmts, __user_scope, c_vars)
                    try:
                        c_ret = __fn(**c_vars)
                    except TypeError:
                        c_ret = __fn(*c_vars.values())
                    c_act_str = json.dumps(c_ret) if not isinstance(c_ret, str) else json.dumps(c_ret)
                    c_passed = __normalize_cmp(c_act_str, c_exp)
                except Exception as ex:
                    c_err_msg = str(ex)
                    c_passed = False
                finally:
                    sys.stdout = __out
                    sys.stderr = __err

            c_time = round((time.perf_counter() - c_start) * 1000, 2)
            __test_results.append({
                'caseId': c_id,
                'passed': c_passed,
                'input': c_in,
                'expectedOutput': c_exp,
                'actualOutput': c_act_str or ('[Runtime Error]' if c_err_msg else 'None'),
                'stdout': c_out.getvalue(),
                'stderr': c_err.getvalue() or (c_err_msg or ''),
                'executionTimeMs': c_time,
                'error': c_err_msg
            })

except Exception as e:
    __error_msg = traceback.format_exc()
    if __has_cases and not __test_results:
        for idx, tc in enumerate(__raw_cases):
            __test_results.append({
                'caseId': tc.get('id', f'case-{idx+1}'),
                'passed': False,
                'input': tc.get('input', ''),
                'expectedOutput': tc.get('expectedOutput', ''),
                'actualOutput': '[Compile / Syntax Error]',
                'stdout': '',
                'stderr': __error_msg,
                'executionTimeMs': 0,
                'error': __error_msg
            })
finally:
    __end = time.perf_counter()
    sys.stdout = __orig_stdout
    sys.stderr = __orig_stderr

__exec_ms = round((__end - __start) * 1000, 2)
__passed_overall = not __error_msg and (all(t['passed'] for t in __test_results) if __test_results else not __err.getvalue())

json.dumps({
    "stdout": __out.getvalue(),
    "stderr": __err.getvalue() or (__error_msg or ''),
    "executionTimeMs": __exec_ms,
    "passed": __passed_overall,
    "testResults": __test_results,
    "error": __error_msg
})
`;

  try {
    const rawResultJson = await pyodideInstance.runPythonAsync(harness);
    const parsed = JSON.parse(rawResultJson);

    self.postMessage({
      type: 'result',
      id,
      stdout: parsed.stdout || '',
      stderr: parsed.stderr || '',
      executionTimeMs: parsed.executionTimeMs || 0,
      passed: Boolean(parsed.passed),
      testResults: parsed.testResults || [],
      error: parsed.error || undefined,
    } as PyodideWorkerResult);
  } catch (err: any) {
    self.postMessage({
      type: 'result',
      id,
      stdout: '',
      stderr: err.message || 'Execution error',
      executionTimeMs: 0,
      passed: false,
      error: err.message || 'Unknown runtime error',
    } as PyodideWorkerResult);
  }
}

self.addEventListener('message', async (event: MessageEvent<PyodideWorkerInput>) => {
  const { type, id, code, testCases } = event.data;

  if (type === 'init') {
    await initPyodide();
  } else if (type === 'run') {
    await runPythonCode(id, code, testCases);
  }
});
