export function PaymentSummary({
  analytics,
}: {
  analytics: any;
}) {
  return (
    <div className="rounded border p-4">
      <h2 className="mb-2 font-semibold">Сводка</h2>

      <div className="mb-2 text-sm text-gray-700">
        Павильоны: всего {analytics.pavilions.total}, занято {analytics.pavilions.rented},
        предоплата {analytics.pavilions.prepaid ?? 0}, свободно {analytics.pavilions.free}
      </div>

      <div>Ожидается: {analytics.expected.total} рублей</div>
      {'discount' in analytics.expected && <div>Скидки: {analytics.expected.discount} рублей</div>}
      <div>Оплачено: {analytics.paid.total} рублей</div>
      <div className="font-medium">Схождение: {analytics.debt * -1} рублей</div>
    </div>
  );
}

