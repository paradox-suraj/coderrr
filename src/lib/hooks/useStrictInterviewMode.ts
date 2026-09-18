'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

export interface StrictModeWarning {
  id: string;
  type: 'copy-paste' | 'tab-switch';
  message: string;
  timestamp: number;
}

export interface UseStrictInterviewModeOptions {
  enabled: boolean;
  blockClipboard?: boolean;
  gracePeriodMs?: number;
  onViolation?: (warning: StrictModeWarning) => void;
}

export interface FocusSwitchEvaluationParams {
  blurDurationMs: number;
  gracePeriodMs?: number;
  lastAlertElapsedMs?: number;
}

/**
 * Pure evaluation function for window/tab focus switches.
 * Enforces a grace period (>= 500ms, default 750ms) to filter out OS notifications,
 * window manager workspace switches, and alt-tab previews.
 * Also debounces rapid successive events (< 1000ms).
 */
export function evaluateFocusSwitch({
  blurDurationMs,
  gracePeriodMs = 750,
  lastAlertElapsedMs = Infinity,
}: FocusSwitchEvaluationParams): { shouldAlert: boolean; elapsedSeconds: number } {
  const elapsedSeconds = Math.max(1, Math.round(blurDurationMs / 1000));
  if (blurDurationMs < gracePeriodMs) {
    return { shouldAlert: false, elapsedSeconds };
  }
  if (lastAlertElapsedMs < 1000) {
    return { shouldAlert: false, elapsedSeconds };
  }
  return { shouldAlert: true, elapsedSeconds };
}

/**
 * Check if clipboard operations should be blocked.
 * By default, clipboard blocking is opt-in (false) even when interview mode is active,
 * preserving accessibility and workflow unless explicitly simulating environments like HackerRank.
 */
export function isClipboardBlocked({
  strictModeEnabled,
  blockClipboard = false,
}: {
  strictModeEnabled: boolean;
  blockClipboard?: boolean;
}): boolean {
  return Boolean(strictModeEnabled && blockClipboard);
}

/**
 * Formats non-punitive, professional simulation feedback messages.
 */
export function formatSimulationWarning(
  type: 'copy-paste' | 'tab-switch',
  context?: { count?: number; durationMs?: number }
): string {
  if (type === 'tab-switch') {
    const duration = context?.durationMs ? `${Math.round(context.durationMs / 1000)}s` : 'briefly';
    const count = context?.count ?? 1;
    return `Focus switch logged: returned to editor after ${duration} (${count} ${count === 1 ? 'time' : 'times'}).`;
  }
  return 'Clipboard shortcut restricted in simulation mode (HackerRank paste-blocking simulation active).';
}

export function useStrictInterviewMode({
  enabled,
  blockClipboard = false,
  gracePeriodMs = 750,
  onViolation,
}: UseStrictInterviewModeOptions) {
  const [tabSwitchCount, setTabSwitchCount] = useState(0);
  const [activeWarning, setActiveWarning] = useState<StrictModeWarning | null>(null);
  const warningTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const blurTimestampRef = useRef<number | null>(null);
  const lastAlertTimestampRef = useRef<number>(0);

  const triggerWarning = useCallback(
    (type: 'copy-paste' | 'tab-switch', message: string) => {
      const warning: StrictModeWarning = {
        id: Math.random().toString(36).substring(2, 9),
        type,
        message,
        timestamp: Date.now(),
      };

      setActiveWarning(warning);
      onViolation?.(warning);

      if (warningTimeoutRef.current) {
        clearTimeout(warningTimeoutRef.current);
      }
      warningTimeoutRef.current = setTimeout(() => {
        setActiveWarning(null);
      }, 3500);
    },
    [onViolation]
  );

  const dismissWarning = useCallback(() => {
    if (warningTimeoutRef.current) {
      clearTimeout(warningTimeoutRef.current);
    }
    setActiveWarning(null);
  }, []);

  const resetViolations = useCallback(() => {
    setTabSwitchCount(0);
    dismissWarning();
  }, [dismissWarning]);

  // 1. Intercept clipboard copy, cut, paste, and context menu ONLY if blockClipboard is opted in
  useEffect(() => {
    if (!isClipboardBlocked({ strictModeEnabled: enabled, blockClipboard })) return;

    const handleCopyCutPaste = (e: ClipboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      triggerWarning('copy-paste', formatSimulationWarning('copy-paste'));
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      const isCtrlOrMeta = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();

      // Block Ctrl+C, Ctrl+V, Ctrl+X
      if (isCtrlOrMeta && (key === 'c' || key === 'v' || key === 'x')) {
        if (!e.shiftKey) {
          e.preventDefault();
          e.stopPropagation();
          triggerWarning('copy-paste', formatSimulationWarning('copy-paste'));
        }
      }
    };

    const handleContextMenu = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && target.closest('.monaco-editor, .problem-workspace-content')) {
        e.preventDefault();
        e.stopPropagation();
        triggerWarning(
          'copy-paste',
          'Context menu is disabled in clipboard-restricted simulation mode.'
        );
      }
    };

    window.addEventListener('copy', handleCopyCutPaste, true);
    window.addEventListener('cut', handleCopyCutPaste, true);
    window.addEventListener('paste', handleCopyCutPaste, true);
    window.addEventListener('keydown', handleKeyDown, true);
    document.addEventListener('contextmenu', handleContextMenu, true);

    return () => {
      window.removeEventListener('copy', handleCopyCutPaste, true);
      window.removeEventListener('cut', handleCopyCutPaste, true);
      window.removeEventListener('paste', handleCopyCutPaste, true);
      window.removeEventListener('keydown', handleKeyDown, true);
      document.removeEventListener('contextmenu', handleContextMenu, true);
    };
  }, [enabled, blockClipboard, triggerWarning]);

  // 2. Detect tab and window switching with grace period debouncing
  useEffect(() => {
    if (!enabled) return;

    const handleLeaving = () => {
      if (!blurTimestampRef.current) {
        blurTimestampRef.current = Date.now();
      }
    };

    const handleReturning = () => {
      if (!blurTimestampRef.current) return;
      const blurDurationMs = Date.now() - blurTimestampRef.current;
      blurTimestampRef.current = null;

      const lastAlertElapsedMs = Date.now() - lastAlertTimestampRef.current;
      const evalResult = evaluateFocusSwitch({
        blurDurationMs,
        gracePeriodMs,
        lastAlertElapsedMs,
      });

      if (evalResult.shouldAlert) {
        lastAlertTimestampRef.current = Date.now();
        setTabSwitchCount((prev) => {
          const newCount = prev + 1;
          triggerWarning(
            'tab-switch',
            formatSimulationWarning('tab-switch', { count: newCount, durationMs: blurDurationMs })
          );
          return newCount;
        });
      }
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        handleLeaving();
      } else {
        handleReturning();
      }
    };

    const handleWindowBlur = () => {
      handleLeaving();
    };

    const handleWindowFocus = () => {
      handleReturning();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleWindowBlur);
    window.addEventListener('focus', handleWindowFocus);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleWindowBlur);
      window.removeEventListener('focus', handleWindowFocus);
    };
  }, [enabled, gracePeriodMs, triggerWarning]);

  return {
    tabSwitchCount,
    activeWarning,
    dismissWarning,
    resetViolations,
  };
}

