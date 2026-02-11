import { formatMoney } from '@/lib/currency';

export function PaymentSummary({
  analytics,
  currency,
}: {
  analytics: any;
  currency?: 'RUB' | 'KZT';
}) {
  const expectedTotal = analytics.expected?.total ?? 0;
  const paidTotal = analytics.paid?.total ?? 0;
  const debt = analytics.debt ?? expectedTotal - paidTotal;

  return (
    <div className="rounded border p-4">
      <h2 className="mb-2 font-semibold">Сводка</h2>

      <div className="mb-2 text-sm text-gray-700">
        Павильоны: всего {analytics.pavilions.total}, занято {analytics.pavilions.rented},
        предоплата {analytics.pavilions.prepaid ?? 0}, свободно {analytics.pavilions.free}
      </div>

      <div>Ожидается: {formatMoney(expectedTotal, currency)}</div>
      <div>Оплачено: {formatMoney(paidTotal, currency)}</div>
      <div className="font-medium">Схождение: {formatMoney(paidTotal - expectedTotal, currency)}</div>
      <div className="text-sm text-gray-600">Долг: {formatMoney(debt, currency)}</div>
    </div>
  );
}
