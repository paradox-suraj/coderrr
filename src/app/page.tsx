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
  Zap,
  GitCompare,
  Layers,
  Flame,
  Code2,
  Terminal,
  ShieldCheck
} from 'lucide-react';
import TopicConstellation from '@/components/canvas/TopicConstellation';
import SprintDeck from '@/components/dashboard/SprintDeck';
import CompanyLogo from '@/components/CompanyLogo';
import { companyToSlug } from '@/lib/utils/companySlug';
import { SpotlightCard } from '@/components/core/SpotlightCard';
import { db } from '@/lib/db';
import type { ProblemDoc } from '@/lib/workers/search.worker';

const FEATURED_TRACKS = [
  {
    id: '03',
    title: 'Pointers & Sliding Window',
    description: 'Two pointers, fast/slow runners, and dynamic window expansion/contraction.',
    pattern: 'Two Pointers • Sliding Window • Binary Search',
  },
  {
    id: '05',
    title: 'Trees & Graph Traversals',
    description: 'Binary search trees, BFS/DFS, topological sorting, and disjoint sets.',
    pattern: 'BFS / DFS • Tree Traversal • Shortest Path',
  },
  {
    id: '08',
    title: 'Dynamic Programming',
    description: '1D/2D memoization, knapsack subproblems, and state machines.',
    pattern: 'Memoization • Tabulation • Subsequences',
  },
  {
    id: '06',
    title: 'Greedy & Intervals',
    description: 'Interval scheduling, greedy choice properties, and prefix sums.',
    pattern: 'Intervals • Greedy Choice • Prefix Sum',
  },
  {
    id: '04',
    title: 'Linear & Monotonic',
    description: 'Monotonic stacks, double-ended queues, and priority heaps.',
    pattern: 'Monotonic Stack • Heap • Priority Queue',
  },
  {
    id: '10',
    title: 'System Design & Concurrency',
    description: 'LRU/LFU caches, rate limiters, multi-threaded worker pools, and data feeds.',
    pattern: 'Cache Design • Concurrency • API Systems',
  },
];

