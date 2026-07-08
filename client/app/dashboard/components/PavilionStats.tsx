import { getTranslations } from 'next-intl/server';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function PavilionStats({ pavilions }: { pavilions: any[] }) {
  const t = await getTranslations('PavilionStats');
  const total = pavilions.length;
  const rented = pavilions.filter((p) => p.status === 'RENTED').length;
  const prepaid = pavilions.filter((p) => p.status === 'PREPAID').length;
  const free = pavilions.filter((p) => p.status === 'AVAILABLE').length;

  return (
    <div className="grid grid-cols-4 gap-4">
      <div className="p-4 bg-white shadow rounded">{t('total', { count: total })}</div>
      <div className="p-4 bg-white shadow rounded">{t('rented', { count: rented })}</div>
      <div className="p-4 bg-white shadow rounded">{t('prepaid', { count: prepaid })}</div>
      <div className="p-4 bg-white shadow rounded">{t('free', { count: free })}</div>
    </div>
  );
}
