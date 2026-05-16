import type { Metadata } from 'next';
import { SolutionContent } from '../components/SolutionContent';
import { buildSolutionMetadata, seoSolutionPages } from '../seoPages';

const page = seoSolutionPages.find((item) => item.slug === 'trading-houses');

export const metadata: Metadata = page
  ? buildSolutionMetadata(page)
  : { title: 'Для торговых домов | Rendlify' };

export default function TradingHousesPage() {
  if (!page) return null;
  return <SolutionContent page={page} />;
}
