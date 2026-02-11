import { formatMoney } from '@/lib/currency';

export function IncomeSummary({
  analytics,
  currency,
}: {
  analytics: any;
  currency?: 'RUB' | 'KZT';
}) {
  const forecast = analytics.income?.forecast;
  const actual = analytics.income?.actual;

  const forecastTotal = forecast?.total ?? 0;
  const actualTotal = actual?.total ?? 0;

  return (
    <div className="rounded border p-4">
      <h2 className="mb-2 font-semibold">Доходы</h2>

      <div className="mb-2 text-sm text-gray-700">
        Формула: аренда + коммуналка + доп. начисления (по всем павильонам)
      </div>
      <div>Прогнозные доходы: {formatMoney(forecastTotal, currency)}</div>
      <div>Фактические доходы: {formatMoney(actualTotal, currency)}</div>
    </div>
  );
}
