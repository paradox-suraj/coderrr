'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { 
  CheckCircle2, 
  BrainCircuit, 
  Building2, 
  Target, 
  ArrowRight, 
  Sparkles, 
  Zap 
} from 'lucide-react';
import TopicConstellation from '@/components/canvas/TopicConstellation';
import SprintDeck from '@/components/cockpit/SprintDeck';
import { SpotlightCard } from '@/components/core/SpotlightCard';
import { TextShimmer } from '@/components/core/TextShimmer';
import { db } from '@/lib/db';
import type { ProblemDoc } from '@/lib/workers/search.worker';

export default function DashboardPage() {
  const [solvedCount, setSolvedCount] = useState(0);
  const [reviewCount, setReviewCount] = useState(0);
  const [totalProblems, setTotalProblems] = useState(3358);
  const [sampleProblems, setSampleProblems] = useState<ProblemDoc[]>([]);

  useEffect(() => {
    async function loadStats() {
      // 1. Fetch user progress stats from Dexie
      const progressList = await db.userProgress.toArray();
      const solved = progressList.filter((p) => p.status === 'solved').length;
      setSolvedCount(solved);

      const nowIso = new Date().toISOString();
      const due = progressList.filter(
        (p) => p.status === 'solved' && p.nextReviewDate && p.nextReviewDate <= nowIso
      ).length;
      setReviewCount(due);

      // 2. Load problems for cockpit deck
      try {
        const res = await fetch('/data/problems.json');
        const data: ProblemDoc[] = await res.json();
        setTotalProblems(data.length);
        setSampleProblems(data);
      } catch (err) {
        console.error('Failed to load problems data', err);
      }
    }

    loadStats();
  }, []);

  return (
    <div className="relative min-h-screen flex flex-col justify-between overflow-hidden">
      {/* ThreeUI WebGL Background Canvas */}
      <TopicConstellation />

      {/* Main Focus Cockpit Container */}
      <div className="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col gap-8">
        {/* Top Hero Section */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 pt-4">
          <div className="flex flex-col gap-2.5">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.04] border border-white/[0.08] text-xs font-medium text-neutral-300 w-fit backdrop-blur-md shadow-xs">
              <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
              <TextShimmer duration={3}>Algorithmic Intelligence Platform</TextShimmer>
            </div>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight bg-gradient-to-b from-white via-neutral-200 to-neutral-500 bg-clip-text text-transparent">
              Prepare Like A Principal.
            </h1>
            <p className="text-sm sm:text-base text-neutral-400 max-w-2xl leading-relaxed">
              17,641 real interview signals across 654 top companies synthesized into 10 structured tracks with Alex Xu system design mappings.
            </p>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex items-center gap-3 shrink-0">
            <Link
              href="/companies/compare"
              className="px-4 py-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-xs font-semibold text-neutral-200 flex items-center gap-2 transition-all shadow-xs backdrop-blur-md cursor-pointer hover:border-white/[0.14]"
            >
              <Building2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>Compare Overlaps</span>
            </Link>
            <Link
              href="/problems"
              className="px-4 py-2 rounded-xl glow-button text-xs font-semibold text-white flex items-center gap-2 transition-all shadow-md cursor-pointer"
            >
              <span>Explore All</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        {/* 4 Quick Stat Metric Tiles */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <SpotlightCard className="p-4 flex flex-col gap-1.5 glass-card rounded-xl">
            <div className="flex items-center justify-between text-neutral-400 text-xs font-medium">
              <span>Solved Questions</span>
              <div className="p-1 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                <CheckCircle2 className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="flex items-baseline gap-2 mt-0.5">
              <span className="text-2xl font-semibold text-white tracking-tight font-mono tabular-nums">{solvedCount}</span>
              <span className="text-xs text-neutral-500 font-mono tabular-nums">/ {totalProblems}</span>
            </div>
            <div className="w-full bg-white/[0.06] rounded-full h-1 mt-2 overflow-hidden">
              <div
                className="bg-emerald-500 h-full rounded-full transition-all duration-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"
                style={{ width: `${Math.min(100, (solvedCount / totalProblems) * 100)}%` }}
              />
            </div>
          </SpotlightCard>

          <SpotlightCard className="p-4 flex flex-col gap-1.5 glass-card rounded-xl">
            <div className="flex items-center justify-between text-neutral-400 text-xs font-medium">
              <span>Reviews Due Today</span>
              <div className="p-1 rounded-md bg-rose-500/10 border border-rose-500/20 text-rose-400">
                <Target className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="flex items-baseline gap-2 mt-0.5">
              <span className="text-2xl font-semibold text-white tracking-tight font-mono tabular-nums">{reviewCount}</span>
              <span className="text-xs text-neutral-500 font-mono">in queue</span>
            </div>
            <div className="text-[11px] text-neutral-400 mt-1 font-mono">
              {reviewCount === 0 ? 'All spaced reviews cleared 🎉' : 'Retention target active'}
            </div>
          </SpotlightCard>

          <SpotlightCard className="p-4 flex flex-col gap-1.5 glass-card rounded-xl">
            <div className="flex items-center justify-between text-neutral-400 text-xs font-medium">
              <span>Sprint Focus</span>
              <div className="p-1 rounded-md bg-amber-500/10 border border-amber-500/20 text-amber-400">
                <Zap className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="flex items-baseline gap-2 mt-0.5">
              <span className="text-2xl font-semibold text-white tracking-tight font-mono tabular-nums">25m</span>
              <span className="text-xs text-neutral-500 font-mono">Pomodoro</span>
            </div>
            <div className="text-[11px] text-neutral-400 mt-1 font-mono">
              Deep work sprint active
            </div>
          </SpotlightCard>

          <SpotlightCard className="p-4 flex flex-col gap-1.5 glass-card rounded-xl">
            <div className="flex items-center justify-between text-neutral-400 text-xs font-medium">
              <span>Track Coverage</span>
              <div className="p-1 rounded-md bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
                <BrainCircuit className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="flex items-baseline gap-2 mt-0.5">
              <span className="text-2xl font-semibold text-white tracking-tight font-mono tabular-nums">10 / 10</span>
              <span className="text-xs text-neutral-500 font-mono">Tracks</span>
            </div>
            <div className="text-[11px] text-neutral-400 mt-1 font-mono">
              System Architecture mapped
            </div>
          </SpotlightCard>
        </div>

        {/* ADHD Focus Sprint Deck */}
        <SprintDeck initialProblems={sampleProblems} />
      </div>

      {/* Cockpit Footer */}
      <footer className="relative z-10 w-full border-t border-white/[0.06] py-4 px-6 text-center text-xs text-neutral-500 font-mono bg-transparent">
        <span>AlgoJeet Pro • High Performance Algorithmic Intelligence Workbench</span>
      </footer>
    </div>
  );
}
