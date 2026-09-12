'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import type { ProblemDoc, SearchFilter } from './search.worker';

export interface UseSearchResult {
  query: string;
  setQuery: (q: string) => void;
  filters: SearchFilter;
  setFilters: (f: SearchFilter | ((prev: SearchFilter) => SearchFilter)) => void;
  results: ProblemDoc[];
  isLoading: boolean;
  isReady: boolean;
  elapsedMs: number;
  totalMatches: number;
}

// Module-level cache for instantaneous client fallback
let globalProblemsCache: ProblemDoc[] | null = null;
let globalFetchPromise: Promise<ProblemDoc[]> | null = null;

async function getProblemsData(): Promise<ProblemDoc[]> {
  if (globalProblemsCache) return globalProblemsCache;
  if (!globalFetchPromise) {
    globalFetchPromise = fetch('/data/problems.json')
      .then((res) => res.json())
      .then((data: ProblemDoc[]) => {
        globalProblemsCache = data;
        return data;
      })
      .catch((err) => {
        console.warn('Failed to pre-fetch problems.json:', err);
        return [];
      });
  }
  return globalFetchPromise;
}

export function useSearch(initialFilter?: SearchFilter, debounceMs: number = 150): UseSearchResult {
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState<SearchFilter>(initialFilter || {});
  const [results, setResults] = useState<ProblemDoc[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isReady, setIsReady] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [totalMatches, setTotalMatches] = useState(0);

  const queryRef = useRef(query);
  queryRef.current = query;

  const filtersRef = useRef(filters);
  filtersRef.current = filters;

  const workerRef = useRef<Worker | null>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const clientProblemsRef = useRef<ProblemDoc[]>(globalProblemsCache || []);

  // Client-side instant filter fallback (< 2ms)
  const runClientFallback = useCallback((q: string, f: SearchFilter, limit: number = 50) => {
    const list = clientProblemsRef.current;
    if (list.length === 0) return;

    const start = performance.now();
    const trimmed = q.trim().toLowerCase().replace(/^#/, '');
    const singular = trimmed.endsWith('s') && trimmed.length > 3 ? trimmed.slice(0, -1) : null;

    let filtered = list.filter((p) => {
      if (f.difficulty && f.difficulty !== 'All' && p.difficulty !== f.difficulty) return false;
      if (f.learningTrack && f.learningTrack !== 'All' && p.learningTrack !== f.learningTrack) return false;
      return true;
    });

    if (trimmed) {
      filtered = filtered.filter((p) => {
        const title = p.title.toLowerCase();
        if (p.id === trimmed) return true;
        if (title.includes(trimmed)) return true;
        if (singular && title.includes(singular)) return true;
        if (p.corePattern && p.corePattern.toLowerCase().includes(trimmed)) return true;
        if (Array.isArray(p.allTopics) && p.allTopics.some((t) => t.toLowerCase().includes(trimmed))) return true;
        return false;
      });

      // Sort relevance: exact ID > exact title > title starts with > title contains
      filtered.sort((a, b) => {
        const aTitle = a.title.toLowerCase();
        const bTitle = b.title.toLowerCase();
        if (a.id === trimmed && b.id !== trimmed) return -1;
        if (b.id === trimmed && a.id !== trimmed) return 1;
        if (aTitle === trimmed && bTitle !== trimmed) return -1;
        if (bTitle === trimmed && aTitle !== trimmed) return 1;
        const aStarts = aTitle.startsWith(trimmed) || (singular && aTitle.startsWith(singular));
        const bStarts = bTitle.startsWith(trimmed) || (singular && bTitle.startsWith(singular));
        if (aStarts && !bStarts) return -1;
        if (!aStarts && bStarts) return 1;
        return 0;
      });
    }

    const elapsed = Math.round((performance.now() - start) * 100) / 100;
    setResults(filtered.slice(0, limit));
    setTotalMatches(filtered.length);
    setElapsedMs(elapsed);
    setIsLoading(false);
  }, []);

  // Pre-fetch problems data on mount for instant client fallback
  useEffect(() => {
    getProblemsData().then((data) => {
      clientProblemsRef.current = data;
      // If worker hasn't populated yet, show initial client results
      if (!isReady && data.length > 0) {
        runClientFallback(queryRef.current, filtersRef.current);
      }
    });
  }, [isReady, runClientFallback]);

  // Worker Initialization
  useEffect(() => {
    let worker: Worker | null = null;
    try {
      worker = new Worker(new URL('./search.worker.ts', import.meta.url), {
        type: 'module',
      });
      workerRef.current = worker;

      worker.onmessage = (event: MessageEvent) => {
        const data = event.data;
        if (data.type === 'ready') {
          setIsReady(true);
          // Run search with the currently active query and filters
          worker?.postMessage({
            type: 'search',
            query: queryRef.current,
            filters: filtersRef.current,
            limit: 50,
          });
        } else if (data.type === 'search_results') {
          if (data.error && clientProblemsRef.current.length > 0) {
            runClientFallback(queryRef.current, filtersRef.current);
          } else {
            setResults(data.results || []);
            setElapsedMs(data.elapsedMs || 0);
            setTotalMatches(data.totalMatches || 0);
            setIsLoading(false);
          }
        } else if (data.type === 'error') {
          runClientFallback(queryRef.current, filtersRef.current);
        }
      };

      worker.onerror = () => {
        runClientFallback(queryRef.current, filtersRef.current);
      };

      worker.postMessage({ type: 'init' });
    } catch {
      // If Web Worker construction fails, rely on client-side fallback
      runClientFallback(queryRef.current, filtersRef.current);
    }

    return () => {
      worker?.terminate();
      workerRef.current = null;
    };
  }, [runClientFallback]);

  // Debounced search trigger on query or filters change
  const triggerSearch = useCallback((q: string, f: SearchFilter) => {
    setIsLoading(true);

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      if (workerRef.current && isReady) {
        workerRef.current.postMessage({
          type: 'search',
          query: q,
          filters: f,
          limit: 50,
        });
      } else {
        runClientFallback(q, f);
      }
    }, debounceMs);
  }, [debounceMs, isReady, runClientFallback]);

  useEffect(() => {
    triggerSearch(query, filters);
  }, [query, filters, triggerSearch]);

  return {
    query,
    setQuery,
    filters,
    setFilters,
    results,
    isLoading,
    isReady,
    elapsedMs,
    totalMatches,
  };
}
