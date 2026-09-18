import type { MetadataRoute } from 'next';
import { getProblems } from '@/lib/data/problems';
import { getCompanies } from '@/lib/data/companies';
import { companyToSlug } from '@/lib/utils/companySlug';

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = 'https://algojeet.app';
  const now = new Date();

  // ── Static routes ──────────────────────────────────────────────────────────
  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 1.0,
    },
    {
      url: `${baseUrl}/problems`,
      lastModified: now,
      changeFrequency: 'daily',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/companies`,
      lastModified: now,
      changeFrequency: 'daily',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/companies/compare`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/review`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.7,
    },
    {
      url: `${baseUrl}/profile`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.5,
    },
    {
      url: `${baseUrl}/privacy`,
      lastModified: now,
      changeFrequency: 'yearly',
      priority: 0.3,
    },
  ];

  // ── Company pages ──────────────────────────────────────────────────────────
  const companies = getCompanies();
  const companyRoutes: MetadataRoute.Sitemap = companies.map((c) => ({
    url: `${baseUrl}/companies/${companyToSlug(c.name)}`,
    lastModified: now,
    changeFrequency: 'weekly' as const,
    priority: 0.7,
  }));

  // ── Problem pages — top 500 by frequency ──────────────────────────────────
  const problems = getProblems().slice(0, 500);
  const problemRoutes: MetadataRoute.Sitemap = problems.map((p) => ({
    url: `${baseUrl}/problem/${p.id}`,
    lastModified: now,
    changeFrequency: 'monthly' as const,
    priority: 0.6,
  }));

  return [...staticRoutes, ...companyRoutes, ...problemRoutes];
}
