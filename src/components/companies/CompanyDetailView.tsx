'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Search,
  GitCompare,
  Flame,
  Code2,
  ExternalLink,
  BookOpen,
  Filter,
  ArrowUpDown,
  Sparkles,
} from 'lucide-react';
import CompanyLogo from '@/components/CompanyLogo';
import type { CompanyItem, CompanyProblemItem } from '@/lib/data/companies';

interface CompanyDetailViewProps {
  company: CompanyItem;
  problems: CompanyProblemItem[];
}

export default function CompanyDetailView({ company, problems }: CompanyDetailViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDifficulty, setSelectedDifficulty] = useState<'ALL' | 'Easy' | 'Medium' | 'Hard'>('ALL');
  const [sortBy, setSortBy] = useState<'frequency-desc' | 'frequency-asc' | 'id-asc' | 'title-asc'>('frequency-desc');

  // Compute breakdown statistics
  const stats = useMemo(() => {
    let easy = 0;
    let medium = 0;
    let hard = 0;

    for (const p of problems) {
      if (p.difficulty === 'Easy') easy++;
      else if (p.difficulty === 'Medium') medium++;
      else if (p.difficulty === 'Hard') hard++;
    }

    const total = problems.length || 1;
    return {
      easy,
      medium,
      hard,
      total: problems.length,
      easyPct: Math.round((easy / total) * 100),
      mediumPct: Math.round((medium / total) * 100),
      hardPct: Math.round((hard / total) * 100),
    };
  }, [problems]);

  // Filter and sort problems
  const filteredProblems = useMemo(() => {
    let result = problems.filter((p) => {
      // Difficulty filter
      if (selectedDifficulty !== 'ALL' && p.difficulty !== selectedDifficulty) {
        return false;
      }

      // Search query filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const matchesId = p.id.includes(query);
        const matchesTitle = p.title.toLowerCase().includes(query);
        const matchesPattern = p.corePattern?.toLowerCase().includes(query);
        const matchesTrack = p.learningTrack?.toLowerCase().includes(query);
        if (!matchesId && !matchesTitle && !matchesPattern && !matchesTrack) {
          return false;
        }
      }

      return true;
    });

    // Sorting
    result = [...result].sort((a, b) => {
      switch (sortBy) {
        case 'frequency-desc':
          return b.companyFrequencyPct - a.companyFrequencyPct || parseInt(a.id, 10) - parseInt(b.id, 10);
        case 'frequency-asc':
          return a.companyFrequencyPct - b.companyFrequencyPct || parseInt(a.id, 10) - parseInt(b.id, 10);
        case 'id-asc':
          return parseInt(a.id, 10) - parseInt(b.id, 10);
        case 'title-asc':
          return a.title.localeCompare(b.title);
        default:
          return 0;
      }
    });

    return result;
  }, [problems, selectedDifficulty, searchQuery, sortBy]);

  return (
    <div className="min-h-screen bg-background text-foreground p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto flex flex-col gap-6">
      {/* Top Navigation Bar */}
      <div className="flex items-center justify-between">
        <Link
          href="/companies"
          className="inline-flex items-center gap-2 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5 rounded-lg bg-secondary/50 hover:bg-secondary border border-border/50"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to All Companies</span>
        </Link>

        <div className="flex items-center gap-3">
          <Link
            href={`/companies/compare?companies=${encodeURIComponent(company.name)}`}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-primary text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-all shadow-sm"
          >
            <GitCompare className="w-3.5 h-3.5" />
            <span>Compare {company.name}</span>
          </Link>
          <Link
            href="/problems"
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-secondary/70 text-xs font-semibold text-foreground hover:bg-secondary border border-border/60 transition-colors"
          >
            <Code2 className="w-3.5 h-3.5" />
            <span>All Problems</span>
          </Link>
        </div>
      </div>

      {/* Company Showcase Header */}
      <div className="bg-card/70 border border-border/80 rounded-2xl p-6 backdrop-blur-md flex flex-col lg:flex-row gap-6 items-start lg:items-center justify-between shadow-xs">
        <div className="flex items-center gap-5">
          <CompanyLogo
            companyName={company.name}
            size={64}
            className="shadow-md ring-2 ring-border/50"
          />
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[11px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-md bg-secondary text-primary font-semibold">
                Verified Questions
              </span>
              <span className="text-xs text-muted-foreground">
                Updated from 2024–2025 interview rounds
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
              {company.name}
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">
              {company.questionCount.toLocaleString()} LeetCode questions cataloged with frequency distributions.
            </p>
          </div>
        </div>

        {/* Stats and Difficulty Breakdown Meter */}
        <div className="flex flex-col sm:flex-row gap-4 w-full lg:w-auto shrink-0">
          <div className="flex items-center gap-3 bg-secondary/40 border border-border/60 rounded-xl p-3 px-4">
            <div className="w-10 h-10 rounded-lg bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-orange-400">
              <Flame className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[11px] text-muted-foreground uppercase font-medium">Avg Frequency</div>
              <div className="text-lg font-bold font-mono text-foreground">
                {Math.round(company.avgFrequency * 100)}%
              </div>
            </div>
          </div>

          {/* Difficulty Meters */}
          <div className="bg-secondary/40 border border-border/60 rounded-xl p-3 px-4 flex flex-col justify-center min-w-[240px]">
            <div className="flex items-center justify-between text-xs mb-1.5 font-medium">
              <span className="text-muted-foreground">Difficulty Spread</span>
              <span className="font-mono text-[11px] text-foreground font-semibold">
                {stats.total} Total
              </span>
            </div>

            {/* Segmented Bar */}
            <div className="w-full h-2 rounded-full overflow-hidden bg-secondary flex gap-0.5 mb-2">
              <div style={{ width: `${stats.easyPct}%` }} className="bg-emerald-500 h-full" title={`Easy: ${stats.easy}`} />
              <div style={{ width: `${stats.mediumPct}%` }} className="bg-amber-500 h-full" title={`Medium: ${stats.medium}`} />
              <div style={{ width: `${stats.hardPct}%` }} className="bg-rose-500 h-full" title={`Hard: ${stats.hard}`} />
            </div>

            <div className="flex items-center justify-between text-[11px] font-mono">
              <span className="text-emerald-400 font-semibold">{stats.easy} Easy</span>
              <span className="text-amber-400 font-semibold">{stats.medium} Med</span>
              <span className="text-rose-400 font-semibold">{stats.hard} Hard</span>
            </div>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 bg-card/60 border border-border/80 p-4 rounded-2xl backdrop-blur-md">
        {/* Search */}
        <div className="relative w-full md:max-w-md">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={`Search ${company.name} questions (e.g. Two Sum, LRU, Graph)...`}
            className="w-full pl-10 pr-4 py-2 text-xs rounded-xl bg-secondary/50 border border-border/60 text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary transition-colors"
          />
        </div>

        {/* Filters and Sort */}
        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto justify-between md:justify-end">
          {/* Difficulty Tabs */}
          <div className="flex items-center gap-1 bg-secondary/60 p-1 rounded-xl border border-border/50 text-xs">
            {(['ALL', 'Easy', 'Medium', 'Hard'] as const).map((diff) => {
              const count = diff === 'ALL' ? stats.total : stats[diff.toLowerCase() as 'easy' | 'medium' | 'hard'];
              const isActive = selectedDifficulty === diff;
              return (
                <button
                  key={diff}
                  onClick={() => setSelectedDifficulty(diff)}
                  className={`px-2.5 py-1 rounded-lg font-medium transition-all text-xs flex items-center gap-1 ${
                    isActive
                      ? 'bg-primary text-primary-foreground font-semibold shadow-xs'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <span>{diff}</span>
                  <span className={`text-[10px] px-1 rounded-md ${isActive ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-secondary text-muted-foreground'}`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Sort Selector */}
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <ArrowUpDown className="w-3.5 h-3.5" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-secondary/70 border border-border/60 rounded-xl px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:border-primary"
            >
              <option value="frequency-desc">Highest Frequency %</option>
              <option value="frequency-asc">Lowest Frequency %</option>
              <option value="id-asc">LeetCode # (Ascending)</option>
              <option value="title-asc">Alphabetical (A-Z)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Questions Counter Header */}
      <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
        <span>
          Showing <span className="font-semibold text-foreground">{filteredProblems.length}</span> questions
          {selectedDifficulty !== 'ALL' && ` filtered by ${selectedDifficulty}`}
        </span>
        {(searchQuery || selectedDifficulty !== 'ALL') && (
          <button
            onClick={() => {
              setSearchQuery('');
              setSelectedDifficulty('ALL');
            }}
            className="text-primary hover:underline font-medium"
          >
            Reset Filters
          </button>
        )}
      </div>

      {/* Questions List / Table */}
      {filteredProblems.length === 0 ? (
        <div className="p-12 text-center border border-dashed border-border/80 rounded-2xl bg-card/30 flex flex-col items-center justify-center gap-3">
          <Code2 className="w-10 h-10 text-muted-foreground/50" />
          <p className="text-sm font-semibold text-foreground">No questions found matching your filter.</p>
          <p className="text-xs text-muted-foreground">Try adjusting your search keywords or switching difficulty.</p>
          <button
            onClick={() => {
              setSearchQuery('');
              setSelectedDifficulty('ALL');
            }}
            className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 mt-2"
          >
            Clear Filters
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {filteredProblems.map((problem) => {
            const freqPct = Math.round(problem.companyFrequencyPct * 100);
            const difficultyBadge =
              problem.difficulty === 'Easy'
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                : problem.difficulty === 'Medium'
                ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                : 'bg-rose-500/10 text-rose-400 border-rose-500/20';

            return (
              <div
                key={problem.id}
                className="p-4 rounded-xl bg-card/70 border border-border/80 hover:border-primary/40 hover:shadow-md transition-all duration-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4 group"
              >
                {/* Left: ID, Title, Badges */}
                <div className="flex items-start sm:items-center gap-3 min-w-0">
                  <span className="font-mono text-xs font-bold text-muted-foreground w-12 shrink-0">
                    #{problem.id}
                  </span>

                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <Link
                        href={`/problem/${problem.id}`}
                        className="font-bold text-sm text-foreground hover:text-primary transition-colors hover:underline line-clamp-1"
                      >
                        {problem.title}
                      </Link>

                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md border ${difficultyBadge}`}>
                        {problem.difficulty}
                      </span>

                      {problem.isPaidOnly && (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-300 border border-amber-500/30">
                          Premium Unlocked
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                      {problem.corePattern && (
                        <span className="px-2 py-0.5 rounded bg-secondary/80 text-foreground/80 font-medium">
                          {problem.corePattern}
                        </span>
                      )}

                      {problem.systemDesignLinks && problem.systemDesignLinks.length > 0 && (
                        <span className="flex items-center gap-1 text-primary bg-primary/10 px-2 py-0.5 rounded text-[10px] font-semibold">
                          <BookOpen className="w-3 h-3" />
                          <span>Alex Xu Ch. {problem.systemDesignLinks[0].chapter}</span>
                        </span>
                      )}

                      <span>
                        Asked by {problem.companiesCount} companies
                      </span>
                    </div>
                  </div>
                </div>

                {/* Right: Frequency Meter & Action */}
                <div className="flex items-center justify-between sm:justify-end gap-5 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-border/40">
                  {/* Frequency meter */}
                  <div className="flex flex-col items-end gap-1">
                    <div className="flex items-center gap-1.5">
                      <Flame className="w-3.5 h-3.5 text-orange-400" />
                      <span className="font-mono text-xs font-bold text-foreground">
                        {freqPct}%
                      </span>
                    </div>
                    <div className="w-24 h-1.5 rounded-full bg-secondary overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-orange-500 to-amber-400 rounded-full"
                        style={{ width: `${Math.max(8, freqPct)}%` }}
                      />
                    </div>
                  </div>

                  {/* Launch button */}
                  <Link
                    href={`/problem/${problem.id}`}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-secondary/80 hover:bg-primary text-foreground hover:text-primary-foreground text-xs font-semibold border border-border/60 transition-all shadow-xs"
                  >
                    <span>Solve</span>
                    <ExternalLink className="w-3 h-3" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
