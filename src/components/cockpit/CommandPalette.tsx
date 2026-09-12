'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Search, 
  X, 
  ArrowRight, 
  Flame, 
  Layers
} from 'lucide-react';
import { useSearch } from '@/lib/workers/useSearch';
import { cn } from '@/lib/utils';

export default function CommandPalette() {
  const [isOpen, setIsOpen] = useState(false);
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const {
    query,
    setQuery,
    filters,
    setFilters,
    results,
    isLoading,
    elapsedMs,
  } = useSearch({}, 80);

  // Global Keyboard listener for Cmd+K / Ctrl+K and Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      } else if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  // Focus input on modal open
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setSelectedIndex(0);
    } else {
      setQuery('');
    }
  }, [isOpen, setQuery]);

  // Keyboard navigation within list
  const handleInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => Math.min(prev + 1, Math.min(results.length - 1, 9)));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter' && results[selectedIndex]) {
      e.preventDefault();
      navigateToProblem(results[selectedIndex].id);
    }
  };

  const navigateToProblem = (id: string) => {
    setIsOpen(false);
    router.push(`/problem/${id}`);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 md:pt-28 px-4 bg-background/80 backdrop-blur-md animate-in fade-in duration-150">
      {/* Click outside backdrop */}
      <div 
        className="absolute inset-0 -z-10" 
        onClick={() => setIsOpen(false)} 
      />

      <div className="w-full max-w-2xl bg-card border border-border/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[75vh] ring-1 ring-white/10">
        {/* Search Input Bar */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-border/60 bg-secondary/30">
          <Search className="w-5 h-5 text-muted-foreground shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleInputKeyDown}
            placeholder="Type a problem name, pattern, topic, or track..."
            className="w-full bg-transparent text-foreground placeholder:text-muted-foreground/60 text-sm focus:outline-none"
          />
          {isLoading && (
            <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin shrink-0" />
          )}
          {query && !isLoading && (
            <button
              onClick={() => setQuery('')}
              className="text-muted-foreground hover:text-foreground p-1"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <kbd className="hidden sm:inline-flex text-[10px] font-mono px-1.5 py-0.5 rounded bg-background border border-border text-muted-foreground">
            ESC
          </kbd>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-2 px-4 py-2 border-b border-border/40 bg-secondary/15 overflow-x-auto text-xs">
          <span className="text-muted-foreground text-[11px] font-medium mr-1">Filter:</span>
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
                'px-2.5 py-1 rounded-full font-medium transition-colors text-[11px]',
                (filters.difficulty === diff || (!filters.difficulty && diff === 'All'))
                  ? 'bg-primary text-primary-foreground font-semibold shadow-xs'
                  : 'bg-secondary/60 text-muted-foreground hover:text-foreground'
              )}
            >
              {diff}
            </button>
          ))}
          {elapsedMs > 0 && (
            <span className="ml-auto text-[10px] font-mono text-muted-foreground">
              ⚡ {elapsedMs}ms
            </span>
          )}
        </div>

        {/* Results List */}
        <div className="overflow-y-auto divide-y divide-border/30 p-2">
          {results.length === 0 && !isLoading && (
            <div className="py-12 text-center text-muted-foreground text-sm">
              <Layers className="w-8 h-8 mx-auto mb-2 opacity-40" />
              No matching questions found for &ldquo;{query}&rdquo;
            </div>
          )}

          {results.slice(0, 10).map((problem, index) => {
            const isSelected = index === selectedIndex;
            return (
              <div
                key={problem.id}
                onClick={() => navigateToProblem(problem.id)}
                onMouseEnter={() => setSelectedIndex(index)}
                className={cn(
                  'flex items-center justify-between p-3 rounded-xl cursor-pointer transition-all duration-150',
                  isSelected
                    ? 'bg-primary/10 border border-primary/25 text-foreground'
                    : 'hover:bg-secondary/40 text-foreground/90'
                )}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="font-mono text-xs text-muted-foreground/80 w-10 shrink-0">
                    #{problem.id}
                  </span>
                  <div className="min-w-0">
                    <div className="font-medium text-sm truncate flex items-center gap-2">
                      <span>{problem.title}</span>
                      <span
                        className={cn(
                          'text-[10px] px-2 py-0.5 rounded-full font-semibold border',
                          problem.difficulty === 'Easy' && 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10',
                          problem.difficulty === 'Medium' && 'text-amber-400 border-amber-500/30 bg-amber-500/10',
                          problem.difficulty === 'Hard' && 'text-rose-400 border-rose-500/30 bg-rose-500/10'
                        )}
                      >
                        {problem.difficulty}
                      </span>
                    </div>
                    <div className="text-[11px] text-muted-foreground truncate flex items-center gap-2 mt-0.5">
                      <span className="font-medium text-foreground/70">{problem.corePattern || 'Standard Pattern'}</span>
                      <span>•</span>
                      <span className="truncate">{problem.learningTrack}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 pl-3 shrink-0">
                  {problem.companiesCount > 0 && (
                    <span className="text-[11px] font-mono text-muted-foreground flex items-center gap-1 bg-secondary px-2 py-0.5 rounded-md">
                      <Flame className="w-3 h-3 text-orange-400" />
                      {problem.companiesCount} orgs
                    </span>
                  )}
                  <ArrowRight className={cn('w-4 h-4', isSelected ? 'text-primary' : 'text-muted-foreground/40')} />
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer info */}
        <div className="flex items-center justify-between px-4 py-2 border-t border-border/40 bg-secondary/30 text-[11px] text-muted-foreground font-mono">
          <span>Navigate with ↑ ↓ • Select with ↵</span>
          <span>AlgoJeet Worker BM25</span>
        </div>
      </div>
    </div>
  );
}
