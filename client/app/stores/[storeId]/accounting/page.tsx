'use client';

import { Fragment, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { formatMoney } from '@/lib/currency';
import { hasPermission } from '@/lib/permissions';

export default function StoreAccountingPage() {
  const params = useParams();
  const router = useRouter();
  const storeId = Number(params.storeId);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [store, setStore] = useState<any>(null);
  const [analytics, setAnalytics] = useState<any>(null);
  const [accountingRows, setAccountingRows] = useState<any[]>([]);
  const [accountingDate, setAccountingDate] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [dayReconciliation, setDayReconciliation] = useState<any>(null);
  const [dayOpenBank, setDayOpenBank] = useState('');
  const [dayOpenCash1, setDayOpenCash1] = useState('');
  const [dayOpenCash2, setDayOpenCash2] = useState('');
  const [dayCloseBank, setDayCloseBank] = useState('');
  const [dayCloseCash1, setDayCloseCash1] = useState('');
  const [dayCloseCash2, setDayCloseCash2] = useState('');
  const [dayActionSaving, setDayActionSaving] = useState(false);

  const fetchData = async (withLoader = true) => {
    if (!storeId) return;
    if (withLoader) setLoading(true);
    try {
      const storeData = await apiFetch<any>(`/stores/${storeId}?lite=true`);
      const permissions = storeData?.permissions || [];
      if (!hasPermission(permissions, 'VIEW_PAYMENTS')) {
        router.replace(`/stores/${storeId}`);
        return;
      }

      const [analyticsData, accountingData, reconciliationData] = await Promise.all([
        apiFetch<any>(`/stores/${storeId}/analytics`),
        apiFetch<any[]>(`/stores/${storeId}/accounting-table`),
        apiFetch<any>(
          `/stores/${storeId}/accounting-reconciliation?date=${encodeURIComponent(accountingDate)}`,
        ),
      ]);
      setStore(storeData);
      setAnalytics(analyticsData);
      setAccountingRows(accountingData || []);
      setDayReconciliation(reconciliationData);
      setError(null);
    } catch (err) {
      console.error(err);
      setError('Не удалось загрузить бух. таблицу');
    } finally {
      if (withLoader) setLoading(false);
    }
  };

  useEffect(() => {
    void fetchData(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeId]);

  useEffect(() => {
    if (!storeId || !store) return;
    if (!hasPermission(store.permissions || [], 'VIEW_PAYMENTS')) return;
    void apiFetch<any>(
      `/stores/${storeId}/accounting-reconciliation?date=${encodeURIComponent(accountingDate)}`,
    )
      .then((data) => setDayReconciliation(data))
      .catch((err) => console.error(err));
  }, [storeId, accountingDate, store]);

  const handleDeleteAccountingRecord = async (recordId: number) => {
    if (!confirm('Удалить эту запись из бух. таблицы?')) return;
    try {
      await apiFetch(`/stores/${storeId}/accounting-table/${recordId}`, {
        method: 'DELETE',
      });
      await fetchData(false);
    } catch (err) {
      console.error(err);
      alert('Не удалось удалить запись');
    }
  };

  const handleOpenDay = async () => {
    const bank = dayOpenBank ? Number(dayOpenBank) : 0;
    const cash1 = dayOpenCash1 ? Number(dayOpenCash1) : 0;
    const cash2 = dayOpenCash2 ? Number(dayOpenCash2) : 0;
    if (bank < 0 || cash1 < 0 || cash2 < 0) {
      alert('Суммы не могут быть отрицательными');
      return;
    }

    try {
      setDayActionSaving(true);
      const data = await apiFetch<any>(`/stores/${storeId}/accounting-reconciliation/open`, {
        method: 'POST',
        body: JSON.stringify({
          date: accountingDate,
          bankTransferPaid: bank,
          cashbox1Paid: cash1,
          cashbox2Paid: cash2,
        }),
      });
      setDayReconciliation(data);
      await fetchData(false);
    } catch (err: any) {
      console.error(err);
      alert(err?.message || 'Не удалось открыть день');
    } finally {
      setDayActionSaving(false);
    }
  };

  const handleCloseDay = async () => {
    const bank = dayCloseBank ? Number(dayCloseBank) : 0;
    const cash1 = dayCloseCash1 ? Number(dayCloseCash1) : 0;
    const cash2 = dayCloseCash2 ? Number(dayCloseCash2) : 0;
    if (bank < 0 || cash1 < 0 || cash2 < 0) {
      alert('Суммы не могут быть отрицательными');
      return;
    }

    const expected = dayReconciliation?.expectedClose;
    const expectedBank = Number(expected?.bankTransferPaid ?? bank);
    const expectedCash1 = Number(expected?.cashbox1Paid ?? cash1);
    const expectedCash2 = Number(expected?.cashbox2Paid ?? cash2);
    const isMismatch =
      Math.abs(bank - expectedBank) > 0.01 ||
      Math.abs(cash1 - expectedCash1) > 0.01 ||
      Math.abs(cash2 - expectedCash2) > 0.01;

    if (isMismatch && !confirm('Вы уверены что хотите закрыть день с не схождением?')) return;

    try {
      setDayActionSaving(true);
      const data = await apiFetch<any>(`/stores/${storeId}/accounting-reconciliation/close`, {
        method: 'POST',
        body: JSON.stringify({
          date: accountingDate,
          bankTransferPaid: bank,
          cashbox1Paid: cash1,
          cashbox2Paid: cash2,
          forceClose: isMismatch,
        }),
      });
      setDayReconciliation(data);
      await fetchData(false);
    } catch (err: any) {
      console.error(err);
      alert(err?.message || 'Не удалось закрыть день');
    } finally {
      setDayActionSaving(false);
    }
  };

  const accountingDays = useMemo(() => {
    const entries = Array.from(
      (accountingRows || []).reduce((map, row: any) => {
        const dayKey = new Date(row.recordDate).toISOString().slice(0, 10);
        const list = map.get(dayKey) ?? [];
        list.push(row);
        map.set(dayKey, list);
        return map;
      }, new Map<string, any[]>()),
    ) as Array<[string, any[]]>;

    return entries
      .map(([dayKey, rows]) => {
        const sorted = [...rows].sort(
          (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
        );
        return {
          dayKey,
          opening: sorted[0] ?? null,
          closing: sorted.length > 1 ? sorted[sorted.length - 1] : null,
        };
      })
      .sort((a, b) => new Date(b.dayKey).getTime() - new Date(a.dayKey).getTime());
  }, [accountingRows]);

  if (loading) return <div className="p-6 text-center text-lg">Загрузка...</div>;
  if (error) return <div className="p-6 text-center text-red-600">{error}</div>;
  if (!store) return <div className="p-6 text-center text-red-600">Объект не найден</div>;

  const permissions = store.permissions || [];
  if (!hasPermission(permissions, 'VIEW_PAYMENTS')) {
    return <div className="p-6 text-center text-red-600">Нет доступа</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-7xl p-4 md:p-8">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <Link href={`/stores/${storeId}`} className="text-blue-600 hover:underline">
              Назад к объекту
            </Link>
            <h1 className="mt-1 text-2xl font-bold md:text-3xl">Бух. таблица</h1>
          </div>
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

        <div className="mb-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-base font-semibold text-slate-900">Сверка по дням</h3>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-600">Дата:</span>
              <input
                type="date"
                value={accountingDate}
                onChange={(e) => setAccountingDate(e.target.value)}
                className="rounded-md border border-gray-300 px-2 py-1 text-xs"
              />
            </div>
          </div>

          {dayReconciliation ? (
            <div className="grid grid-cols-1 gap-2 text-sm md:grid-cols-2">
              <div className="rounded-lg bg-white p-3">
                <div className="text-xs text-gray-500">Открытие дня</div>
                <div className="font-medium">
                  {dayReconciliation.opening
                    ? formatMoney(dayReconciliation.opening.total ?? 0, store.currency)
                    : 'День не открыт'}
                </div>
              </div>
              <div className="rounded-lg bg-white p-3">
                <div className="text-xs text-gray-500">Операции за день (факт)</div>
                <div className="font-medium">
                  {formatMoney(dayReconciliation.actual?.total ?? 0, store.currency)}
                </div>
              </div>
              <div className="rounded-lg bg-white p-3">
                <div className="text-xs text-gray-500">Ожидаемое закрытие</div>
                <div className="font-medium">
                  {dayReconciliation.expectedClose ? (
                    <Link
                      href={`/stores/${storeId}/accounting-expected-close?date=${encodeURIComponent(accountingDate)}`}
                      className="text-blue-700 hover:underline"
                    >
                      {formatMoney(dayReconciliation.expectedClose.total ?? 0, store.currency)}
                    </Link>
                  ) : (
                    '-'
                  )}
                </div>
              </div>
              <div className="rounded-lg bg-white p-3">
                <div className="text-xs text-gray-500">Фактическое закрытие</div>
                <div className="font-medium">
                  {dayReconciliation.closing
                    ? formatMoney(dayReconciliation.closing.total ?? 0, store.currency)
                    : '-'}
                </div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-600">Загрузка сверки...</p>
          )}

          {hasPermission(permissions, 'CREATE_PAYMENTS') && dayReconciliation && (
            <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
              {!dayReconciliation.isOpened && (
                <div className="rounded-lg border border-slate-200 bg-white p-3">
                  <p className="mb-2 text-sm font-medium text-slate-800">Открыть день</p>
                  <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={dayOpenBank}
                      onChange={(e) => setDayOpenBank(e.target.value)}
                      className="rounded-lg border border-gray-300 px-3 py-2"
                      placeholder="Безналичные"
                    />
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={dayOpenCash1}
                      onChange={(e) => setDayOpenCash1(e.target.value)}
                      className="rounded-lg border border-gray-300 px-3 py-2"
                      placeholder="Касса 1"
                    />
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={dayOpenCash2}
                      onChange={(e) => setDayOpenCash2(e.target.value)}
                      className="rounded-lg border border-gray-300 px-3 py-2"
                      placeholder="Касса 2"
                    />
                  </div>
                  <button
                    onClick={handleOpenDay}
                    disabled={dayActionSaving}
                    className="mt-3 rounded-lg bg-emerald-600 px-4 py-2 text-sm text-white hover:bg-emerald-700 disabled:opacity-60"
                  >
                    Открыть день
                  </button>
                </div>
              )}

              {dayReconciliation.isOpened && !dayReconciliation.isClosed && (
                <div className="rounded-lg border border-slate-200 bg-white p-3">
                  <p className="mb-2 text-sm font-medium text-slate-800">Закрыть день</p>
                  <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={dayCloseBank}
                      onChange={(e) => setDayCloseBank(e.target.value)}
                      className="rounded-lg border border-gray-300 px-3 py-2"
                      placeholder="Безналичные"
                    />
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={dayCloseCash1}
                      onChange={(e) => setDayCloseCash1(e.target.value)}
                      className="rounded-lg border border-gray-300 px-3 py-2"
                      placeholder="Касса 1"
                    />
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={dayCloseCash2}
                      onChange={(e) => setDayCloseCash2(e.target.value)}
                      className="rounded-lg border border-gray-300 px-3 py-2"
                      placeholder="Касса 2"
                    />
                  </div>
                  <button
                    onClick={handleCloseDay}
                    disabled={dayActionSaving}
                    className="mt-3 rounded-lg bg-indigo-600 px-4 py-2 text-sm text-white hover:bg-indigo-700 disabled:opacity-60"
                  >
                    Закрыть день
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {accountingDays.length === 0 ? (
          <p className="text-gray-600">Записей пока нет</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                    Дата
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                    Тип записи
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                    Безналичные
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                    Наличные касса 1
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                    Наличные касса 2
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                    Итого
                  </th>
                  {hasPermission(permissions, 'EDIT_PAYMENTS') && (
                    <th className="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500">
                      Действия
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {accountingDays.map((day: any) => (
                  <Fragment key={day.dayKey}>
                    {day.opening && (
                      <tr>
                        <td className="px-4 py-3 text-sm">
                          {new Date(day.dayKey).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3 text-sm font-medium text-emerald-700">
                          Открытие дня
                        </td>
                        <td className="px-4 py-3 text-sm">
                          {formatMoney(day.opening.bankTransferPaid ?? 0, store.currency)}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          {formatMoney(day.opening.cashbox1Paid ?? 0, store.currency)}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          {formatMoney(day.opening.cashbox2Paid ?? 0, store.currency)}
                        </td>
                        <td className="px-4 py-3 text-sm font-medium">
                          {formatMoney(
                            Number(day.opening.bankTransferPaid ?? 0) +
                              Number(day.opening.cashbox1Paid ?? 0) +
                              Number(day.opening.cashbox2Paid ?? 0),
                            store.currency,
                          )}
                        </td>
                        {hasPermission(permissions, 'EDIT_PAYMENTS') && (
                          <td className="px-4 py-3 text-right text-sm">
                            <button
                              onClick={() => handleDeleteAccountingRecord(day.opening.id)}
                              className="text-red-600 hover:underline"
                            >
                              Удалить
                            </button>
                          </td>
                        )}
                      </tr>
                    )}
                    {day.closing && (
                      <tr className="bg-slate-50/40">
                        <td className="px-4 py-3 text-sm">
                          {new Date(day.dayKey).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3 text-sm font-medium text-indigo-700">
                          Закрытие дня
                        </td>
                        <td className="px-4 py-3 text-sm">
                          {formatMoney(day.closing.bankTransferPaid ?? 0, store.currency)}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          {formatMoney(day.closing.cashbox1Paid ?? 0, store.currency)}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          {formatMoney(day.closing.cashbox2Paid ?? 0, store.currency)}
                        </td>
                        <td className="px-4 py-3 text-sm font-medium">
                          {formatMoney(
                            Number(day.closing.bankTransferPaid ?? 0) +
                              Number(day.closing.cashbox1Paid ?? 0) +
                              Number(day.closing.cashbox2Paid ?? 0),
                            store.currency,
                          )}
                        </td>
                        {hasPermission(permissions, 'EDIT_PAYMENTS') && (
                          <td className="px-4 py-3 text-right text-sm">
                            <button
                              onClick={() => handleDeleteAccountingRecord(day.closing.id)}
                              className="text-red-600 hover:underline"
                            >
                              Удалить
                            </button>
                          </td>
                        )}
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
