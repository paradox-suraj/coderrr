'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import DOMPurify from 'dompurify';
import {
  Play,
  RotateCcw,
  CheckCircle2,
  ExternalLink,
  Flame,
  BrainCircuit,
  BookOpen,
  Save,
  Clock,
  Terminal,
  ArrowLeft,
  FileText,
  Layers,
  Lock,
  NotebookPen,
  Plus,
  Trophy,
  AlertCircle,
  ListChecks,
  Check,
  X,
  Zap,
  Laptop,
  MoreHorizontal,
  FileCode2,
  Copy
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/lib/hooks/useIsMobile';
import { usePyodide } from '@/lib/workers/usePyodide';
import {
  getProblemProgress,
  upsertProblemProgress,
  getProblemCode,
  saveProblemCode,
  getProblemNotes,
  isCodeValidForLanguage,
  type UserProgress,
  type ProblemStatus,
  type SupportedLanguage
} from '@/lib/db';
import { calculateSM2 } from '@/lib/db/sm2';
import { LANGUAGE_CONFIGS, executeCodeUniversal } from '@/lib/runners/codeExecutor';
import { parseTestCasesFromHtml, type TestCase, type TestCaseResult } from '@/lib/runners/testCaseParser';
import LanguageSelector from './LanguageSelector';
import CelebrationCanvas from './CelebrationCanvas';
import SubmissionBanner, { type SubmissionBannerData } from './SubmissionBanner';
import WorkspaceTimer from './WorkspaceTimer';
import { useStrictInterviewMode } from '@/lib/hooks/useStrictInterviewMode';
import type { ProblemDoc } from '@/lib/workers/search.worker';
import type { CompanyMappingDoc } from '@/lib/data/problems';

// Dynamic import for Monaco Editor to avoid SSR hydration mismatch
const MonacoEditor = dynamic(() => import('@monaco-editor/react'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex flex-col items-center justify-center bg-card/80 text-muted-foreground gap-3">
      <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      <span className="text-xs font-mono">Initializing Monaco Workspace...</span>
    </div>
  ),
});

// Dynamic import for Monaco Diff Editor
const MonacoDiffEditor = dynamic(
  () => import('@monaco-editor/react').then((mod) => mod.DiffEditor),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-44 flex items-center justify-center bg-card/80 text-muted-foreground gap-2">
        <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        <span className="text-xs font-mono">Loading Diff Viewer...</span>
      </div>
    ),
  }
);

interface ProblemWorkspaceProps {
  problem: ProblemDoc;
  companyMappings: CompanyMappingDoc[];
  reviewMode?: boolean;
}

