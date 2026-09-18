'use client';

import { useState, useMemo, useRef, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { useVirtualizer } from '@tanstack/react-virtual';
import {
  GitCompare,
  Plus,
  X,
  Flame,
  ArrowUpRight,
  BrainCircuit,
  Search,
  ArrowLeft,
  SlidersHorizontal
} from 'lucide-react';
import { cn } from '@/lib/utils';
import companiesData from '../../../../public/data/companies.json';
import problemsData from '../../../../public/data/problems.json';
import mappingsData from '../../../../public/data/company_mappings.json';
import type { ProblemDoc } from '@/lib/workers/search.worker';

interface CompareProblemRow {
  problem: ProblemDoc;
  companyFrequencies: Record<string, number>;
  totalScore: number;
  matchCount: number;
}

function ComparatorContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  // Initial companies from query string or default to FAANG-tier leaders
  const initialSelected = useMemo(() => {
    const raw = searchParams.get('companies');
    if (raw) {
      const parts = raw.split(',').map((s) => decodeURIComponent(s.trim())).filter(Boolean);
      if (parts.length > 0) return parts.slice(0, 5);
    }
    return ['Google', 'Amazon', 'Meta'];
  }, [searchParams]);

  const [selectedCompanies, setSelectedCompanies] = useState<string[]>(initialSelected);
  const [mode, setMode] = useState<'intersection' | 'union'>('intersection');
  const [searchFilter, setSearchFilter] = useState('');
  const [selectedTrack, setSelectedTrack] = useState<string>('All');

  // Search input for adding companies
  const [addCompanyQuery, setAddCompanyQuery] = useState('');
  const [isAddMenuOpen, setIsAddMenuOpen] = useState(false);

  // Available companies for picker dropdown
  const filteredAvailableCompanies = useMemo(() => {
    const existing = new Set(selectedCompanies);
    return (companiesData as Array<{ name: string; questionCount: number }>)
      .filter((c) => !existing.has(c.name) && c.name.toLowerCase().includes(addCompanyQuery.toLowerCase()))
      .slice(0, 8);
  }, [selectedCompanies, addCompanyQuery]);

  const handleAddCompany = (companyName: string) => {
    if (selectedCompanies.length >= 5) return;
    const updated = [...selectedCompanies, companyName];
    setSelectedCompanies(updated);
    setIsAddMenuOpen(false);
    setAddCompanyQuery('');
    router.replace(`/companies/compare?companies=${encodeURIComponent(updated.join(','))}`);
  };

  const handleRemoveCompany = (companyName: string) => {
    if (selectedCompanies.length <= 1) return;
    const updated = selectedCompanies.filter((c) => c !== companyName);
    setSelectedCompanies(updated);
    router.replace(`/companies/compare?companies=${encodeURIComponent(updated.join(','))}`);
  };

  // Pre-index mappings by company and problemId
  const { problemsMap, companyProblemFreqMap } = useMemo(() => {
    const pMap = new Map<string, ProblemDoc>();
    (problemsData as ProblemDoc[]).forEach((p) => pMap.set(p.id, p));

    // Map: Company -> Map(problemId -> frequencyPct)
    const cfMap = new Map<string, Map<string, number>>();
    (mappingsData as Array<{ company: string; problemId: string; frequencyPct: number }>).forEach((m) => {
      let map = cfMap.get(m.company);
      if (!map) {
        map = new Map<string, number>();
        cfMap.set(m.company, map);
      }
      map.set(m.problemId, m.frequencyPct);
    });

    return { problemsMap: pMap, companyProblemFreqMap: cfMap };
  }, []);

  // Compute Intersection and Union Sets
  const comparedRows: CompareProblemRow[] = useMemo(() => {
    if (selectedCompanies.length === 0) return [];

    const problemIdsToEvaluate = new Set<string>();

    selectedCompanies.forEach((company) => {
      const companyMap = companyProblemFreqMap.get(company);
      if (companyMap) {
        companyMap.forEach((_, problemId) => {
          problemIdsToEvaluate.add(problemId);
        });
      }
    });

    const rows: CompareProblemRow[] = [];

    problemIdsToEvaluate.forEach((problemId) => {
      const problem = problemsMap.get(problemId);
      if (!problem) return;

      // Track filter
      if (selectedTrack !== 'All' && problem.learningTrack !== selectedTrack) {
        return;
      }

      // Title/topic search
      if (searchFilter) {
        const queryLower = searchFilter.toLowerCase();
        const matchTitle = problem.title.toLowerCase().includes(queryLower);
        const matchPattern = problem.corePattern?.toLowerCase().includes(queryLower);
        if (!matchTitle && !matchPattern) return;
      }

      const frequencies: Record<string, number> = {};
      let matchCount = 0;
      let totalScore = 0;

      selectedCompanies.forEach((company) => {
        const freq = companyProblemFreqMap.get(company)?.get(problemId) || 0;
        frequencies[company] = freq;
        if (freq > 0) {
          matchCount++;
          totalScore += freq;
        }
      });

      // Filter based on Mode (Intersection = asked by ALL selected companies)
      if (mode === 'intersection') {
        if (matchCount === selectedCompanies.length) {
          rows.push({
            problem,
            companyFrequencies: frequencies,
            totalScore,
            matchCount,
          });
        }
      } else {
        // Union = asked by AT LEAST ONE
        rows.push({
          problem,
          companyFrequencies: frequencies,
          totalScore,
          matchCount,
        });
      }
    });

    // Sort by cumulative overlap frequency descending
    return rows.sort((a, b) => b.totalScore - a.totalScore);
  }, [selectedCompanies, mode, searchFilter, selectedTrack, problemsMap, companyProblemFreqMap]);

  // Distinct tracks for filter dropdown
  const tracksList = useMemo(() => {
    const set = new Set((problemsData as ProblemDoc[]).map((p) => p.learningTrack));
    return ['All', ...Array.from(set).sort()];
  }, []);

  // Virtualizer Setup for 60 FPS scrolling
  const parentRef = useRef<HTMLDivElement>(null);

  const rowVirtualizer = useVirtualizer({
    count: comparedRows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 64,
    overscan: 10,
  });

  return (
    <div className="min-h-screen bg-background text-foreground p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/[0.08] pb-6">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-emerald-400 uppercase tracking-wider mb-1">
            <GitCompare className="w-3.5 h-3.5" />
            <span>Company Overlap Analysis</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-neutral-100">
            Compare Company Problem Sets
          </h1>
          <p className="text-xs sm:text-sm text-neutral-400 mt-1">
            Find the highest-yield questions asked across multiple target companies to maximize your preparation efficiency.
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

      {/* Selected Companies Multi-Picker Bar */}
      <div className="p-4 rounded-2xl glass-card flex flex-wrap items-center gap-3">
        <span className="text-xs font-semibold text-neutral-400">Target Companies (2-5):</span>
        {selectedCompanies.map((company) => (
          <div
            key={company}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-semibold shadow-xs"
          >
            <span>{company}</span>
            {selectedCompanies.length > 1 && (
              <button
                onClick={() => handleRemoveCompany(company)}
                className="hover:text-white transition-colors p-0.5 cursor-pointer"
                title="Remove company"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        ))}

        {selectedCompanies.length < 5 && (
          <div className="relative">
            <button
              onClick={() => setIsAddMenuOpen(!isAddMenuOpen)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-xs font-semibold text-neutral-300 hover:text-white border border-white/[0.08] transition-all cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Company</span>
            </button>

            {isAddMenuOpen && (
              <div className="absolute left-0 mt-2 w-64 bg-[#0f0f12] border border-white/[0.12] rounded-xl shadow-2xl p-2 z-50 flex flex-col gap-2">
                <input
                  value={addCompanyQuery}
                  onChange={(e) => setAddCompanyQuery(e.target.value)}
                  placeholder="Search companies..."
                  className="w-full px-3 py-1.5 rounded-lg bg-black/50 border border-white/[0.08] text-xs text-white placeholder:text-neutral-500 focus:outline-none focus:border-emerald-500/50"
                  autoFocus
                />
                <div className="max-h-48 overflow-y-auto flex flex-col gap-0.5">
                  {filteredAvailableCompanies.map((c) => (
                    <button
                      key={c.name}
                      onClick={() => handleAddCompany(c.name)}
                      className="flex items-center justify-between px-2.5 py-1.5 text-xs text-left rounded-lg hover:bg-white/[0.06] text-neutral-200 hover:text-white transition-colors cursor-pointer"
                    >
                      <span className="truncate">{c.name}</span>
                      <span className="font-mono text-[10px] text-neutral-500 tabular-nums">{c.questionCount}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Filter & View Controls */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 glass-card p-3.5 rounded-2xl">
        <div className="flex items-center gap-2 w-full md:w-auto">
          {/* Segmented Intersection vs Union Mode Buttons */}
          <div className="flex items-center p-1 rounded-xl bg-neutral-900/90 border border-white/[0.08]">
            <button
              onClick={() => setMode('intersection')}
              className={cn(
                'px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer',
                mode === 'intersection'
                  ? 'bg-white/[0.1] text-white font-semibold shadow-xs'
                  : 'text-neutral-400 hover:text-neutral-200'
              )}
            >
              Strict Intersection ({mode === 'intersection' ? comparedRows.length : 'All Common'})
            </button>
            <button
              onClick={() => setMode('union')}
              className={cn(
                'px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer',
                mode === 'union'
                  ? 'bg-white/[0.1] text-white font-semibold shadow-xs'
                  : 'text-neutral-400 hover:text-neutral-200'
              )}
            >
              Combined Union Pool
            </button>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto justify-end">
          {/* Learning Track Filter */}
          <select
            value={selectedTrack}
            onChange={(e) => setSelectedTrack(e.target.value)}
            className="px-3 py-1.5 rounded-xl bg-black/40 border border-white/[0.08] text-xs text-neutral-200 focus:outline-none focus:border-emerald-500/50 max-w-[200px] truncate"
          >
            {tracksList.map((t) => (
              <option key={t} value={t} className="bg-[#0f0f12] text-neutral-200">
                {t}
              </option>
            ))}
          </select>

          {/* Search Input */}
          <div className="relative w-full md:w-56">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
            <input
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              placeholder="Filter title/pattern..."
              className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-black/40 border border-white/[0.08] text-xs text-white placeholder:text-neutral-500 focus:outline-none focus:border-emerald-500/50 transition-colors"
            />
          </div>
        </div>
      </div>

      {/* Virtualized Table Container */}
      <div className="rounded-2xl border border-white/[0.08] glass-card overflow-hidden flex flex-col">
        {/* Table Header */}
        <div className="grid grid-cols-12 bg-neutral-900/90 backdrop-blur sticky top-0 text-xs font-mono text-neutral-400 uppercase tracking-wider border-b border-neutral-800 px-4 py-3 z-10">
          <div className="col-span-1">#</div>
          <div className="col-span-4">Problem / Pattern</div>
          <div className="col-span-2">Track</div>
          <div className="col-span-1">Diff</div>
          {/* Dynamic Company Frequency Columns */}
          <div className="col-span-3 flex items-center justify-around">
            {selectedCompanies.map((c) => (
              <span key={c} className="truncate px-1 text-[11px] text-neutral-200 font-semibold tracking-normal">
                {c.slice(0, 8)}
              </span>
            ))}
          </div>
          <div className="col-span-1 text-right">Action</div>
        </div>

        {/* Empty state */}
        {comparedRows.length === 0 && (
          <div className="py-16 text-center text-neutral-500 text-xs font-mono">
            No overlapping questions found for this combination and filter.
          </div>
        )}

        {/* Virtualized Rows Viewport (Height 540px) */}
        {comparedRows.length > 0 && (
          <div
            ref={parentRef}
            className="overflow-y-auto"
            style={{ height: '540px', position: 'relative' }}
          >
            <div
              style={{
                height: `${rowVirtualizer.getTotalSize()}px`,
                width: '100%',
                position: 'relative',
              }}
            >
              {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                const row = comparedRows[virtualRow.index];
                if (!row) return null;

                return (
                  <div
                    key={virtualRow.key}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      height: `${virtualRow.size}px`,
                      transform: `translateY(${virtualRow.start}px)`,
                    }}
                    className="grid grid-cols-12 items-center px-4 py-3.5 border-b border-white/[0.04] hover:bg-neutral-800/30 transition-colors text-xs"
                  >
                    <div className="col-span-1 font-mono text-neutral-500 text-xs tabular-nums">
                      #{row.problem.id}
                    </div>

                    <div className="col-span-4 pr-3 min-w-0">
                      <Link
                        href={`/problem/${row.problem.id}`}
                        className="font-medium text-neutral-200 hover:text-white transition-colors truncate block text-sm"
                      >
                        {row.problem.title}
                      </Link>
                      <div className="text-xs text-neutral-500 truncate mt-0.5 font-mono">
                        {row.problem.corePattern || 'Pattern'}
                      </div>
                    </div>

                    <div className="col-span-2 text-neutral-400 text-xs truncate pr-2 font-mono">
                      {row.problem.learningTrack.split(' - ')[1] || row.problem.learningTrack}
                    </div>

                    <div className="col-span-1">
                      <span
                        className={cn(
                          'text-[10px] font-semibold px-2 py-0.5 rounded-full border',
                          row.problem.difficulty === 'Easy' &&
                            'text-emerald-400 border-emerald-500/25 bg-emerald-500/10',
                          row.problem.difficulty === 'Medium' &&
                            'text-amber-400 border-amber-500/25 bg-amber-500/10',
                          row.problem.difficulty === 'Hard' &&
                            'text-rose-400 border-rose-500/25 bg-rose-500/10'
                        )}
                      >
                        {row.problem.difficulty}
                      </span>
                    </div>

                    {/* Company Frequency Matrix Cells with Mini Progress Bars */}
                    <div className="col-span-3 flex items-center justify-around">
                      {selectedCompanies.map((c) => {
                        const freq = row.companyFrequencies[c] || 0;
                        if (freq === 0) {
                          return (
                            <span key={c} className="font-mono text-[11px] text-neutral-600">
                              —
                            </span>
                          );
                        }

                        const pct = Math.round(freq * 100);
                        return (
                          <div key={c} className="flex flex-col items-center gap-1 w-14">
                            <span
                              className={cn(
                                'font-mono text-[10px] px-1.5 py-0.5 rounded font-medium tabular-nums border leading-none',
                                pct === 100
                                  ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                                  : pct >= 75
                                  ? 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30'
                                  : 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                              )}
                            >
                              {pct}%
                            </span>
                            <div className="w-10 bg-white/[0.06] rounded-full h-1 overflow-hidden">
                              <div
                                className={cn(
                                  'h-full rounded-full',
                                  pct === 100 ? 'bg-emerald-400' : pct >= 75 ? 'bg-cyan-400' : 'bg-amber-400'
                                )}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <div className="col-span-1 text-right">
                      <Link
                        href={`/problem/${row.problem.id}`}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-400 hover:text-emerald-300 transition-colors"
                      >
                        <span>Solve</span>
                        <ArrowUpRight className="w-3.5 h-3.5" />
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function ComparePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-background text-muted-foreground font-mono text-xs">
          Loading ROI Comparator Matrix...
        </div>
      }
    >
      <ComparatorContent />
    </Suspense>
  );
}
