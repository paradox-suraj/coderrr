'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

export interface StrictModeWarning {
  id: string;
  type: 'copy-paste' | 'tab-switch';
  message: string;
  timestamp: number;
}

interface UseStrictInterviewModeOptions {
  enabled: boolean;
  onViolation?: (warning: StrictModeWarning) => void;
}

export function useStrictInterviewMode({
  enabled,
  onViolation,
}: UseStrictInterviewModeOptions) {
  const [tabSwitchCount, setTabSwitchCount] = useState(0);
  const [activeWarning, setActiveWarning] = useState<StrictModeWarning | null>(null);
  const warningTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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

  // 1. Intercept clipboard copy, cut, paste, and context menu
  useEffect(() => {
    if (!enabled) return;

    const handleCopyCutPaste = (e: ClipboardEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const action = e.type === 'paste' ? 'Paste' : 'Copy/Cut';
      triggerWarning(
        'copy-paste',
        `🚫 ${action} is disabled during strict interview mode!`
      );
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      const isCtrlOrMeta = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();

      // Block Ctrl+C, Ctrl+V, Ctrl+X
      if (isCtrlOrMeta && (key === 'c' || key === 'v' || key === 'x')) {
        if (!e.shiftKey) {
          e.preventDefault();
          e.stopPropagation();
          const action = key === 'v' ? 'Paste (Ctrl+V)' : 'Copy (Ctrl+C)';
          triggerWarning(
            'copy-paste',
            `🚫 ${action} shortcut is disabled in strict mode!`
          );
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
          '🚫 Context menu is disabled in strict interview mode!'
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
  }, [enabled, triggerWarning]);

  // 2. Detect tab and window switching
  useEffect(() => {
    if (!enabled) return;

    let hasSwitchedOut = false;

    const handleVisibilityChange = () => {
      if (document.hidden) {
        hasSwitchedOut = true;
      } else if (hasSwitchedOut) {
        hasSwitchedOut = false;
        setTabSwitchCount((prev) => {
          const newCount = prev + 1;
          triggerWarning(
            'tab-switch',
            `⚠️ Tab switch detected! You left the test window (${newCount} ${newCount === 1 ? 'time' : 'times'}).`
          );
          return newCount;
        });
      }
    };

    const handleWindowBlur = () => {
      hasSwitchedOut = true;
    };

    const handleWindowFocus = () => {
      if (hasSwitchedOut) {
        hasSwitchedOut = false;
        setTabSwitchCount((prev) => {
          const newCount = prev + 1;
          triggerWarning(
            'tab-switch',
            `⚠️ Window switch detected! You focused outside the editor window (${newCount} ${newCount === 1 ? 'time' : 'times'}).`
          );
          return newCount;
        });
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleWindowBlur);
    window.addEventListener('focus', handleWindowFocus);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleWindowBlur);
      window.removeEventListener('focus', handleWindowFocus);
    };
  }, [enabled, triggerWarning]);

  return {
    tabSwitchCount,
    activeWarning,
    dismissWarning,
    resetViolations,
  };
}
