import { getTranslations } from 'next-intl/server';
import { formatMoney } from '@/lib/currency';

export async function PaymentSummary({
  analytics,
  currency,
}: {
  analytics: any;
  currency?: 'RUB' | 'KZT';
}) {
  const t = await getTranslations('PaymentSummary');
  const expectedTotal = analytics.expected?.total ?? 0;
  const paidTotal = analytics.paid?.total ?? 0;
  const debt = analytics.debt ?? expectedTotal - paidTotal;

  return (
    <div className="rounded border p-4">
      <h2 className="mb-2 font-semibold">{t('title')}</h2>

      <div className="mb-2 text-sm text-gray-700">
        {t('pavilionsSummary', {
          total: analytics.pavilions.total,
          rented: analytics.pavilions.rented,
          prepaid: analytics.pavilions.prepaid ?? 0,
          free: analytics.pavilions.free,
        })}
      </div>

      <div>{t('expected', { amount: formatMoney(expectedTotal, currency) })}</div>
      <div>{t('paid', { amount: formatMoney(paidTotal, currency) })}</div>
      <div className="font-medium">{t('reconciliation', { amount: formatMoney(paidTotal - expectedTotal, currency) })}</div>
      <div className="text-sm text-gray-600">{t('debt', { amount: formatMoney(debt, currency) })}</div>
    </div>
  );
}
