import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { SolutionContent } from '../components/SolutionContent';
import { buildSolutionMetadata, getSeoSolutionPage, seoSolutionPages } from '../seoPages';

export function generateStaticParams() {
  return seoSolutionPages.map((page) => ({ slug: page.slug }));
}

export function generateMetadata({ params }: { params: { slug: string } }): Metadata {
  const page = getSeoSolutionPage(params.slug);
  if (!page) {
    return {
      title: 'Страница не найдена | Rendlify',
    };
  }
  return buildSolutionMetadata(page);
}

export default function SolutionDetailPage({ params }: { params: { slug: string } }) {
  const page = getSeoSolutionPage(params.slug);
  if (!page) notFound();
  return <SolutionContent page={page} />;
}
