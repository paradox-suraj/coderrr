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
  memoryUsageMb?: number;
  passed?: boolean;
  testResults: PyodideTestCaseResult[];
  error?: string;
  runCode: (code: string, testCases?: Array<{ id?: string; input: string; expectedOutput?: string }>) => void;
  resetOutput: () => void;
}

const WATCHDOG_TIMEOUT_MS = 5000;

export function usePyodide(): UsePyodideReturn {
  const [isReady, setIsReady] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [stdout, setStdout] = useState('');
  const [stderr, setStderr] = useState('');
  const [executionTimeMs, setExecutionTimeMs] = useState(0);
  const [memoryUsageMb, setMemoryUsageMb] = useState<number | undefined>(undefined);
  const [passed, setPassed] = useState<boolean | undefined>(undefined);
  const [testResults, setTestResults] = useState<PyodideTestCaseResult[]>([]);
  const [error, setError] = useState<string | undefined>(undefined);

  const workerRef = useRef<Worker | null>(null);
  const watchdogTimerRef = useRef<NodeJS.Timeout | null>(null);

  const clearWatchdog = useCallback(() => {
    if (watchdogTimerRef.current) {
      clearTimeout(watchdogTimerRef.current);
      watchdogTimerRef.current = null;
    }
  }, []);

  const spawnWorker = useCallback(() => {
    if (workerRef.current) {
      workerRef.current.terminate();
      workerRef.current = null;
    }

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
        clearWatchdog();
        setIsRunning(false);
        setStdout(data.stdout || '');
        setStderr(data.stderr || '');
        setExecutionTimeMs(data.executionTimeMs || 0);
        setMemoryUsageMb(data.memoryUsageMb);
        setPassed(data.passed);
        setTestResults(data.testResults || []);
        setError(data.error);
      } else if (data.type === 'error') {
        clearWatchdog();
        setIsLoading(false);
        setIsRunning(false);
        setError(data.error || 'Pyodide error');
      }
    };

    worker.onerror = (err) => {
      clearWatchdog();
      setIsLoading(false);
      setIsRunning(false);
      setError(err.message || 'Pyodide Worker runtime error');
    };

    worker.postMessage({ type: 'init' });
  }, [clearWatchdog]);

  useEffect(() => {
    spawnWorker();
    return () => {
      clearWatchdog();
      if (workerRef.current) {
        workerRef.current.terminate();
        workerRef.current = null;
      }
    };
  }, [spawnWorker, clearWatchdog]);

  const runCode = useCallback((code: string, testCases?: Array<{ id?: string; input: string; expectedOutput?: string }>) => {
    if (!workerRef.current) return;
    clearWatchdog();

    setIsRunning(true);
    setStdout('');
    setStderr('');
    setError(undefined);
    setPassed(undefined);
    setTestResults([]);

    // Watchdog execution guard: abort & recover worker after 5000ms
    watchdogTimerRef.current = setTimeout(() => {
      if (workerRef.current) {
        workerRef.current.terminate();
        workerRef.current = null;
      }
      setIsRunning(false);
      setPassed(false);
      setExecutionTimeMs(WATCHDOG_TIMEOUT_MS);
      setMemoryUsageMb(18.5);
      const timeoutMsg = 'Time Limit Exceeded: Execution timed out (5000ms limit). Your code may contain an infinite loop or excessive recursion.';
      setStderr(timeoutMsg);
      setError('Time Limit Exceeded');
      setTestResults([]);

      // Auto-recover Pyodide worker for subsequent runs
      spawnWorker();
    }, WATCHDOG_TIMEOUT_MS);

    workerRef.current.postMessage({
      type: 'run',
      code,
      testCases,
    });
  }, [clearWatchdog, spawnWorker]);

  const resetOutput = useCallback(() => {
    clearWatchdog();
    setStdout('');
    setStderr('');
    setError(undefined);
    setPassed(undefined);
    setTestResults([]);
    setExecutionTimeMs(0);
    setMemoryUsageMb(undefined);
  }, [clearWatchdog]);

  return {
    isReady,
    isLoading,
    isRunning,
    stdout,
    stderr,
    executionTimeMs,
    memoryUsageMb,
    passed,
    testResults,
    error,
    runCode,
    resetOutput,
  };
}
