export function PaymentSummary({
  analytics,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  analytics: any;
}) {
  return (
    <div className="border rounded p-4">
      <h2 className="font-semibold mb-2">Сводка</h2>

      <div>Ожидается: {analytics.expected.total} рублей</div>
      {'discount' in analytics.expected && (
        <div>Скидки: {analytics.expected.discount} рублей</div>
      )}
      <div>Оплачено: {analytics.paid.total} рублей</div>
      <div className="font-medium">
        Схождение: {analytics.debt * -1} рублей
      </div>
    </div>
  );
}
