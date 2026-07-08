import type { Metadata } from 'next';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import {
  BarChart3,
  Building2,
  FileClock,
  HandCoins,
  ShieldCheck,
  Store,
  Users,
} from 'lucide-react';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('HomePage.meta');

  return {
    title: t('title'),
    description: t('description'),
    keywords: t.raw('keywords'),
    alternates: {
      canonical: '/',
    },
    openGraph: {
      title: t('title'),
      description: t('ogDescription'),
      url: '/',
      siteName: 'Rendlify',
      type: 'website',
    },
  };
}

const featureIcons = [Building2, HandCoins, FileClock, BarChart3, Users, ShieldCheck];

export default async function HomePage() {
  const t = await getTranslations('HomePage');
  const features = t.raw('features') as { title: string; text: string }[];
  const stats = t.raw('stats') as { label: string; value: string }[];
  const solutionLinks = t.raw('solutionLinks') as { href: string; title: string; text: string }[];
  const faqItems = t.raw('faq.items') as { q: string; a: string }[];

  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqItems.map((item) => ({
      '@type': 'Question',
      name: item.q,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.a,
      },
    })),
  };

  const softwareSchema = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'Rendlify',
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web',
    description: t('meta.description'),
    offers: {
      '@type': 'Offer',
      url: 'https://rendlify.com/tariffs',
    },
  };

  return (
    <main className="min-h-screen bg-[#f9f5f0] text-[#111111]">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareSchema) }}
      />

      <section className="mx-auto max-w-7xl px-6 pb-12 pt-12 md:px-10 md:pt-16">
        <header className="mb-14 flex flex-col gap-5 md:mb-20 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="mb-2 text-lg font-semibold uppercase tracking-[0.2em] text-[#6B6B6B]">
              {t('hero.eyebrow')}
            </p>
            <h1 className="max-w-4xl text-4xl font-extrabold leading-tight md:text-5xl">
              {t('hero.title')}
            </h1>
            <p className="mt-5 max-w-3xl text-base text-[#4B5563] md:text-lg">
              {t('hero.description')}
            </p>
          </div>

          <div className="flex w-full flex-col gap-3 md:w-auto">
            <Link
              href="/register"
              className="inline-flex w-full items-center justify-center rounded-full bg-[#FF6A13] px-6 py-3 text-sm font-bold uppercase tracking-wide text-white transition hover:bg-[#E65C00] md:w-64"
            >
              {t('hero.ctaStart')}
            </Link>
            <Link
              href="/solutions"
              className="inline-flex w-full items-center justify-center rounded-full border border-[#D8D1CB] bg-white px-6 py-3 text-sm font-semibold text-[#111111] transition hover:bg-[#f4efeb] md:w-64"
            >
              {t('hero.ctaSolutions')}
            </Link>
            <Link
              href="/login"
              className="inline-flex w-full items-center justify-center rounded-full border border-[#D8D1CB] bg-[#F4EFEB] px-6 py-3 text-sm font-semibold text-[#374151] transition hover:bg-[#ede7e2] md:w-64"
            >
              {t('hero.ctaLogin')}
            </Link>
          </div>
        </header>

        <div className="mb-12 grid grid-cols-1 gap-4 md:grid-cols-3">
          {stats.map((stat) => (
            <div key={stat.label} className="rounded-2xl border border-[#D8D1CB] bg-white p-5 shadow-sm">
              <p className="text-xs uppercase tracking-widest text-[#6B6B6B]">{stat.label}</p>
              <p className="mt-2 text-xl font-bold">{stat.value}</p>
            </div>
          ))}
        </div>

        <section className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
          {features.map((feature, index) => {
            const Icon = featureIcons[index];
            return (
              <article
                key={feature.title}
                className="rounded-[1.75rem] border border-[#D8D1CB] bg-white p-6 shadow-[0_6px_24px_rgba(0,0,0,0.04)] transition hover:-translate-y-0.5 hover:shadow-[0_10px_28px_rgba(0,0,0,0.08)]"
              >
                <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-[#F4EFEB] text-[#FF6A13]">
                  <Icon className="h-5 w-5" />
                </div>
                <h2 className="mb-2 text-xl font-bold">{feature.title}</h2>
                <p className="text-sm leading-6 text-[#4B5563]">{feature.text}</p>
              </article>
            );
          })}
        </section>

        <section className="mt-12 rounded-[1.75rem] border border-[#D8D1CB] bg-white p-7 shadow-[0_6px_24px_rgba(0,0,0,0.04)]">
          <div className="flex items-start gap-3">
            <div className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#F4EFEB] text-[#FF6A13]">
              <Store className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-2xl font-extrabold md:text-3xl">
                {t('notOnlyAccounting.title')}
              </h2>
              <p className="mt-2 max-w-3xl text-sm text-[#4B5563] md:text-base">
                {t('notOnlyAccounting.text')}
              </p>
            </div>
          </div>
        </section>

        <section className="mt-12">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#6B6B6B]">
                {t('solutionsSection.eyebrow')}
              </p>
              <h2 className="mt-2 text-2xl font-extrabold md:text-3xl">
                {t('solutionsSection.title')}
              </h2>
            </div>
            <Link
              href="/solutions"
              className="text-sm font-semibold text-[#FF6A13] hover:text-[#E65C00]"
            >
              {t('solutionsSection.linkAll')}
            </Link>
          </div>
          <div className="mt-5 grid grid-cols-1 gap-5 md:grid-cols-2">
            {solutionLinks.map((item) => (
              <article
                key={item.href}
                className="rounded-[1.5rem] border border-[#D8D1CB] bg-white p-6 shadow-[0_6px_24px_rgba(0,0,0,0.04)]"
              >
                <h3 className="text-xl font-bold">{item.title}</h3>
                <p className="mt-2 text-sm leading-6 text-[#4B5563]">{item.text}</p>
                <Link
                  href={item.href}
                  className="mt-5 inline-flex items-center justify-center rounded-full border border-[#D8D1CB] bg-[#F4EFEB] px-4 py-2.5 text-sm font-semibold text-[#111111] transition hover:bg-[#ede7e2]"
                >
                  {t('solutionsSection.openPage')}
                </Link>
              </article>
            ))}
          </div>
        </section>

        <section className="mt-12 rounded-[1.75rem] border border-[#D8D1CB] bg-white p-7 shadow-[0_6px_24px_rgba(0,0,0,0.04)]">
          <h2 className="text-2xl font-extrabold md:text-3xl">{t('faq.title')}</h2>
          <div className="mt-5 space-y-3">
            {faqItems.map((item) => (
              <details
                key={item.q}
                className="rounded-xl border border-[#E5DED8] bg-[#F9F5F0] p-4"
              >
                <summary className="cursor-pointer list-none text-sm font-semibold text-[#111111]">
                  {item.q}
                </summary>
                <p className="mt-2 text-sm leading-6 text-[#4B5563]">{item.a}</p>
              </details>
            ))}
          </div>
        </section>
      </section>
    </main>
  );
}
