import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getCompanies, getCompanyBySlug, getCompanyProblems } from '@/lib/data/companies';
import { companyToSlug } from '@/lib/utils/companySlug';
import CompanyDetailView from '@/components/companies/CompanyDetailView';

interface PageProps {
  params: Promise<{ slug: string }>;
}

export const revalidate = 86400; // 24h ISR

export async function generateStaticParams() {
  const companies = getCompanies();
  return companies.map((c) => ({
    slug: companyToSlug(c.name),
  }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const company = getCompanyBySlug(slug);

  if (!company) {
    return {
      title: 'Company Not Found — AlgoJeet Pro',
    };
  }

  return {
    title: `${company.name} LeetCode Interview Questions (${company.questionCount.toLocaleString()}) — AlgoJeet Pro`,
    description: `Master ${company.name}'s verified LeetCode question distribution. View ${company.questionCount} interview questions ranked by frequency.`,
    openGraph: {
      title: `${company.name} LeetCode Interview Questions (${company.questionCount.toLocaleString()}) — AlgoJeet Pro`,
      description: `Master ${company.name}'s verified LeetCode question distribution. View ${company.questionCount} interview questions ranked by frequency.`,
      type: 'website',
    },
  };
}

export default async function CompanyDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const company = getCompanyBySlug(slug);

  if (!company) {
    notFound();
  }

  const problems = getCompanyProblems(company.name);

  return <CompanyDetailView company={company} problems={problems} />;
}
