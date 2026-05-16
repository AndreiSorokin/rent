import type { Metadata } from 'next';
import { SolutionContent } from '../components/SolutionContent';
import { buildSolutionMetadata, seoSolutionPages } from '../seoPages';

const page = seoSolutionPages.find((item) => item.slug === 'pavilion-management');

export const metadata: Metadata = page
  ? buildSolutionMetadata(page)
  : { title: 'Управление павильонами | Rendlify' };

export default function PavilionManagementPage() {
  if (!page) return null;
  return <SolutionContent page={page} />;
}