export default function ProblemWorkspace({ problem, companyMappings, reviewMode }: ProblemWorkspaceProps) {
  // ─── Multi-Language & Code State (Dictionary mapping [language]: string) ──
  const [currentLanguage, setCurrentLanguage] = useState<SupportedLanguage>('python');
  const [codeByLanguage, setCodeByLanguage] = useState<Record<SupportedLanguage, string>>(() => ({
    python: LANGUAGE_CONFIGS.python.defaultCode(problem.title, problem.id, problem.descriptionHtml),
    javascript: LANGUAGE_CONFIGS.javascript.defaultCode(problem.title, problem.id, problem.descriptionHtml),
    cpp: LANGUAGE_CONFIGS.cpp.defaultCode(problem.title, problem.id, problem.descriptionHtml),
    java: LANGUAGE_CONFIGS.java.defaultCode(problem.title, problem.id, problem.descriptionHtml),
  }));
  const [notes, setNotes] = useState<string>('');
  const [isSaved, setIsSaved] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<'description' | 'architecture' | 'scratchpad'>('description');
  const [activeConsoleTab, setActiveConsoleTab] = useState<'testcases' | 'console' | 'tests'>('testcases');

  // ─── Header Overflow Popover & Diff Viewer State ─────────────────────────
  const [showOverflowMenu, setShowOverflowMenu] = useState(false);
  const overflowMenuRef = useRef<HTMLDivElement>(null);
  const [isSplitDiff, setIsSplitDiff] = useState(true);
  const [injectedNotice, setInjectedNotice] = useState<string | null>(null);
  const descriptionRef = useRef<HTMLDivElement>(null);

  // Close overflow menu on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (overflowMenuRef.current && !overflowMenuRef.current.contains(e.target as Node)) {
        setShowOverflowMenu(false);
      }
    }
    if (showOverflowMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showOverflowMenu]);

  // ─── Timer & Strict Interview Mode State ─────────────────────────────────
  const [strictModeEnabled, setStrictModeEnabled] = useState<boolean>(true);
  const [isTimerRunning, setIsTimerRunning] = useState<boolean>(false);

  const { tabSwitchCount, activeWarning, dismissWarning, resetViolations } = useStrictInterviewMode({
    enabled: strictModeEnabled && isTimerRunning,
  });

  // ─── Test Cases & Submission State ───────────────────────────────────────
  const initialTestCases = useMemo(() => {
    const parsed = parseTestCasesFromHtml(problem.descriptionHtml);
    if (parsed.length > 0) return parsed;
    return [
      {
        id: 'case-1',
        input: 'target = 0',
        expectedOutput: '0',
      },
    ];
  }, [problem.descriptionHtml]);

  const [testCases, setTestCases] = useState<TestCase[]>(initialTestCases);
  const [activeCaseIndex, setActiveCaseIndex] = useState<number>(0);
  const [genericTestResults, setGenericTestResults] = useState<TestCaseResult[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionBanner, setSubmissionBanner] = useState<SubmissionBannerData | null>(null);
  const [showCelebration, setShowCelebration] = useState(false);

  // Generic execution output state (for JS, C++, Java)
  const [genericStdout, setGenericStdout] = useState('');
  const [genericStderr, setGenericStderr] = useState('');
  const [genericExecutionTimeMs, setGenericExecutionTimeMs] = useState(0);
  const [genericMemoryMb, setGenericMemoryMb] = useState(12.8);
  const [genericPassed, setGenericPassed] = useState<boolean | undefined>(undefined);
  const [isGenericRunning, setIsGenericRunning] = useState(false);

  // ─── SM-2 Spaced Repetition State ──────────────────────────────────────────
  const [userProgress, setUserProgress] = useState<UserProgress | null>(null);
  const [sm2SuccessMsg, setSm2SuccessMsg] = useState<string | null>(null);
  const [justCompletedTick, setJustCompletedTick] = useState(false);
  const completedTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (completedTimerRef.current) clearTimeout(completedTimerRef.current);
    };
  }, []);

  const handleToggleComplete = async () => {
    const isCurrentlySolved = userProgress?.status === 'solved';
    const newStatus: ProblemStatus = isCurrentlySolved ? 'attempted' : 'solved';
    const updatedProg: UserProgress = {
      problemId: problem.id,
      status: newStatus,
      revisions: userProgress?.revisions ?? (isCurrentlySolved ? 0 : 1),
      easeFactor: userProgress?.easeFactor ?? 2.5,
      intervalDays: userProgress?.intervalDays ?? (isCurrentlySolved ? 0 : 1),
      nextReviewDate: userProgress?.nextReviewDate ?? new Date().toISOString(),
      lastSolved: !isCurrentlySolved ? new Date().toISOString() : userProgress?.lastSolved,
    };
    await upsertProblemProgress(updatedProg);
    setUserProgress(updatedProg);
    if (!isCurrentlySolved) {
      setJustCompletedTick(true);
      setTimeout(() => setJustCompletedTick(false), 4000);
    }
  };

  // ─── Pyodide Worker Execution (Python) ────────────────────────────────────
  const {
    isReady: isPyodideReady,
    isLoading: isPyodideLoading,
    isRunning: isPyodideRunning,
    stdout: pyodideStdout,
    stderr: pyodideStderr,
    executionTimeMs: pyodideExecutionTimeMs,
    memoryUsageMb: pyodideMemoryMb,
    passed: pyodidePassed,
    testResults: pyodideTestResults,
    error: pyodideError,
    runCode: runPyodideCode,
    resetOutput: resetPyodideOutput,
  } = usePyodide();

  // Active outputs based on language
  const isPython = currentLanguage === 'python';
  const isRunning = isPython ? isPyodideRunning : isGenericRunning;
  const stdout = isPython ? pyodideStdout : genericStdout;
  const stderr = isPython ? pyodideStderr : genericStderr;
  const executionTimeMs = isPython ? pyodideExecutionTimeMs : genericExecutionTimeMs;
  const passed = isPython ? pyodidePassed : genericPassed;
  const testResults = isPython ? pyodideTestResults : genericTestResults;
  const memoryUsageMb = isPython ? pyodideMemoryMb : genericMemoryMb;

  // Watch Python submission completion
  useEffect(() => {
    if (isSubmitting && isPython && !isPyodideRunning) {
      setIsSubmitting(false);

      if (pyodideError) {
        const errShort = pyodideError.split('\n').filter(Boolean).pop() || 'Execution error';
        setSubmissionBanner({
          status: 'Runtime Error',
          message: errShort,
          passedCases: 0,
          totalCases: testCases.length,
          latencyMs: pyodideExecutionTimeMs,
        });
        return;
      }

      if (!pyodideTestResults || pyodideTestResults.length === 0) {
        setSubmissionBanner({
          status: 'Runtime Error',
          message: pyodideStderr || 'Execution finished without test results. Please define class Solution or a function.',
          passedCases: 0,
          totalCases: testCases.length,
          latencyMs: pyodideExecutionTimeMs,
        });
        return;
      }

      const passedCount = pyodideTestResults.filter((r) => r.passed).length;
      const allPassed = pyodideTestResults.length > 0 && passedCount === pyodideTestResults.length;
      const failingIdx = pyodideTestResults.findIndex((r) => !r.passed);

      if (allPassed) {
        setSubmissionBanner({
          status: 'Accepted',
          message: 'All test cases passed! Solution verified.',
          passedCases: passedCount,
          totalCases: testCases.length,
          latencyMs: pyodideExecutionTimeMs,
        });
        setShowCelebration(true);

        const sm2 = calculateSM2(
          4,
          userProgress?.easeFactor ?? 2.5,
          userProgress?.intervalDays ?? 0,
          userProgress?.revisions ?? 0
        );
        const updatedProg: UserProgress = {
          problemId: problem.id,
          status: 'solved',
          revisions: sm2.repetitions,
          easeFactor: sm2.easeFactor,
          intervalDays: sm2.intervalDays,
          nextReviewDate: sm2.nextReviewDate,
          lastSolved: new Date().toISOString(),
        };

        // Persist immediately in database
        upsertProblemProgress(updatedProg);

        // After exactly 1s, tick that as completed in the UI with animation
        if (completedTimerRef.current) clearTimeout(completedTimerRef.current);
        completedTimerRef.current = setTimeout(() => {
          setUserProgress(updatedProg);
          setJustCompletedTick(true);
          setTimeout(() => setJustCompletedTick(false), 4000);
        }, 1000);
      } else {
        if (failingIdx >= 0) {
          setActiveCaseIndex(failingIdx);
        }
        setSubmissionBanner({
          status: 'Wrong Answer',
          message: `Failed on Test Case ${failingIdx + 1}.`,
          passedCases: passedCount,
          totalCases: testCases.length,
          latencyMs: pyodideExecutionTimeMs,
          failingCaseIndex: failingIdx >= 0 ? failingIdx : 0,
        });
      }
    }
  }, [
    isSubmitting,
    isPython,
    isPyodideRunning,
    pyodideTestResults,
    pyodideExecutionTimeMs,
    pyodideError,
    pyodideStderr,
    testCases.length,
    problem.id,
    userProgress,
  ]);

  // Submission Safety Timeout (15 seconds) preventing infinite hang
  useEffect(() => {
    if (!isSubmitting) return;
    const timer = setTimeout(() => {
      setIsSubmitting(false);
      setIsGenericRunning(false);
      setSubmissionBanner({
        status: 'Time Limit Exceeded',
        message: 'Execution timed out after 15,000ms. Please check for infinite loops or syntax issues.',
        passedCases: 0,
        totalCases: testCases.length,
        latencyMs: 15000,
      });
    }, 15000);
    return () => clearTimeout(timer);
  }, [isSubmitting, testCases.length]);

  // Active code for currently selected language (with syntax validity safeguard)
  const currentCode =
    codeByLanguage[currentLanguage] && isCodeValidForLanguage(codeByLanguage[currentLanguage], currentLanguage)
      ? codeByLanguage[currentLanguage]
      : LANGUAGE_CONFIGS[currentLanguage].defaultCode(problem.title, problem.id, problem.descriptionHtml);

  // Initial load on mount
  useEffect(() => {
    async function loadSavedData() {
      // 1. Load notes (shared across languages)
      const savedNotes = await getProblemNotes(problem.id);
      if (savedNotes) setNotes(savedNotes);

      // 2. Load progress
      const progress = await getProblemProgress(problem.id);
      if (progress) setUserProgress(progress);

      // 3. Load saved code drafts from Dexie for all supported languages
      const languages: SupportedLanguage[] = ['python', 'cpp', 'java', 'javascript'];
      const loadedDrafts: Partial<Record<SupportedLanguage, string>> = {};

      for (const lang of languages) {
        try {
          const savedRecord = await getProblemCode(problem.id, lang);
          if (savedRecord && savedRecord.code && isCodeValidForLanguage(savedRecord.code, lang)) {
            loadedDrafts[lang] = savedRecord.code;
          }
        } catch {
          // Default starter template retained
        }
      }

      if (Object.keys(loadedDrafts).length > 0) {
        setCodeByLanguage((prev) => ({
          ...prev,
          ...loadedDrafts,
        }));
      }
    }

    loadSavedData();
  }, [problem.id]);

  // Handle language switch
  const handleLanguageChange = (newLang: SupportedLanguage) => {
    // Auto-save current language draft before switching only if valid
    const currentBuffer = codeByLanguage[currentLanguage];
    if (currentBuffer && isCodeValidForLanguage(currentBuffer, currentLanguage)) {
      saveProblemCode(problem.id, currentBuffer, currentLanguage, notes);
    }

    // Ensure the target language has code populated in the dictionary and is valid
    setCodeByLanguage((prev) => {
      const existing = prev[newLang];
      if (!existing || !isCodeValidForLanguage(existing, newLang)) {
        return {
          ...prev,
          [newLang]: LANGUAGE_CONFIGS[newLang].defaultCode(problem.title, problem.id, problem.descriptionHtml),
        };
      }
      return prev;
    });

    setCurrentLanguage(newLang);
    setIsSaved(true);
  };

  // Reset current buffer to clean starter template
  const handleResetToStarterCode = () => {
    const starter = LANGUAGE_CONFIGS[currentLanguage].defaultCode(
      problem.title,
      problem.id,
      problem.descriptionHtml
    );
    setCodeByLanguage((prev) => ({
      ...prev,
      [currentLanguage]: starter,
    }));
    saveProblemCode(problem.id, starter, currentLanguage, notes);
    setIsSaved(true);
  };

  // Auto-Save Scratchpad & Code to IndexedDB
  const handleSave = useCallback(
    async (codeToSave = codeByLanguage[currentLanguage], notesToSave = notes) => {
      await saveProblemCode(problem.id, codeToSave, currentLanguage, notesToSave);
      setIsSaved(true);
    },
    [problem.id, codeByLanguage, currentLanguage, notes]
  );

  const handleCodeChange = (value?: string) => {
    const val = value ?? '';
    setCodeByLanguage((prev) => ({
      ...prev,
      [currentLanguage]: val,
    }));
    setIsSaved(false);
  };

  const handleNotesChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setNotes(e.target.value);
    setIsSaved(false);
  };

  // Testcase modification helpers
  const handleAddTestCase = () => {
    const newCase: TestCase = {
      id: `case-${testCases.length + 1}`,
      input: 'target = 0',
      expectedOutput: '0',
      isCustom: true,
    };
    setTestCases((prev) => [...prev, newCase]);
    setActiveCaseIndex(testCases.length);
  };

  const handleUpdateCaseInput = (index: number, val: string) => {
    setTestCases((prev) => {
      const copy = [...prev];
      if (copy[index]) {
        copy[index] = { ...copy[index], input: val };
      }
      return copy;
    });
  };

  const handleUpdateCaseExpected = (index: number, val: string) => {
    setTestCases((prev) => {
      const copy = [...prev];
      if (copy[index]) {
        copy[index] = { ...copy[index], expectedOutput: val };
      }
      return copy;
    });
  };

  // Run Code Universal Dispatcher
  const handleRunCode = useCallback(async () => {
    const codeToRun = codeByLanguage[currentLanguage] ?? '';
    handleSave(codeToRun, notes);
    setActiveConsoleTab('testcases');
    setSubmissionBanner(null);

    if (currentLanguage === 'python') {
      runPyodideCode(codeToRun, testCases);
      return;
    }

    // JavaScript / C++ / Java execution
    setIsGenericRunning(true);
    setGenericStdout('');
    setGenericStderr('');
    setGenericPassed(undefined);
    setGenericTestResults([]);

    try {
      const res = await executeCodeUniversal(currentLanguage, codeToRun, {
        testCases,
      });
      setGenericStdout(res.stdout);
      setGenericStderr(res.stderr);
      setGenericExecutionTimeMs(res.executionTimeMs);
      setGenericPassed(res.passed);
      setGenericTestResults(res.testResults || []);
    } catch (err: any) {
      setGenericStderr(err.message || 'Execution error');
      setGenericPassed(false);
    } finally {
      setIsGenericRunning(false);
    }
  }, [currentLanguage, codeByLanguage, notes, handleSave, runPyodideCode, testCases]);

  // Submit Solution Universal Dispatcher
  const handleSubmitCode = useCallback(async () => {
    setIsSubmitting(true);
    setActiveConsoleTab('testcases');
    setSubmissionBanner(null);
    const codeToRun = codeByLanguage[currentLanguage] ?? '';
    handleSave(codeToRun, notes);

    if (currentLanguage === 'python') {
      runPyodideCode(codeToRun, testCases);
      return;
    }

    // JavaScript / C++ / Java execution
    setIsGenericRunning(true);
    setGenericStdout('');
    setGenericStderr('');
    setGenericPassed(undefined);
    setGenericTestResults([]);

    try {
      const res = await executeCodeUniversal(currentLanguage, codeToRun, {
        testCases,
      });
      setGenericStdout(res.stdout);
      setGenericStderr(res.stderr);
      setGenericExecutionTimeMs(res.executionTimeMs);
      setGenericPassed(res.passed);
      setGenericTestResults(res.testResults || []);

      const latency = res.executionTimeMs;
      const results = res.testResults || [];
      const passedCount = results.filter((r) => r.passed).length;
      const allPassed = results.length > 0 && passedCount === results.length;
      const failingIdx = results.findIndex((r) => !r.passed);

      if (allPassed) {
        setSubmissionBanner({
          status: 'Accepted',
          message: 'All test cases passed! Solution verified.',
          passedCases: passedCount,
          totalCases: testCases.length,
          latencyMs: latency,
        });
        setShowCelebration(true);
        const sm2 = calculateSM2(
          4,
          userProgress?.easeFactor ?? 2.5,
          userProgress?.intervalDays ?? 0,
          userProgress?.revisions ?? 0
        );
        const updatedProg: UserProgress = {
          problemId: problem.id,
          status: 'solved',
          revisions: sm2.repetitions,
          easeFactor: sm2.easeFactor,
          intervalDays: sm2.intervalDays,
          nextReviewDate: sm2.nextReviewDate,
          lastSolved: new Date().toISOString(),
        };
        // Persist immediately in database
        await upsertProblemProgress(updatedProg);

        // After exactly 1s, tick that as completed in the UI with animation
        if (completedTimerRef.current) clearTimeout(completedTimerRef.current);
        completedTimerRef.current = setTimeout(() => {
          setUserProgress(updatedProg);
          setJustCompletedTick(true);
          setTimeout(() => setJustCompletedTick(false), 4000);
        }, 1000);
      } else {
        if (failingIdx >= 0) {
          setActiveCaseIndex(failingIdx);
        }
        setSubmissionBanner({
          status: (res.submissionStatus as any) || 'Wrong Answer',
          message: `Failed on Test Case ${failingIdx + 1}.`,
          passedCases: passedCount,
          totalCases: testCases.length,
          latencyMs: latency,
          failingCaseIndex: failingIdx >= 0 ? failingIdx : 0,
        });
      }
    } catch (err: any) {
      setGenericStderr(err.message || 'Execution error');
      setGenericPassed(false);
    } finally {
      setIsGenericRunning(false);
      setIsSubmitting(false);
    }
  }, [currentLanguage, codeByLanguage, notes, handleSave, runPyodideCode, testCases, problem.id, userProgress]);

  // Keyboard shortcuts: Ctrl+Enter (Run) / Ctrl+Shift+Enter (Submit)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'Enter') {
        e.preventDefault();
        handleSubmitCode();
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        handleRunCode();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleRunCode, handleSubmitCode]);

  // Reset Console
  const handleResetConsole = () => {
    if (isPython) {
      resetPyodideOutput();
    } else {
      setGenericStdout('');
      setGenericStderr('');
      setGenericExecutionTimeMs(0);
      setGenericPassed(undefined);
    }
  };

  // ─── SM-2 Recall Quality Rating Handler (1 to 5) ───────────────────────────
  const handleRateRecall = async (quality: number) => {
    const currentEf = userProgress?.easeFactor ?? 2.5;
    const currentInterval = userProgress?.intervalDays ?? 0;
    const currentReps = userProgress?.revisions ?? 0;

    const sm2Result = calculateSM2(quality, currentEf, currentInterval, currentReps);

    const updatedProgress: UserProgress = {
      problemId: problem.id,
      status: 'solved',
      revisions: sm2Result.repetitions,
      easeFactor: sm2Result.easeFactor,
      intervalDays: sm2Result.intervalDays,
      nextReviewDate: sm2Result.nextReviewDate,
      lastSolved: new Date().toISOString(),
    };

    await upsertProblemProgress(updatedProgress);
    setUserProgress(updatedProgress);

    setSm2SuccessMsg(
      `SM-2 updated: Next review in ${sm2Result.intervalDays} day${
        sm2Result.intervalDays === 1 ? '' : 's'
      } (EF: ${sm2Result.easeFactor})`
    );

    setTimeout(() => setSm2SuccessMsg(null), 4000);
  };

  const currentConfig = LANGUAGE_CONFIGS[currentLanguage];

  // Memoize sanitized HTML description (browser-only DOMPurify execution)
  const sanitizedDescription = useMemo(() => {
    if (!problem.descriptionHtml) return '';
    if (typeof window !== 'undefined' && typeof DOMPurify?.sanitize === 'function') {
      return DOMPurify.sanitize(problem.descriptionHtml);
    }
    return problem.descriptionHtml;
  }, [problem.descriptionHtml]);

  // Memoized parsed examples from description HTML
  const parsedExamples = useMemo(() => {
    return parseTestCasesFromHtml(problem.descriptionHtml);
  }, [problem.descriptionHtml]);

  // Handler for adding/injecting an example into test cases runner
  const handleInjectExample = useCallback(
    (example: { input: string; expectedOutput: string; explanation?: string }, label?: string) => {
      const newCase: TestCase = {
        id: `case-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        input: example.input,
        expectedOutput: example.expectedOutput,
        isCustom: true,
        explanation: example.explanation,
      };

      setTestCases((prev) => {
        const next = [...prev, newCase];
        setActiveCaseIndex(next.length - 1);
        return next;
      });
      setActiveConsoleTab('testcases');
      setInjectedNotice(label ? `Injected "${label}" into Test Cases` : 'Example added to Test Cases');
      setTimeout(() => setInjectedNotice(null), 3500);
    },
    []
  );

  // In-situ DOM button injection for Example pre and example-block elements
  useEffect(() => {
    if (!descriptionRef.current) return;
    const container = descriptionRef.current;

    const blocks = container.querySelectorAll<HTMLElement>('pre, .example-block');
    blocks.forEach((block, idx) => {
      if (block.querySelector('.algojeet-inject-btn')) return;

      const text = block.innerText || block.textContent || '';
      if (!text.toLowerCase().includes('input:') || !text.toLowerCase().includes('output:')) {
        return;
      }

      const inputMatch = /Input:\s*([\s\S]*?)(?:Output:|$)/i.exec(text);
      const outputMatch = /Output:\s*([\s\S]*?)(?:Explanation:|$)/i.exec(text);

      const inputVal = inputMatch ? inputMatch[1].trim() : '';
      const outputVal = outputMatch ? outputMatch[1].trim() : '';

      if (!inputVal && !outputVal) return;

      block.style.position = 'relative';

      const btn = document.createElement('button');
      btn.className =
        'algojeet-inject-btn absolute top-2 right-2 px-2.5 py-1 rounded-md bg-secondary/90 hover:bg-primary/20 text-neutral-300 hover:text-primary border border-white/10 hover:border-primary/40 text-[11px] font-mono font-medium transition-all flex items-center gap-1.5 cursor-pointer shadow-sm z-10';
      btn.innerHTML = `
        <svg class="w-3.5 h-3.5 text-primary" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12 7-7 7 7"/><path d="M12 19V5"/></svg>
        <span>Copy to Runner</span>
      `;
      btn.title = 'Add this example directly to Test Cases runner';

      btn.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        handleInjectExample(
          {
            input: inputVal,
            expectedOutput: outputVal,
          },
          `Example ${idx + 1}`
        );
      };

      block.appendChild(btn);
    });
  }, [sanitizedDescription, handleInjectExample]);

  // SM-2 Spaced Recall Rating Section
  const renderSm2RatingSection = () => (
    <div className="p-4 rounded-xl bg-card border border-border/80 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-primary" />
          <span className="font-semibold text-xs">SM-2 Spaced Recall Rating</span>
        </div>
        {userProgress?.nextReviewDate && (
          <span className="text-[11px] font-mono text-muted-foreground">
            Next: {new Date(userProgress.nextReviewDate).toLocaleDateString()}
          </span>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        Rate recall quality after solving (1 = Complete Lapse, 5 = Flawless Recall):
      </p>

      <div className="grid grid-cols-5 gap-2">
        {[
          { val: 1, label: 'Blackout' },
          { val: 2, label: 'Struggled' },
          { val: 3, label: 'Hesitant' },
          { val: 4, label: 'Solid' },
          { val: 5, label: 'Mastered' },
        ].map(({ val, label }) => (
          <button
            key={val}
            onClick={() => handleRateRecall(val)}
            className="flex flex-col items-center justify-center p-2 rounded-lg bg-secondary/60 hover:bg-primary/20 hover:text-primary border border-border/60 hover:border-primary/40 transition-all cursor-pointer"
          >
            <span className="font-mono font-bold text-sm">{val}</span>
            <span className="text-[10px] text-muted-foreground">{label}</span>
          </button>
        ))}
      </div>

      {sm2SuccessMsg && (
        <div className="p-2 rounded-md bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-mono text-center animate-in fade-in">
          {sm2SuccessMsg}
        </div>
      )}
    </div>
  );

  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <div className="flex-1 flex flex-col h-screen overflow-hidden bg-background text-foreground relative">
        <header className="h-14 border-b border-border/80 px-4 flex items-center gap-3 bg-card/60 backdrop-blur-md shrink-0 z-20">
          <Link
            href="/problems"
            className="p-2 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
            title="Back to Problems"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div className="flex items-center gap-2 truncate">
            <h1 className="font-bold text-sm truncate">{problem.title}</h1>
            <span
              className={cn(
                'text-[10px] font-semibold px-2 py-0.5 rounded-full border shrink-0',
                problem.difficulty === 'Easy' && 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10',
                problem.difficulty === 'Medium' && 'text-amber-400 border-amber-500/30 bg-amber-500/10',
                problem.difficulty === 'Hard' && 'text-rose-400 border-rose-500/30 bg-rose-500/10'
              )}
            >
              {problem.difficulty}
            </span>
            {(userProgress?.status === 'solved' || justCompletedTick) && (
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 shrink-0">
                <Check className="w-3 h-3 stroke-[3]" />
                <span>Completed</span>
              </span>
            )}
          </div>
        </header>
        
        <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-6">
          <div className="flex flex-wrap items-center gap-2 pb-3 border-b border-border/50">
            <span className="px-2.5 py-1 rounded-md bg-secondary text-foreground text-xs font-medium border border-border/60 flex items-center gap-1.5">
              <BrainCircuit className="w-3.5 h-3.5 text-primary" />
              <span>{problem.learningTrack}</span>
            </span>
            <span className="px-2.5 py-1 rounded-md bg-secondary/70 text-muted-foreground text-xs font-mono border border-border/40 flex items-center gap-1">
              <Flame className="w-3 h-3 text-orange-400" />
              <span>{problem.companiesCount} Companies</span>
            </span>
          </div>

          {problem.descriptionHtml && (
            <div
              className="problem-description select-text"
              dangerouslySetInnerHTML={{ __html: sanitizedDescription }}
            />
          )}

          {userProgress?.status === 'solved' && renderSm2RatingSection()}
        </div>

        <div className="sticky bottom-0 border-t border-border/80 bg-card/95 p-3 flex items-center gap-3 text-xs text-muted-foreground backdrop-blur-md shadow-lg border-t-primary/20">
          <Laptop className="w-5 h-5 text-primary shrink-0" />
          <span className="leading-snug">AlgoJeet Pro coding workspace requires a desktop browser. Mobile read-only mode active.</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-screen overflow-hidden bg-background text-foreground relative problem-workspace-content">
      {/* Strict Anti-Cheat Mode Violation Alert Toast */}
      {activeWarning && (
        <div
          role="alert"
          className="absolute top-16 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-4 py-2.5 rounded-xl bg-rose-950/95 border border-rose-500/60 text-rose-200 shadow-2xl shadow-rose-950/60 backdrop-blur-md animate-in fade-in slide-in-from-top-3 duration-200 text-xs font-semibold"
        >
          <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping shrink-0" />
          <span>{activeWarning.message}</span>
          <button
            onClick={dismissWarning}
            className="ml-2 p-1 rounded-md hover:bg-white/10 text-rose-300 hover:text-white transition-colors cursor-pointer"
            aria-label="Dismiss warning"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Celebration Particles & Emojis Canvas */}
      <CelebrationCanvas active={showCelebration} onComplete={() => setShowCelebration(false)} />

      {/* Top Navigation Bar */}
      <header className="h-14 border-b border-border/80 px-4 flex items-center justify-between bg-card/60 backdrop-blur-md shrink-0 z-20">
        <div className="flex items-center gap-3 min-w-0">
          <Link
            href="/problems"
            className="p-2 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
            title="Back to Problems"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>

          <div className="flex items-center gap-2 truncate">
            <span className="font-mono text-xs text-muted-foreground font-semibold">
              #{problem.id}
            </span>
            <h1 className="font-bold text-sm truncate">{problem.title}</h1>
            <span
              className={cn(
                'text-[10px] font-semibold px-2 py-0.5 rounded-full border shrink-0',
                problem.difficulty === 'Easy' &&
                  'text-emerald-400 border-emerald-500/30 bg-emerald-500/10',
                problem.difficulty === 'Medium' &&
                  'text-amber-400 border-amber-500/30 bg-amber-500/10',
                problem.difficulty === 'Hard' &&
                  'text-rose-400 border-rose-500/30 bg-rose-500/10'
              )}
            >
              {problem.difficulty}
            </span>

            {/* Completed Tick Badge */}
            {(userProgress?.status === 'solved' || justCompletedTick) ? (
              <button
                onClick={handleToggleComplete}
                title="Status: Completed (Click to toggle)"
                className={cn(
                  'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold shrink-0 cursor-pointer transition-all duration-300',
                  justCompletedTick
                    ? 'bg-emerald-500/30 text-emerald-300 border border-emerald-400 scale-105 shadow-md shadow-emerald-500/25 ring-2 ring-emerald-400/40 animate-pulse'
                    : 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/25'
                )}
              >
                <CheckCircle2 className={cn('w-3.5 h-3.5 text-emerald-400', justCompletedTick && 'stroke-[2.5]')} />
                <span>Completed</span>
              </button>
            ) : (
              <button
                onClick={handleToggleComplete}
                title="Mark as completed"
                className="hidden sm:inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium text-neutral-400 hover:text-emerald-400 hover:bg-emerald-500/10 border border-white/[0.08] hover:border-emerald-500/30 shrink-0 cursor-pointer transition-colors"
              >
                <Check className="w-3 h-3" />
                <span>Mark Completed</span>
              </button>
            )}
          </div>
        </div>

        {/* Action Buttons: Primary focus on Language, Run, Submit; Overflow for secondary items */}
        <div className="flex items-center gap-2 sm:gap-2.5">
          {/* Active Timer Pill Indicator (if timer is active) */}
          {isTimerRunning && (
            <button
              onClick={() => setShowOverflowMenu(true)}
              className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-primary/10 border border-primary/30 text-primary font-mono text-xs font-semibold animate-pulse cursor-pointer"
              title="Interview timer running — click for options"
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Timer Active</span>
            </button>
          )}

          {/* Primary 1: Language Selector */}
          <div className="hidden sm:block">
            <LanguageSelector
              currentLanguage={currentLanguage}
              onLanguageChange={handleLanguageChange}
              disabled={isRunning}
            />
          </div>

          {/* Primary 2: Run Code Button */}
          <button
            onClick={handleRunCode}
            disabled={isRunning || isSubmitting || (isPython && isPyodideLoading)}
            aria-label="Run code against test cases"
            className={cn(
              'px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 border transition-all cursor-pointer select-none',
              isRunning
                ? 'bg-amber-500/15 text-amber-400 border-amber-500/30 animate-pulse'
                : 'bg-secondary hover:bg-secondary/80 text-foreground border-border/80'
            )}
            title="Run code against test cases (Ctrl+Enter)"
          >
            <Play className={cn('w-3.5 h-3.5 fill-current text-primary', isRunning && 'animate-spin')} />
            <span>{isRunning ? 'Running...' : 'Run Code'}</span>
            <kbd className="hidden lg:inline text-[10px] bg-black/30 px-1.5 py-0.5 rounded text-muted-foreground font-mono">
              ⌘↵
            </kbd>
          </button>

          {/* Primary 3: Submit Solution Button */}
          <button
            onClick={handleSubmitCode}
            disabled={isRunning || isSubmitting || (isPython && isPyodideLoading)}
            aria-label="Submit solution and evaluate all test cases"
            className={cn(
              'px-4 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-sm select-none',
              isSubmitting
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 animate-pulse'
                : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-950/40'
            )}
            title="Submit solution and verify all test cases (Ctrl+Shift+Enter)"
          >
            <CheckCircle2 className={cn('w-3.5 h-3.5', isSubmitting && 'animate-spin')} />
            <span>{isSubmitting ? 'Evaluating...' : 'Submit'}</span>
            <kbd className="hidden lg:inline text-[10px] bg-black/25 px-1.5 py-0.5 rounded text-emerald-100 font-mono">
              ⇧⌘↵
            </kbd>
          </button>

          {/* Secondary Items Overflow Popover */}
          <div className="relative" ref={overflowMenuRef}>
            <button
              onClick={() => setShowOverflowMenu((prev) => !prev)}
              aria-label="Workspace tools & overflow menu"
              className={cn(
                'p-2 rounded-lg border text-muted-foreground hover:text-foreground transition-all cursor-pointer flex items-center justify-center',
                showOverflowMenu
                  ? 'bg-secondary text-foreground border-primary/40'
                  : 'bg-secondary/60 hover:bg-secondary border-border/60'
              )}
              title="Workspace tools (Timer, Save, LeetCode link)"
            >
              <MoreHorizontal className="w-4 h-4" />
            </button>

            {showOverflowMenu && (
              <div className="absolute right-0 top-full mt-2 w-76 p-3 rounded-xl bg-neutral-900 border border-white/10 shadow-2xl z-50 flex flex-col gap-3 backdrop-blur-xl animate-in fade-in zoom-in-95">
                <div className="flex items-center justify-between px-1">
                  <span className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider">
                    Workspace Options
                  </span>
                  <button
                    onClick={() => setShowOverflowMenu(false)}
                    className="text-neutral-500 hover:text-neutral-300 p-0.5 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Interview Timer & Strict Controls */}
                <div className="p-2.5 rounded-lg bg-neutral-950/80 border border-white/5 flex flex-col gap-2">
                  <div className="flex items-center justify-between text-[11px] text-neutral-300 font-medium">
                    <span className="flex items-center gap-1.5">
                      <Clock className="w-3 h-3 text-primary" />
                      <span>Interview Timer</span>
                    </span>
                    {strictModeEnabled && (
                      <span className="text-[10px] text-amber-400 bg-amber-400/10 px-1.5 py-0.2 rounded font-mono">
                        Strict Active
                      </span>
                    )}
                  </div>
                  <WorkspaceTimer
                    tabSwitchCount={tabSwitchCount}
                    strictModeEnabled={strictModeEnabled}
                    onToggleStrictMode={setStrictModeEnabled}
                    onTimerRunningChange={setIsTimerRunning}
                    onResetViolations={resetViolations}
                  />
                </div>

                {/* Save & Reset Actions */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      handleSave();
                      setShowOverflowMenu(false);
                    }}
                    className={cn(
                      'flex-1 px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 border transition-all cursor-pointer',
                      isSaved
                        ? 'bg-secondary/60 text-muted-foreground border-border/60 hover:text-foreground'
                        : 'bg-primary/10 text-primary border-primary/30 animate-pulse'
                    )}
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>{isSaved ? 'Saved to DB' : 'Save Code'}</span>
                  </button>

                  <button
                    onClick={() => {
                      handleResetToStarterCode();
                      setShowOverflowMenu(false);
                    }}
                    className="px-3 py-1.5 rounded-lg text-xs text-neutral-400 hover:text-neutral-200 bg-secondary/40 hover:bg-secondary/80 border border-border/60 transition-colors cursor-pointer flex items-center gap-1.5"
                    title="Reset to default starter template"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Reset</span>
                  </button>
                </div>

                {/* Mobile Language Selector Fallback */}
                <div className="sm:hidden pt-1 border-t border-white/5">
                  <LanguageSelector
                    currentLanguage={currentLanguage}
                    onLanguageChange={(lang) => {
                      handleLanguageChange(lang);
                      setShowOverflowMenu(false);
                    }}
                    disabled={isRunning}
                  />
                </div>

                {/* LeetCode External Link */}
                {problem.url && (
                  <a
                    href={problem.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => setShowOverflowMenu(false)}
                    className="flex items-center justify-between p-2 rounded-lg bg-secondary/30 hover:bg-secondary border border-border/40 text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <span className="flex items-center gap-1.5">
                      <span>LeetCode #{problem.id}</span>
                    </span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Split-Pane Workspace Body */}
      <div className="flex-1 flex flex-col lg:flex-row min-h-0 overflow-hidden">
        {/* ─── LEFT PANE: Context, Companies, System Architecture, SM-2 ─────── */}
        <div className="w-full lg:w-[46%] border-b lg:border-b-0 lg:border-r border-border/80 flex flex-col h-full overflow-hidden bg-card/40">
          {reviewMode && (
            <div className="flex items-center gap-2 p-3 bg-rose-500/10 border-b border-rose-500/20 text-rose-400 text-xs font-semibold shrink-0">
              <BrainCircuit className="w-4 h-4 shrink-0" />
              <span>Spaced Review Mode — Rate your recall quality after solving</span>
            </div>
          )}
          {/* Sub-tab Bar */}
          <div className="flex items-center border-b border-border/60 bg-secondary/30 px-3 shrink-0 overflow-x-auto">
            <button
              onClick={() => setActiveTab('description')}
              className={cn(
                'px-3.5 py-2.5 text-xs font-semibold border-b-2 transition-all cursor-pointer flex items-center gap-1.5 shrink-0',
                activeTab === 'description'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              )}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Description</span>
              {problem.isPaidOnly && (
                <Lock className="w-3 h-3 text-amber-400 shrink-0" />
              )}
            </button>
            <button
              onClick={() => setActiveTab('architecture')}
              className={cn(
                'px-3.5 py-2.5 text-xs font-semibold border-b-2 transition-all cursor-pointer flex items-center gap-1.5 shrink-0',
                activeTab === 'architecture'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              )}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Architecture & Meta</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-secondary text-muted-foreground border border-border/60">
                {companyMappings.length}
              </span>
            </button>
            <button
              onClick={() => setActiveTab('scratchpad')}
              className={cn(
                'px-3.5 py-2.5 text-xs font-semibold border-b-2 transition-all cursor-pointer flex items-center gap-1.5 shrink-0',
                activeTab === 'scratchpad'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              )}
            >
              <NotebookPen className="w-3.5 h-3.5" />
              <span>Personal Notes</span>
              {notes && <span className="w-1.5 h-1.5 rounded-full bg-primary" />}
            </button>
          </div>

          {/* Left Pane Content Area */}
          <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-6">
            {activeTab === 'description' && (
              <div className="flex flex-col gap-6">
                {/* Header Summary Metadata Chips */}
                <div className="flex flex-wrap items-center gap-2 pb-3 border-b border-border/50">
                  <span className="px-2.5 py-1 rounded-md bg-secondary text-foreground text-xs font-medium border border-border/60 flex items-center gap-1.5">
                    <BrainCircuit className="w-3.5 h-3.5 text-primary" />
                    <span>{problem.learningTrack}</span>
                  </span>
                  {problem.corePattern && (
                    <span className="px-2.5 py-1 rounded-md bg-primary/10 text-primary text-xs font-medium border border-primary/20">
                      {problem.corePattern}
                    </span>
                  )}
                  <span className="px-2.5 py-1 rounded-md bg-secondary/70 text-muted-foreground text-xs font-mono border border-border/40">
                    {Math.round(problem.avgAcceptance * 100)}% Acceptance
                  </span>
                  <span className="px-2.5 py-1 rounded-md bg-secondary/70 text-muted-foreground text-xs font-mono border border-border/40 flex items-center gap-1">
                    <Flame className="w-3 h-3 text-orange-400" />
                    <span>{problem.companiesCount} Companies</span>
                  </span>
                </div>

                {/* One-Click Example Injection Toolbar */}
                {parsedExamples.length > 0 && (
                  <div className="p-3 rounded-xl bg-secondary/30 border border-border/60 flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
                        <Zap className="w-3.5 h-3.5 text-primary" />
                        <span>Example Test Cases</span>
                      </div>
                      <span className="text-[10px] text-muted-foreground font-mono">
                        One-click inject into runner
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {parsedExamples.map((ex, idx) => (
                        <button
                          key={ex.id || idx}
                          type="button"
                          onClick={() => handleInjectExample(ex, `Example ${idx + 1}`)}
                          className="px-2.5 py-1 rounded-lg bg-secondary/70 hover:bg-primary/20 hover:text-primary text-neutral-300 border border-border/60 hover:border-primary/40 text-xs font-mono transition-colors flex items-center gap-1.5 cursor-pointer"
                          title={`Add Example ${idx + 1} to Test Cases runner`}
                        >
                          <Plus className="w-3 h-3 text-primary" />
                          <span>Example {idx + 1}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Example Injected Notice Toast */}
                {injectedNotice && (
                  <div className="p-2.5 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-mono flex items-center gap-2 animate-in fade-in">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>{injectedNotice}</span>
                  </div>
                )}

                {/* Problem Statement Content or Premium Locked Fallback */}
                {problem.descriptionHtml ? (
                  <div
                    ref={descriptionRef}
                    className="problem-description select-text"
                    dangerouslySetInnerHTML={{ __html: sanitizedDescription }}
                  />
                ) : (
                  <div className="p-5 rounded-xl bg-amber-500/10 border border-amber-500/30 flex flex-col gap-3.5">
                    <div className="flex items-center gap-2 text-amber-400 font-semibold text-xs">
                      <Lock className="w-4 h-4" />
                      <span>LeetCode Premium Restricted Problem</span>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      The full problem statement, test cases, and constraints for{' '}
                      <strong className="text-foreground">{problem.title}</strong> are gated behind LeetCode Premium.
                    </p>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      You can view the full problem description directly on LeetCode or solve it right here using the starter templates, curated patterns, and local execution sandbox.
                    </p>
                    {problem.url && (
                      <a
                        href={problem.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-xs font-semibold border border-amber-500/40 w-fit transition-all cursor-pointer"
                      >
                        <span>Open #{problem.id} on LeetCode</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    )}
                  </div>
                )}

                {/* SM-2 Recall Controls */}
                {renderSm2RatingSection()}
              </div>
            )}

            {activeTab === 'architecture' && (
              <div className="flex flex-col gap-6">
                {/* Track and Pattern Tags */}
                <div className="flex flex-col gap-2">
                  <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Curated Track
                  </div>
                  <div className="p-3 rounded-xl bg-secondary/40 border border-border/60 flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      <BrainCircuit className="w-4 h-4 text-primary shrink-0" />
                      <span className="font-semibold text-xs text-foreground truncate">
                        {problem.learningTrack}
                      </span>
                    </div>
                    <span className="text-[11px] font-mono text-muted-foreground shrink-0">
                      {Math.round(problem.avgAcceptance * 100)}% Acceptance
                    </span>
                  </div>
                </div>

                {/* Core Concept & Topic Tags */}
                <div className="flex flex-col gap-2">
                  <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Pattern & Topics
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {problem.corePattern && (
                      <span className="px-2.5 py-1 rounded-md bg-primary/10 text-primary text-xs font-medium border border-primary/20">
                        Pattern: {problem.corePattern}
                      </span>
                    )}
                    {problem.allTopics?.map((topic) => (
                      <span
                        key={topic}
                        className="px-2.5 py-1 rounded-md bg-secondary text-muted-foreground text-xs font-medium border border-border/60"
                      >
                        {topic}
                      </span>
                    ))}
                  </div>
                </div>

                {/* System Design Notes Link (Alex Xu Architecture Concept) */}
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                      <BookOpen className="w-3.5 h-3.5 text-primary" />
                      <span>System Architecture Alignment</span>
                    </div>
                    <span className="text-[10px] font-mono text-muted-foreground">
                      Alex Xu Interview Notes
                    </span>
                  </div>

                  {problem.systemDesignLinks && problem.systemDesignLinks.length > 0 ? (
                    <div className="grid grid-cols-1 gap-2">
                      {problem.systemDesignLinks.map((link, idx) => (
                        <a
                          key={idx}
                          href={`https://github.com/liquidslr/system-design-notes#${link.chapter
                            .toLowerCase()
                            .replace(/\s+/g, '-')}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-3 rounded-xl bg-card border border-border/80 hover:border-primary/50 flex items-center justify-between group transition-all"
                        >
                          <div className="flex items-center gap-2.5">
                            <span className="px-2 py-0.5 rounded-md bg-primary/15 text-primary text-[11px] font-bold font-mono">
                              {link.chapter}
                            </span>
                            <span className="font-semibold text-xs text-foreground group-hover:text-primary transition-colors">
                              {link.title}
                            </span>
                          </div>
                          <ExternalLink className="w-3.5 h-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
                        </a>
                      ))}
                    </div>
                  ) : (
                    <div className="p-3 rounded-xl bg-secondary/30 text-xs text-muted-foreground font-mono">
                      No direct architectural mapping assigned.
                    </div>
                  )}
                </div>

                {/* Top 10 Target Companies */}
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                      <Flame className="w-3.5 h-3.5 text-orange-400" />
                      <span>Top Target Companies ({companyMappings.length})</span>
                    </div>
                    <span className="text-[10px] font-mono text-muted-foreground">Frequency %</span>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    {companyMappings.slice(0, 10).map((m, idx) => (
                      <div
                        key={idx}
                        className="p-2.5 rounded-lg bg-secondary/40 border border-border/50 flex items-center justify-between text-xs"
                      >
                        <span className="font-medium text-foreground truncate pr-2">
                          {m.company}
                        </span>
                        <span className="font-mono text-[11px] font-semibold text-primary shrink-0">
                          {Math.round(m.frequencyPct * 100)}%
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* SM-2 Recall Quality Rating */}
                {renderSm2RatingSection()}
              </div>
            )}

            {activeTab === 'scratchpad' && (
              /* Scratchpad / Notes Editor */
              <div className="flex-1 flex flex-col gap-2 h-full">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Markdown scratchpad (auto-saved to local IndexedDB)</span>
                  <button
                    onClick={() => handleSave()}
                    className="text-primary hover:underline font-medium cursor-pointer"
                  >
                    Save Notes
                  </button>
                </div>
                <textarea
                  value={notes}
                  onChange={handleNotesChange}
                  placeholder="Record edge cases, time/space complexity analysis, or whiteboard intuition..."
                  className="w-full flex-1 min-h-[350px] p-3 rounded-xl bg-secondary/30 border border-border/80 font-mono text-xs leading-relaxed focus:outline-none focus:border-primary/60 resize-none text-foreground placeholder:text-muted-foreground/50"
                />
              </div>
            )}
          </div>
        </div>

        {/* ─── RIGHT PANE: Monaco Code Editor & Terminal Drawer ────────────── */}
        <div className="w-full lg:w-[54%] flex flex-col h-full overflow-hidden bg-[#1e1e1e]">
          {/* Monaco Editor Header with LanguageSelector */}
          <div className="h-10 border-b border-border/40 px-4 flex items-center justify-between bg-[#181818] text-xs font-mono text-muted-foreground shrink-0">
            <div className="flex items-center gap-3">
              <LanguageSelector
                currentLanguage={currentLanguage}
                onLanguageChange={handleLanguageChange}
                disabled={isRunning}
              />
              <span className="text-[11px] text-muted-foreground/80 font-mono">
                main.{currentConfig.extension}
              </span>
              <button
                type="button"
                onClick={handleResetToStarterCode}
                className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] text-muted-foreground hover:text-foreground hover:bg-secondary/60 border border-border/40 transition-colors cursor-pointer"
                title="Reset to default starter template"
              >
                <RotateCcw className="w-2.5 h-2.5" />
                <span>Reset</span>
              </button>
            </div>

            <div className="flex items-center gap-3 text-[11px]">
              {isPython && isPyodideLoading && (
                <span className="text-amber-400 flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                  Loading Pyodide CDN...
                </span>
              )}
              {isPython && isPyodideReady && !isPyodideRunning && (
                <span className="text-emerald-400 flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  Pyodide Ready
                </span>
              )}
              {!isPython && (
                <span className="text-sky-400 flex items-center gap-1 font-mono">
                  {currentConfig.version}
                </span>
              )}
            </div>
          </div>

          {/* Monaco Editor Container */}
          <div className="flex-1 min-h-[280px] relative">
            <MonacoEditor
              key={`monaco-${problem.id}-${currentLanguage}`}
              height="100%"
              path={`solution_${problem.id}_${currentLanguage}.${currentConfig.extension}`}
              language={currentConfig.monacoLang}
              theme="vs-dark"
              value={currentCode}
              onChange={handleCodeChange}
              options={{
                fontSize: 13,
                fontFamily: 'var(--font-mono), monospace',
                tabSize: 4,
                minimap: { enabled: false },
                scrollBeyondLastLine: false,
                lineNumbers: 'on',
                bracketPairColorization: { enabled: true },
                automaticLayout: true,
                padding: { top: 12, bottom: 12 },
                contextmenu: !(strictModeEnabled && isTimerRunning),
              }}
            />
          </div>

          {/* Terminal Console Drawer */}
          <div className="h-64 border-t border-border/80 flex flex-col bg-[#141414] shrink-0">
            {/* Drawer Tab Header */}
            <div className="h-9 border-b border-border/40 px-3 flex items-center justify-between bg-[#181818] text-xs font-mono text-muted-foreground shrink-0">
              <div className="flex items-center gap-1 sm:gap-2">
                <button
                  onClick={() => setActiveConsoleTab('testcases')}
                  className={cn(
                    'flex items-center gap-1.5 px-2.5 py-1 rounded-lg transition-colors cursor-pointer text-xs',
                    activeConsoleTab === 'testcases'
                      ? 'text-white bg-secondary font-semibold'
                      : 'hover:text-foreground'
                  )}
                >
                  <ListChecks className="w-3.5 h-3.5 text-primary" />
                  <span>Test Cases</span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-black/40 font-mono">
                    {testCases.length}
                  </span>
                </button>
                <button
                  onClick={() => setActiveConsoleTab('console')}
                  className={cn(
                    'flex items-center gap-1.5 px-2.5 py-1 rounded-lg transition-colors cursor-pointer text-xs',
                    activeConsoleTab === 'console'
                      ? 'text-white bg-secondary font-semibold'
                      : 'hover:text-foreground'
                  )}
                >
                  <Terminal className="w-3.5 h-3.5 text-primary" />
                  <span>Terminal Console</span>
                </button>
                <button
                  onClick={() => setActiveConsoleTab('tests')}
                  className={cn(
                    'flex items-center gap-1.5 px-2.5 py-1 rounded-lg transition-colors cursor-pointer text-xs',
                    activeConsoleTab === 'tests'
                      ? 'text-white bg-secondary font-semibold'
                      : 'hover:text-foreground'
                  )}
                >
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Metrics</span>
                </button>
              </div>

              <div className="flex items-center gap-2.5 text-[11px]">
                {executionTimeMs > 0 && (
                  <span className="px-2 py-0.5 rounded bg-black/50 border border-white/10 text-neutral-300 font-mono text-[10px] flex items-center gap-1.5">
                    <span className="text-primary font-semibold">⚡ Execution:</span>
                    <span>{executionTimeMs}ms</span>
                    <span className="text-neutral-500">|</span>
                    <span className="text-neutral-400">Memory: ~{memoryUsageMb ? memoryUsageMb.toFixed(1) : '12.4'}MB</span>
                  </span>
                )}
                <button
                  onClick={handleResetConsole}
                  className="hover:text-foreground p-1 transition-colors cursor-pointer text-muted-foreground"
                  title="Clear Output"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Terminal Body */}
            <div className="flex-1 overflow-y-auto p-3 font-mono text-xs">
              {activeConsoleTab === 'testcases' && (
                <div className="flex flex-col gap-3">
                  {/* Submission Banner (if exists) */}
                  {submissionBanner && (
                    <div role="status" aria-live="polite" aria-atomic="true" className="flex flex-col gap-2">
                      <SubmissionBanner
                        banner={submissionBanner}
                        onRateRecall={() => {
                          setActiveTab('architecture');
                        }}
                        onJumpToCase={(idx) => {
                          setActiveCaseIndex(idx);
                          setActiveConsoleTab('testcases');
                        }}
                        onOpenConsole={() => {
                          setActiveConsoleTab('console');
                        }}
                        onTriggerConfetti={() => {
                          setShowCelebration(true);
                        }}
                      />
                      {reviewMode && submissionBanner.status === 'Accepted' && (
                        <Link href="/review" className="p-3 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-xl flex items-center justify-center gap-2 hover:bg-emerald-500/20 font-bold transition-all text-xs">
                          <ArrowLeft className="w-4 h-4" />
                          <span>Back to Review Queue</span>
                        </Link>
                      )}
                    </div>
                  )}

                  {/* Case selection tabs */}
                  <div className="flex items-center gap-2 overflow-x-auto pb-1">
                    {testCases.map((tc, idx) => {
                      const res = testResults.find((r) => r.caseId === tc.id);
                      return (
                        <button
                          key={tc.id}
                          onClick={() => setActiveCaseIndex(idx)}
                          className={cn(
                            'px-3 py-1.5 rounded-lg text-xs font-mono font-medium flex items-center gap-1.5 transition-all cursor-pointer shrink-0 border',
                            activeCaseIndex === idx
                              ? res?.passed === true
                                ? 'bg-emerald-950/50 text-emerald-300 border-emerald-500/50 shadow-[0_0_12px_rgba(16,185,129,0.25)]'
                                : res?.passed === false
                                ? 'bg-rose-950/50 text-rose-300 border-rose-500/50 shadow-[0_0_12px_rgba(244,63,94,0.25)]'
                                : 'bg-neutral-800 text-white border-white/25 shadow-xs'
                              : res?.passed === true
                              ? 'bg-neutral-900/90 text-emerald-400/80 hover:text-emerald-300 border-emerald-500/20'
                              : res?.passed === false
                              ? 'bg-neutral-900/90 text-rose-400/80 hover:text-rose-300 border-rose-500/20'
                              : 'bg-neutral-900/80 text-neutral-400 hover:text-neutral-200 border-white/[0.06]'
                          )}
                        >
                          {res?.passed === true && <span>✅</span>}
                          {res?.passed === false && <span>❌</span>}
                          {res === undefined && <span className="w-1.5 h-1.5 rounded-full bg-neutral-600" />}
                          <span>Case {idx + 1}</span>
                          {res?.passed === true && <span className="text-[10px] text-emerald-400 font-bold">🎯</span>}
                          {res?.passed === false && <span className="text-[10px] text-rose-400 font-bold">💥</span>}
                        </button>
                      );
                    })}
                    <button
                      onClick={handleAddTestCase}
                      className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-neutral-400 hover:text-emerald-400 bg-neutral-900/60 hover:bg-neutral-900 border border-dashed border-white/[0.1] transition-colors cursor-pointer flex items-center gap-1 shrink-0"
                      title="Add Custom Test Case"
                    >
                      <Plus className="w-3 h-3" />
                      <span>Add Case</span>
                    </button>
                  </div>

                  {/* Active Case Editor & Viewer */}
                  {testCases[activeCaseIndex] && (() => {
                    const curCase = testCases[activeCaseIndex];
                    const curResult = testResults.find((r) => r.caseId === curCase.id);

                    return (
                      <div className="flex flex-col gap-2.5">
                        {/* Case Status Hint Card with creative emojis */}
                        {curResult && (
                          <div
                            className={cn(
                              'p-2.5 rounded-xl border text-xs flex items-center justify-between transition-all backdrop-blur-sm',
                              curResult.passed
                                ? 'bg-emerald-950/30 border-emerald-500/35 text-emerald-300 shadow-[0_0_15px_rgba(16,185,129,0.1)]'
                                : 'bg-rose-950/30 border-rose-500/35 text-rose-300 shadow-[0_0_15px_rgba(244,63,94,0.1)]'
                            )}
                          >
                            <div className="flex items-center gap-2">
                              <span className="text-sm">{curResult.passed ? '🎉' : '💥'}</span>
                              <span className="font-semibold">
                                {curResult.passed
                                  ? `Test Case ${activeCaseIndex + 1} Passed!`
                                  : `Test Case ${activeCaseIndex + 1} Failed! Output mismatch detected.`}
                              </span>
                            </div>
                            <span className="text-[11px] font-mono opacity-80 flex items-center gap-1">
                              {curResult.passed ? (
                                <>
                                  <span>✨</span> Output Matches Perfectly 💯
                                </>
                              ) : (
                                <>
                                  <span>🧐</span> Edge Case Mismatch 💡
                                </>
                              )}
                            </span>
                          </div>
                        )}

                        {/* Inputs & Outputs Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
                          {/* Input */}
                          <div className="flex flex-col gap-1">
                            <span className="text-[11px] font-mono text-neutral-400 font-semibold flex items-center gap-1">
                              <span>📥</span> Input
                            </span>
                            <textarea
                              value={curCase.input}
                              onChange={(e) => handleUpdateCaseInput(activeCaseIndex, e.target.value)}
                              className="w-full h-20 p-2 rounded-lg bg-neutral-950/80 border border-white/[0.08] font-mono text-xs text-neutral-200 focus:outline-none focus:border-emerald-500/50 resize-none"
                              placeholder="e.g. nums = [2,7,11,15], target = 9"
                            />
                          </div>

                          {/* Expected Output */}
                          <div className="flex flex-col gap-1">
                            <span className="text-[11px] font-mono text-neutral-400 font-semibold flex items-center gap-1">
                              <span>🎯</span> Expected Output
                            </span>
                            <textarea
                              value={curCase.expectedOutput}
                              onChange={(e) => handleUpdateCaseExpected(activeCaseIndex, e.target.value)}
                              className="w-full h-20 p-2 rounded-lg bg-neutral-950/80 border border-white/[0.08] font-mono text-xs text-neutral-200 focus:outline-none focus:border-emerald-500/50 resize-none"
                              placeholder="e.g. [0,1]"
                            />
                          </div>

                          {/* Your Output */}
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center justify-between">
                              <span className="text-[11px] font-mono text-neutral-400 font-semibold flex items-center gap-1">
                                <span>⚡</span> Your Output
                              </span>
                              {curResult && (
                                <span
                                  className={cn(
                                    'text-[10px] font-bold px-1.5 py-0.5 rounded font-mono flex items-center gap-1 border',
                                    curResult.passed
                                      ? 'text-emerald-400 bg-emerald-500/15 border-emerald-500/30'
                                      : 'text-rose-400 bg-rose-500/15 border-rose-500/30'
                                  )}
                                >
                                  <span>{curResult.passed ? '✅ PASSED 🎯' : '❌ MISMATCH 💥'}</span>
                                </span>
                              )}
                            </div>
                            <div
                              className={cn(
                                'w-full h-20 p-2 rounded-lg font-mono text-xs overflow-y-auto border transition-all',
                                !curResult &&
                                  'bg-neutral-950/40 text-neutral-600 border-white/[0.05] italic flex items-center justify-center',
                                curResult?.passed &&
                                  'bg-emerald-950/20 text-emerald-300 border-emerald-500/30 shadow-inner',
                                curResult &&
                                  !curResult.passed &&
                                  'bg-rose-950/20 text-rose-300 border-rose-500/30 shadow-inner'
                              )}
                            >
                              {curResult ? (
                                <pre className="whitespace-pre-wrap leading-relaxed">{curResult.actualOutput}</pre>
                              ) : (
                                'Click "Run Code" or "Submit" to evaluate'
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Monaco Diff Viewer for Mismatched Test Case */}
                        {curResult && !curResult.passed && (
                          <div className="flex flex-col gap-2 p-3 rounded-xl bg-neutral-950/90 border border-rose-500/30">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-mono font-semibold text-rose-300 flex items-center gap-1.5">
                                  <span>🔍</span> Output Diff Analysis
                                </span>
                                <span className="text-[10px] text-muted-foreground">
                                  (Left: Expected | Right: Your Output)
                                </span>
                              </div>
                              <div className="flex items-center gap-1 bg-secondary/80 p-0.5 rounded-lg border border-border/50">
                                <button
                                  type="button"
                                  onClick={() => setIsSplitDiff(false)}
                                  className={cn(
                                    'px-2 py-0.5 rounded text-[11px] font-mono transition-colors cursor-pointer',
                                    !isSplitDiff
                                      ? 'bg-rose-500/20 text-rose-300 font-semibold shadow-xs'
                                      : 'text-muted-foreground hover:text-foreground'
                                  )}
                                >
                                  Inline
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setIsSplitDiff(true)}
                                  className={cn(
                                    'px-2 py-0.5 rounded text-[11px] font-mono transition-colors cursor-pointer',
                                    isSplitDiff
                                      ? 'bg-rose-500/20 text-rose-300 font-semibold shadow-xs'
                                      : 'text-muted-foreground hover:text-foreground'
                                  )}
                                >
                                  Split
                                </button>
                              </div>
                            </div>
                            <div className="h-44 w-full rounded-lg overflow-hidden border border-white/10 bg-[#1e1e1e]">
                              <MonacoDiffEditor
                                original={curResult.expectedOutput || ''}
                                modified={curResult.actualOutput || ''}
                                language="plaintext"
                                theme="vs-dark"
                                options={{
                                  readOnly: true,
                                  renderSideBySide: isSplitDiff,
                                  minimap: { enabled: false },
                                  lineNumbers: 'off',
                                  scrollBeyondLastLine: false,
                                  automaticLayout: true,
                                  fontSize: 12,
                                  folding: false,
                                }}
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              )}

              {activeConsoleTab === 'console' && (
                <div className="flex flex-col gap-1">
                  {isRunning && (
                    <div className="text-amber-400 flex items-center gap-2">
                      <div className="w-3 h-3 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
                      <span>
                        {currentConfig.runtimeType === 'wasm'
                          ? 'Executing in WebAssembly/Worker sandbox...'
                          : `Compiling and executing via ${currentConfig.label}...`}
                      </span>
                    </div>
                  )}

                  {!isRunning && !stdout && !stderr && (
                    <div className="text-muted-foreground/60 italic">
                      Press &ldquo;Run Code&rdquo; or Ctrl+Enter to execute in {currentConfig.label}...
                    </div>
                  )}

                  {stdout && (
                    <pre className="text-emerald-300 whitespace-pre-wrap leading-relaxed">
                      {stdout}
                    </pre>
                  )}

                  {stderr && (
                    <pre className="text-rose-400 whitespace-pre-wrap leading-relaxed">
                      {stderr}
                    </pre>
                  )}
                </div>
              )}

              {activeConsoleTab === 'tests' && (
                /* Execution Metrics Tab */
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between p-2 rounded bg-secondary/30 border border-border/40">
                    <span className="text-muted-foreground">Execution Status:</span>
                    <span
                      className={cn(
                        'font-bold',
                        passed === true && 'text-emerald-400',
                        passed === false && 'text-rose-400',
                        passed === undefined && 'text-muted-foreground'
                      )}
                    >
                      {passed === true
                        ? 'Passed without Errors'
                        : passed === false
                        ? 'Execution Error'
                        : 'Not Executed Yet'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between p-2 rounded bg-secondary/30 border border-border/40">
                    <span className="text-muted-foreground">Runtime Latency:</span>
                    <span className="font-bold text-foreground">
                      {executionTimeMs ? `${executionTimeMs} ms` : '—'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between p-2 rounded bg-secondary/30 border border-border/40">
                    <span className="text-muted-foreground">Test Cases Verified:</span>
                    <span className="font-bold font-mono text-foreground">
                      {testResults.length > 0
                        ? `${testResults.filter((t) => t.passed).length} / ${testResults.length} Passed`
                        : '0 Evaluated'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between p-2 rounded bg-secondary/30 border border-border/40">
                    <span className="text-muted-foreground">Runtime Environment:</span>
                    <span className="text-foreground">
                      {currentConfig.label} ({currentConfig.version}) [{currentConfig.runtimeLabel}]
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