const TOP_COMPANIES = [
  { name: 'Google', count: 1378 },
  { name: 'Amazon', count: 1285 },
  { name: 'Meta', count: 1042 },
  { name: 'Microsoft', count: 964 },
  { name: 'Apple', count: 688 },
  { name: 'Bloomberg', count: 612 },
  { name: 'Uber', count: 489 },
  { name: 'Citadel', count: 284 },
  { name: 'Stripe', count: 216 },
  { name: 'Netflix', count: 182 },
];

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

      // 2. Load problems for dashboard deck
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

      {/* Main Content Container */}
      <div className="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col gap-10">
        {/* Top Hero Section */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 pt-4">
          <div className="flex flex-col gap-2.5">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-xs font-medium text-emerald-300 w-fit backdrop-blur-md shadow-xs">
              <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
              <span>Curated Technical Interview Prep</span>
            </div>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight bg-gradient-to-b from-white via-neutral-200 to-neutral-400 bg-clip-text text-transparent">
              Targeted Practice for Technical Interviews.
            </h1>
            <p className="text-sm sm:text-base text-neutral-400 max-w-2xl leading-relaxed">
              3,358 real interview problems cross-referenced across 654 top tech companies. Practice with in-browser code execution, company frequency rankings, and spaced repetition.
            </p>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex items-center gap-3 shrink-0">
            <Link
              href="/companies/compare"
              className="px-4 py-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-xs font-semibold text-neutral-200 flex items-center gap-2 transition-all shadow-xs backdrop-blur-md cursor-pointer hover:border-white/[0.16]"
            >
              <GitCompare className="w-3.5 h-3.5 text-emerald-400" />
              <span>Compare Companies</span>
            </Link>
            <Link
              href="/problems"
              className="px-4 py-2 rounded-xl glow-button text-xs font-semibold text-white flex items-center gap-2 transition-all shadow-md cursor-pointer"
            >
              <span>Browse Problems</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        {/* 4 Quick Stat Metric Tiles */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <SpotlightCard className="p-4 flex flex-col gap-1.5 glass-card rounded-xl border border-white/10">
            <div className="flex items-center justify-between text-neutral-300 text-xs font-medium">
              <span>Solved Problems</span>
              <div className="p-1 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                <CheckCircle2 className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="flex items-baseline gap-2 mt-0.5">
              <span className="text-2xl font-semibold text-white tracking-tight font-mono tabular-nums">{solvedCount}</span>
              <span className="text-xs text-neutral-400 font-mono tabular-nums">/ {totalProblems}</span>
            </div>
            <div className="w-full bg-white/[0.08] rounded-full h-1 mt-2 overflow-hidden">
              <div
                className="bg-emerald-500 h-full rounded-full transition-all duration-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"
                style={{ width: `${Math.min(100, (solvedCount / totalProblems) * 100)}%` }}
              />
            </div>
          </SpotlightCard>

          <SpotlightCard className="p-4 flex flex-col gap-1.5 glass-card rounded-xl border border-white/10">
            <div className="flex items-center justify-between text-neutral-300 text-xs font-medium">
              <span>Reviews Due Today</span>
              <div className="p-1 rounded-md bg-rose-500/10 border border-rose-500/20 text-rose-400">
                <Target className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="flex items-baseline gap-2 mt-0.5">
              <span className="text-2xl font-semibold text-white tracking-tight font-mono tabular-nums">{reviewCount}</span>
              <span className="text-xs text-neutral-400 font-mono">in queue</span>
            </div>
            <div className="text-[11px] text-neutral-400 mt-1 font-mono font-medium">
              {reviewCount === 0 ? 'All reviews cleared for today 🎉' : 'Active retention schedule'}
            </div>
          </SpotlightCard>

          <SpotlightCard className="p-4 flex flex-col gap-1.5 glass-card rounded-xl border border-white/10">
            <div className="flex items-center justify-between text-neutral-300 text-xs font-medium">
              <span>Focus Timer</span>
              <div className="p-1 rounded-md bg-amber-500/10 border border-amber-500/20 text-amber-400">
                <Zap className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="flex items-baseline gap-2 mt-0.5">
              <span className="text-2xl font-semibold text-white tracking-tight font-mono tabular-nums">25m</span>
              <span className="text-xs text-neutral-400 font-mono">Pomodoro</span>
            </div>
            <div className="text-[11px] text-neutral-400 mt-1 font-mono font-medium">
              Structured sprint mode
            </div>
          </SpotlightCard>

          <SpotlightCard className="p-4 flex flex-col gap-1.5 glass-card rounded-xl border border-white/10">
            <div className="flex items-center justify-between text-neutral-300 text-xs font-medium">
              <span>Learning Tracks</span>
              <div className="p-1 rounded-md bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
                <BrainCircuit className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="flex items-baseline gap-2 mt-0.5">
              <span className="text-2xl font-semibold text-white tracking-tight font-mono tabular-nums">10 / 10</span>
              <span className="text-xs text-neutral-400 font-mono">Tracks</span>
            </div>
            <div className="text-[11px] text-neutral-400 mt-1 font-mono font-medium">
              Complete DSA taxonomy
            </div>
          </SpotlightCard>
        </div>

        {/* Daily Focus Practice Sprint Deck */}
        <SprintDeck initialProblems={sampleProblems} />

        {/* Curated Topic Tracks */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2 text-xs font-semibold text-emerald-400 uppercase tracking-wider">
                <Layers className="w-3.5 h-3.5" />
                <span>Structured Learning</span>
              </div>
              <h2 className="text-xl font-bold tracking-tight text-white">
                Core Algorithmic Tracks
              </h2>
            </div>
            <Link
              href="/problems"
              className="text-xs font-semibold text-neutral-400 hover:text-white transition-colors flex items-center gap-1 cursor-pointer"
            >
              <span>View all tracks</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {FEATURED_TRACKS.map((track) => (
              <Link
                key={track.id}
                href="/problems"
                className="group p-5 rounded-2xl glass-card border border-white/10 hover:border-emerald-500/30 transition-all duration-200 flex flex-col justify-between gap-3"
              >
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs text-neutral-500 font-semibold">
                      Track #{track.id}
                    </span>
                    <span className="text-[11px] text-neutral-400 font-mono group-hover:text-emerald-400 transition-colors">
                      Explore →
                    </span>
                  </div>
                  <h3 className="text-sm font-semibold text-neutral-200 group-hover:text-white transition-colors">
                    {track.title}
                  </h3>
                  <p className="text-xs text-neutral-400 leading-relaxed">
                    {track.description}
                  </p>
                </div>
                <div className="pt-2 border-t border-white/[0.06] text-[11px] font-mono text-neutral-400 truncate">
                  {track.pattern}
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Top Tech Companies Strip */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2 text-xs font-semibold text-emerald-400 uppercase tracking-wider">
                <Building2 className="w-3.5 h-3.5" />
                <span>Company Problem Sets</span>
              </div>
              <h2 className="text-xl font-bold tracking-tight text-white">
                Top Hiring Organizations
              </h2>
            </div>
            <Link
              href="/companies"
              className="text-xs font-semibold text-neutral-400 hover:text-white transition-colors flex items-center gap-1 cursor-pointer"
            >
              <span>All 654 companies</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
            {TOP_COMPANIES.map((company) => (
              <Link
                key={company.name}
                href={`/companies/${companyToSlug(company.name)}`}
                className="p-3.5 rounded-xl glass-card border border-white/10 hover:border-emerald-500/30 transition-all flex items-center gap-3 group"
              >
                <CompanyLogo companyName={company.name} size={32} />
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-semibold text-neutral-200 group-hover:text-white truncate">
                    {company.name}
                  </div>
                  <div className="text-[11px] text-neutral-400 font-mono tabular-nums flex items-center gap-1">
                    <Flame className="w-3 h-3 text-orange-400" />
                    <span>{company.count} problems</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* Authentic Multi-Column Footer */}
      <footer className="relative z-10 w-full border-t border-white/[0.08] mt-16 bg-[#08080a]/90 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 flex flex-col gap-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            {/* Brand Column */}
            <div className="flex flex-col gap-3 md:col-span-1">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-center text-emerald-400">
                  <BrainCircuit className="w-4 h-4" />
                </div>
                <span className="font-semibold text-sm text-white tracking-tight">AlgoJeet Pro</span>
              </div>
              <p className="text-xs text-neutral-400 leading-relaxed">
                Open-source, local-first technical interview prep platform. Practice real questions with zero-latency in-browser execution and memory retention.
              </p>
            </div>

            {/* Practice Column */}
            <div className="flex flex-col gap-2.5">
              <span className="text-xs font-semibold text-neutral-300 uppercase tracking-wider font-mono">Practice</span>
              <Link href="/problems" className="text-xs text-neutral-400 hover:text-white transition-colors">
                All Problems (3,358)
              </Link>
              <Link href="/companies" className="text-xs text-neutral-400 hover:text-white transition-colors">
                Companies Directory (654)
              </Link>
              <Link href="/companies/compare" className="text-xs text-neutral-400 hover:text-white transition-colors">
                Company Overlap Comparator
              </Link>
              <Link href="/review" className="text-xs text-neutral-400 hover:text-white transition-colors">
                Spaced Repetition Queue
              </Link>
            </div>

            {/* Platform Capabilities Column */}
            <div className="flex flex-col gap-2.5">
              <span className="text-xs font-semibold text-neutral-300 uppercase tracking-wider font-mono">Capabilities</span>
              <span className="text-xs text-neutral-400 flex items-center gap-1.5">
                <Terminal className="w-3 h-3 text-emerald-400" />
                Pyodide Python 3 (Wasm)
              </span>
              <span className="text-xs text-neutral-400 flex items-center gap-1.5">
                <Code2 className="w-3 h-3 text-emerald-400" />
                Web Worker JS Sandbox
              </span>
              <span className="text-xs text-neutral-400 flex items-center gap-1.5">
                <BrainCircuit className="w-3 h-3 text-emerald-400" />
                SM-2 Repetition Engine
              </span>
              <span className="text-xs text-neutral-400 flex items-center gap-1.5">
                <ShieldCheck className="w-3 h-3 text-emerald-400" />
                Strict Interview Simulation
              </span>
            </div>

            {/* Resources Column */}
            <div className="flex flex-col gap-2.5">
              <span className="text-xs font-semibold text-neutral-300 uppercase tracking-wider font-mono">Resources</span>
              <Link href="/privacy" className="text-xs text-neutral-400 hover:text-white transition-colors">
                Privacy & Data Notice
              </Link>
              <Link href="/profile" className="text-xs text-neutral-400 hover:text-white transition-colors">
                Account & Sync Settings
              </Link>
              <div className="text-[11px] text-neutral-500 font-mono mt-1">
                Keyboard: <kbd className="px-1.5 py-0.5 rounded bg-white/[0.06] border border-white/10 text-neutral-400">⌘K</kbd> Find • <kbd className="px-1.5 py-0.5 rounded bg-white/[0.06] border border-white/10 text-neutral-400">[</kbd> Sidebar
              </div>
            </div>
          </div>

          <div className="pt-6 border-t border-white/[0.06] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-neutral-500">
            <div className="flex flex-col sm:flex-row items-center gap-1.5 sm:gap-2 text-center sm:text-left">
              <span>© 2026 AlgoJeet Pro</span>
              <span className="hidden sm:inline">•</span>
              <span>
                Created by{' '}
                <a
                  href="https://www.instagram.com/paradox.suraj/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-neutral-300 hover:text-emerald-400 font-medium transition-colors underline underline-offset-4 decoration-white/20 hover:decoration-emerald-400"
                >
                  Paradox Suraj
                </a>
              </span>
              <span className="hidden sm:inline">•</span>
              <span>Built for engineers • Local-first, private by design</span>
            </div>
            <span className="font-mono text-[11px]">Zero tracking • All data stored in IndexedDB</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

