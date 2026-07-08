import { getTranslations } from 'next-intl/server';
import { formatMoney } from '@/lib/currency';

export async function ExpensesSummary({
  analytics,
  currency,
}: {
  analytics: any;
  currency?: 'RUB' | 'KZT';
}) {
  const t = await getTranslations('ExpensesSummary');
  const forecastTotal = analytics?.expenses?.total?.forecast ?? 0;
  const actualTotal = analytics?.expenses?.total?.actual ?? 0;

  return (
    <div className="rounded border p-4">
      <h2 className="mb-2 font-semibold">{t('title')}</h2>
      <div className="text-sm text-gray-700">{t('description')}</div>
      <div className="mt-2">{t('forecast', { amount: formatMoney(forecastTotal, currency) })}</div>
      <div>{t('actual', { amount: formatMoney(actualTotal, currency) })}</div>
    </div>
  );
}
