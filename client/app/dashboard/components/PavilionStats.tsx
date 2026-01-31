// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function PavilionStats({ pavilions }: { pavilions: any[] }) {
  const total = pavilions.length;
  const rented = pavilions.filter(
    (p) => p.status === 'RENTED',
  ).length;
  const free = total - rented;

  return (
    <div className="grid grid-cols-3 gap-4">
      <div className="p-4 bg-white shadow rounded">Total: {total}</div>
      <div className="p-4 bg-white shadow rounded">Rented: {rented}</div>
      <div className="p-4 bg-white shadow rounded">Available: {free}</div>
    </div>
  );
}
