'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { getCurrencySymbol } from '@/lib/currency';
import { hasPermission } from '@/lib/permissions';
import { PaymentSummary } from '@/app/dashboard/components/PaymentSummary';
import { IncomeSummary } from '@/app/dashboard/components/IncomeSummary';
import { ExpensesSummary } from '@/app/dashboard/components/ExpensesSummary';
import { CreatePavilionModal } from '@/app/dashboard/components/CreatePavilionModal';
import { InviteUserModal } from '@/app/dashboard/components/InviteUserModal';
import { StoreUsersSection } from '@/app/dashboard/components/StoreUsersSection';

export default function StorePage() {
  const params = useParams();
  const router = useRouter();
  const storeId = Number(params.storeId);

  const [store, setStore] = useState<any>(null);
  const [analytics, setAnalytics] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreatePavilionModal, setShowCreatePavilionModal] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [currencyUpdating, setCurrencyUpdating] = useState(false);
  const [staffFullName, setStaffFullName] = useState('');
  const [staffPosition, setStaffPosition] = useState('');
  const [staffSaving, setStaffSaving] = useState(false);

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

  const handleCurrencyChange = async (currency: 'RUB' | 'KZT') => {
    try {
      setCurrencyUpdating(true);
      await apiFetch(`/stores/${storeId}/currency`, {
        method: 'PATCH',
        body: JSON.stringify({ currency }),
      });
      await fetchData();
    } catch (err) {
      console.error(err);
      alert('Не удалось изменить валюту');
    } finally {
      setCurrencyUpdating(false);
    }
  };

  const handleAddStaff = async () => {
    if (!staffFullName.trim() || !staffPosition.trim()) {
      alert('Заполните поля "Имя фамилия" и "Должность"');
      return;
    }

    try {
      setStaffSaving(true);
      await apiFetch(`/stores/${storeId}/staff`, {
        method: 'POST',
        body: JSON.stringify({
          fullName: staffFullName.trim(),
          position: staffPosition.trim(),
        }),
      });
      setStaffFullName('');
      setStaffPosition('');
      await fetchData();
    } catch (err) {
      console.error(err);
      alert('Не удалось добавить сотрудника');
    } finally {
      setStaffSaving(false);
    }
  };

  const handleDeleteStaff = async (staffId: number) => {
    if (!confirm('Удалить сотрудника из таблицы?')) return;

    try {
      await apiFetch(`/stores/${storeId}/staff/${staffId}`, {
        method: 'DELETE',
      });
      await fetchData();
    } catch (err) {
      console.error(err);
      alert('Не удалось удалить сотрудника');
    }
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
            <p className="mt-1 text-sm text-gray-600">
              Валюта магазина: {store.currency} ({getCurrencySymbol(store.currency)})
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            {hasPermission(permissions, 'ASSIGN_PERMISSIONS') && (
              <select
                value={store.currency ?? 'RUB'}
                onChange={(e) => handleCurrencyChange(e.target.value as 'RUB' | 'KZT')}
                disabled={currencyUpdating}
                className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
              >
                <option value="RUB">Российский рубль (₽)</option>
                <option value="KZT">Казахстанский тенге (₸)</option>
              </select>
            )}
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

        {hasPermission(permissions, 'VIEW_PAYMENTS') ? (
          <>
            {analytics && (
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                <PaymentSummary analytics={analytics} currency={store.currency} />
                <IncomeSummary analytics={analytics} currency={store.currency} />
                <ExpensesSummary analytics={analytics} currency={store.currency} />
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
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                      Павильон
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                      Статус
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                      Арендатор
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {store.pavilions.map((p: any) => (
                    <tr
                      key={p.id}
                      className="cursor-pointer transition-colors hover:bg-gray-50"
                      onClick={() => router.push(`/stores/${storeId}/pavilions/${p.id}`)}
                    >
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">
                        Павильон {p.number}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        {statusLabel[p.status] ?? p.status}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        {p.tenantName || 'Свободен'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="rounded-xl bg-white p-6 shadow md:p-8">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-semibold md:text-2xl">Сотрудники</h2>
          </div>

          {hasPermission(permissions, 'ASSIGN_PERMISSIONS') && (
            <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-[1fr_1fr_auto]">
              <input
                type="text"
                value={staffPosition}
                onChange={(e) => setStaffPosition(e.target.value)}
                className="rounded-lg border border-gray-300 px-3 py-2"
                placeholder="Должность"
              />
              <input
                type="text"
                value={staffFullName}
                onChange={(e) => setStaffFullName(e.target.value)}
                className="rounded-lg border border-gray-300 px-3 py-2"
                placeholder="Имя фамилия"
              />
              <button
                onClick={handleAddStaff}
                disabled={staffSaving}
                className="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-60"
              >
                Добавить
              </button>
            </div>
          )}

          {!store.staff || store.staff.length === 0 ? (
            <p className="text-gray-600">Список сотрудников пуст</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                      Должность
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                      Имя фамилия
                    </th>
                    {hasPermission(permissions, 'ASSIGN_PERMISSIONS') && (
                      <th className="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500">
                        Действия
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {store.staff.map((staff: any) => (
                    <tr key={staff.id}>
                      <td className="px-4 py-3 text-sm">{staff.position}</td>
                      <td className="px-4 py-3 text-sm">{staff.fullName}</td>
                      {hasPermission(permissions, 'ASSIGN_PERMISSIONS') && (
                        <td className="px-4 py-3 text-right text-sm">
                          <button
                            onClick={() => handleDeleteStaff(staff.id)}
                            className="text-red-600 hover:underline"
                          >
                            Удалить
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
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
