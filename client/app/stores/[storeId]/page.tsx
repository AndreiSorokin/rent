'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { hasPermission } from '@/lib/permissions';
import { PaymentSummary } from '@/app/dashboard/components/PaymentSummary';
import { IncomeSummary } from '@/app/dashboard/components/IncomeSummary';
import { ExpensesSummary } from '@/app/dashboard/components/ExpensesSummary';
import { CreatePavilionModal } from '@/app/dashboard/components/CreatePavilionModal';
import { InviteUserModal } from '@/app/dashboard/components/InviteUserModal';
import { StoreUsersSection } from '@/app/dashboard/components/StoreUsersSection';

export default function StorePage() {
  const params = useParams();
  const storeId = Number(params.storeId);

  const [store, setStore] = useState<any>(null);
  const [analytics, setAnalytics] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreatePavilionModal, setShowCreatePavilionModal] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);

  const statusLabel: Record<string, string> = {
    AVAILABLE: 'СВОБОДЕН',
    RENTED: 'ЗАНЯТ',
    PREPAID: 'ПРЕДОПЛАТА',
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const storeData = await apiFetch(`/stores/${storeId}`);

      let analyticsData = null;
      if (hasPermission(storeData.permissions || [], 'VIEW_PAYMENTS')) {
        analyticsData = await apiFetch(`/stores/${storeId}/analytics`);
      }

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
    fetchData();
    setShowCreatePavilionModal(false);
  };

  if (loading) return <div className="p-6 text-center text-lg">Загрузка...</div>;
  if (error) return <div className="p-6 text-center text-red-600">{error}</div>;
  if (!store) return <div className="p-6 text-center text-red-600">Магазин не найден</div>;

  const permissions = store.permissions || [];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-6xl space-y-6 p-4 md:space-y-8 md:p-8">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div>
            <Link href="/dashboard" className="text-sm text-blue-600 hover:underline md:text-base">
              Назад к магазинам
            </Link>
            <h1 className="mt-2 text-2xl font-bold text-gray-900 md:text-3xl">{store.name}</h1>
          </div>

          <div className="flex flex-wrap gap-3">
            {hasPermission(permissions, 'CREATE_PAVILIONS') && (
              <button
                onClick={() => setShowCreatePavilionModal(true)}
                className="rounded-lg bg-green-600 px-5 py-2.5 font-medium text-white shadow-sm transition hover:bg-green-700"
              >
                + Добавить павильон
              </button>
            )}
          </div>
        </div>

        <div className="rounded-xl bg-white p-6 shadow md:p-8">
          <h2 className="mb-6 text-xl font-semibold md:text-2xl">Пользователи и права</h2>
          <StoreUsersSection
            storeId={storeId}
            permissions={permissions}
            onUsersChanged={() => {
              // no-op
            }}
          />
        </div>

        {hasPermission(permissions, 'VIEW_PAYMENTS') ? (
          <>
            {analytics && (
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                <PaymentSummary analytics={analytics} />
                <IncomeSummary analytics={analytics} />
                <ExpensesSummary analytics={analytics} />
              </div>
            )}
          </>
        ) : (
          <div className="rounded-xl bg-white p-6 text-center text-gray-600 shadow">
            Здесь вы можете найти все павильоны, принадлежащие этому магазину
          </div>
        )}

        <div className="rounded-xl bg-white p-6 shadow md:p-8">
          <h2 className="mb-6 text-xl font-semibold md:text-2xl">Павильоны</h2>

          {store.pavilions?.length === 0 ? (
            <p className="py-8 text-center text-gray-600">В магазине пока нет павильонов</p>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:gap-6 lg:grid-cols-3">
              {store.pavilions.map((p: any) => (
                <Link
                  key={p.id}
                  href={`/stores/${storeId}/pavilions/${p.id}`}
                  className="rounded-lg border bg-white p-5 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-md md:p-6"
                >
                  <h3 className="mb-3 text-lg font-semibold md:text-xl">Павильон {p.number}</h3>
                  <p className="mb-2 text-sm text-gray-600">
                    Статус: <span className="font-medium">{statusLabel[p.status] ?? p.status}</span>
                  </p>
                  <p className="mb-3 text-sm text-gray-600">Арендатор: {p.tenantName || 'Свободен'}</p>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {showCreatePavilionModal && (
        <CreatePavilionModal
          storeId={storeId}
          onClose={() => setShowCreatePavilionModal(false)}
          onSaved={handlePavilionCreated}
        />
      )}

      {showInviteModal && (
        <InviteUserModal
          storeId={storeId}
          onClose={() => setShowInviteModal(false)}
          onSuccess={() => fetchData()}
        />
      )}
    </div>
  );
}
