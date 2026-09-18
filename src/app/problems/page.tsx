'use client';

import { useState, useEffect, useMemo, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { 
  Search, 
  Flame, 
  BrainCircuit, 
  ArrowUpRight, 
  ArrowLeft,
  Layers,
  CheckCircle2,
  Filter,
  X,
  RotateCcw,
  SlidersHorizontal,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Tag,
  ArrowUpDown
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { getAllSolvedProblemIds } from '@/lib/db';
import type { ProblemDoc } from '@/lib/workers/search.worker';

// Module-level cache so returning to /problems is instant
let cachedProblems: ProblemDoc[] | null = null;

function ProblemsLoadingSkeleton() {
  return (
    <div className="min-h-screen bg-background text-foreground p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto flex flex-col gap-6">
      <div className="animate-pulse flex flex-col gap-4 border-b border-white/[0.08] pb-6">
        <div className="h-4 w-32 bg-neutral-800 rounded" />
        <div className="h-8 w-64 bg-neutral-800 rounded" />
        <div className="h-4 w-96 bg-neutral-800 rounded" />
      </div>
      <div className="glass-card p-4 rounded-2xl animate-pulse flex flex-col gap-4">
        <div className="h-10 w-full bg-neutral-900 rounded-xl" />
        <div className="h-8 w-full bg-neutral-900 rounded-xl" />
      </div>
      <div className="rounded-2xl border border-white/[0.08] glass-card p-6 flex flex-col gap-3 animate-pulse">
        {[...Array(8)].map((_, i) => (
          <div key={i} className="h-12 w-full bg-neutral-900/60 rounded-xl" />
        ))}
      </div>
    </div>
  );
}

function ProblemsDirectoryContent() {
  const searchParams = useSearchParams();

  // ── State ──────────────────────────────────────────────────────────────────
  const [allProblems, setAllProblems] = useState<ProblemDoc[]>(cachedProblems || []);
  const [solvedIds, setSolvedIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(!cachedProblems || cachedProblems.length === 0);

  // Filters initialized from URL query params if present
  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '');
  const [selectedDifficulty, setSelectedDifficulty] = useState<'All' | 'Easy' | 'Medium' | 'Hard'>(
    (searchParams.get('difficulty') as any) || 'All'
  );
  const [selectedStatus, setSelectedStatus] = useState<'all' | 'solved' | 'unsolved'>(
    (searchParams.get('status') as any) || 'all'
  );
  const [selectedPattern, setSelectedPattern] = useState<string>(
    searchParams.get('pattern') || 'all'
  );
  const [selectedTopic, setSelectedTopic] = useState<string>(
    searchParams.get('topic') || 'all'
  );
  const [selectedTrack, setSelectedTrack] = useState<string>(
    searchParams.get('track') || 'all'
  );
  const [sortBy, setSortBy] = useState<'id-asc' | 'id-desc' | 'companies-desc' | 'title-asc' | 'difficulty-asc' | 'difficulty-desc'>('id-asc');

  // Pagination: 50, 100, 250, or 0 (All)
  const [pageSize, setPageSize] = useState<number>(50);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [jumpPageInput, setJumpPageInput] = useState<string>('');

  // ── Data Fetching ──────────────────────────────────────────────────────────
  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      try {
        if (!cachedProblems) {
          setIsLoading(true);
          const [res, solvedSet] = await Promise.all([
            fetch('/data/problems.json').then((r) => r.json()),
            getAllSolvedProblemIds(),
          ]);
          if (isMounted) {
            cachedProblems = res;
            setAllProblems(res);
            setSolvedIds(solvedSet);
          }
        } else {
          const solvedSet = await getAllSolvedProblemIds();
          if (isMounted) {
            setSolvedIds(solvedSet);
          }
        }
      } catch (err) {
        console.error('Failed to fetch problems', err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    loadData();
    return () => {
      isMounted = false;
    };
  }, []);

  // ── Dynamic Metadata Extraction for Filters ────────────────────────────────
  const { patternsList, topicsList, tracksList, overallStats } = useMemo(() => {
    const patternCounts: Record<string, number> = {};
    const topicCounts: Record<string, number> = {};
    const trackCounts: Record<string, number> = {};

    let easyCount = 0;
    let mediumCount = 0;
    let hardCount = 0;

    for (const p of allProblems) {
      if (p.difficulty === 'Easy') easyCount++;
      else if (p.difficulty === 'Medium') mediumCount++;
      else if (p.difficulty === 'Hard') hardCount++;

      if (p.corePattern) {
        patternCounts[p.corePattern] = (patternCounts[p.corePattern] || 0) + 1;
      }
      if (Array.isArray(p.allTopics)) {
        for (const t of p.allTopics) {
          topicCounts[t] = (topicCounts[t] || 0) + 1;
        }
      }
      if (p.learningTrack) {
        trackCounts[p.learningTrack] = (trackCounts[p.learningTrack] || 0) + 1;
      }
    }

    const patterns = Object.entries(patternCounts)
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([name, count]) => ({ name, count }));

    const topics = Object.entries(topicCounts)
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([name, count]) => ({ name, count }));

    const tracks = Object.entries(trackCounts)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([name, count]) => ({ name, count }));

    return {
      patternsList: patterns,
      topicsList: topics,
      tracksList: tracks,
      overallStats: {
        total: allProblems.length,
        easy: easyCount,
        medium: mediumCount,
        hard: hardCount,
      },
    };
  }, [allProblems]);

  // ── In-Memory Instant Filtering & Sorting (< 1ms) ──────────────────────────
  const { filteredProblems, filterStats, executionTimeMs } = useMemo(() => {
    const startTime = performance.now();

    const queryTrimmed = searchQuery.trim().toLowerCase().replace(/^#/, '');
    const singularQuery = queryTrimmed.endsWith('s') && queryTrimmed.length > 3 ? queryTrimmed.slice(0, -1) : null;

    let easy = 0;
    let medium = 0;
    let hard = 0;
    let solved = 0;

    const list = allProblems.filter((p) => {
      const isSolved = solvedIds.has(p.id);

      // 1. Difficulty filter
      if (selectedDifficulty !== 'All' && p.difficulty !== selectedDifficulty) {
        return false;
      }

      // 2. Solved Status filter
      if (selectedStatus === 'solved' && !isSolved) return false;
      if (selectedStatus === 'unsolved' && isSolved) return false;

      // 3. Pattern filter
      if (selectedPattern !== 'all' && p.corePattern !== selectedPattern) {
        return false;
      }

      // 4. Topic filter
      if (selectedTopic !== 'all' && (!Array.isArray(p.allTopics) || !p.allTopics.includes(selectedTopic))) {
        return false;
      }

      // 5. Track filter
      if (selectedTrack !== 'all' && p.learningTrack !== selectedTrack) {
        return false;
      }

      // 6. Text query search
      if (queryTrimmed) {
        const title = p.title.toLowerCase();
        const pattern = p.corePattern ? p.corePattern.toLowerCase() : '';
        const track = p.learningTrack ? p.learningTrack.toLowerCase() : '';
        const topics = Array.isArray(p.allTopics) ? p.allTopics.join(' ').toLowerCase() : '';

        const matchesId = p.id === queryTrimmed;
        const matchesTitle = title.includes(queryTrimmed) || (singularQuery !== null && title.includes(singularQuery));
        const matchesPattern = pattern.includes(queryTrimmed);
        const matchesTopic = topics.includes(queryTrimmed);
        const matchesTrack = track.includes(queryTrimmed);

        if (!matchesId && !matchesTitle && !matchesPattern && !matchesTopic && !matchesTrack) {
          return false;
        }
      }

      // Stats accumulators
      if (p.difficulty === 'Easy') easy++;
      else if (p.difficulty === 'Medium') medium++;
      else if (p.difficulty === 'Hard') hard++;
      if (isSolved) solved++;

      return true;
    });

    // Sorting
    const difficultyRank: Record<string, number> = { Easy: 1, Medium: 2, Hard: 3 };

    list.sort((a, b) => {
      switch (sortBy) {
        case 'id-asc':
          return parseInt(a.id, 10) - parseInt(b.id, 10);
        case 'id-desc':
          return parseInt(b.id, 10) - parseInt(a.id, 10);
        case 'companies-desc':
          return b.companiesCount - a.companiesCount || parseInt(a.id, 10) - parseInt(b.id, 10);
        case 'title-asc':
          return a.title.localeCompare(b.title);
        case 'difficulty-asc':
          return (difficultyRank[a.difficulty] || 0) - (difficultyRank[b.difficulty] || 0) || parseInt(a.id, 10) - parseInt(b.id, 10);
        case 'difficulty-desc':
          return (difficultyRank[b.difficulty] || 0) - (difficultyRank[a.difficulty] || 0) || parseInt(a.id, 10) - parseInt(b.id, 10);
        default:
          return 0;
      }
    });

    const elapsed = Math.round((performance.now() - startTime) * 100) / 100;

    return {
      filteredProblems: list,
      filterStats: {
        total: list.length,
        easy,
        medium,
        hard,
        solved,
      },
      executionTimeMs: elapsed,
    };
  }, [allProblems, searchQuery, selectedDifficulty, selectedStatus, selectedPattern, selectedTopic, selectedTrack, sortBy, solvedIds]);

  // Reset page to 1 when filters or search change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedDifficulty, selectedStatus, selectedPattern, selectedTopic, selectedTrack, sortBy, pageSize]);

  // ── Pagination Math ────────────────────────────────────────────────────────
  const totalMatching = filteredProblems.length;
  const effectivePageSize = pageSize === 0 ? totalMatching : pageSize;
  const totalPages = pageSize === 0 ? 1 : Math.max(1, Math.ceil(totalMatching / pageSize));
  const safePage = Math.min(Math.max(1, currentPage), totalPages);

  const paginatedProblems = useMemo(() => {
    if (pageSize === 0) return filteredProblems;
    const startIndex = (safePage - 1) * pageSize;
    return filteredProblems.slice(startIndex, startIndex + pageSize);
  }, [filteredProblems, safePage, pageSize]);

  const startIndex = totalMatching === 0 ? 0 : (safePage - 1) * effectivePageSize + 1;
  const endIndex = pageSize === 0 ? totalMatching : Math.min(safePage * pageSize, totalMatching);

  // Helper to generate page numbers with ellipsis
  const paginationRange = useMemo(() => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }

    if (safePage <= 4) {
      return [1, 2, 3, 4, 5, '...', totalPages];
    }

    if (safePage >= totalPages - 3) {
      return [1, '...', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
    }

    return [1, '...', safePage - 1, safePage, safePage + 1, '...', totalPages];
  }, [safePage, totalPages]);

  // Active filter counters & reset
  const hasActiveFilters = 
    searchQuery.trim() !== '' ||
    selectedDifficulty !== 'All' ||
    selectedStatus !== 'all' ||
    selectedPattern !== 'all' ||
    selectedTopic !== 'all' ||
    selectedTrack !== 'all';

  const resetAllFilters = () => {
    setSearchQuery('');
    setSelectedDifficulty('All');
    setSelectedStatus('all');
    setSelectedPattern('all');
    setSelectedTopic('all');
    setSelectedTrack('all');
    setSortBy('id-asc');
    setCurrentPage(1);
  };

  const handleJumpPage = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = parseInt(jumpPageInput, 10);
    if (!isNaN(parsed) && parsed >= 1 && parsed <= totalPages) {
      setCurrentPage(parsed);
      setJumpPageInput('');
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/[0.08] pb-6">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-emerald-400 uppercase tracking-wider mb-1">
            <Layers className="w-3.5 h-3.5" />
            <span>Problem Directory</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-neutral-100">
            Practice Problems
          </h1>
          <p className="text-xs sm:text-sm text-neutral-400 mt-1">
            Browse, filter, and practice 3,358 interview problems categorized by pattern, topic, and company frequency.
          </p>
        </div>

        <Link
          href="/"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-xs font-semibold text-neutral-200 border border-white/[0.08] transition-colors self-start cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Dashboard</span>
        </Link>
      </div>

      {/* Comprehensive Multi-Faceted Filter Section */}
      <div className="flex flex-col gap-3.5 glass-card p-4 rounded-2xl border border-white/[0.08] shadow-sm">
        {/* Row 1: Search + Difficulty + Solved Status */}
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
          {/* Search Box */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-500" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by title, ID (#1), pattern, or topic..."
              className="w-full pl-10 pr-10 py-2.5 text-xs rounded-xl bg-black/40 border border-white/[0.08] text-white placeholder:text-neutral-500 focus:outline-none focus:border-emerald-500/50 transition-colors"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-white p-0.5"
                title="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Difficulty Segmented Chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto p-1 rounded-xl bg-black/30 border border-white/[0.08] shrink-0">
            {(['All', 'Easy', 'Medium', 'Hard'] as const).map((diff) => {
              const count = diff === 'All' ? overallStats.total : diff === 'Easy' ? overallStats.easy : diff === 'Medium' ? overallStats.medium : overallStats.hard;
              const isActive = selectedDifficulty === diff;
              return (
                <button
                  key={diff}
                  onClick={() => setSelectedDifficulty(diff)}
                  className={cn(
                    'px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap',
                    isActive
                      ? diff === 'Easy'
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-semibold'
                        : diff === 'Medium'
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 font-semibold'
                        : diff === 'Hard'
                        ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 font-semibold'
                        : 'bg-white/[0.12] text-white font-semibold'
                      : 'text-neutral-400 hover:text-neutral-200 hover:bg-white/[0.04]'
                  )}
                >
                  <span>{diff}</span>
                  <span className="text-[10px] font-mono opacity-70 tabular-nums">
                    ({count})
                  </span>
                </button>
              );
            })}
          </div>

          {/* Solved Status Segmented Chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto p-1 rounded-xl bg-black/30 border border-white/[0.08] shrink-0">
            {(
              [
                { key: 'all', label: 'All Status' },
                { key: 'solved', label: 'Solved' },
                { key: 'unsolved', label: 'Unsolved' },
              ] as const
            ).map((st) => {
              const isActive = selectedStatus === st.key;
              const count = st.key === 'all' ? allProblems.length : st.key === 'solved' ? solvedIds.size : allProblems.length - solvedIds.size;
              return (
                <button
                  key={st.key}
                  onClick={() => setSelectedStatus(st.key)}
                  className={cn(
                    'px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap',
                    isActive
                      ? 'bg-white/[0.12] text-white font-semibold'
                      : 'text-neutral-400 hover:text-neutral-200 hover:bg-white/[0.04]'
                  )}
                >
                  {st.key === 'solved' && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
                  <span>{st.label}</span>
                  <span className="text-[10px] font-mono opacity-70 tabular-nums">
                    ({count})
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Row 2: Dropdown Selectors: Pattern, Topic, Track, Sort, Page Size */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 pt-1">
          {/* Pattern Dropdown */}
          <div className="relative">
            <label className="text-[10px] font-mono uppercase tracking-wider text-neutral-400 block mb-1">
              Pattern ({patternsList.length})
            </label>
            <div className="relative">
              <select
                aria-label="Filter by pattern"
                value={selectedPattern}
                onChange={(e) => setSelectedPattern(e.target.value)}
                className="w-full bg-black/40 border border-white/[0.08] text-neutral-200 text-xs rounded-xl px-3 py-2 appearance-none pr-8 cursor-pointer focus:outline-none focus:border-emerald-500/50 hover:border-white/20 transition-colors truncate"
              >
                <option value="all" className="bg-neutral-900 text-neutral-200">
                  All Patterns ({patternsList.length})
                </option>
                {patternsList.map((pat) => (
                  <option key={pat.name} value={pat.name} className="bg-neutral-900 text-neutral-200">
                    {pat.name} ({pat.count})
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-neutral-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          {/* Topic Tag Dropdown */}
          <div className="relative">
            <label className="text-[10px] font-mono uppercase tracking-wider text-neutral-400 block mb-1">
              Topic Tag ({topicsList.length})
            </label>
            <div className="relative">
              <select
                aria-label="Filter by topic tag"
                value={selectedTopic}
                onChange={(e) => setSelectedTopic(e.target.value)}
                className="w-full bg-black/40 border border-white/[0.08] text-neutral-200 text-xs rounded-xl px-3 py-2 appearance-none pr-8 cursor-pointer focus:outline-none focus:border-emerald-500/50 hover:border-white/20 transition-colors truncate"
              >
                <option value="all" className="bg-neutral-900 text-neutral-200">
                  All Topics ({topicsList.length})
                </option>
                {topicsList.map((top) => (
                  <option key={top.name} value={top.name} className="bg-neutral-900 text-neutral-200">
                    {top.name} ({top.count})
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-neutral-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          {/* Learning Track Dropdown */}
          <div className="relative">
            <label className="text-[10px] font-mono uppercase tracking-wider text-neutral-400 block mb-1">
              Learning Track (10)
            </label>
            <div className="relative">
              <select
                aria-label="Filter by learning track"
                value={selectedTrack}
                onChange={(e) => setSelectedTrack(e.target.value)}
                className="w-full bg-black/40 border border-white/[0.08] text-neutral-200 text-xs rounded-xl px-3 py-2 appearance-none pr-8 cursor-pointer focus:outline-none focus:border-emerald-500/50 hover:border-white/20 transition-colors truncate"
              >
                <option value="all" className="bg-neutral-900 text-neutral-200">
                  All Tracks (10)
                </option>
                {tracksList.map((tr) => (
                  <option key={tr.name} value={tr.name} className="bg-neutral-900 text-neutral-200">
                    {tr.name} ({tr.count})
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-neutral-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          {/* Sort By Dropdown */}
          <div className="relative">
            <label className="text-[10px] font-mono uppercase tracking-wider text-neutral-400 block mb-1">
              Sort Order
            </label>
            <div className="relative">
              <select
                aria-label="Sort order"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="w-full bg-black/40 border border-white/[0.08] text-neutral-200 text-xs rounded-xl px-3 py-2 appearance-none pr-8 cursor-pointer focus:outline-none focus:border-emerald-500/50 hover:border-white/20 transition-colors truncate"
              >
                <option value="id-asc" className="bg-neutral-900 text-neutral-200">
                  Problem # (1 → 3358)
                </option>
                <option value="id-desc" className="bg-neutral-900 text-neutral-200">
                  Problem # (3358 → 1)
                </option>
                <option value="companies-desc" className="bg-neutral-900 text-neutral-200">
                  Most Asked (Companies Count)
                </option>
                <option value="title-asc" className="bg-neutral-900 text-neutral-200">
                  Title (A → Z)
                </option>
                <option value="difficulty-asc" className="bg-neutral-900 text-neutral-200">
                  Difficulty (Easy First)
                </option>
                <option value="difficulty-desc" className="bg-neutral-900 text-neutral-200">
                  Difficulty (Hard First)
                </option>
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-neutral-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          {/* Page Size Dropdown */}
          <div className="relative col-span-2 sm:col-span-1">
            <label className="text-[10px] font-mono uppercase tracking-wider text-neutral-400 block mb-1">
              Per Page
            </label>
            <div className="relative">
              <select
                aria-label="Problems per page"
                value={pageSize}
                onChange={(e) => setPageSize(parseInt(e.target.value, 10))}
                className="w-full bg-black/40 border border-white/[0.08] text-neutral-200 text-xs rounded-xl px-3 py-2 appearance-none pr-8 cursor-pointer focus:outline-none focus:border-emerald-500/50 hover:border-white/20 transition-colors"
              >
                <option value={50} className="bg-neutral-900 text-neutral-200">
                  50 per page
                </option>
                <option value={100} className="bg-neutral-900 text-neutral-200">
                  100 per page
                </option>
                <option value={250} className="bg-neutral-900 text-neutral-200">
                  250 per page
                </option>
                <option value={0} className="bg-neutral-900 text-neutral-200">
                  All ({allProblems.length})
                </option>
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-neutral-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>
        </div>

        {/* Row 3: Active Filters & Clear All */}
        {hasActiveFilters && (
          <div className="pt-2 border-t border-white/[0.06] flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              <span className="text-neutral-500 text-[11px] font-mono mr-1">Active Filters:</span>
              
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 flex items-center gap-1.5 hover:bg-emerald-500/20 transition-colors cursor-pointer"
                >
                  <span>Query: &ldquo;{searchQuery}&rdquo;</span>
                  <X className="w-3 h-3" />
                </button>
              )}

              {selectedDifficulty !== 'All' && (
                <button
                  onClick={() => setSelectedDifficulty('All')}
                  className="px-2.5 py-1 rounded-lg bg-white/[0.06] border border-white/10 text-neutral-200 flex items-center gap-1.5 hover:bg-white/[0.1] transition-colors cursor-pointer"
                >
                  <span>Difficulty: {selectedDifficulty}</span>
                  <X className="w-3 h-3" />
                </button>
              )}

              {selectedStatus !== 'all' && (
                <button
                  onClick={() => setSelectedStatus('all')}
                  className="px-2.5 py-1 rounded-lg bg-white/[0.06] border border-white/10 text-neutral-200 flex items-center gap-1.5 hover:bg-white/[0.1] transition-colors cursor-pointer"
                >
                  <span>Status: {selectedStatus}</span>
                  <X className="w-3 h-3" />
                </button>
              )}

              {selectedPattern !== 'all' && (
                <button
                  onClick={() => setSelectedPattern('all')}
                  className="px-2.5 py-1 rounded-lg bg-white/[0.06] border border-white/10 text-neutral-200 flex items-center gap-1.5 hover:bg-white/[0.1] transition-colors cursor-pointer"
                >
                  <span>Pattern: {selectedPattern}</span>
                  <X className="w-3 h-3" />
                </button>
              )}

              {selectedTopic !== 'all' && (
                <button
                  onClick={() => setSelectedTopic('all')}
                  className="px-2.5 py-1 rounded-lg bg-white/[0.06] border border-white/10 text-neutral-200 flex items-center gap-1.5 hover:bg-white/[0.1] transition-colors cursor-pointer"
                >
                  <span>Topic: {selectedTopic}</span>
                  <X className="w-3 h-3" />
                </button>
              )}

              {selectedTrack !== 'all' && (
                <button
                  onClick={() => setSelectedTrack('all')}
                  className="px-2.5 py-1 rounded-lg bg-white/[0.06] border border-white/10 text-neutral-200 flex items-center gap-1.5 hover:bg-white/[0.1] transition-colors cursor-pointer"
                >
                  <span className="truncate max-w-[200px]">Track: {selectedTrack}</span>
                  <X className="w-3 h-3 shrink-0" />
                </button>
              )}
            </div>

            <button
              onClick={resetAllFilters}
              className="px-3 py-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shrink-0 ml-auto"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset All Filters</span>
            </button>
          </div>
        )}
      </div>

      {/* Summary Metrics & Results Count Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-1 text-xs">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-neutral-200">
            Showing <span className="text-white font-mono tabular-nums">{startIndex}–{endIndex}</span> of{' '}
            <span className="text-white font-mono tabular-nums">{totalMatching}</span> problems
          </span>
          {executionTimeMs > 0 && (
            <span className="text-[11px] font-mono text-neutral-500 tabular-nums">
              ⚡ {executionTimeMs}ms
            </span>
          )}
        </div>

        {/* Filter Breakdown Badges */}
        <div className="flex items-center gap-2 text-[11px] font-mono text-neutral-400 flex-wrap">
          <span className="px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 tabular-nums">
            {filterStats.easy} Easy
          </span>
          <span className="px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/20 text-amber-400 tabular-nums">
            {filterStats.medium} Medium
          </span>
          <span className="px-2 py-0.5 rounded bg-rose-500/10 border border-rose-500/20 text-rose-400 tabular-nums">
            {filterStats.hard} Hard
          </span>
          <span className="px-2 py-0.5 rounded bg-white/[0.04] border border-white/10 text-neutral-300 tabular-nums">
            {filterStats.solved} Solved
          </span>
        </div>
      </div>

      {/* Results Table */}
      <div className="rounded-2xl border border-white/[0.08] glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-neutral-900/90 backdrop-blur border-b border-neutral-800 text-neutral-400 font-mono uppercase tracking-wider text-[11px]">
              <tr>
                <th className="py-3.5 px-3 w-12 text-center">Status</th>
                <th 
                  onClick={() => setSortBy(sortBy === 'id-asc' ? 'id-desc' : 'id-asc')}
                  className="py-3.5 px-3 w-16 cursor-pointer hover:text-white transition-colors select-none"
                  title="Click to sort by problem ID"
                >
                  <div className="flex items-center gap-1">
                    <span>#</span>
                    <ArrowUpDown className="w-3 h-3 opacity-60" />
                  </div>
                </th>
                <th 
                  onClick={() => setSortBy(sortBy === 'title-asc' ? 'id-asc' : 'title-asc')}
                  className="py-3.5 px-4 cursor-pointer hover:text-white transition-colors select-none"
                  title="Click to sort alphabetically"
                >
                  <div className="flex items-center gap-1">
                    <span>Title</span>
                    <ArrowUpDown className="w-3 h-3 opacity-60" />
                  </div>
                </th>
                <th 
                  onClick={() => setSortBy(sortBy === 'difficulty-asc' ? 'difficulty-desc' : 'difficulty-asc')}
                  className="py-3.5 px-4 w-28 cursor-pointer hover:text-white transition-colors select-none"
                  title="Click to sort by difficulty"
                >
                  <div className="flex items-center gap-1">
                    <span>Difficulty</span>
                    <ArrowUpDown className="w-3 h-3 opacity-60" />
                  </div>
                </th>
                <th className="py-3.5 px-4">Core Pattern</th>
                <th className="py-3.5 px-4">Topics</th>
                <th className="py-3.5 px-4">Learning Track</th>
                <th 
                  onClick={() => setSortBy(sortBy === 'companies-desc' ? 'id-asc' : 'companies-desc')}
                  className="py-3.5 px-4 w-24 text-right cursor-pointer hover:text-white transition-colors select-none"
                  title="Click to sort by company frequency"
                >
                  <div className="flex items-center justify-end gap-1">
                    <span>Companies</span>
                    <ArrowUpDown className="w-3 h-3 opacity-60" />
                  </div>
                </th>
                <th className="py-3.5 px-4 w-24 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {isLoading && (
                <>
                  {[...Array(10)].map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      <td className="py-4 px-3 text-center"><div className="h-4 w-4 bg-neutral-800 rounded-full mx-auto" /></td>
                      <td className="py-4 px-3"><div className="h-4 w-8 bg-neutral-800 rounded" /></td>
                      <td className="py-4 px-4"><div className="h-4 w-48 bg-neutral-800 rounded" /></td>
                      <td className="py-4 px-4"><div className="h-4 w-16 bg-neutral-800 rounded-full" /></td>
                      <td className="py-4 px-4"><div className="h-4 w-28 bg-neutral-800 rounded" /></td>
                      <td className="py-4 px-4"><div className="h-4 w-32 bg-neutral-800 rounded" /></td>
                      <td className="py-4 px-4"><div className="h-4 w-36 bg-neutral-800 rounded" /></td>
                      <td className="py-4 px-4 text-right"><div className="h-4 w-10 bg-neutral-800 rounded ml-auto" /></td>
                      <td className="py-4 px-4 text-right"><div className="h-4 w-12 bg-neutral-800 rounded ml-auto" /></td>
                    </tr>
                  ))}
                </>
              )}

              {!isLoading && paginatedProblems.length === 0 && (
                <tr>
                  <td colSpan={9} className="py-16 px-4 text-center">
                    <div className="max-w-md mx-auto flex flex-col items-center gap-3">
                      <div className="w-12 h-12 rounded-2xl bg-neutral-900 border border-white/[0.08] flex items-center justify-center text-neutral-400 shadow-inner">
                        <Search className="w-5 h-5" />
                      </div>
                      <h3 className="text-sm font-semibold text-neutral-200">
                        No problems match your filter criteria
                      </h3>
                      <p className="text-xs text-neutral-400 leading-relaxed">
                        Try loosening your active filters, checking your search spelling, or searching by problem number.
                      </p>
                      <button
                        onClick={resetAllFilters}
                        className="mt-2 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-semibold cursor-pointer transition-colors"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Clear All Filters</span>
                      </button>
                    </div>
                  </td>
                </tr>
              )}

              {!isLoading && paginatedProblems.map((problem) => {
                const isSolved = solvedIds.has(problem.id);
                const topics = Array.isArray(problem.allTopics) ? problem.allTopics : [];

                return (
                  <tr
                    key={problem.id}
                    className="hover:bg-neutral-800/30 transition-colors group"
                  >
                    <td className="py-3.5 px-3 text-center">
                      {isSolved ? (
                        <span title="Completed" className="inline-flex items-center justify-center">
                          <CheckCircle2 className="w-4 h-4 text-emerald-400 fill-emerald-500/20" />
                        </span>
                      ) : (
                        <span title="Unsolved" className="w-1.5 h-1.5 rounded-full bg-neutral-700/60 inline-block" />
                      )}
                    </td>
                    <td className="py-3.5 px-3 font-mono text-neutral-500 tabular-nums">
                      #{problem.id}
                    </td>
                    <td className="py-3.5 px-4">
                      <Link
                        href={`/problem/${problem.id}`}
                        className="font-medium text-neutral-200 group-hover:text-white transition-colors flex items-center gap-1.5"
                      >
                        <span>{problem.title}</span>
                      </Link>
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={cn(
                          'text-[10px] font-semibold px-2 py-0.5 rounded-full border inline-block',
                          problem.difficulty === 'Easy' &&
                            'text-emerald-400 border-emerald-500/25 bg-emerald-500/10',
                          problem.difficulty === 'Medium' &&
                            'text-amber-400 border-amber-500/25 bg-amber-500/10',
                          problem.difficulty === 'Hard' &&
                            'text-rose-400 border-rose-500/25 bg-rose-500/10'
                        )}
                      >
                        {problem.difficulty}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-neutral-300 font-mono text-xs">
                      {problem.corePattern ? (
                        <span className="flex items-center gap-1.5 truncate max-w-[180px]">
                          <BrainCircuit className="w-3 h-3 text-emerald-400 shrink-0" />
                          <span className="truncate">{problem.corePattern}</span>
                        </span>
                      ) : (
                        <span className="text-neutral-500">—</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-neutral-400 text-xs">
                      <div className="flex items-center gap-1 flex-wrap max-w-[200px]">
                        {topics.slice(0, 2).map((top) => (
                          <span
                            key={top}
                            className="px-1.5 py-0.5 rounded bg-white/[0.04] border border-white/10 text-[10px] text-neutral-400 font-mono whitespace-nowrap"
                          >
                            {top}
                          </span>
                        ))}
                        {topics.length > 2 && (
                          <span
                            className="text-[10px] text-neutral-500 font-mono"
                            title={topics.slice(2).join(', ')}
                          >
                            +{topics.length - 2}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-neutral-400 font-mono text-xs truncate max-w-[200px]" title={problem.learningTrack}>
                      {problem.learningTrack}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono text-neutral-400 tabular-nums">
                      {problem.companiesCount > 0 ? (
                        <span className="inline-flex items-center gap-1">
                          <Flame className="w-3.5 h-3.5 text-orange-400" />
                          {problem.companiesCount}
                        </span>
                      ) : (
                        <span className="text-neutral-600">—</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <Link
                        href={`/problem/${problem.id}`}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-400 hover:text-emerald-300 transition-colors"
                      >
                        <span>{isSolved ? 'Review' : 'Solve'}</span>
                        <ArrowUpRight className="w-3.5 h-3.5" />
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Full Pagination Navigation Bar */}
        {pageSize !== 0 && totalPages > 1 && (
          <div className="p-4 border-t border-white/[0.08] bg-black/20 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-xs text-neutral-400">
              Page <span className="text-white font-semibold font-mono">{safePage}</span> of{' '}
              <span className="text-white font-semibold font-mono">{totalPages}</span>
            </div>

            {/* Numeric Navigation */}
            <div className="flex items-center gap-1">
              {/* First Page */}
              <button
                onClick={() => setCurrentPage(1)}
                disabled={safePage === 1}
                className="p-1.5 rounded-lg border border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.06] text-neutral-400 hover:text-white disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
                title="First Page"
              >
                <ChevronsLeft className="w-4 h-4" />
              </button>

              {/* Prev Page */}
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={safePage === 1}
                className="p-1.5 rounded-lg border border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.06] text-neutral-400 hover:text-white disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer mr-1"
                title="Previous Page"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              {/* Number Buttons */}
              {paginationRange.map((item, idx) => {
                if (item === '...') {
                  return (
                    <span key={`dots-${idx}`} className="px-2 py-1 text-xs text-neutral-600 font-mono select-none">
                      ...
                    </span>
                  );
                }

                const pageNum = item as number;
                const isCurrent = pageNum === safePage;

                return (
                  <button
                    key={pageNum}
                    onClick={() => setCurrentPage(pageNum)}
                    className={cn(
                      'min-w-[32px] h-8 px-2 rounded-lg text-xs font-mono font-semibold transition-all cursor-pointer',
                      isCurrent
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-xs'
                        : 'border border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.06] text-neutral-400 hover:text-white'
                    )}
                  >
                    {pageNum}
                  </button>
                );
              })}

              {/* Next Page */}
              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={safePage === totalPages}
                className="p-1.5 rounded-lg border border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.06] text-neutral-400 hover:text-white disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer ml-1"
                title="Next Page"
              >
                <ChevronRight className="w-4 h-4" />
              </button>

              {/* Last Page */}
              <button
                onClick={() => setCurrentPage(totalPages)}
                disabled={safePage === totalPages}
                className="p-1.5 rounded-lg border border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.06] text-neutral-400 hover:text-white disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
                title="Last Page"
              >
                <ChevronsRight className="w-4 h-4" />
              </button>
            </div>

            {/* Quick Jump Input */}
            <form onSubmit={handleJumpPage} className="flex items-center gap-2">
              <span className="text-xs text-neutral-500">Go to</span>
              <input
                type="number"
                min={1}
                max={totalPages}
                value={jumpPageInput}
                onChange={(e) => setJumpPageInput(e.target.value)}
                placeholder={`${safePage}`}
                className="w-14 px-2 py-1 text-xs rounded-lg bg-black/40 border border-white/[0.08] text-white text-center font-mono focus:outline-none focus:border-emerald-500/50"
              />
            </form>
          </div>
        )}
      </div>
    </div>
  );
}

export default function ProblemsDirectoryPage() {
  return (
    <Suspense fallback={<ProblemsLoadingSkeleton />}>
      <ProblemsDirectoryContent />
    </Suspense>
  );
}

