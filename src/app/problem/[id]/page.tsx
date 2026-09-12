import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getProblemById, getCompanyMappingsForProblem, getProblems } from '@/lib/data/problems';
import ProblemWorkspace from '@/components/workspace/ProblemWorkspace';

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateStaticParams() {
  const problems = getProblems();
  // Prerender the top 30 most frequent problems for fast static access
  return problems.slice(0, 30).map((p) => ({
    id: p.id,
  }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const problem = getProblemById(id);

  if (!problem) {
    return {
      title: 'Problem Not Found — AlgoJeet Pro',
    };
  }

  return {
    title: `${problem.id}. ${problem.title} (${problem.difficulty}) — AlgoJeet Pro`,
    description: `Practice ${problem.title}. Core pattern: ${problem.corePattern || 'Algorithms'}. Asked by ${problem.companiesCount} companies.`,
  };
}

export default async function ProblemPage({ params }: PageProps) {
  const { id } = await params;
  const problem = getProblemById(id);

  if (!problem) {
    notFound();
  }

  const companyMappings = getCompanyMappingsForProblem(id);

  return <ProblemWorkspace problem={problem} companyMappings={companyMappings} />;
}
