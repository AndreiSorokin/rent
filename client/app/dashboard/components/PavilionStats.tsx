// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function PavilionStats({ pavilions }: { pavilions: any[] }) {
  const total = pavilions.length;
  const rented = pavilions.filter((p) => p.status === 'RENTED').length;
  const prepaid = pavilions.filter((p) => p.status === 'PREPAID').length;
  const free = pavilions.filter((p) => p.status === 'AVAILABLE').length;

  return (
    <div className="grid grid-cols-4 gap-4">
      <div className="p-4 bg-white shadow rounded">Всего: {total}</div>
      <div className="p-4 bg-white shadow rounded">Занят: {rented}</div>
      <div className="p-4 bg-white shadow rounded">Предоплата: {prepaid}</div>
      <div className="p-4 bg-white shadow rounded">Свободен: {free}</div>
    </div>
  );
}
