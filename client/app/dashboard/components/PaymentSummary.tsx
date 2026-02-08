export function PaymentSummary({
  analytics,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  analytics: any;
}) {
  return (
    <div className="border rounded p-4">
      <h2 className="font-semibold mb-2">Payment Summary</h2>

      <div>Expected: ${analytics.expected.total}</div>
      {'discount' in analytics.expected && (
        <div>Discounts: -${analytics.expected.discount}</div>
      )}
      <div>Paid: ${analytics.paid.total}</div>
      <div className="font-medium">
        Balance: ${analytics.debt}
      </div>
    </div>
  );
}
