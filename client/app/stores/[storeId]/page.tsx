'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { PavilionStats } from '@/app/dashboard/components/PavilionStats';
import { PaymentSummary } from '@/app/dashboard/components/PaymentSummary';

export default function StorePage() {
  const params = useParams();
  const storeId = Number(params.storeId);

  const [store, setStore] = useState<any>(null);
  const [analytics, setAnalytics] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!storeId) return;

    const loadData = async () => {
      try {
        const [storeData, analyticsData] = await Promise.all([
          apiFetch(`/stores/${storeId}`),
          apiFetch(`/stores/${storeId}/analytics`),
        ]);
        setStore(storeData);
        setAnalytics(analyticsData);
      } catch (err) {
        setError('Не удалось загрузить данные магазина');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [storeId]);

  if (loading) return <div className="p-6 text-center text-lg">Загрузка...</div>;
  if (error) return <div className="p-6 text-center text-red-600">{error}</div>;
  if (!store) return <div className="p-6 text-center text-red-600">Магазин не найден</div>;

  const getPaymentSummary = (pavilion: any) => {
    // Если у павильона нет своих аналитик, используем заглушку
    const expected = pavilion.expectedTotal || 0;
    const paid = pavilion.paidTotal || 0;
    const difference = paid - expected;
    if (difference > 0) return `Переплата ${difference}$`;
    if (difference < 0) return `Долг ${Math.abs(difference)}$`;
    return 'Оплачено';
  };

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-6xl mx-auto">
      <h1 className="text-2xl md:text-3xl font-bold text-center md:text-left">{store.name}</h1>

      {/* Общая аналитика магазина */}
      {analytics && <PaymentSummary analytics={analytics} />}

      {/* Статистика павильонов */}
      {store.pavilions && <PavilionStats pavilions={store.pavilions} />}

      <h2 className="text-xl md:text-2xl font-semibold mt-8">Павильоны</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
        {store.pavilions?.map((p: any) => (
          <Link
            key={p.id}
            href={`/stores/${storeId}/pavilions/${p.id}`}
            className="border rounded-lg p-4 md:p-6 bg-white shadow-sm hover:shadow-md transition-shadow"
          >
            <h3 className="text-lg md:text-xl font-semibold mb-2">
              Павильон {p.number}
            </h3>
            <p className="text-sm text-gray-600 mb-1">
              Статус: <span className="font-medium">{p.status}</span>
            </p>
            <p className="text-sm text-gray-600 mb-3">
              Арендатор: {p.tenantName || 'Свободен'}
            </p>
            <p className="text-sm md:text-base font-medium mt-2">
              {getPaymentSummary(p)}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}