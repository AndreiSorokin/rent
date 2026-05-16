import Link from 'next/link';
import { ArrowRight, BarChart3, Building2, ReceiptText, ShieldCheck } from 'lucide-react';
import type { SeoSolutionPage } from '../seoPages';

export function SolutionContent({ page }: { page: SeoSolutionPage }) {
  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: page.faq.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.answer,
      },
    })),
  };

  return (
    <main className="min-h-screen bg-[#f9f5f0] text-[#111111]">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />

      <section className="mx-auto max-w-7xl px-6 py-12 md:px-10 md:py-16">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1.35fr_0.9fr]">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#6B6B6B]">
              Решение Rendlify
            </p>
            <h1 className="mt-3 max-w-4xl text-4xl font-extrabold leading-tight md:text-5xl">
              {page.h1}
            </h1>
            <p className="mt-5 max-w-3xl text-base leading-7 text-[#4B5563] md:text-lg">
              {page.intro}
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/register"
                className="inline-flex items-center justify-center rounded-full bg-[#FF6A13] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#E65C00]"
              >
                Попробовать Rendlify
              </Link>
              <Link
                href="/solutions"
                className="inline-flex items-center justify-center rounded-full border border-[#D8D1CB] bg-white px-5 py-3 text-sm font-semibold text-[#111111] transition hover:bg-[#f4efeb]"
              >
                Все решения
              </Link>
            </div>
          </div>

          <aside className="rounded-[1.75rem] border border-[#D8D1CB] bg-white p-6 shadow-[0_8px_26px_rgba(0,0,0,0.05)]">
            <h2 className="text-xl font-bold">Кому подойдет</h2>
            <ul className="mt-4 space-y-3 text-sm leading-6 text-[#374151]">
              {page.audience.map((item) => (
                <li key={item} className="rounded-xl bg-[#F9F5F0] px-4 py-3">
                  {item}
                </li>
              ))}
            </ul>
            <div className="mt-6 rounded-2xl border border-[#E5DED8] bg-[#F4EFEB] p-4 text-sm text-[#374151]">
              <p className="font-semibold text-[#111111]">Упрощает</p>
              <p className="mt-2 leading-6">{page.keywords.join(' • ')}</p>
            </div>
          </aside>
        </div>

        <section className="mt-10 grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
          {[
            { icon: Building2, title: 'Объект', text: 'Собирает данные по объекту в одном месте.' },
            { icon: ReceiptText, title: 'Платежи', text: 'Помогает видеть начисления, оплаты и долги.' },
            { icon: BarChart3, title: 'Сводка', text: 'Показывает доходы, расходы и прибыль на одном экране.' },
            { icon: ShieldCheck, title: 'Контроль', text: 'Дает прозрачность по действиям и правам доступа.' },
          ].map((item) => (
            <article
              key={item.title}
              className="rounded-[1.5rem] border border-[#D8D1CB] bg-white p-5 shadow-[0_8px_26px_rgba(0,0,0,0.04)]"
            >
              <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-[#F4EFEB] text-[#FF6A13]">
                <item.icon className="h-5 w-5" />
              </div>
              <h2 className="text-lg font-bold">{item.title}</h2>
              <p className="mt-2 text-sm leading-6 text-[#4B5563]">{item.text}</p>
            </article>
          ))}
        </section>

        <section className="mt-12 grid grid-cols-1 gap-6 lg:grid-cols-2">
          <article className="rounded-[1.75rem] border border-[#D8D1CB] bg-white p-7 shadow-[0_8px_26px_rgba(0,0,0,0.05)]">
            <h2 className="text-2xl font-extrabold">Что получает управляющий</h2>
            <ul className="mt-5 space-y-3 text-sm leading-6 text-[#374151]">
              {page.benefits.map((item) => (
                <li key={item} className="rounded-xl bg-[#F9F5F0] px-4 py-3">
                  {item}
                </li>
              ))}
            </ul>
          </article>

          <article className="rounded-[1.75rem] border border-[#D8D1CB] bg-white p-7 shadow-[0_8px_26px_rgba(0,0,0,0.05)]">
            <h2 className="text-2xl font-extrabold">Что можно контролировать в системе</h2>
            <ul className="mt-5 space-y-3 text-sm leading-6 text-[#374151]">
              {page.capabilities.map((item) => (
                <li key={item} className="rounded-xl bg-[#F9F5F0] px-4 py-3">
                  {item}
                </li>
              ))}
            </ul>
          </article>
        </section>

        <section className="mt-12 rounded-[1.75rem] border border-[#D8D1CB] bg-white p-7 shadow-[0_8px_26px_rgba(0,0,0,0.05)]">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <h2 className="text-2xl font-extrabold">Частые вопросы</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-[#4B5563]">
                Ниже ответы на вопросы, которые часто возникают у собственников и управляющих,
                когда они выбирают систему контроля торгового объекта.
              </p>
            </div>
            <Link
              href="/"
              className="inline-flex items-center gap-2 text-sm font-semibold text-[#FF6A13] hover:text-[#E65C00]"
            >
              На главную
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="mt-5 space-y-3">
            {page.faq.map((item) => (
              <details
                key={item.question}
                className="rounded-xl border border-[#E5DED8] bg-[#F9F5F0] p-4"
              >
                <summary className="cursor-pointer list-none text-sm font-semibold text-[#111111]">
                  {item.question}
                </summary>
                <p className="mt-2 text-sm leading-6 text-[#4B5563]">{item.answer}</p>
              </details>
            ))}
          </div>
        </section>
      </section>
    </main>
  );
}
