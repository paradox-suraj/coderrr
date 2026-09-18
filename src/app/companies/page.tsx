'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { 
  Search, 
  ArrowRight, 
  GitCompare, 
  Flame, 
  ArrowLeft,
  Briefcase,
  Sparkles,
  Layers
} from 'lucide-react';
import CompanyLogo from '@/components/CompanyLogo';
import { companyToSlug } from '@/lib/utils/companySlug';
import { SpotlightCard } from '@/components/core/SpotlightCard';
import companiesData from '../../../public/data/companies.json';

interface CompanyItem {
  name: string;
  questionCount: number;
  avgFrequency: number;
  easyCount?: number;
  mediumCount?: number;
  hardCount?: number;
}

type TaxonomyCategory = 'All' | 'FAANG / Big Tech' | 'HFT & Quant' | 'Unicorns' | 'Top Frequency (>50%)';

const TAXONOMY_CATEGORIES: TaxonomyCategory[] = [
  'All',
  'FAANG / Big Tech',
  'HFT & Quant',
  'Unicorns',
  'Top Frequency (>50%)',
];

const TAXONOMY_SETS: Record<Exclude<TaxonomyCategory, 'All' | 'Top Frequency (>50%)'>, Set<string>> = {
  'FAANG / Big Tech': new Set([
    'Google', 'Meta', 'Amazon', 'Apple', 'Netflix', 'Microsoft'
  ]),
  'HFT & Quant': new Set([
    'Citadel', 'Jane Street', 'Two Sigma', 'Jump Trading', 'Hrt',
    'De Shaw', 'Optiver', 'Akuna Capital', 'Drw', 'Imc',
    'Tower Research', 'Virtu', 'Virtu Financial', 'Sig', 'Point72',
    'Millennium', 'Worldquant', 'Hudson River Trading'
  ]),
  'Unicorns': new Set([
    'Stripe', 'Uber', 'Airbnb', 'Bytedance', 'Coinbase', 'Snowflake',
    'Databricks', 'Doordash', 'Figma', 'Robinhood', 'Instacart',
    'Palantir', 'Rippling', 'Discord', 'Notion', 'Scale Ai',
    'Openai', 'Anthropic', 'Anduril'
  ]),
};

