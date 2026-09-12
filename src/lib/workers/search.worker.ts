import { create, insertMultiple, search, type AnyOrama } from '@orama/orama';

export interface SearchFilter {
  difficulty?: 'Easy' | 'Medium' | 'Hard' | 'All';
  learningTrack?: string;
  topic?: string;
}

export interface SearchWorkerMessage {
  type: 'init' | 'search';
  id?: string;
  data?: any;
  query?: string;
  filters?: SearchFilter;
  limit?: number;
}

export interface ProblemDoc {
  id: string;
  title: string;
  slug: string;
  difficulty: string;
  problemType: string;
  corePattern: string;
  allTopics: string[];
  learningTrack: string;
  companiesCount: number;
  maxFrequency: number;
  avgAcceptance: number;
  url: string;
  priorityBucket: string;
  systemDesignLinks: { chapter: string; title: string }[];
  descriptionHtml?: string;
  isPaidOnly?: boolean;
}

let oramaDb: AnyOrama | null = null;
let allProblems: ProblemDoc[] = [];
let initPromise: Promise<void> | null = null;

async function initOrama(problemsData?: ProblemDoc[]): Promise<void> {
  if (oramaDb) return;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      let dataset = problemsData;
      if (!dataset || dataset.length === 0) {
        const response = await fetch('/data/problems.json');
        dataset = await response.json();
      }

      allProblems = dataset || [];

      oramaDb = await create({
        schema: {
          id: 'string',
          title: 'string',
          difficulty: 'string',
          corePattern: 'string',
          learningTrack: 'string',
          allTopics: 'string[]',
          problemType: 'string',
          priorityBucket: 'string',
        },
      });

      const indexRecords = allProblems.map((p) => ({
        id: p.id,
        title: p.title,
        difficulty: p.difficulty,
        corePattern: p.corePattern || '',
        learningTrack: p.learningTrack || '',
        allTopics: Array.isArray(p.allTopics) ? p.allTopics : [],
        problemType: p.problemType || '',
        priorityBucket: p.priorityBucket || '',
      }));

      await insertMultiple(oramaDb, indexRecords);

      self.postMessage({
        type: 'ready',
        count: allProblems.length,
      });
    } catch (err: any) {
      initPromise = null;
      self.postMessage({
        type: 'error',
        error: err.message || 'Failed to initialize Orama database',
      });
      throw err;
    }
  })();

  return initPromise;
}

async function handleSearch(id: string | undefined, query: string = '', filters?: SearchFilter, limit: number = 50) {
  if (!oramaDb) {
    if (initPromise) {
      try {
        await initPromise;
      } catch {
        // Fall back to direct search on allProblems if Orama init failed
      }
    }
  }

  const startTime = performance.now();

  try {
    let problemResults: ProblemDoc[] = [];

    const trimmedQuery = query.trim();
    const lowerQuery = trimmedQuery.toLowerCase().replace(/^#/, '');
    const singularQuery = lowerQuery.endsWith('s') && lowerQuery.length > 3 ? lowerQuery.slice(0, -1) : null;

    const matchesFilter = (p: ProblemDoc) => {
      if (filters?.difficulty && filters.difficulty !== 'All' && p.difficulty !== filters.difficulty) {
        return false;
      }
      if (filters?.learningTrack && filters.learningTrack !== 'All' && p.learningTrack !== filters.learningTrack) {
        return false;
      }
      return true;
    };

    if (trimmedQuery && oramaDb) {
      const whereClause: Record<string, any> = {};
      if (filters?.difficulty && filters.difficulty !== 'All') {
        whereClause.difficulty = filters.difficulty;
      }
      if (filters?.learningTrack && filters.learningTrack !== 'All') {
        whereClause.learningTrack = filters.learningTrack;
      }

      // Check for direct title or ID matches first
      const directMatches: ProblemDoc[] = [];
      for (const p of allProblems) {
        if (!matchesFilter(p)) continue;
        const pTitle = p.title.toLowerCase();
        if (p.id === lowerQuery) {
          directMatches.push(p);
        } else if (pTitle === lowerQuery || (singularQuery && pTitle === singularQuery)) {
          directMatches.push(p);
        } else if (pTitle.includes(lowerQuery) || (singularQuery && pTitle.includes(singularQuery))) {
          directMatches.push(p);
        }
      }

      const searchParams: any = {
        term: trimmedQuery,
        limit: Math.max(limit, 50),
        boost: { title: 4 },
        properties: ['title', 'corePattern', 'allTopics', 'learningTrack', 'problemType'],
      };

      if (Object.keys(whereClause).length > 0) {
        searchParams.where = whereClause;
      }

      const results = await search(oramaDb, searchParams);
      const hitIds = new Set(results.hits.map((h) => (h.document as any).id));
      
      const probMap = new Map<string, ProblemDoc>();
      for (const p of allProblems) {
        if (hitIds.has(p.id)) {
          probMap.set(p.id, p);
        }
      }
      
      const oramaMatches = results.hits
        .map((h) => probMap.get((h.document as any).id))
        .filter(Boolean) as ProblemDoc[];

      // Combine direct matches first, then Orama matches, deduplicated
      const seenIds = new Set<string>();
      for (const p of directMatches) {
        if (!seenIds.has(p.id)) {
          seenIds.add(p.id);
          problemResults.push(p);
        }
      }
      for (const p of oramaMatches) {
        if (!seenIds.has(p.id)) {
          seenIds.add(p.id);
          problemResults.push(p);
        }
      }
      problemResults = problemResults.slice(0, limit);
    } else if (trimmedQuery) {
      // Fallback in-memory search if oramaDb is not available
      problemResults = allProblems
        .filter((p) => {
          if (!matchesFilter(p)) return false;
          const pTitle = p.title.toLowerCase();
          if (p.id === lowerQuery) return true;
          if (pTitle.includes(lowerQuery)) return true;
          if (singularQuery && pTitle.includes(singularQuery)) return true;
          if (p.corePattern && p.corePattern.toLowerCase().includes(lowerQuery)) return true;
          if (Array.isArray(p.allTopics) && p.allTopics.some((t) => t.toLowerCase().includes(lowerQuery))) return true;
          return false;
        })
        .slice(0, limit);
    } else {
      // Return top problems filtered by conditions
      problemResults = allProblems.filter(matchesFilter).slice(0, limit);
    }

    const elapsedMs = Math.round((performance.now() - startTime) * 100) / 100;

    self.postMessage({
      type: 'search_results',
      id,
      results: problemResults,
      elapsedMs,
      totalMatches: problemResults.length,
    });
  } catch (err: any) {
    self.postMessage({
      type: 'search_results',
      id,
      results: [],
      error: err.message || 'Search execution failed',
    });
  }
}

self.addEventListener('message', async (event: MessageEvent<SearchWorkerMessage>) => {
  const { type, id, data, query, filters, limit } = event.data;

  if (type === 'init') {
    await initOrama(data).catch(() => {});
  } else if (type === 'search') {
    if (!oramaDb) {
      await initOrama().catch(() => {});
    }
    await handleSearch(id, query, filters, limit);
  }
});
