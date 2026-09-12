import { SupportedLanguage } from '@/lib/db';
import type { TestCase, TestCaseResult } from './testCaseParser';

export interface ExecutionResult {
  stdout: string;
  stderr: string;
  executionTimeMs: number;
  passed: boolean;
  testResults?: TestCaseResult[];
  submissionStatus?: 'Accepted' | 'Wrong Answer' | 'Runtime Error' | 'Compile Error';
  error?: string;
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

// Piston API language aliases and versions
const PISTON_LANGUAGE_MAP: Record<string, { language: string; version: string }> = {
  cpp: { language: 'cpp', version: '10.2.0' },
  java: { language: 'java', version: '15.0.2' },
};

/**
 * Universal Code Execution Dispatcher
 * - python: handled by caller via usePyodide worker
 * - javascript: executed in dedicated JS Web Worker
 * - cpp / java: dispatched to Piston Cloud Sandbox API
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

        worker.onmessage = (e: MessageEvent) => {
          const data = e.data;
          worker.terminate();
          const passed = Boolean(data.passed);
          const hasError = Boolean(data.error);
          resolve({
            stdout: data.stdout || '',
            stderr: data.stderr || '',
            executionTimeMs: data.executionTimeMs || 0,
            passed,
            testResults: data.testResults,
            submissionStatus: passed
              ? 'Accepted'
              : hasError
              ? 'Runtime Error'
              : 'Wrong Answer',
            error: data.error,
          });
        };

        worker.onerror = (err) => {
          worker.terminate();
          resolve({
            stdout: '',
            stderr: err.message || 'Worker syntax/runtime error',
            executionTimeMs: Math.round(performance.now() - startTime),
            passed: false,
            submissionStatus: 'Runtime Error',
            error: err.message,
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
        });
      }
    });
  }

  // 2. Cloud Sandbox (C++ / Java) via Piston
  if (language === 'cpp' || language === 'java') {
    const pistonConfig = PISTON_LANGUAGE_MAP[language];
    if (!pistonConfig) {
      return {
        stdout: '',
        stderr: `Unsupported language: ${language}`,
        executionTimeMs: 0,
        passed: false,
        submissionStatus: 'Compile Error',
        error: `Language ${language} is not configured`,
      };
    }

    const userEndpoint = typeof window !== 'undefined' ? localStorage.getItem('algojeet_piston_url')?.trim() : undefined;
    const userApiKey = typeof window !== 'undefined' ? localStorage.getItem('algojeet_piston_key')?.trim() : undefined;
    const envEndpoint = process.env.NEXT_PUBLIC_PISTON_URL?.trim();
    const envApiKey = process.env.NEXT_PUBLIC_PISTON_KEY?.trim();

    const endpoint = userEndpoint || envEndpoint || 'https://emkc.org/api/v2/piston/execute';
    const apiKey = userApiKey || envApiKey;

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (apiKey) {
      headers['Authorization'] = apiKey;
    }

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          language: pistonConfig.language,
          version: pistonConfig.version,
          files: [
            {
              name: language === 'java' ? 'Main.java' : `main.${LANGUAGE_CONFIGS[language].extension}`,
              content: code,
            },
          ],
        }),
      });

      const elapsedMs = Math.round((performance.now() - startTime) * 10) / 10;

      if (!response.ok) {
        const errText = await response.text();
        let formattedStderr = `Cloud Sandbox API Error (${response.status}): ${errText}`;

        if (response.status === 401) {
          formattedStderr = [
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
            `   If you have a Piston key from engineer-man/piston, enter it in Sandbox Settings (⚙️ icon).`
          ].join('\n');
        }

        return {
          stdout: '',
          stderr: formattedStderr,
          executionTimeMs: elapsedMs,
          passed: false,
          submissionStatus: 'Compile Error',
          error: `HTTP ${response.status}`,
        };
      }

      const result = await response.json();
      const compile = result.compile || {};
      const run = result.run || {};

      const stdout = run.stdout || '';
      const stderr = [compile.stderr, run.stderr].filter(Boolean).join('\n');
      const passed = run.code === 0 && !compile.stderr;

      const testResults: TestCaseResult[] = (options?.testCases || []).map((tc, idx) => {
        const actualTrimmed = stdout.trim();
        const expectedTrimmed = tc.expectedOutput.trim();
        const casePassed = passed && (actualTrimmed.includes(expectedTrimmed) || actualTrimmed === expectedTrimmed);
        return {
          caseId: tc.id || `case-${idx + 1}`,
          passed: casePassed,
          input: tc.input,
          expectedOutput: tc.expectedOutput,
          actualOutput: actualTrimmed || (compile.stderr ? '[Compile Error]' : '[No Output]'),
          stdout,
          stderr,
          executionTimeMs: elapsedMs,
          error: compile.stderr || run.stderr,
        };
      });

      const allPassed = passed && (testResults.length === 0 || testResults.every((t) => t.passed));
      const submissionStatus = allPassed
        ? 'Accepted'
        : compile.stderr
        ? 'Compile Error'
        : run.stderr
        ? 'Runtime Error'
        : 'Wrong Answer';

      return {
        stdout,
        stderr,
        executionTimeMs: elapsedMs,
        passed: allPassed,
        testResults: testResults.length > 0 ? testResults : undefined,
        submissionStatus,
        error: stderr ? (compile.stderr ? 'Compilation Error' : 'Runtime Error') : undefined,
      };
    } catch (err: any) {
      const elapsedMs = Math.round((performance.now() - startTime) * 10) / 10;
      // Fallback message when network is unreachable
      return {
        stdout: '',
        stderr: `Cloud Sandbox Connection Notice: ${err.message || 'Network unreachable'}\n\nPiston API (${pistonConfig.language} ${pistonConfig.version}) requires outbound internet access.`,
        executionTimeMs: elapsedMs,
        passed: false,
        submissionStatus: 'Runtime Error',
        error: err.message || 'Network unreachable',
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