export default function CompaniesDirectoryPage() {
  const [query, setQuery] = useState('');
  const [sortBy, setSortBy] = useState<'count' | 'name'>('count');
  const [selectedCategory, setSelectedCategory] = useState<TaxonomyCategory>('All');

  const filteredCompanies = useMemo(() => {
    const list = (companiesData as CompanyItem[]).filter((c) => {
      // 1. Text query filter
      if (query.trim() && !c.name.toLowerCase().includes(query.toLowerCase().trim())) {
        return false;
      }

      // 2. Taxonomy category filter
      if (selectedCategory === 'FAANG / Big Tech') {
        if (!TAXONOMY_SETS['FAANG / Big Tech'].has(c.name)) return false;
      } else if (selectedCategory === 'HFT & Quant') {
        if (!TAXONOMY_SETS['HFT & Quant'].has(c.name)) return false;
      } else if (selectedCategory === 'Unicorns') {
        if (!TAXONOMY_SETS['Unicorns'].has(c.name)) return false;
      } else if (selectedCategory === 'Top Frequency (>50%)') {
        if (c.avgFrequency < 0.5) return false;
      }

      return true;
    });

    if (sortBy === 'count') {
      return list.sort((a, b) => b.questionCount - a.questionCount);
    } else {
      return list.sort((a, b) => a.name.localeCompare(b.name));
    }
  }, [query, sortBy, selectedCategory]);

  return (
    <div className="min-h-screen bg-background text-foreground p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-6">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-emerald-400 uppercase tracking-wider mb-1">
            <Briefcase className="w-3.5 h-3.5" />
            <span>Company Directory</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-neutral-100">
            Target Companies
          </h1>
          <p className="text-xs sm:text-sm text-neutral-400 mt-1">
            Explore 654 tech companies and the specific interview questions they ask most frequently.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/companies/compare"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl glow-button text-xs font-semibold text-white transition-all shadow-md cursor-pointer"
          >
            <GitCompare className="w-4 h-4" />
            <span>Compare Companies</span>
          </Link>
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-xs font-semibold text-neutral-200 border border-white/10 transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Dashboard</span>
          </Link>
        </div>
      </div>

      {/* Search and Sort Toolbar */}
      <div className="flex flex-col gap-3.5 glass-card p-4 rounded-2xl border border-white/10">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="relative w-full sm:max-w-md">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search 654 companies (e.g. Google, Apple, Uber)..."
              className="w-full pl-10 pr-12 py-2 text-xs rounded-xl bg-black/40 border border-white/10 text-white placeholder:text-neutral-400 focus:outline-none focus:border-emerald-500/50 transition-colors"
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
              <kbd className="font-mono text-[10px] bg-white/[0.06] text-neutral-400 px-1.5 py-0.5 rounded border border-white/10">
                /
              </kbd>
            </div>
          </div>

          <div className="flex items-center gap-2.5 text-xs w-full sm:w-auto justify-end">
            <span className="text-neutral-400 text-xs font-medium">Sort:</span>
            <div className="flex items-center p-1 rounded-xl bg-neutral-900/90 border border-white/10">
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

        {/* Quick-Filter Taxonomy Chips */}
        <div className="flex items-center gap-2 overflow-x-auto pt-1 pb-0.5 no-scrollbar text-xs">
          <span className="text-neutral-400 text-xs font-medium shrink-0 flex items-center gap-1 mr-1">
            <Layers className="w-3.5 h-3.5 text-neutral-400" />
            <span>Preset:</span>
          </span>
          {TAXONOMY_CATEGORIES.map((category) => {
            const isActive = selectedCategory === category;
            return (
              <button
                key={category}
                onClick={() => setSelectedCategory(category)}
                className={`px-3 py-1 rounded-lg text-xs font-medium whitespace-nowrap transition-all border cursor-pointer ${
                  isActive
                    ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40 shadow-xs font-semibold'
                    : 'bg-white/[0.03] hover:bg-white/[0.07] text-neutral-400 hover:text-neutral-200 border-white/10'
                }`}
              >
                {category}
              </button>
            );
          })}
        </div>
      </div>

      {/* Grid of Companies Header Info */}
      <div className="flex items-center justify-between text-xs text-neutral-400 px-1 font-mono">
        <span className="tabular-nums">
          Showing {Math.min(filteredCompanies.length, 120)} of {filteredCompanies.length} organizations
        </span>
        {(query || selectedCategory !== 'All') && (
          <button
            onClick={() => {
              setQuery('');
              setSelectedCategory('All');
            }}
            className="text-emerald-400 hover:text-emerald-300 font-sans cursor-pointer text-xs font-medium"
          >
            Reset Filters
          </button>
        )}
      </div>

      {/* Strict 3-Tier Card Layout Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {filteredCompanies.slice(0, 120).map((company) => {
          const slug = companyToSlug(company.name);
          const totalQ = company.questionCount || 1;
          const easy = company.easyCount || 0;
          const med = company.mediumCount || 0;
          const hard = company.hardCount || 0;

          const easyPct = Math.round((easy / totalQ) * 100);
          const medPct = Math.round((med / totalQ) * 100);
          const hardPct = Math.max(0, 100 - easyPct - medPct);

          return (
            <SpotlightCard
              key={company.name}
              className="p-4 flex flex-col justify-between group transition-all duration-200 hover:-translate-y-0.5 border border-white/10 rounded-xl"
            >
              {/* ─── TIER 1: Header (Icon + Name + Avg Freq) ──────────────────── */}
              <Link href={`/companies/${slug}`} className="block">
                <div className="flex items-center justify-between gap-2.5 mb-1.5">
                  <CompanyLogo companyName={company.name} size={36} className="group-hover:scale-105 transition-transform shrink-0" />
                  <span className="font-mono text-[11px] font-semibold px-2 py-0.5 rounded-md bg-neutral-800/90 text-neutral-300 border border-white/10 tabular-nums shrink-0">
                    {Math.round(company.avgFrequency * 100)}% Avg Freq
                  </span>
                </div>

                <h2 className="font-semibold text-sm text-neutral-100 group-hover:text-white transition-colors truncate mt-2">
                  {company.name}
                </h2>
              </Link>

              {/* ─── TIER 2: Body (Count + Difficulty Stacked Micro-Bar) ──────── */}
              <div className="my-3.5 flex flex-col gap-2">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-neutral-400 flex items-center gap-1">
                    <Flame className="w-3.5 h-3.5 text-orange-400" />
                    <span className="tabular-nums font-semibold text-neutral-200">{company.questionCount.toLocaleString()}</span>
                    <span>Qs</span>
                  </span>
                  <span className="text-[10px] text-neutral-400 font-mono">
                    <span className="text-emerald-400 font-semibold">{easy}</span>E •{' '}
                    <span className="text-amber-400 font-semibold">{med}</span>M •{' '}
                    <span className="text-rose-400 font-semibold">{hard}</span>H
                  </span>
                </div>

                {/* Stacked micro-bar with visual tooltips */}
                <div 
                  className="w-full h-1.5 rounded-full bg-white/[0.08] overflow-hidden flex"
                  title={`Easy: ${easy} (${easyPct}%), Medium: ${med} (${medPct}%), Hard: ${hard} (${hardPct}%)`}
                >
                  <div style={{ width: `${easyPct}%` }} className="bg-emerald-500 h-full" />
                  <div style={{ width: `${medPct}%` }} className="bg-amber-500 h-full" />
                  <div style={{ width: `${hardPct}%` }} className="bg-rose-500 h-full" />
                </div>
              </div>

              {/* ─── TIER 3: Footer (Distinct Actions with Explicit Spacing) ──── */}
              <div className="pt-3 border-t border-white/10 flex items-center gap-3">
                <Link
                  href={`/companies/compare?companies=${encodeURIComponent(company.name)}`}
                  className="flex-1 py-1.5 px-2.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-neutral-300 hover:text-white border border-white/10 flex items-center justify-center gap-1.5 text-xs font-medium transition-colors cursor-pointer"
                  title="Compare in overlap comparator"
                >
                  <GitCompare className="w-3.5 h-3.5 text-neutral-400" />
                  <span>Compare</span>
                </Link>

                <Link
                  href={`/companies/${slug}`}
                  className="flex-1 py-1.5 px-2.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 hover:text-emerald-300 border border-emerald-500/25 flex items-center justify-center gap-1 text-xs font-semibold transition-colors cursor-pointer group/btn"
                >
                  <span>View Questions</span>
                  <ArrowRight className="w-3 h-3 group-hover/btn:translate-x-0.5 transition-transform" />
                </Link>
              </div>
            </SpotlightCard>
          );
        })}
      </div>
    </div>
  );
}
