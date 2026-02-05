'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { hasPermission } from '@/lib/permissions';
import { PavilionStats } from '@/app/dashboard/components/PavilionStats';
import { PaymentSummary } from '@/app/dashboard/components/PaymentSummary';
import { CreatePavilionModal } from '@/app/dashboard/components/CreatePavilionModal'; // ← import your modal (or create it)

export default function StorePage() {
  const params = useParams();
  const storeId = Number(params.storeId);

  const [store, setStore] = useState<any>(null);
  const [analytics, setAnalytics] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreatePavilionModal, setShowCreatePavilionModal] = useState(false);

  // Permissions — in real app you would fetch them from store or user context
  const permissions = store?.permissions || []; // fallback

  const fetchData = async () => {
    setLoading(true);
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

  useEffect(() => {
    if (storeId) fetchData();
  }, [storeId]);

  const handlePavilionCreated = () => {
    fetchData(); // refresh store data
    setShowCreatePavilionModal(false);
  };

  if (loading) return <div className="p-6 text-center text-lg">Загрузка...</div>;
  if (error) return <div className="p-6 text-center text-red-600">{error}</div>;
  if (!store) return <div className="p-6 text-center text-red-600">Магазин не найден</div>;

const getPaymentSummary = (pavilion: any) => {
  const monthlyExpected = (pavilion.squareMeters || 0) * (pavilion.pricePerSqM || 0);

  if (!pavilion.payments || pavilion.payments.length === 0) {
    return {
      text: `Нет платежей (ожидается ${monthlyExpected.toFixed(2)}$/мес)`,
      colorClass: 'text-amber-600',
    };
  }

  const totalPaid = pavilion.payments.reduce((sum: number, pay: any) => {
    return sum + (pay.rentPaid || 0) + (pay.utilitiesPaid || 0);
  }, 0);

  const difference = totalPaid - monthlyExpected;

  if (difference > 0) {
    return {
      text: `Переплата ${difference.toFixed(2)}$`,
      colorClass: 'text-green-600',
    };
  }

  if (difference < 0) {
    return {
      text: `Долг ${Math.abs(difference).toFixed(2)}$`,
      colorClass: 'text-red-600',
    };
  }

  return {
    text: 'Оплачено полностью',
    colorClass: 'text-gray-600',
  };
};
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto p-4 md:p-8 space-y-6 md:space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <Link href="/stores" className="text-blue-600 hover:underline text-sm md:text-base">
              ← Назад к магазинам
            </Link>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mt-2">
              {store.name}
            </h1>
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap gap-3">
            {hasPermission(permissions, 'CREATE_PAVILIONS') && (
              <button
                onClick={() => setShowCreatePavilionModal(true)}
                className="px-5 py-2.5 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 transition shadow-sm"
              >
                + Добавить павильон
              </button>
            )}
            {/* You can add here edit/delete store buttons later */}
          </div>
        </div>

        {/* Analytics & Stats */}
        {analytics && <PaymentSummary analytics={analytics} />}
        {store.pavilions && <PavilionStats pavilions={store.pavilions} />}

        {/* Pavilions list */}
        <div className="bg-white rounded-xl shadow p-6 md:p-8">
          <h2 className="text-xl md:text-2xl font-semibold mb-6">Павильоны</h2>

          {store.pavilions?.length === 0 ? (
            <p className="text-gray-600 text-center py-8">
              В магазине пока нет павильонов
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
              {store.pavilions?.map((p: any) => {
  const summary = getPaymentSummary(p);

  return (
    <Link
      key={p.id}
      href={`/stores/${storeId}/pavilions/${p.id}`}
      className="border rounded-lg p-5 md:p-6 bg-white shadow-sm hover:shadow-md transition-all duration-200 hover:-translate-y-1"
    >
      <h3 className="text-lg md:text-xl font-semibold mb-3">
        Павильон {p.number}
      </h3>
      <p className="text-sm text-gray-600 mb-2">
        Статус: <span className="font-medium">{p.status}</span>
      </p>
      <p className="text-sm text-gray-600 mb-3">
        Арендатор: {p.tenantName || 'Свободен'}
      </p>
      <p className={`text-base font-medium ${summary.colorClass}`}>
        {summary.text}
      </p>
    </Link>
  );
})}
            </div>
          )}
        </div>

        {/* Create Pavilion Modal */}
        {showCreatePavilionModal && (
          <CreatePavilionModal
            storeId={storeId}
            onClose={() => setShowCreatePavilionModal(false)}
            onSaved={handlePavilionCreated}
          />
        )}
      </div>
    </div>
  );
}