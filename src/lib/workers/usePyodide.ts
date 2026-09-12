'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import type { PyodideWorkerResult, PyodideTestCaseResult } from './pyodide.worker';

export interface UsePyodideReturn {
  isReady: boolean;
  isLoading: boolean;
  isRunning: boolean;
  stdout: string;
  stderr: string;
  executionTimeMs: number;
  passed?: boolean;
  testResults: PyodideTestCaseResult[];
  error?: string;
  runCode: (code: string, testCases?: Array<{ id?: string; input: string; expectedOutput?: string }>) => void;
  resetOutput: () => void;
}

export function usePyodide(): UsePyodideReturn {
  const [isReady, setIsReady] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [stdout, setStdout] = useState('');
  const [stderr, setStderr] = useState('');
  const [executionTimeMs, setExecutionTimeMs] = useState(0);
  const [passed, setPassed] = useState<boolean | undefined>(undefined);
  const [testResults, setTestResults] = useState<PyodideTestCaseResult[]>([]);
  const [error, setError] = useState<string | undefined>(undefined);

  const workerRef = useRef<Worker | null>(null);

  useEffect(() => {
    setIsLoading(true);
    const worker = new Worker(new URL('./pyodide.worker.ts', import.meta.url), {
      type: 'module',
    });
    workerRef.current = worker;

    worker.onmessage = (event: MessageEvent<PyodideWorkerResult>) => {
      const data = event.data;

      if (data.type === 'ready') {
        setIsReady(true);
        setIsLoading(false);
      } else if (data.type === 'result') {
        setIsRunning(false);
        setStdout(data.stdout || '');
        setStderr(data.stderr || '');
        setExecutionTimeMs(data.executionTimeMs || 0);
        setPassed(data.passed);
        setTestResults(data.testResults || []);
        setError(data.error);
      } else if (data.type === 'error') {
        setIsLoading(false);
        setIsRunning(false);
        setError(data.error || 'Pyodide error');
      }
    };

    worker.postMessage({ type: 'init' });

    return () => {
      worker.terminate();
      workerRef.current = null;
    };
  }, []);

  const runCode = useCallback((code: string, testCases?: Array<{ id?: string; input: string; expectedOutput?: string }>) => {
    if (!workerRef.current) return;
    setIsRunning(true);
    setStdout('');
    setStderr('');
    setError(undefined);
    setPassed(undefined);
    setTestResults([]);

    workerRef.current.postMessage({
      type: 'run',
      code,
      testCases,
    });
  }, []);

  const resetOutput = useCallback(() => {
    setStdout('');
    setStderr('');
    setError(undefined);
    setPassed(undefined);
    setTestResults([]);
    setExecutionTimeMs(0);
  }, []);

  return {
    isReady,
    isLoading,
    isRunning,
    stdout,
    stderr,
    executionTimeMs,
    passed,
    testResults,
    error,
    runCode,
    resetOutput,
  };
}
