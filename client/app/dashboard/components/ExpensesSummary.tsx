import { formatMoney } from '@/lib/currency';

export function ExpensesSummary({
  analytics,
  currency,
}: {
  analytics: any;
  currency?: 'RUB' | 'KZT';
}) {
  const forecastTotal = analytics?.expenses?.total?.forecast ?? 0;
  const actualTotal = analytics?.expenses?.total?.actual ?? 0;

  return (
    <div className="rounded border p-4">
      <h2 className="mb-2 font-semibold">Расходы</h2>
      <div className="text-sm text-gray-700">
        Сумма по всем павильонам из таблиц расходов на страницах павильонов
      </div>
      <div className="mt-2">Итого прогноз: {formatMoney(forecastTotal, currency)}</div>
      <div>Итого факт: {formatMoney(actualTotal, currency)}</div>
    </div>
  );
}
