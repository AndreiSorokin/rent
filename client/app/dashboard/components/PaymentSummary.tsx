// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function PaymentSummary({ pavilions }: { pavilions: any[] }) {
  const expected = pavilions.reduce(
    (sum, p) => sum + p.pricePerSqM * p.squareMeters + (p.utilitiesAmount ?? 0),
    0
  );
  const paid = pavilions.reduce(
    (sum, p) => sum + (p.payments?.[0]?.rentPaid ?? 0) + (p.payments?.[0]?.utilitiesPaid ?? 0),
    0
  );

  return (
    <div className="p-4 bg-white shadow rounded mb-6">
      <h2 className="text-xl font-semibold mb-2">Payment Summary</h2>
      <div>Expected: ${expected}</div>
      <div>Paid: ${paid}</div>
      <div>Balance: ${expected - paid}</div>
    </div>
  );
}
