import { getTranslations } from 'next-intl/server';
import { formatMoney } from '@/lib/currency';

export async function IncomeSummary({
  analytics,
  currency,
}: {
  analytics: any;
  currency?: 'RUB' | 'KZT';
}) {
  const t = await getTranslations('IncomeSummary');
  const forecast = analytics.income?.forecast;
  const actual = analytics.income?.actual;

  const forecastTotal = forecast?.total ?? 0;
  const actualTotal = actual?.total ?? 0;

  return (
    <div className="rounded border p-4">
      <h2 className="mb-2 font-semibold">{t('title')}</h2>

      <div className="mb-2 text-sm text-gray-700">{t('formula')}</div>
      <div>{t('forecast', { amount: formatMoney(forecastTotal, currency) })}</div>
      <div>{t('actual', { amount: formatMoney(actualTotal, currency) })}</div>
    </div>
  );
}
