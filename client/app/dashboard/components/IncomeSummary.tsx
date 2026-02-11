export function IncomeSummary({
  analytics,
}: {
  analytics: any;
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

      <div>Прогнозные доходы: {forecastTotal} рублей</div>
      <div>Фактические доходы: {actualTotal} рублей</div>
      <div className="font-medium">Разница: {actualTotal - forecastTotal} рублей</div>
    </div>
  );
}
