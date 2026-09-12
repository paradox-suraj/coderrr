'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { 
  Building2, 
  Search, 
  ArrowRight, 
  GitCompare, 
  Flame, 
  ArrowLeft,
  Briefcase
} from 'lucide-react';
import CompanyLogo from '@/components/CompanyLogo';
import { companyToSlug } from '@/lib/utils/companySlug';
import { SpotlightCard } from '@/components/core/SpotlightCard';
import companiesData from '../../../public/data/companies.json';

interface CompanyItem {
  name: string;
  questionCount: number;
  avgFrequency: number;
}

export default function CompaniesDirectoryPage() {
  const [query, setQuery] = useState('');
  const [sortBy, setSortBy] = useState<'count' | 'name'>('count');

  const filteredCompanies = useMemo(() => {
    const list = (companiesData as CompanyItem[]).filter((c) =>
      c.name.toLowerCase().includes(query.toLowerCase().trim())
    );

    if (sortBy === 'count') {
      return list.sort((a, b) => b.questionCount - a.questionCount);
    } else {
      return list.sort((a, b) => a.name.localeCompare(b.name));
    }
  }, [query, sortBy]);

  return (
    <div className="min-h-screen bg-background text-foreground p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/[0.08] pb-6">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-emerald-400 uppercase tracking-wider mb-1">
            <Briefcase className="w-3.5 h-3.5" />
            <span>Target Org Directory</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-neutral-100">
            Companies Asking LeetCode
          </h1>
          <p className="text-xs sm:text-sm text-neutral-400 mt-1">
            Explore 654 top engineering organizations and their verified problem frequency distribution.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/companies/compare"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl glow-button text-xs font-semibold text-white transition-all shadow-md cursor-pointer"
          >
            <GitCompare className="w-4 h-4" />
            <span>Compare Overlaps</span>
          </Link>
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-xs font-semibold text-neutral-200 border border-white/[0.08] transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Cockpit</span>
          </Link>
        </div>
      </div>

      {/* Search and Sort Toolbar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 glass-card p-3.5 rounded-2xl">
        <div className="relative w-full sm:max-w-md">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-500" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search 654 companies (e.g. Google, Apple, Uber)..."
            className="w-full pl-10 pr-12 py-2 text-xs rounded-xl bg-black/40 border border-white/[0.08] text-white placeholder:text-neutral-500 focus:outline-none focus:border-emerald-500/50 transition-colors"
          />
          <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
            <kbd className="font-mono text-[10px] bg-white/[0.06] text-neutral-400 px-1.5 py-0.5 rounded border border-white/[0.08]">
              /
            </kbd>
          </div>
        </div>

        <div className="flex items-center gap-2.5 text-xs w-full sm:w-auto justify-end">
          <span className="text-neutral-500 text-xs font-medium">Sort:</span>
          <div className="flex items-center p-1 rounded-xl bg-neutral-900/90 border border-white/[0.08]">
            <button
              onClick={() => setSortBy('count')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                sortBy === 'count'
                  ? 'bg-white/[0.1] text-white shadow-xs font-semibold'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              Questions Count
            </button>
            <button
              onClick={() => setSortBy('name')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                sortBy === 'name'
                  ? 'bg-white/[0.1] text-white shadow-xs font-semibold'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              Alphabetical
            </button>
          </div>
        </div>
      </div>

      {/* Grid of Companies */}
      <div className="flex items-center justify-between text-xs text-neutral-400 px-1 font-mono">
        <span className="tabular-nums">
          Showing {Math.min(filteredCompanies.length, 120)} of {filteredCompanies.length} organizations
        </span>
        {query && (
          <button
            onClick={() => setQuery('')}
            className="text-emerald-400 hover:text-emerald-300 font-sans cursor-pointer"
          >
            Clear Search
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {filteredCompanies.slice(0, 120).map((company) => {
          const slug = companyToSlug(company.name);
          return (
            <SpotlightCard
              key={company.name}
              className="p-4 flex flex-col justify-between group transition-all duration-200 hover:-translate-y-0.5"
            >
              <Link href={`/companies/${slug}`} className="block">
                <div className="flex items-center justify-between mb-3">
                  <CompanyLogo companyName={company.name} size={36} className="group-hover:scale-105 transition-transform" />
                  <span className="font-mono text-xs px-2 py-0.5 rounded-md bg-neutral-800/80 text-neutral-300 border border-white/[0.05] tabular-nums">
                    {Math.round(company.avgFrequency * 100)}% Avg Freq
                  </span>
                </div>

                <h2 className="font-semibold text-sm text-neutral-100 group-hover:text-white transition-colors line-clamp-1">
                  {company.name}
                </h2>
              </Link>

              <div className="mt-4 pt-3 border-t border-white/[0.06] flex items-center justify-between text-xs">
                <Link
                  href={`/companies/${slug}`}
                  className="flex items-center gap-1 font-mono text-neutral-400 hover:text-neutral-200 transition-colors"
                >
                  <Flame className="w-3.5 h-3.5 text-orange-400" />
                  <span className="tabular-nums">{company.questionCount.toLocaleString()} Qs</span>
                </Link>

                <div className="flex items-center gap-3">
                  <Link
                    href={`/companies/compare?companies=${encodeURIComponent(company.name)}`}
                    className="text-neutral-400 hover:text-neutral-200 font-medium flex items-center gap-1 transition-colors"
                    title="Compare in overlap comparator"
                  >
                    <span>Compare</span>
                  </Link>

                  <Link
                    href={`/companies/${slug}`}
                    className="text-emerald-400 hover:text-emerald-300 font-semibold flex items-center gap-0.5"
                  >
                    <span>View</span>
                    <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                  </Link>
                </div>
              </div>
            </SpotlightCard>
          );
        })}
      </div>
    </div>
  );
}
