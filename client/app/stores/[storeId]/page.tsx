'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { formatMoney, getCurrencySymbol } from '@/lib/currency';
import { hasPermission } from '@/lib/permissions';
import { CreatePavilionModal } from '@/app/dashboard/components/CreatePavilionModal';
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
  const [currencyUpdating, setCurrencyUpdating] = useState(false);
  const [staffFullName, setStaffFullName] = useState('');
  const [staffPosition, setStaffPosition] = useState('');
  const [staffSaving, setStaffSaving] = useState(false);
  const [accountingRows, setAccountingRows] = useState<any[]>([]);
  const [accountingDate, setAccountingDate] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [accountingBank, setAccountingBank] = useState('');
  const [accountingCash1, setAccountingCash1] = useState('');
  const [accountingCash2, setAccountingCash2] = useState('');
  const [accountingSaving, setAccountingSaving] = useState(false);
  const [pavilionSearch, setPavilionSearch] = useState('');
  const [pavilionCategoryFilter, setPavilionCategoryFilter] = useState('');

  const statusLabel: Record<string, string> = {
    AVAILABLE: 'СВОБОДЕН',
    RENTED: 'ЗАНЯТ',
    PREPAID: 'ПРЕДОПЛАТА',
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const storeData = await apiFetch(`/stores/${storeId}`);

      if (hasPermission(storeData.permissions || [], 'VIEW_PAYMENTS')) {
        const analyticsData = await apiFetch<any>(`/stores/${storeId}/analytics`);
        const accountingData = await apiFetch<any[]>(
          `/stores/${storeId}/accounting-table`,
        );
        setAnalytics(analyticsData);
        setAccountingRows(accountingData || []);
      } else {
        setAnalytics(null);
        setAccountingRows([]);
      }

      setStore(storeData);
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

  const handleCreateAccountingRecord = async () => {
    const bank = accountingBank ? Number(accountingBank) : 0;
    const cash1 = accountingCash1 ? Number(accountingCash1) : 0;
    const cash2 = accountingCash2 ? Number(accountingCash2) : 0;

    if (bank < 0 || cash1 < 0 || cash2 < 0) {
      alert('Суммы не могут быть отрицательными');
      return;
    }

    try {
      setAccountingSaving(true);
      await apiFetch(`/stores/${storeId}/accounting-table`, {
        method: 'POST',
        body: JSON.stringify({
          recordDate: accountingDate,
          bankTransferPaid: bank,
          cashbox1Paid: cash1,
          cashbox2Paid: cash2,
        }),
      });
      setAccountingBank('');
      setAccountingCash1('');
      setAccountingCash2('');
      await fetchData();
    } catch (err) {
      console.error(err);
      alert('Не удалось добавить запись в бух. таблицу');
    } finally {
      setAccountingSaving(false);
    }
  };

  const handleDeleteAccountingRecord = async (recordId: number) => {
    if (!confirm('Удалить эту запись из бух. таблицы?')) return;

    try {
      await apiFetch(`/stores/${storeId}/accounting-table/${recordId}`, {
        method: 'DELETE',
      });
      await fetchData();
    } catch (err) {
      console.error(err);
      alert('Не удалось удалить запись');
    }
  };

  if (loading) return <div className="p-6 text-center text-lg">Загрузка...</div>;
  if (error) return <div className="p-6 text-center text-red-600">{error}</div>;
  if (!store) return <div className="p-6 text-center text-red-600">Магазин не найден</div>;

  const permissions = store.permissions || [];
  const allCategories: string[] = Array.from(
    new Set<string>(
      (store.pavilions || [])
        .map((p: any) => (p.category || '').trim())
        .filter((category: string) => category.length > 0),
    ),
  ).sort((a: string, b: string) => a.localeCompare(b));
  const filteredPavilions = (store.pavilions || []).filter((p: any) => {
    const byName = p.number
      ?.toString()
      .toLowerCase()
      .includes(pavilionSearch.toLowerCase());
    const byCategory = pavilionCategoryFilter
      ? (p.category || '') === pavilionCategoryFilter
      : true;
    return byName && byCategory;
  });

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

        {hasPermission(permissions, 'VIEW_PAYMENTS') && (
          <div className="rounded-xl bg-white p-6 shadow md:p-8">
            <h2 className="mb-4 text-xl font-semibold md:text-2xl">СВОДКА</h2>
            <p className="mb-4 text-gray-600">
              Основные финансовые показатели магазина на отдельной странице.
            </p>
            <Link
              href={`/stores/${storeId}/summary`}
              className="inline-flex rounded-lg bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-700"
            >
              Открыть СВОДКУ
            </Link>
          </div>
        )}

        {hasPermission(permissions, 'VIEW_PAYMENTS') && analytics && (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <div className="rounded-xl bg-white p-6 shadow">
              <h3 className="mb-3 text-lg font-semibold">Доходы</h3>
              <div className="text-sm text-gray-700">
                Прогноз: {formatMoney(analytics?.income?.forecast?.total ?? 0, store.currency)}
              </div>
              <div className="text-sm text-gray-700">
                Факт: {formatMoney(analytics?.income?.actual?.total ?? 0, store.currency)}
              </div>
            </div>
            <div className="rounded-xl bg-white p-6 shadow">
              <h3 className="mb-3 text-lg font-semibold">Расходы</h3>
              <div className="text-sm text-gray-700">
                Прогноз: {formatMoney(analytics?.expenses?.total?.forecast ?? 0, store.currency)}
              </div>
              <div className="text-sm text-gray-700">
                Факт: {formatMoney(analytics?.expenses?.total?.actual ?? 0, store.currency)}
              </div>
            </div>
            <div className="rounded-xl bg-white p-6 shadow">
              <h3 className="mb-3 text-lg font-semibold">Прибыль</h3>
              <div className="text-sm text-gray-700">
                Прогноз:{' '}
                {formatMoney(
                  (analytics?.income?.forecast?.total ?? 0) -
                    (analytics?.expenses?.total?.forecast ?? 0),
                  store.currency,
                )}
              </div>
              <div className="text-sm text-gray-700">
                Факт:{' '}
                {formatMoney(
                  (analytics?.income?.actual?.total ?? 0) -
                    (analytics?.expenses?.total?.actual ?? 0),
                  store.currency,
                )}
              </div>
            </div>
          </div>
        )}

        {hasPermission(permissions, 'VIEW_PAYMENTS') && (
          <div className="rounded-xl bg-white p-6 shadow md:p-8">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold md:text-2xl">Бух. таблица</h2>
            </div>

            {analytics && (
              <div className="mb-4 rounded-lg bg-blue-50 px-4 py-3 text-sm text-blue-800">
                Остаток с предыдущего месяца:{' '}
                <span className="font-semibold">
                  {formatMoney(
                    analytics?.summaryPage?.income?.previousMonthBalance ?? 0,
                    store.currency,
                  )}
                </span>
              </div>
            )}

            {hasPermission(permissions, 'CREATE_PAYMENTS') && (
              <div className="mb-5 grid grid-cols-1 gap-3 lg:grid-cols-5">
                <input
                  type="date"
                  value={accountingDate}
                  onChange={(e) => setAccountingDate(e.target.value)}
                  className="rounded-lg border border-gray-300 px-3 py-2"
                />
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={accountingBank}
                  onChange={(e) => setAccountingBank(e.target.value)}
                  className="rounded-lg border border-gray-300 px-3 py-2"
                  placeholder="Безналичные"
                />
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={accountingCash1}
                  onChange={(e) => setAccountingCash1(e.target.value)}
                  className="rounded-lg border border-gray-300 px-3 py-2"
                  placeholder="Наличные касса 1"
                />
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={accountingCash2}
                  onChange={(e) => setAccountingCash2(e.target.value)}
                  className="rounded-lg border border-gray-300 px-3 py-2"
                  placeholder="Наличные касса 2"
                />
                <button
                  onClick={handleCreateAccountingRecord}
                  disabled={accountingSaving}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-60"
                >
                  Добавить
                </button>
              </div>
            )}

            {accountingRows.length === 0 ? (
              <p className="text-gray-600">Записей пока нет</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Дата</th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Ручной ввод (итого)</th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Оплачено по павильонам (итого)</th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Схождение</th>
                      {hasPermission(permissions, 'EDIT_PAYMENTS') && (
                        <th className="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500">Действия</th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 bg-white">
                    {accountingRows.map((row: any) => (
                      <tr key={row.id}>
                        <td className="px-4 py-3 text-sm">
                          {new Date(row.recordDate).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          {formatMoney(row.manualTotal, store.currency)}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          {formatMoney(row.actual?.total ?? 0, store.currency)}
                        </td>
                        <td
                          className={`px-4 py-3 text-sm font-medium ${
                            row.difference > 0
                              ? 'text-green-600'
                              : row.difference < 0
                                ? 'text-red-600'
                                : 'text-gray-700'
                          }`}
                        >
                          {row.difference > 0 ? '+' : ''}
                          {formatMoney(row.difference, store.currency)}
                        </td>
                        {hasPermission(permissions, 'EDIT_PAYMENTS') && (
                          <td className="px-4 py-3 text-right text-sm">
                            <button
                              onClick={() => handleDeleteAccountingRecord(row.id)}
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
        )}

        {hasPermission(permissions, 'VIEW_PAVILIONS') && (
          <div className="rounded-xl bg-white p-6 shadow md:p-8">
            <h2 className="mb-6 text-xl font-semibold md:text-2xl">Павильоны</h2>

            <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-[1fr_280px]">
              <input
                type="text"
                value={pavilionSearch}
                onChange={(e) => setPavilionSearch(e.target.value)}
                className="rounded-lg border border-gray-300 px-3 py-2"
                placeholder="Поиск по имени павильона"
              />
              <select
                value={pavilionCategoryFilter}
                onChange={(e) => setPavilionCategoryFilter(e.target.value)}
                className="rounded-lg border border-gray-300 px-3 py-2"
              >
                <option value="">Все категории</option>
                {allCategories.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </div>

            {filteredPavilions.length === 0 ? (
              <p className="py-8 text-center text-gray-600">
                {store.pavilions?.length === 0
                  ? 'В магазине пока нет павильонов'
                  : 'По текущим фильтрам павильоны не найдены'}
              </p>
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
                        Категория
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                        Арендатор
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 bg-white">
                    {filteredPavilions.map((p: any) => (
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
                          {p.category || '-'}
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
        )}

        {hasPermission(permissions, 'ASSIGN_PERMISSIONS') && (
          <div className="rounded-xl bg-white p-6 shadow md:p-8">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold md:text-2xl">Сотрудники</h2>
            </div>

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
                      <th className="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500">
                        Действия
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {store.staff.map((staff: any) => (
                      <tr key={staff.id}>
                        <td className="px-4 py-3 text-sm">{staff.position}</td>
                        <td className="px-4 py-3 text-sm">{staff.fullName}</td>
                        <td className="px-4 py-3 text-right text-sm">
                          <button
                            onClick={() => handleDeleteStaff(staff.id)}
                            className="text-red-600 hover:underline"
                          >
                            Удалить
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {(hasPermission(permissions, 'INVITE_USERS') ||
          hasPermission(permissions, 'ASSIGN_PERMISSIONS')) && (
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
        )}
      </div>

      {showCreatePavilionModal && (
        <CreatePavilionModal
          storeId={storeId}
          existingCategories={allCategories}
          onClose={() => setShowCreatePavilionModal(false)}
          onSaved={handlePavilionCreated}
        />
      )}
    </div>
  );
}
