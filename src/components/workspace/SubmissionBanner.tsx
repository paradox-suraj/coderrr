'use client';

import { motion } from 'framer-motion';
import { Trophy, AlertCircle, Sparkles, Flame, Clock, RefreshCw, ArrowRight, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface SubmissionBannerData {
  status: 'Accepted' | 'Wrong Answer' | 'Runtime Error' | 'Compile Error' | 'Time Limit Exceeded';
  message: string;
  passedCases: number;
  totalCases: number;
  latencyMs: number;
  failingCaseIndex?: number;
}

interface SubmissionBannerProps {
  banner: SubmissionBannerData;
  onRateRecall?: () => void;
  onJumpToCase?: (caseIndex: number) => void;
  onOpenConsole?: () => void;
  onTriggerConfetti?: () => void;
}

export default function SubmissionBanner({
  banner,
  onRateRecall,
  onJumpToCase,
  onOpenConsole,
  onTriggerConfetti,
}: SubmissionBannerProps) {
  const isAccepted = banner.status === 'Accepted';
  const isWrongAnswer = banner.status === 'Wrong Answer';
  const isRuntimeError = banner.status === 'Runtime Error' || banner.status === 'Compile Error';
  const isTLE = banner.status === 'Time Limit Exceeded';

  const failingIdx = banner.failingCaseIndex ?? 0;

  return (
    <motion.div
      initial={
        isWrongAnswer
          ? { opacity: 0, x: -10 }
          : { opacity: 0, scale: 0.96, y: -6 }
      }
      animate={
        isWrongAnswer
          ? {
              opacity: 1,
              x: [-10, 10, -8, 8, -4, 4, 0],
              transition: { duration: 0.48, ease: 'easeInOut' },
            }
          : {
              opacity: 1,
              scale: 1,
              y: 0,
              transition: { type: 'spring', stiffness: 350, damping: 22 },
            }
      }
      className={cn(
        'p-3.5 rounded-2xl border text-xs relative overflow-hidden backdrop-blur-md transition-all',
        isAccepted &&
          'bg-gradient-to-r from-emerald-950/40 via-emerald-900/20 to-teal-950/40 border-emerald-500/35 text-emerald-200 shadow-[0_0_35px_rgba(16,185,129,0.18)]',
        isWrongAnswer &&
          'bg-gradient-to-r from-rose-950/40 via-rose-900/20 to-orange-950/40 border-rose-500/35 text-rose-200 shadow-[0_0_35px_rgba(244,63,94,0.18)]',
        isRuntimeError &&
          'bg-gradient-to-r from-amber-950/40 via-rose-950/25 to-red-950/40 border-amber-500/35 text-amber-200 shadow-[0_0_35px_rgba(245,158,11,0.18)]',
        isTLE &&
          'bg-gradient-to-r from-amber-950/40 via-yellow-950/20 to-neutral-950/40 border-amber-500/35 text-amber-200 shadow-[0_0_35px_rgba(245,158,11,0.18)]'
      )}
    >
      {/* Background Accent Glow */}
      <div
        className={cn(
          'absolute -right-8 -top-8 w-32 h-32 rounded-full blur-2xl pointer-events-none opacity-20',
          isAccepted && 'bg-emerald-400',
          isWrongAnswer && 'bg-rose-500',
          isRuntimeError && 'bg-amber-400',
          isTLE && 'bg-yellow-400'
        )}
      />

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 relative z-10">
        {/* Left Side: Status Icon & Title */}
        <div className="flex items-start gap-3">
          {/* Animated Badge Icon */}
          <div
            className={cn(
              'w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border shadow-inner text-base',
              isAccepted && 'bg-emerald-500/20 border-emerald-500/30 text-emerald-300',
              isWrongAnswer && 'bg-rose-500/20 border-rose-500/30 text-rose-300',
              isRuntimeError && 'bg-amber-500/20 border-amber-500/30 text-amber-300',
              isTLE && 'bg-yellow-500/20 border-yellow-500/30 text-yellow-300'
            )}
          >
            {isAccepted && <span>🏆</span>}
            {isWrongAnswer && <span>💥</span>}
            {isRuntimeError && <span>🚨</span>}
            {isTLE && <span>⏱️</span>}
          </div>

          <div className="flex flex-col gap-0.5">
            {/* Status Headline with Creative Emojis */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-sm tracking-tight text-white flex items-center gap-1.5">
                {isAccepted && '🎉 🚀 Accepted! Flawless Solution! 🏆 💎'}
                {isWrongAnswer && '💥 ❌ Wrong Answer! Test Case Failed 🧐 🔍'}
                {isRuntimeError && '🚨 ⚡ Runtime Exception! Execution Failed 🛑 💣'}
                {isTLE && '⏱️ ⏳ Time Limit Exceeded (15,000ms)! 🐢 🛑'}
              </span>
            </div>

            {/* Subtitle Details & Diagnostic message */}
            <p className="text-[11.5px] opacity-90 leading-relaxed font-sans">
              {isAccepted && (
                <>
                  All <span className="font-semibold text-emerald-300">{banner.passedCases}</span> of{' '}
                  <span className="font-semibold text-emerald-300">{banner.totalCases}</span> test cases passed flawlessly in{' '}
                  <span className="font-mono text-emerald-300 font-bold">{banner.latencyMs}ms</span>!
                </>
              )}
              {isWrongAnswer && (
                <>
                  Passed <span className="font-semibold text-rose-300">{banner.passedCases}</span> of{' '}
                  <span className="font-semibold text-rose-300">{banner.totalCases}</span> test cases (⚡ {banner.latencyMs}ms).{' '}
                  <span className="font-medium text-white">Output mismatch on Test Case {failingIdx + 1}.</span>
                </>
              )}
              {isRuntimeError && (
                <span className="font-mono text-amber-100/90">{banner.message}</span>
              )}
              {isTLE && (
                <>
                  Execution timed out after 15 seconds. Please inspect your loops and recursion logic.
                </>
              )}
            </p>

            {/* Diagnostic edge case hints */}
            {isWrongAnswer && (
              <div className="mt-1 flex items-center gap-1.5 text-[11px] text-rose-300/85 font-mono">
                <span>💡</span>
                <span>Inspect expected vs your output in Case {failingIdx + 1} below to diagnose the bug! 🛠️</span>
              </div>
            )}
            {isRuntimeError && (
              <div className="mt-1 flex items-center gap-1.5 text-[11px] text-amber-300/85 font-mono">
                <span>💡</span>
                <span>Inspect full stack trace and line numbers in the Console tab 📋</span>
              </div>
            )}
            {isTLE && (
              <div className="mt-1 flex items-center gap-1.5 text-[11px] text-amber-300/85 font-mono">
                <span>💡</span>
                <span>Look out for infinite while loops, recursion depth, or O(N²) / O(2^N) complexity 🚀</span>
              </div>
            )}
          </div>
        </div>

        {/* Right Side: Badges & Quick Action Buttons */}
        <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
          {isAccepted && (
            <>
              {onTriggerConfetti && (
                <button
                  onClick={onTriggerConfetti}
                  className="px-2.5 py-1.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-200 text-[11px] font-medium transition-all flex items-center gap-1 cursor-pointer hover:scale-105 active:scale-95"
                  title="Celebrate again!"
                >
                  <Sparkles className="w-3 h-3 text-emerald-400" />
                  <span>Celebrate 🎉</span>
                </button>
              )}

              {onRateRecall && (
                <button
                  onClick={onRateRecall}
                  className="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-neutral-950 text-[11px] font-bold transition-all shadow-[0_0_15px_rgba(16,185,129,0.4)] flex items-center gap-1.5 cursor-pointer hover:scale-105 active:scale-95"
                >
                  <span>Rate Recall 🧠</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}
            </>
          )}

          {isWrongAnswer && onJumpToCase && (
            <button
              onClick={() => onJumpToCase(failingIdx)}
              className="px-3 py-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 text-rose-200 text-[11px] font-semibold transition-all flex items-center gap-1.5 cursor-pointer hover:scale-105 active:scale-95"
            >
              <span>Inspect Case {failingIdx + 1} 🔍</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}

          {isRuntimeError && onOpenConsole && (
            <button
              onClick={onOpenConsole}
              className="px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-200 text-[11px] font-semibold transition-all flex items-center gap-1.5 cursor-pointer hover:scale-105 active:scale-95"
            >
              <span>View Logs 📋</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
}
