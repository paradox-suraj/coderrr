'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getDueReviews } from '@/lib/db';
import type { UserProgress } from '@/lib/db';
import type { ProblemDoc } from '@/lib/workers/search.worker';
import { BrainCircuit, Clock, Target, ArrowRight, CheckCircle2, Sparkles, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface EnrichedReview extends UserProgress {
  problem?: ProblemDoc;
}

export default function ReviewClient() {
  const [reviews, setReviews] = useState<EnrichedReview[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadReviews() {
      try {
        setIsLoading(true);
        const due = await getDueReviews();
        
        if (due.length === 0) {
          setReviews([]);
          return;
        }

        const res = await fetch('/data/problems.json');
        if (!res.ok) throw new Error('Failed to fetch problems');
        
        const allProblems: ProblemDoc[] = await res.json();
        const problemMap = new Map<string, ProblemDoc>();
        for (const p of allProblems) {
          problemMap.set(p.id, p);
        }

        const enriched = due.map(r => ({
          ...r,
          problem: problemMap.get(r.problemId)
        }));

        setReviews(enriched);
      } catch (err) {
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    }

    loadReviews();
  }, []);

  return (
    <div className="flex-1 overflow-y-auto bg-background p-6">
      <div className="max-w-4xl mx-auto flex flex-col gap-8">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <BrainCircuit className="w-6 h-6 text-primary" />
              <span>Review Queue</span>
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              Spaced repetition based on the SM-2 algorithm.
            </p>
          </div>
          {!isLoading && reviews.length > 0 && (
            <div className="px-3 py-1.5 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-400 font-mono text-sm font-semibold flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              <span>{reviews.length} Due Today</span>
            </div>
          )}
        </header>

        {isLoading ? (
          <div className="flex items-center justify-center p-12 text-muted-foreground font-mono text-sm gap-3">
            <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            Loading queue...
          </div>
        ) : reviews.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-16 rounded-2xl bg-card border border-border/80 glass-card gap-4 text-center">
            <div className="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center mb-2">
              <Sparkles className="w-8 h-8 text-emerald-400" />
            </div>
            <h2 className="text-xl font-bold">All caught up! 🎉</h2>
            <p className="text-muted-foreground max-w-sm">
              No reviews due today. Excellent work maintaining your spaced repetition schedule.
            </p>
            <Link 
              href="/problems"
              className="mt-4 px-5 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-semibold flex items-center gap-2 transition-all shadow-sm"
            >
              <span>Learn New Problems</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {reviews.map((item, idx) => {
              const p = item.problem;
              if (!p) return null;

              return (
                <div key={item.problemId} className="flex flex-col md:flex-row md:items-center justify-between p-5 rounded-2xl bg-card/60 backdrop-blur-md border border-border/80 hover:border-primary/50 transition-all gap-5 group">
                  <div className="flex flex-col gap-3 min-w-0">
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-xs text-muted-foreground font-semibold">
                        #{p.id}
                      </span>
                      <h3 className="font-bold text-base truncate group-hover:text-primary transition-colors">
                        {p.title}
                      </h3>
                      <span
                        className={cn(
                          'text-[10px] font-semibold px-2 py-0.5 rounded-full border shrink-0',
                          p.difficulty === 'Easy' && 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10',
                          p.difficulty === 'Medium' && 'text-amber-400 border-amber-500/30 bg-amber-500/10',
                          p.difficulty === 'Hard' && 'text-rose-400 border-rose-500/30 bg-rose-500/10'
                        )}
                      >
                        {p.difficulty}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-4 text-[11px] font-mono text-muted-foreground">
                      <div className="flex items-center gap-1.5" title="Next Review Date">
                        <Clock className="w-3.5 h-3.5 text-blue-400" />
                        <span>Due: {new Date(item.nextReviewDate).toLocaleDateString()}</span>
                      </div>
                      <div className="flex items-center gap-1.5" title="Current Interval">
                        <ArrowRight className="w-3.5 h-3.5 text-amber-400" />
                        <span>Interval: {item.intervalDays}d</span>
                      </div>
                      <div className="flex items-center gap-1.5" title="Ease Factor">
                        <BrainCircuit className="w-3.5 h-3.5 text-purple-400" />
                        <span>Ease: {item.easeFactor.toFixed(2)}</span>
                      </div>
                      <div className="flex items-center gap-1.5" title="Total Repetitions">
                        <Target className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Reps: {item.revisions}</span>
                      </div>
                    </div>
                  </div>

                  <Link 
                    href={`/problem/${p.id}?mode=review`}
                    className="shrink-0 px-5 py-2.5 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30 font-semibold text-xs flex items-center justify-center gap-2 transition-all self-start md:self-auto"
                  >
                    <span>Start Review</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
