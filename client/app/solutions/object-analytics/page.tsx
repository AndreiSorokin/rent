import type { Metadata } from 'next';
import { SolutionContent } from '../components/SolutionContent';
import { buildSolutionMetadata, seoSolutionPages } from '../seoPages';

const page = seoSolutionPages.find((item) => item.slug === 'object-analytics');

export const metadata: Metadata = page
  ? buildSolutionMetadata(page)
  : { title: 'Доходы, расходы и прибыль | Rendlify' };

export default function ObjectAnalyticsPage() {
  if (!page) return null;
  return <SolutionContent page={page} />;
}
