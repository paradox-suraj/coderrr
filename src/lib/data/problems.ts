import fs from 'fs';
import path from 'path';
import type { ProblemDoc } from '@/lib/workers/search.worker';

export interface CompanyMappingDoc {
  company: string;
  problemId: string;
  frequencyPct: number;
}

let cachedProblems: ProblemDoc[] | null = null;
let cachedMappings: CompanyMappingDoc[] | null = null;

export function getProblems(): ProblemDoc[] {
  if (!cachedProblems) {
    const filePath = path.join(process.cwd(), 'public/data/problems.json');
    const content = fs.readFileSync(filePath, 'utf-8');
    cachedProblems = JSON.parse(content);
  }
  return cachedProblems!;
}

export function getProblemDescription(id: string): string | undefined {
  const descPath = path.join(process.cwd(), `public/data/descriptions/${id}.json`);
  if (fs.existsSync(descPath)) {
    try {
      const data = JSON.parse(fs.readFileSync(descPath, 'utf-8'));
      return data.descriptionHtml;
    } catch {
      return undefined;
    }
  }
  return undefined;
}

export function getProblemById(id: string): ProblemDoc | undefined {
  const problems = getProblems();
  const problem = problems.find((p) => p.id === id);
  if (problem && !problem.descriptionHtml) {
    const desc = getProblemDescription(id);
    if (desc) {
      return { ...problem, descriptionHtml: desc, isPaidOnly: false };
    }
  }
  return problem;
}

export function getCompanyMappingsForProblem(problemId: string): CompanyMappingDoc[] {
  if (!cachedMappings) {
    const filePath = path.join(process.cwd(), 'public/data/company_mappings.json');
    const content = fs.readFileSync(filePath, 'utf-8');
    cachedMappings = JSON.parse(content);
  }
  return cachedMappings!
    .filter((m) => m.problemId === problemId)
    .sort((a, b) => b.frequencyPct - a.frequencyPct);
}
