'use client';

import Link from 'next/link';
import { 
  Search, 
  Flame, 
  BrainCircuit, 
  ArrowUpRight, 
  ArrowLeft,
  Layers
} from 'lucide-react';
import { useSearch } from '@/lib/workers/useSearch';
import { cn } from '@/lib/utils';

export default function ProblemsDirectoryPage() {
  const {
    query,
    setQuery,
    filters,
    setFilters,
    results,
    isLoading,
    elapsedMs,
    totalMatches,
  } = useSearch({}, 100);

  return (
    <div className="min-h-screen bg-background text-foreground p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/[0.08] pb-6">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-emerald-400 uppercase tracking-wider mb-1">
            <Layers className="w-3.5 h-3.5" />
            <span>Problem Repository</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-neutral-100">
            Curated Algorithmic Inventory
          </h1>
          <p className="text-xs sm:text-sm text-neutral-400 mt-1">
            Browse, filter, and master 3,358 interview problems categorized across 10 learning tracks.
          </p>
        </div>

        <Link
          href="/"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-xs font-semibold text-neutral-200 border border-white/[0.08] transition-colors self-start cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Return to Cockpit</span>
        </Link>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 glass-card p-3.5 rounded-2xl">
        <div className="relative w-full md:max-w-md">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-500" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search problems, patterns, topics, or tracks..."
            className="w-full pl-10 pr-4 py-2 text-xs rounded-xl bg-black/40 border border-white/[0.08] text-white placeholder:text-neutral-500 focus:outline-none focus:border-emerald-500/50 transition-colors"
          />
        </div>

        {/* Difficulty Segmented Chips */}
        <div className="flex items-center gap-2 overflow-x-auto w-full md:w-auto text-xs justify-end">
          <span className="text-neutral-500 text-xs font-medium mr-1">Difficulty:</span>
          <div className="flex items-center p-1 rounded-xl bg-neutral-900/90 border border-white/[0.08]">
            {['All', 'Easy', 'Medium', 'Hard'].map((diff) => (
              <button
                key={diff}
                onClick={() =>
                  setFilters((prev) => ({
                    ...prev,
                    difficulty: diff === 'All' ? undefined : (diff as any),
                  }))
                }
                className={cn(
                  'px-3 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer',
                  (filters.difficulty === diff || (!filters.difficulty && diff === 'All'))
                    ? 'bg-white/[0.1] text-white shadow-xs font-semibold'
                    : 'text-neutral-400 hover:text-neutral-200'
                )}
              >
                {diff}
              </button>
            ))}
          </div>

          {elapsedMs > 0 && (
            <span className="text-[11px] font-mono text-neutral-500 ml-2 tabular-nums">
              ⚡ {elapsedMs}ms
            </span>
          )}
        </div>
      </div>

      {/* Results Table */}
      <div className="rounded-2xl border border-white/[0.08] glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-neutral-900/90 backdrop-blur border-b border-neutral-800 text-neutral-400 font-mono uppercase tracking-wider text-[11px]">
              <tr>
                <th className="py-3 px-4 w-16">#</th>
                <th className="py-3 px-4">Title</th>
                <th className="py-3 px-4 w-28">Difficulty</th>
                <th className="py-3 px-4">Pattern</th>
                <th className="py-3 px-4">Learning Track</th>
                <th className="py-3 px-4 w-24 text-right">Orgs</th>
                <th className="py-3 px-4 w-24 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {isLoading && results.length === 0 && (
                <>
                  {[...Array(6)].map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      <td className="py-4 px-4"><div className="h-4 w-8 bg-neutral-800 rounded" /></td>
                      <td className="py-4 px-4"><div className="h-4 w-48 bg-neutral-800 rounded" /></td>
                      <td className="py-4 px-4"><div className="h-4 w-16 bg-neutral-800 rounded-full" /></td>
                      <td className="py-4 px-4"><div className="h-4 w-28 bg-neutral-800 rounded" /></td>
                      <td className="py-4 px-4"><div className="h-4 w-36 bg-neutral-800 rounded" /></td>
                      <td className="py-4 px-4 text-right"><div className="h-4 w-10 bg-neutral-800 rounded ml-auto" /></td>
                      <td className="py-4 px-4 text-right"><div className="h-4 w-12 bg-neutral-800 rounded ml-auto" /></td>
                    </tr>
                  ))}
                </>
              )}

              {results.length === 0 && !isLoading && (
                <tr>
                  <td colSpan={7} className="py-16 px-4 text-center">
                    <div className="max-w-md mx-auto flex flex-col items-center gap-3">
                      <div className="w-12 h-12 rounded-2xl bg-neutral-900 border border-white/[0.08] flex items-center justify-center text-neutral-400 shadow-inner">
                        <Search className="w-5 h-5" />
                      </div>
                      <h3 className="text-sm font-semibold text-neutral-200">
                        No questions found matching your criteria
                      </h3>
                      {filters.difficulty && filters.difficulty !== 'All' ? (
                        <div className="space-y-3">
                          <p className="text-xs text-neutral-400 leading-relaxed">
                            You currently have the <span className="font-semibold text-rose-400 font-mono">[{filters.difficulty}]</span> difficulty filter enabled.
                            {query.toLowerCase().replace(/\s+/g, '').includes('twosum') && (
                              <span className="block text-emerald-400 mt-1.5 font-medium">
                                💡 Tip: The classic &ldquo;Two Sum&rdquo; (#1) is an <span className="underline font-bold">Easy</span> problem!
                              </span>
                            )}
                          </p>
                          <button
                            onClick={() =>
                              setFilters((prev) => ({
                                ...prev,
                                difficulty: undefined,
                              }))
                            }
                            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-semibold cursor-pointer transition-colors"
                          >
                            <span>Show All Difficulties</span>
                          </button>
                        </div>
                      ) : (
                        <p className="text-xs text-neutral-500 leading-relaxed">
                          Try adjusting your keywords, verifying your spelling, or searching by problem ID (e.g. &ldquo;#1&rdquo;).
                        </p>
                      )}
                    </div>
                  </td>
                </tr>
              )}

              {results.map((problem) => (
                <tr
                  key={problem.id}
                  className="hover:bg-neutral-800/30 transition-colors group"
                >
                  <td className="py-3.5 px-4 font-mono text-neutral-500 tabular-nums">
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
                  <td className="py-3.5 px-4 text-neutral-500 font-mono text-xs">
                    {problem.corePattern || '—'}
                  </td>
                  <td className="py-3.5 px-4 text-neutral-400 font-mono text-xs truncate max-w-xs">
                    {problem.learningTrack}
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono text-neutral-400 tabular-nums">
                    {problem.companiesCount > 0 && (
                      <span className="inline-flex items-center gap-1">
                        <Flame className="w-3.5 h-3.5 text-orange-400" />
                        {problem.companiesCount}
                      </span>
                    )}
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    <Link
                      href={`/problem/${problem.id}`}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-400 hover:text-emerald-300 transition-colors"
                    >
                      <span>Open</span>
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
