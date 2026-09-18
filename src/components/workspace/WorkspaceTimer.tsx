'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  Clock,
  ShieldAlert,
  ShieldCheck,
  ChevronDown,
  Settings,
  AlertTriangle,
  Flame,
  Check
} from 'lucide-react';
import { cn } from '@/lib/utils';

export type TimerMode = 'stopwatch' | 'countdown';

interface WorkspaceTimerProps {
  tabSwitchCount: number;
  strictModeEnabled: boolean;
  blockClipboard?: boolean;
  onToggleStrictMode: (enabled: boolean) => void;
  onToggleBlockClipboard?: (enabled: boolean) => void;
  onTimerRunningChange?: (isRunning: boolean) => void;
  onResetViolations?: () => void;
}

const PRESET_DURATIONS = [
  { label: '15 Min', seconds: 15 * 60 },
  { label: '25 Min (Pomodoro)', seconds: 25 * 60 },
  { label: '45 Min (FAANG Mock)', seconds: 45 * 60 },
  { label: '60 Min', seconds: 60 * 60 },
];

export default function WorkspaceTimer({
  tabSwitchCount,
  strictModeEnabled,
  blockClipboard = false,
  onToggleStrictMode,
  onToggleBlockClipboard,
  onTimerRunningChange,
  onResetViolations,
}: WorkspaceTimerProps) {
  const [mode, setMode] = useState<TimerMode>('countdown');
  const [targetSeconds, setTargetSeconds] = useState(45 * 60); // 45m default
  const [secondsLeft, setSecondsLeft] = useState(45 * 60);
  const [secondsElapsed, setSecondsElapsed] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const settingsRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (settingsRef.current && !settingsRef.current.contains(e.target as Node)) {
        setShowSettings(false);
      }
    }
    if (showSettings) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showSettings]);

  // Sync isRunning with parent
  useEffect(() => {
    onTimerRunningChange?.(isRunning);
  }, [isRunning, onTimerRunningChange]);

  // Main Timer Interval
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;

    if (isRunning) {
      interval = setInterval(() => {
        if (mode === 'stopwatch') {
          setSecondsElapsed((prev) => prev + 1);
        } else {
          setSecondsLeft((prev) => {
            if (prev <= 1) {
              setIsRunning(false);
              return 0;
            }
            return prev - 1;
          });
        }
      }, 1000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isRunning, mode]);

  const toggleRunning = () => {
    setIsRunning((prev) => !prev);
  };

  const handleReset = () => {
    setIsRunning(false);
    if (mode === 'stopwatch') {
      setSecondsElapsed(0);
    } else {
      setSecondsLeft(targetSeconds);
    }
    onResetViolations?.();
  };

  const handleSelectPreset = (seconds: number) => {
    setMode('countdown');
    setTargetSeconds(seconds);
    setSecondsLeft(seconds);
    setIsRunning(false);
    setShowSettings(false);
  };

  const handleSelectStopwatch = () => {
    setMode('stopwatch');
    setSecondsElapsed(0);
    setIsRunning(false);
    setShowSettings(false);
  };

  // Format time
  const displaySeconds = mode === 'stopwatch' ? secondsElapsed : secondsLeft;
  const hours = Math.floor(displaySeconds / 3600);
  const mins = Math.floor((displaySeconds % 3600) / 60);
  const secs = displaySeconds % 60;

  const formattedTime =
    hours > 0
      ? `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
      : `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;

  const isLowTime = mode === 'countdown' && isRunning && secondsLeft <= 300 && secondsLeft > 0;
  const isTimeUp = mode === 'countdown' && secondsLeft === 0;

  return (
    <div className="relative flex items-center" ref={settingsRef}>
      <div
        className={cn(
          'flex items-center gap-1.5 px-2 py-1 rounded-xl text-xs font-mono transition-all border',
          isRunning
            ? strictModeEnabled
              ? 'bg-amber-500/10 border-amber-500/30 text-amber-300 shadow-sm shadow-amber-500/10'
              : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
            : 'bg-white/[0.04] border-white/[0.08] text-neutral-300 hover:border-white/[0.15]'
        )}
      >
        {/* Play/Pause Button */}
        <button
          onClick={toggleRunning}
          aria-label={isRunning ? 'Pause timer' : 'Start timer'}
          className={cn(
            'w-6 h-6 rounded-lg flex items-center justify-center transition-colors cursor-pointer',
            isRunning
              ? 'bg-amber-500/20 hover:bg-amber-500/30 text-amber-400'
              : 'bg-white/[0.06] hover:bg-white/[0.12] text-neutral-300 hover:text-white'
          )}
          title={isRunning ? 'Pause Timer' : 'Start Timer'}
        >
          {isRunning ? (
            <Pause className="w-3 h-3 fill-current" />
          ) : (
            <Play className="w-3 h-3 fill-current ml-0.5" />
          )}
        </button>

        {/* Digital Time Display */}
        <span
          className={cn(
            'font-bold tracking-wider tabular-nums select-none text-[12px] px-1',
            isTimeUp && 'text-rose-400 animate-pulse font-extrabold',
            isLowTime && 'text-amber-400 animate-pulse'
          )}
        >
          {formattedTime}
        </span>

        {/* Tab switch violation indicator badge */}
        {tabSwitchCount > 0 && (
          <span
            className="hidden sm:inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-rose-500/20 text-rose-400 border border-rose-500/30 text-[10px] font-sans font-semibold"
            title={`${tabSwitchCount} tab/window switches detected`}
          >
            <AlertTriangle className="w-2.5 h-2.5 shrink-0" />
            <span>{tabSwitchCount}</span>
          </span>
        )}

        {/* Interview Simulation Icon */}
        <button
          onClick={() => onToggleStrictMode(!strictModeEnabled)}
          className={cn(
            'p-1 rounded-md transition-colors cursor-pointer',
            strictModeEnabled
              ? 'text-amber-400 hover:text-amber-300'
              : 'text-neutral-500 hover:text-neutral-400'
          )}
          title={
            strictModeEnabled
              ? 'Interview Simulation ON: Focus tracking active (>750ms grace window)'
              : 'Interview Simulation OFF: Click to enable focus tracking'
          }
        >
          {strictModeEnabled ? (
            <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
          ) : (
            <ShieldCheck className="w-3.5 h-3.5 text-neutral-500" />
          )}
        </button>

        {/* Reset Button */}
        <button
          onClick={handleReset}
          className="p-1 rounded-md text-neutral-400 hover:text-neutral-200 hover:bg-white/[0.06] transition-colors cursor-pointer"
          title="Reset timer"
        >
          <RotateCcw className="w-3 h-3" />
        </button>

        {/* Settings Dropdown Trigger */}
        <button
          onClick={() => setShowSettings((prev) => !prev)}
          className={cn(
            'p-1 rounded-md text-neutral-400 hover:text-white transition-colors cursor-pointer',
            showSettings && 'text-white bg-white/[0.08]'
          )}
          title="Timer Options & Modes"
        >
          <ChevronDown className="w-3 h-3" />
        </button>
      </div>

      {/* Dropdown Menu */}
      {showSettings && (
        <div className="absolute top-full left-0 mt-2 w-72 rounded-2xl bg-[#111113] border border-white/[0.12] p-3 shadow-2xl backdrop-blur-xl z-50 flex flex-col gap-3 animate-in fade-in zoom-in-95 duration-150 font-sans">
          <div className="flex items-center justify-between pb-2 border-b border-white/[0.08]">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-white">
              <Clock className="w-3.5 h-3.5 text-emerald-400" />
              <span>Timer & Interview Simulation</span>
            </div>
          </div>

          {/* Mode Selection */}
          <div className="flex flex-col gap-1">
            <span className="text-[11px] font-medium text-neutral-400 uppercase tracking-wider font-mono">
              Timer Presets
            </span>
            <div className="grid grid-cols-2 gap-1.5 mt-1">
              {PRESET_DURATIONS.map((preset) => (
                <button
                  key={preset.seconds}
                  onClick={() => handleSelectPreset(preset.seconds)}
                  className={cn(
                    'px-2.5 py-1.5 rounded-lg text-xs font-medium text-left transition-colors cursor-pointer flex items-center justify-between border',
                    mode === 'countdown' && targetSeconds === preset.seconds
                      ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30 font-semibold'
                      : 'bg-white/[0.02] hover:bg-white/[0.06] text-neutral-300 border-white/[0.06]'
                  )}
                >
                  <span className="truncate">{preset.label}</span>
                  {mode === 'countdown' && targetSeconds === preset.seconds && (
                    <Check className="w-3 h-3 text-emerald-400 shrink-0" />
                  )}
                </button>
              ))}
            </div>

            <button
              onClick={handleSelectStopwatch}
              className={cn(
                'mt-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer flex items-center justify-between border w-full',
                mode === 'stopwatch'
                  ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30 font-semibold'
                  : 'bg-white/[0.02] hover:bg-white/[0.06] text-neutral-300 border-white/[0.06]'
              )}
            >
              <span>Stopwatch (Count Up)</span>
              {mode === 'stopwatch' && <Check className="w-3 h-3 text-emerald-400 shrink-0" />}
            </button>
          </div>

          {/* Simulation Mode Toggle Section */}
          <div className="pt-2 border-t border-white/[0.08] flex flex-col gap-2.5">
            <div className="flex items-start justify-between gap-2">
              <div className="flex flex-col">
                <span className="text-xs font-semibold text-white flex items-center gap-1">
                  <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
                  <span>Focus Tracking Simulation</span>
                </span>
                <span className="text-[10px] text-neutral-400 leading-tight mt-0.5">
                  Logs tab/window focus switches (>750ms grace window for OS popups)
                </span>
              </div>
              <button
                onClick={() => onToggleStrictMode(!strictModeEnabled)}
                className={cn(
                  'w-9 h-5 rounded-full p-0.5 transition-colors cursor-pointer shrink-0',
                  strictModeEnabled ? 'bg-amber-500' : 'bg-neutral-800 border border-white/[0.1]'
                )}
                aria-label="Toggle focus tracking simulation"
              >
                <div
                  className={cn(
                    'w-4 h-4 rounded-full bg-white transition-transform shadow-xs',
                    strictModeEnabled ? 'translate-x-4' : 'translate-x-0'
                  )}
                />
              </button>
            </div>

            {/* Opt-in Clipboard Restriction */}
            {strictModeEnabled && (
              <div className="flex items-start justify-between gap-2 pl-2 border-l-2 border-amber-500/30 py-1">
                <div className="flex flex-col">
                  <span className="text-xs font-medium text-neutral-200">
                    HackerRank Paste Restriction
                  </span>
                  <span className="text-[10px] text-neutral-400 leading-tight mt-0.5">
                    Blocks copy/paste shortcuts to practice typing solutions from scratch
                  </span>
                </div>
                <button
                  onClick={() => onToggleBlockClipboard?.(!blockClipboard)}
                  className={cn(
                    'w-8 h-4.5 rounded-full p-0.5 transition-colors cursor-pointer shrink-0 mt-0.5',
                    blockClipboard ? 'bg-amber-500' : 'bg-neutral-800 border border-white/[0.1]'
                  )}
                  aria-label="Toggle paste restriction"
                >
                  <div
                    className={cn(
                      'w-3.5 h-3.5 rounded-full bg-white transition-transform shadow-xs',
                      blockClipboard ? 'translate-x-3.5' : 'translate-x-0'
                    )}
                  />
                </button>
              </div>
            )}

            {tabSwitchCount > 0 && (
              <div className="flex items-center justify-between p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs">
                <span className="text-[11px] text-amber-300 flex items-center gap-1.5">
                  <AlertTriangle className="w-3 h-3 text-amber-400" />
                  <span>{tabSwitchCount} focus switch events</span>
                </span>
                <button
                  onClick={onResetViolations}
                  className="text-[10px] text-neutral-400 hover:text-white underline cursor-pointer"
                >
                  Reset
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
