import fs from 'fs';
import path from 'path';
import { getProblems } from './problems';
import type { ProblemDoc } from '@/lib/workers/search.worker';

export interface CompanyItem {
  name: string;
  questionCount: number;
  avgFrequency: number;
}

export interface CompanyMappingDoc {
  company: string;
  problemId: string;
  frequencyPct: number;
}

export interface CompanyProblemItem extends ProblemDoc {
  companyFrequencyPct: number;
}

let cachedCompanies: CompanyItem[] | null = null;
let cachedMappings: CompanyMappingDoc[] | null = null;
let slugToCompanyMap: Map<string, CompanyItem> | null = null;

export { companyToSlug } from '@/lib/utils/companySlug';
import { companyToSlug } from '@/lib/utils/companySlug';

export function getCompanies(): CompanyItem[] {
  if (!cachedCompanies) {
    const filePath = path.join(process.cwd(), 'public/data/companies.json');
    const content = fs.readFileSync(filePath, 'utf-8');
    cachedCompanies = JSON.parse(content);
  }
  return cachedCompanies!;
}

export function getCompanyBySlug(slug: string): CompanyItem | undefined {
  if (!slugToCompanyMap) {
    const list = getCompanies();
    slugToCompanyMap = new Map();
    for (const c of list) {
      slugToCompanyMap.set(companyToSlug(c.name), c);
    }
  }
  return slugToCompanyMap.get(slug);
}

export function getCompanyMappings(): CompanyMappingDoc[] {
  if (!cachedMappings) {
    const filePath = path.join(process.cwd(), 'public/data/company_mappings.json');
    const content = fs.readFileSync(filePath, 'utf-8');
    cachedMappings = JSON.parse(content);
  }
  return cachedMappings!;
}

export function getCompanyProblems(companyName: string): CompanyProblemItem[] {
  const mappings = getCompanyMappings();
  const companyMappings = mappings.filter(
    (m) => m.company.toLowerCase().trim() === companyName.toLowerCase().trim()
  );

  const problems = getProblems();
  const problemMap = new Map<string, ProblemDoc>(problems.map((p) => [p.id, p]));

  const results: CompanyProblemItem[] = [];

  for (const m of companyMappings) {
    const problem = problemMap.get(m.problemId);
    if (problem) {
      results.push({
        ...problem,
        companyFrequencyPct: m.frequencyPct,
      });
    }
  }

  // Sort by interview frequency descending, then by problem ID ascending
  results.sort((a, b) => {
    if (b.companyFrequencyPct !== a.companyFrequencyPct) {
      return b.companyFrequencyPct - a.companyFrequencyPct;
    }
    return parseInt(a.id, 10) - parseInt(b.id, 10);
  });

  return results;
}
