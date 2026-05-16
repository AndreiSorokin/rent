import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, Building2, ChartColumnBig, ReceiptText, Store } from 'lucide-react';
import { seoSolutionPages } from './seoPages';

export const metadata: Metadata = {
  title: 'Решения для контроля торгового объекта | Rendlify',
  description:
    'Подборка страниц о том, как Rendlify помогает контролировать торговый объект, арендаторов, павильоны, доходы и расходы в реальном времени.',
  alternates: {
    canonical: '/solutions',
  },
};

const icons = [Building2, ReceiptText, Store, ChartColumnBig];

export default function SolutionsIndexPage() {
  return (
    <main className="min-h-screen bg-[#f9f5f0] text-[#111111]">
      <section className="mx-auto max-w-7xl px-6 py-12 md:px-10 md:py-16">
        <div className="max-w-4xl">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#6B6B6B]">
            Решения Rendlify
          </p>
          <h1 className="mt-3 text-4xl font-extrabold leading-tight md:text-5xl">
            Платформа под реальные задачи собственника и управляющего
          </h1>
          <p className="mt-5 text-base leading-7 text-[#4B5563] md:text-lg">
            Здесь собраны ключевые сценарии, по которым пользователи ищут систему вроде
            Rendlify: контроль торгового объекта, управление павильонами, арендаторами,
            платежами, доходами и расходами.
          </p>
        </div>

        <div className="mt-10 grid grid-cols-1 gap-5 md:grid-cols-2">
          {seoSolutionPages.map((page, index) => {
            const Icon = icons[index % icons.length];
            return (
              <article
                key={page.slug}
                className="rounded-[1.75rem] border border-[#D8D1CB] bg-white p-6 shadow-[0_8px_26px_rgba(0,0,0,0.05)]"
              >
                <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-[#F4EFEB] text-[#FF6A13]">
                  <Icon className="h-5 w-5" />
                </div>
                <h2 className="text-2xl font-bold">{page.shortTitle}</h2>
                <p className="mt-3 text-sm leading-6 text-[#4B5563]">{page.description}</p>
                <ul className="mt-4 space-y-2 text-sm text-[#374151]">
                  {page.capabilities.slice(0, 3).map((item) => (
                    <li key={item}>• {item}</li>
                  ))}
                </ul>
                <Link
                  href={`/solutions/${page.slug}`}
                  className="mt-6 inline-flex items-center gap-2 rounded-full bg-[#FF6A13] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#E65C00]"
                >
                  Перейти на страницу
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </article>
            );
          })}
        </div>
      </section>
    </main>
  );
}
