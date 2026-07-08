import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, Calculator, Receipt } from 'lucide-react';
import { getTranslations } from 'next-intl/server';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('TariffsPage.meta');
  return {
    title: t('title'),
    description: t('description'),
  };
}

const examples = [
  { occupied: 10, amount: '50 ₽' },
  { occupied: 50, amount: '250 ₽' },
  { occupied: 120, amount: '600 ₽' },
];

export default async function TariffsPage() {
  const t = await getTranslations('TariffsPage');

  return (
    <main className="min-h-screen bg-[#f9f5f0] text-[#111111]">
      <section className="mx-auto max-w-5xl px-6 pb-14 pt-12 md:px-10 md:pt-16">
        <div className="mb-8">
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-full border border-[#D8D1CB] bg-white px-4 py-2 text-sm font-semibold text-[#374151] transition hover:bg-[#f4efeb]"
          >
            <ArrowLeft className="h-4 w-4" />
            {t('backHome')}
          </Link>
        </div>

        <div className="rounded-[2rem] border border-[#D8D1CB] bg-white p-7 shadow-[0_8px_30px_rgba(0,0,0,0.04)] md:p-10">
          <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="mb-2 text-sm font-semibold uppercase tracking-[0.18em] text-[#6B6B6B]">
                {t('eyebrow')}
              </p>
              <h1 className="text-3xl font-extrabold leading-tight md:text-5xl">
                {t('title')}
              </h1>
              <p className="mt-4 max-w-3xl text-base leading-7 text-[#4B5563]">
                {t('descriptionPrefix')}{' '}
                <span className="font-semibold text-[#111111]">{t('descriptionArea')}</span>{' '}
                {t('descriptionAnd')}{' '}
                <span className="font-semibold text-[#111111]">{t('descriptionRate')}</span>.
              </p>
            </div>

            <div className="flex gap-3">
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-[#F4EFEB] text-[#FF6A13]">
                <Calculator className="h-6 w-6" />
              </div>
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-[#F4EFEB] text-[#111111]">
                <Receipt className="h-6 w-6" />
              </div>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-[#E5DED8] bg-[#F9F5F0] p-5">
              <p className="text-xs uppercase tracking-[0.16em] text-[#6B6B6B]">{t('modelLabel')}</p>
              <p className="mt-2 text-sm font-semibold text-[#111111]">{t('modelValue')}</p>
            </div>
            <div className="rounded-2xl border border-[#E5DED8] bg-[#F9F5F0] p-5">
              <p className="text-xs uppercase tracking-[0.16em] text-[#6B6B6B]">{t('rateLabel')}</p>
              <p className="mt-2 text-sm font-semibold text-[#111111]">{t('rateValue')}</p>
            </div>
            <div className="rounded-2xl border border-[#E5DED8] bg-[#F9F5F0] p-5">
              <p className="text-xs uppercase tracking-[0.16em] text-[#6B6B6B]">{t('statusLabel')}</p>
              <p className="mt-2 text-sm font-semibold text-[#111111]">{t('statusValue')}</p>
            </div>
          </div>

          <div className="mt-6 rounded-[1.5rem] border border-[#E5DED8] bg-[#FFF8F2] p-6">
            <p className="text-sm font-semibold uppercase tracking-[0.14em] text-[#6B6B6B]">
              {t('formulaLabel')}
            </p>
            <div className="mt-4 space-y-4">
              <div className="rounded-2xl border border-[#F1D7C3] bg-white px-5 py-4 text-lg font-extrabold text-[#111111] md:text-2xl">
                {t('formula')}
              </div>
              <p className="text-sm leading-7 text-[#4B5563]">
                {t('formulaNotePrefix')}{' '}
                <span className="font-semibold text-[#111111]">{t('formulaNoteStatus')}</span>.{' '}
                {t('formulaNoteSuffix')}
              </p>
            </div>
          </div>

          <section className="mt-8 rounded-[1.5rem] border border-[#E5DED8] bg-white p-6 md:p-8">
            <div className="mb-5 border-b border-[#EFE7E1] pb-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#6B6B6B]">
                {t('examplesLabel')}
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              {examples.map((example) => (
                <div
                  key={example.occupied}
                  className="rounded-2xl border border-[#EAE1D9] bg-[#F9F5F0] p-5"
                >
                  <p className="text-sm text-[#6B6B6B]">{t('occupiedAreaLabel')}</p>
                  <p className="mt-2 text-3xl font-extrabold text-[#111111]">
                    {example.occupied} м²
                  </p>
                  <p className="mt-4 text-sm text-[#6B6B6B]">{t('monthlyCostLabel')}</p>
                  <p className="mt-2 text-xl font-bold text-[#FF6A13]">{example.amount}</p>
                </div>
              ))}
            </div>
          </section>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/offer"
              className="rounded-full border border-[#d8d1cb] bg-white px-5 py-2.5 text-sm font-semibold text-[#111111] transition hover:bg-[#f4efeb]"
            >
              {t('offer')}
            </Link>
            <Link
              href="/user-agreement"
              className="rounded-full border border-[#d8d1cb] bg-white px-5 py-2.5 text-sm font-semibold text-[#111111] transition hover:bg-[#f4efeb]"
            >
              {t('userAgreement')}
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
