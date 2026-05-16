import type { Metadata } from 'next';
import { SolutionContent } from '../components/SolutionContent';
import { buildSolutionMetadata, seoSolutionPages } from '../seoPages';

const page = seoSolutionPages.find((item) => item.slug === 'tenant-payments');

export const metadata: Metadata = page
  ? buildSolutionMetadata(page)
  : { title: 'Арендаторы и платежи | Rendlify' };

export default function TenantPaymentsPage() {
  if (!page) return null;
  return <SolutionContent page={page} />;
}
