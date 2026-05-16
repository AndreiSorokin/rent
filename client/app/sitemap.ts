import type { MetadataRoute } from 'next';
import { seoSolutionPages } from './solutions/seoPages';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://rendlify.com';

export default function sitemap(): MetadataRoute.Sitemap {
  const marketingPages = [
    '/',
    '/solutions',
    '/tariffs',
    '/privacy',
    '/offer',
    '/user-agreement',
    '/content-rules',
    '/operator',
    '/cookies',
    '/site-consent',
  ];

  return [
    ...marketingPages.map((path, index) => ({
      url: `${SITE_URL}${path}`,
      lastModified: new Date(),
      changeFrequency: path === '/' ? ('weekly' as const) : ('monthly' as const),
      priority: path === '/' ? 1 : index < 3 ? 0.9 : 0.6,
    })),
    ...seoSolutionPages.map((page) => ({
      url: `${SITE_URL}/solutions/${page.slug}`,
      lastModified: new Date(),
      changeFrequency: 'monthly' as const,
      priority: 0.8,
    })),
  ];
}
