export function PaymentSummary({
  analytics,
}: {
  analytics: any;
}) {
  const forecastTotal = analytics.forecastIncome?.total ?? analytics.expected?.total ?? 0;
  const actualTotal = analytics.actualIncome?.total ?? analytics.paid?.total ?? 0;

  return (
    <div className="rounded border p-4">
      <h2 className="mb-2 font-semibold">Сводка</h2>

      <div className="mb-2 text-sm text-gray-700">
        Павильоны: всего {analytics.pavilions.total}, занято {analytics.pavilions.rented},
        предоплата {analytics.pavilions.prepaid ?? 0}, свободно {analytics.pavilions.free}
      </div>

      <div>Прогнозные доходы: {forecastTotal} рублей</div>
      <div>Фактические доходы: {actualTotal} рублей</div>
      <div className="font-medium">Разница: {actualTotal - forecastTotal} рублей</div>
    </div>
  );
}
