'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { 
  Play, 
  Pause, 
  RotateCcw, 
  Flame, 
  ArrowUpRight,
  BrainCircuit,
  Zap
} from 'lucide-react';
import { db, getDueReviews, logSprintCompletion, type UserProgress } from '@/lib/db';
import { cn } from '@/lib/utils';
import { SpotlightCard } from '@/components/core/SpotlightCard';
import { TextShimmer } from '@/components/core/TextShimmer';
import type { ProblemDoc } from '@/lib/workers/search.worker';

const SPRINT_DURATION_SECONDS = 25 * 60; // 25 minutes Pomodoro sprint

interface SprintDeckProps {
  initialProblems?: ProblemDoc[];
}

export default function SprintDeck({ initialProblems = [] }: SprintDeckProps) {
  // ─── Pomodoro Timer State ──────────────────────────────────────────────────
  const [secondsRemaining, setSecondsRemaining] = useState(SPRINT_DURATION_SECONDS);
  const [isActive, setIsActive] = useState(false);
  const [sprintCount, setSprintCount] = useState(0);

  // ─── Rule-of-5 Prioritized Problem Cards ──────────────────────────────────
  const [prioritizedCards, setPrioritizedCards] = useState<ProblemDoc[]>([]);
  const [progressMap, setProgressMap] = useState<Record<string, UserProgress>>({});
  const [completedProblems, setCompletedProblems] = useState<Set<string>>(new Set());

  // Load problems and prioritize Rule of 5:
  // 1. Spaced Repetition Due (nextReviewDate <= now)
  // 2. Highest company frequency / priority bucket
  useEffect(() => {
    async function loadCockpitDeck() {
      let dataset = initialProblems;
      if (!dataset || dataset.length === 0) {
        try {
          const res = await fetch('/data/problems.json');
          dataset = await res.json();
        } catch {
          dataset = [];
        }
      }

      // Fetch user progress from Dexie
      const progressEntries = await db.userProgress.toArray();
      const pMap: Record<string, UserProgress> = {};
      const completed = new Set<string>();
      progressEntries.forEach((p) => {
        pMap[p.problemId] = p;
        if (p.status === 'solved') completed.add(p.problemId);
      });
      setProgressMap(pMap);
      setCompletedProblems(completed);

      // Fetch items due for review today
      const dueReviews = await getDueReviews();
      const dueIds = new Set(dueReviews.map((r) => r.problemId));

      // Build Top 5 ADHD Rule Deck
      const dueCards: ProblemDoc[] = [];
      const upcomingCards: ProblemDoc[] = [];

      for (const p of dataset) {
        if (dueIds.has(p.id)) {
          dueCards.push(p);
        } else if (!completed.has(p.id)) {
          upcomingCards.push(p);
        }
      }

      // Sort upcoming cards by companies count descending (Highest ROI)
      upcomingCards.sort((a, b) => b.companiesCount - a.companiesCount);

      // Combine: due first, then highest ROI, capped at strictly 5 items
      const finalDeck = [...dueCards, ...upcomingCards].slice(0, 5);
      setPrioritizedCards(finalDeck);
    }

    loadCockpitDeck();
  }, [initialProblems]);

  // ─── Timer Countdown & Complete Effect ──────────────────────────────────────
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;

    if (isActive && secondsRemaining > 0) {
      interval = setInterval(() => {
        setSecondsRemaining((prev) => prev - 1);
      }, 1000);
    } else if (secondsRemaining === 0 && isActive) {
      setIsActive(false);
      setSprintCount((prev) => prev + 1);
      // Log to Dexie sprints
      logSprintCompletion({
        date: new Date().toISOString().slice(0, 10),
        durationMinutes: 25,
        completedCount: completedProblems.size,
        problemIds: prioritizedCards.map((p) => p.id),
      });
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isActive, secondsRemaining, completedProblems, prioritizedCards]);

  // ─── Keyboard Control: Space Bar to Toggle Timer ───────────────────────────
  const toggleTimer = useCallback(() => {
    setIsActive((prev) => !prev);
  }, []);

  const resetTimer = useCallback(() => {
    setIsActive(false);
    setSecondsRemaining(SPRINT_DURATION_SECONDS);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Toggle timer on Space when not inside an input / textarea
      if (
        e.code === 'Space' &&
        !(e.target instanceof HTMLInputElement) &&
        !(e.target instanceof HTMLTextAreaElement)
      ) {
        e.preventDefault();
        toggleTimer();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleTimer]);

  // Format MM:SS
  const minutes = Math.floor(secondsRemaining / 60);
  const seconds = secondsRemaining % 60;
  const timeFormatted = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  // Circular progress math (Radius 52, Circumference ~326.7)
  const radius = 48;
  const circumference = 2 * Math.PI * radius;
  const progressPercent = (SPRINT_DURATION_SECONDS - secondsRemaining) / SPRINT_DURATION_SECONDS;
  const strokeDashoffset = circumference - progressPercent * circumference;

  return (
    <div className="w-full flex flex-col gap-6">
      {/* Top Banner: ADHD Sprint Dashboard Header */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-6 p-6 rounded-2xl glass-card relative overflow-hidden shadow-sm">
        {/* Subtle background glow */}
        <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-500/[0.04] rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />

        <div className="flex flex-col gap-1.5 max-w-xl z-10">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-emerald-400">
            <Zap className="w-4 h-4 fill-emerald-400 text-emerald-400" />
            <TextShimmer className="text-xs font-semibold uppercase tracking-wider">
              ADHD Sprint Deck — Zero Cognitive Overload
            </TextShimmer>
          </div>
          <h2 className="text-xl md:text-2xl font-bold tracking-tight text-neutral-100">
            Today&apos;s Focus Quota (Rule of 5)
          </h2>
          <p className="text-xs md:text-sm text-neutral-400 leading-relaxed">
            Strict maximum 5 problems surfaced per session. Spaced repetition due reviews are prioritized over top-tier company frequencies.
          </p>
        </div>

        {/* 25-min Pomodoro Sprint Widget */}
        <div className="flex items-center gap-5 z-10 bg-black/40 p-3.5 rounded-xl border border-white/[0.08] self-start lg:self-auto backdrop-blur-md">
          {/* Circular SVG Progress */}
          <div className="relative w-28 h-28 flex items-center justify-center shrink-0">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
              <circle
                cx="60"
                cy="60"
                r={radius}
                className="stroke-white/[0.06] fill-none"
                strokeWidth="6"
              />
              <circle
                cx="60"
                cy="60"
                r={radius}
                className="stroke-emerald-500 fill-none transition-all duration-300 ease-linear"
                strokeWidth="6"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute flex flex-col items-center justify-center">
              <span className="font-mono text-lg font-bold tracking-tight text-white tabular-nums">
                {timeFormatted}
              </span>
              <span className="text-[10px] text-neutral-500 uppercase font-mono">
                {isActive ? 'Sprint' : 'Paused'}
              </span>
            </div>
          </div>

          {/* Timer Controls */}
          <div className="flex flex-col gap-2">
            <button
              onClick={toggleTimer}
              className={cn(
                'flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-semibold text-xs transition-all duration-200 shadow-sm cursor-pointer',
                isActive
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30'
                  : 'glow-button text-white'
              )}
            >
              {isActive ? (
                <>
                  <Pause className="w-3.5 h-3.5 fill-current" />
                  <span>Pause</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Start Sprint</span>
                </>
              )}
            </button>

            <div className="flex items-center gap-1.5">
              <button
                onClick={resetTimer}
                title="Reset timer to 25 mins"
                className="p-1.5 rounded-md hover:bg-white/[0.06] text-neutral-400 hover:text-white transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
              <span className="text-[11px] font-mono text-neutral-500">
                Space to Toggle
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 5 Focused Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        {prioritizedCards.map((problem) => {
          const isSolved = completedProblems.has(problem.id);
          const userProg = progressMap[problem.id];
          const isDue = userProg && new Date(userProg.nextReviewDate) <= new Date();

          return (
            <SpotlightCard
              key={problem.id}
              className={cn(
                'group relative transition-all duration-200 hover:-translate-y-0.5',
                isSolved && 'opacity-70'
              )}
            >
              <div className="flex flex-col justify-between h-full">
                {/* Header Badges */}
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2.5">
                    <span className="font-mono text-xs font-semibold text-neutral-500 tabular-nums">
                      #{problem.id}
                    </span>
                    <div className="flex items-center gap-1.5">
                      {isDue && (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-400 border border-rose-500/30">
                          Review Due
                        </span>
                      )}
                      <span
                        className={cn(
                          'text-[10px] font-semibold px-2 py-0.5 rounded-full border',
                          problem.difficulty === 'Easy' && 'text-emerald-400 border-emerald-500/25 bg-emerald-500/10',
                          problem.difficulty === 'Medium' && 'text-amber-400 border-amber-500/25 bg-amber-500/10',
                          problem.difficulty === 'Hard' && 'text-rose-400 border-rose-500/25 bg-rose-500/10'
                        )}
                      >
                        {problem.difficulty}
                      </span>
                    </div>
                  </div>

                  {/* Title */}
                  <Link
                    href={`/problem/${problem.id}`}
                    className="font-medium text-sm text-neutral-200 group-hover:text-white transition-colors line-clamp-1 block"
                  >
                    {problem.title}
                  </Link>

                  {/* Pattern & Track Details */}
                  <div className="flex flex-col gap-1 mt-2.5 text-xs text-neutral-400">
                    <div className="font-medium text-neutral-300 flex items-center gap-1.5 truncate">
                      <BrainCircuit className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span className="truncate">{problem.corePattern || 'Core Pattern'}</span>
                    </div>
                    <div className="text-[11px] text-neutral-500 font-mono truncate">
                      {problem.learningTrack}
                    </div>
                  </div>
                </div>

                {/* Card Footer */}
                <div className="pt-4 mt-3 border-t border-white/[0.06] flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1 text-[11px] text-neutral-400 font-mono tabular-nums">
                    <Flame className="w-3.5 h-3.5 text-orange-400" />
                    <span>{problem.companiesCount} orgs</span>
                  </div>

                  <Link
                    href={`/problem/${problem.id}`}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-400 hover:text-emerald-300 transition-colors"
                  >
                    <span>Solve</span>
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            </SpotlightCard>
          );
        })}
      </div>
    </div>
  );
}
