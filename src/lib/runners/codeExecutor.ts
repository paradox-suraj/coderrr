import { SupportedLanguage } from '@/lib/db';
import type { TestCase, TestCaseResult } from './testCaseParser';

export interface ExecutionResult {
  stdout: string;
  stderr: string;
  executionTimeMs: number;
  passed: boolean;
  testResults?: TestCaseResult[];
  submissionStatus?: 'Accepted' | 'Wrong Answer' | 'Runtime Error' | 'Compile Error' | 'Time Limit Exceeded';
  error?: string;
  memoryUsageMb?: number;
}

export interface LanguageConfig {
  id: SupportedLanguage;
  label: string;
  monacoLang: string;
  runtimeType: 'wasm' | 'cloud';
  runtimeLabel: string;
  version: string;
  extension: string;
  defaultCode: (problemTitle: string, problemId: string, descriptionHtml?: string) => string;
}

export function toCamelCase(str: string): string {
  if (!str) return 'solve';
  const clean = str.trim();

  const knownMap: Record<string, string> = {
    'two sum': 'twoSum',
    '3sum': 'threeSum',
    '4sum': 'fourSum',
    'valid parentheses': 'isValid',
    'merge two sorted lists': 'mergeTwoLists',
    'best time to buy and sell stock': 'maxProfit',
    'valid palindrome': 'isPalindrome',
    'invert binary tree': 'invertTree',
    'valid anagram': 'isAnagram',
    'binary search': 'search',
    'flood fill': 'floodFill',
    'maximum subarray': 'maxSubArray',
    'lowest common ancestor of a binary search tree': 'lowestCommonAncestor',
    'climbing stairs': 'climbStairs',
    'reverse linked list': 'reverseList',
    'valid word abbreviation': 'validWordAbbreviation',
    'single number': 'singleNumber',
    'contains duplicate': 'containsDuplicate',
  };

  const lower = clean.toLowerCase();
  if (knownMap[lower]) {
    return knownMap[lower];
  }

  const adjusted = clean
    .replace(/^3Sum\b/i, 'threeSum')
    .replace(/^4Sum\b/i, 'fourSum')
    .replace(/^1-bit/i, 'oneBit');

  const camel = adjusted
    .replace(/[^a-zA-Z0-9 ]/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((w, i) => (i === 0 ? w.toLowerCase() : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()))
    .join('');

  return camel || 'solve';
}

export function extractProblemParams(descriptionHtml?: string): string[] {
  if (!descriptionHtml) return ['nums'];

  const match =
    descriptionHtml.match(/Input:?\s*<\/strong>\s*(?:<span[^>]*>)?([\s\S]*?)(?:<\/span>|<\/p>|<br>|<strong>Output)/i) ||
    descriptionHtml.match(/Input:?\s*(?:<span[^>]*>)?([\s\S]*?)(?:<\/span>|<\/p>|<br>|Output:)/i);

  if (!match) return ['nums'];

  const inputStr = match[1].replace(/<[^>]+>/g, '').trim();
  const matches = Array.from(inputStr.matchAll(/([a-zA-Z_]\w*)\s*=/g));
  const params = matches.map((m) => m[1]);

  if (params.length > 0) {
    return Array.from(new Set(params));
  }

  return ['nums'];
}

function inferParamType(param: string): { py: string; jsDoc: string; cpp: string; java: string } {
  const p = param.toLowerCase();
  if (p === 's' || p === 'word' || p === 'abbr' || p === 'str' || p.includes('string')) {
    return { py: 'str', jsDoc: 'string', cpp: `string ${param}`, java: `String ${param}` };
  }
  if (p === 'target' || p === 'n' || p === 'k' || p === 'x' || p === 'val' || p === 'num' || p === 'count') {
    return { py: 'int', jsDoc: 'number', cpp: `int ${param}`, java: `int ${param}` };
  }
  if (p === 'matrix' || p === 'grid') {
    return { py: 'List[List[int]]', jsDoc: 'number[][]', cpp: `vector<vector<int>>& ${param}`, java: `int[][] ${param}` };
  }
  if (p === 'strs' || p === 'words') {
    return { py: 'List[str]', jsDoc: 'string[]', cpp: `vector<string>& ${param}`, java: `String[] ${param}` };
  }
  if (p === 'head') {
    return { py: 'Optional[ListNode]', jsDoc: 'ListNode', cpp: `ListNode* ${param}`, java: `ListNode ${param}` };
  }
  if (p === 'root') {
    return { py: 'Optional[TreeNode]', jsDoc: 'TreeNode', cpp: `TreeNode* ${param}`, java: `TreeNode ${param}` };
  }
  return { py: 'List[int]', jsDoc: 'number[]', cpp: `vector<int>& ${param}`, java: `int[] ${param}` };
}

export const LANGUAGE_CONFIGS: Record<SupportedLanguage, LanguageConfig> = {
  python: {
    id: 'python',
    label: 'Python 3',
    monacoLang: 'python',
    runtimeType: 'wasm',
    runtimeLabel: 'WASM (Client)',
    version: '3.12 (Pyodide)',
    extension: 'py',
    defaultCode: (title, id, descriptionHtml) => {
      const fnName = toCamelCase(title);
      const params = extractProblemParams(descriptionHtml);
      return `# Problem: #${id}: ${title}
# Python 3.12 (Pyodide WebAssembly)

from typing import List, Optional, Dict, Set, Tuple
import collections
import heapq
import math

class Solution:
    def ${fnName}(self, ${params.join(', ')}):
        # Implementation for #${id}: ${title}
        pass

if __name__ == "__main__":
    s = Solution()
    print("Ready: #${id} ${title}")
`;
    },
  },
  javascript: {
    id: 'javascript',
    label: 'JavaScript',
    monacoLang: 'javascript',
    runtimeType: 'wasm',
    runtimeLabel: 'WASM (Client)',
    version: 'ES2024 (Worker)',
    extension: 'js',
    defaultCode: (title, id, descriptionHtml) => {
      const fnName = toCamelCase(title);
      const params = extractProblemParams(descriptionHtml);
      const jsDocs = params.map((p) => `     * @param {${inferParamType(p).jsDoc}} ${p}`).join('\n');
      return `// Problem: #${id}: ${title}
// JavaScript (ES2024 Web Worker)

class Solution {
    /**
${jsDocs}
     * @return {*}
     */
    ${fnName}(${params.join(', ')}) {
        // Implementation for #${id}: ${title}
        return null;
    }
}

const s = new Solution();
console.log("Ready: #${id} ${title}");
`;
    },
  },
  cpp: {
    id: 'cpp',
    label: 'C++ (GCC)',
    monacoLang: 'cpp',
    runtimeType: 'cloud',
    runtimeLabel: 'Cloud Sandbox',
    version: 'GCC 10.2 / C++20',
    extension: 'cpp',
    defaultCode: (title, id, descriptionHtml) => {
      const is408 = id === '408' || title.toLowerCase().includes('valid word abbreviation');
      if (is408) {
        return `// Problem: #${id}: ${title}
// C++ (GCC 10.2 / C++20)

#include <iostream>
#include <vector>
#include <string>

using namespace std;

class Solution {
public:
    bool validWordAbbreviation(string word, string abbr) {
        // Solution implementation
        return true;
    }
};

int main() {
    Solution s;
    cout << "Running C++ solution..." << endl;
    return 0;
}
`;
      }
      const fnName = toCamelCase(title);
      const params = extractProblemParams(descriptionHtml);
      const cppArgs = params.map((p) => inferParamType(p).cpp).join(', ');
      const lower = title.toLowerCase();
      let returnType = 'auto';
      let retVal = '{}';
      if (lower.includes('valid') || lower.includes('palindrome') || lower.includes('is ') || lower.includes('contains')) {
        returnType = 'bool';
        retVal = 'true';
      } else if (lower.includes('number') || lower.includes('count') || lower.includes('search') || lower.includes('length')) {
        returnType = 'int';
        retVal = '0';
      } else if (title === 'Two Sum') {
        returnType = 'vector<int>';
        retVal = '{}';
      }
      return `// Problem: #${id}: ${title}
// C++ (GCC 10.2 / C++20)

#include <iostream>
#include <vector>
#include <string>
#include <unordered_map>
#include <algorithm>

using namespace std;

class Solution {
public:
    ${returnType} ${fnName}(${cppArgs}) {
        // Implementation for #${id}: ${title}
        return ${retVal};
    }
};

int main() {
    Solution s;
    cout << "Ready: #${id} ${title}" << endl;
    return 0;
}
`;
    },
  },
  java: {
    id: 'java',
    label: 'Java (OpenJDK)',
    monacoLang: 'java',
    runtimeType: 'cloud',
    runtimeLabel: 'Cloud Sandbox',
    version: 'OpenJDK 15',
    extension: 'java',
    defaultCode: (title, id, descriptionHtml) => {
      const fnName = toCamelCase(title);
      const params = extractProblemParams(descriptionHtml);
      const javaArgs = params.map((p) => inferParamType(p).java).join(', ');
      const lower = title.toLowerCase();
      let returnType = 'Object';
      let retVal = 'null';
      if (lower.includes('valid') || lower.includes('palindrome') || lower.includes('is ') || lower.includes('contains')) {
        returnType = 'boolean';
        retVal = 'true';
      } else if (lower.includes('number') || lower.includes('count') || lower.includes('search') || lower.includes('length')) {
        returnType = 'int';
        retVal = '0';
      } else if (title === 'Two Sum') {
        returnType = 'int[]';
        retVal = 'new int[]{}';
      }
      return `// Problem: #${id}: ${title}
// Java (OpenJDK 15)

import java.util.*;

class Solution {
    public ${returnType} ${fnName}(${javaArgs}) {
        // Implementation for #${id}: ${title}
        return ${retVal};
    }
}

public class Main {
    public static void main(String[] args) {
        Solution s = new Solution();
        System.out.println("Running ${title} solution in Java...");
        System.out.println("Target: Problem #${id}");
    }
}
`;
    },
  },
};

/**
 * Universal Code Execution Dispatcher
 * - python: handled by caller via usePyodide worker
 * - javascript: executed in dedicated JS Web Worker
 * - cpp / java: submitted to the server-side job queue (/api/execute → async poll)
 */
export async function executeCodeUniversal(
  language: SupportedLanguage,
  code: string,
  options?: {
    testCases?: TestCase[];
    runPython?: (code: string) => void;
  }
): Promise<ExecutionResult> {
  const startTime = performance.now();

  // 1. JavaScript: in-browser isolated worker
  if (language === 'javascript') {
    return new Promise((resolve) => {
      try {
        const worker = new Worker(new URL('../workers/js.worker.ts', import.meta.url), {
          type: 'module',
        });

        // 5000ms watchdog timer for runaway infinite loops
        const watchdog = setTimeout(() => {
          worker.terminate();
          resolve({
            stdout: '',
            stderr: 'Time Limit Exceeded: Execution timed out (5000ms limit). Your code may contain an infinite loop or excessive recursion.',
            executionTimeMs: 5000,
            passed: false,
            submissionStatus: 'Time Limit Exceeded',
            error: 'Time Limit Exceeded (5000ms)',
            memoryUsageMb: 16.5,
          });
        }, 5000);

        worker.onmessage = (e: MessageEvent) => {
          clearTimeout(watchdog);
          const data = e.data;
          worker.terminate();
          const passed = Boolean(data.passed);
          const hasError = Boolean(data.error);
          resolve({
            stdout: data.stdout || '',
            stderr: data.stderr || '',
            executionTimeMs: data.executionTimeMs || Math.round(performance.now() - startTime),
            passed,
            testResults: data.testResults,
            submissionStatus: passed
              ? 'Accepted'
              : hasError
              ? 'Runtime Error'
              : 'Wrong Answer',
            error: data.error,
            memoryUsageMb: 12.8,
          });
        };

        worker.onerror = (err) => {
          clearTimeout(watchdog);
          worker.terminate();
          resolve({
            stdout: '',
            stderr: err.message || 'Worker syntax/runtime error',
            executionTimeMs: Math.round(performance.now() - startTime),
            passed: false,
            submissionStatus: 'Runtime Error',
            error: err.message,
            memoryUsageMb: 12.4,
          });
        };

        worker.postMessage({ type: 'run', code, testCases: options?.testCases });
      } catch (err: any) {
        resolve({
          stdout: '',
          stderr: err.message || 'Failed to spawn JavaScript worker',
          executionTimeMs: 0,
          passed: false,
          submissionStatus: 'Runtime Error',
          error: err.message,
          memoryUsageMb: 0,
        });
      }
    });
  }

  // 2. Cloud Sandbox (C++ / Java) via async job queue
  //
  // Flow:
  //   POST /api/execute        → { jobId } (202 Accepted, returns immediately)
  //   GET  /api/execute/:jobId → poll until status is 'done' or 'failed'
  //
  // Polling: every 1 s, up to 30 s total (well above the 10 s Piston timeout).
  if (language === 'cpp' || language === 'java') {
    const POLL_INTERVAL_MS = 1_000;
    const POLL_TIMEOUT_MS = 30_000;

    try {
      // ── 1. Enqueue the job ────────────────────────────────────────────────
      const submitRes = await fetch('/api/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ language, code, testCases: options?.testCases }),
      });

      const elapsedMs = () => Math.round((performance.now() - startTime) * 10) / 10;

      if (submitRes.status === 429) {
        return {
          stdout: '',
          stderr: 'Rate Limit Exceeded: You are sending too many requests. Please slow down and try again later.',
          executionTimeMs: elapsedMs(),
          passed: false,
          submissionStatus: 'Runtime Error',
          error: 'Rate limit',
        };
      }

      if (submitRes.status === 503) {
        return {
          stdout: '',
          stderr: 'Service Unavailable: The sandbox is temporarily busy. Please retry in a few seconds.',
          executionTimeMs: elapsedMs(),
          passed: false,
          submissionStatus: 'Runtime Error',
          error: 'Queue full',
        };
      }

      if (!submitRes.ok) {
        let errMsg = `HTTP ${submitRes.status}`;
        try {
          const errBody = await submitRes.json();
          errMsg = errBody.error || errMsg;
        } catch { /* ignore */ }

        if (submitRes.status === 401) {
          return {
            stdout: '',
            stderr: [
              `⚠️ Cloud Sandbox API Error (HTTP 401 Unauthorized):`,
              ``,
              `"Public Piston API is now whitelist only as of 2/15/2026."`,
              ``,
              `📌 Why this happened:`,
              `The public Piston execution cluster (emkc.org) disabled unauthenticated public access on February 15, 2026 to prevent free-tier abuse, bot traffic, and crypto mining.`,
              ``,
              `🚀 How to solve & run your code immediately:`,
              `1. Switch to Python 3 or JavaScript:`,
              `   Both execute 100% locally in your browser via WebAssembly (Pyodide) and Web Workers. Zero server needed, offline capable, and never rate-limited or blocked!`,
              ``,
              `2. Self-Host Piston Locally (Free, 1-Line Docker Command):`,
              `   docker run -d -p 2000:2000 ghcr.io/engineer-man/piston`,
              `   Then open Sandbox Settings (⚙️ icon next to the language dropdown) and set your URL to:`,
              `   http://localhost:2000/api/v2/execute`,
              ``,
              `3. Use a Whitelisted API Key:`,
              `   If you have a Piston key from engineer-man/piston, enter it in Sandbox Settings (⚙️ icon).`,
            ].join('\n'),
            executionTimeMs: elapsedMs(),
            passed: false,
            submissionStatus: 'Compile Error',
            error: errMsg,
          };
        }

        return {
          stdout: '',
          stderr: `Cloud Sandbox Error: ${errMsg}`,
          executionTimeMs: elapsedMs(),
          passed: false,
          submissionStatus: 'Compile Error',
          error: errMsg,
        };
      }

      const { jobId } = await submitRes.json() as { jobId: string };

      // ── 2. Poll for result ────────────────────────────────────────────────
      const pollDeadline = Date.now() + POLL_TIMEOUT_MS;

      while (Date.now() < pollDeadline) {
        await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));

        let pollRes: Response;
        try {
          pollRes = await fetch(`/api/execute/${jobId}`);
        } catch {
          continue; // transient network hiccup — keep polling
        }

        if (!pollRes.ok) {
          if (pollRes.status === 404) {
            return {
              stdout: '',
              stderr: 'Execution job expired before completing. Please try again.',
              executionTimeMs: elapsedMs(),
              passed: false,
              submissionStatus: 'Runtime Error',
              error: 'Job expired',
            };
          }
          continue; // other transient error — keep polling
        }

        const poll = await pollRes.json() as {
          status: 'pending' | 'running' | 'done' | 'failed';
          result?: ExecutionResult;
          error?: string;
        };

        if (poll.status === 'pending' || poll.status === 'running') continue;

        if (poll.status === 'done' && poll.result) {
          return poll.result;
        }

        if (poll.status === 'failed') {
          return {
            stdout: '',
            stderr: poll.result?.stderr || poll.error || 'Execution failed.',
            executionTimeMs: elapsedMs(),
            passed: false,
            submissionStatus: poll.result?.submissionStatus ?? 'Runtime Error',
            error: poll.error,
          };
        }
      }

      // Timed out waiting for result
      return {
        stdout: '',
        stderr: 'Gateway Timeout: Code execution took too long (30s limit). Your code might contain an infinite loop.',
        executionTimeMs: elapsedMs(),
        passed: false,
        submissionStatus: 'Runtime Error',
        error: 'Poll timeout',
      };

    } catch (err: unknown) {
      const elapsedMs = Math.round((performance.now() - startTime) * 10) / 10;
      const msg = err instanceof Error ? err.message : 'Network unreachable';
      return {
        stdout: '',
        stderr: `Cloud Sandbox Connection Notice: ${msg}\n\nOur execution proxy requires internet access.`,
        executionTimeMs: elapsedMs,
        passed: false,
        submissionStatus: 'Runtime Error',
        error: msg,
      };
    }
  }

  // Python placeholder (caller delegates to usePyodide)
  return {
    stdout: '',
    stderr: '',
    executionTimeMs: 0,
    passed: true,
  };
}
