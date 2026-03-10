'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { formatMoney } from '@/lib/currency';
import { hasPermission } from '@/lib/permissions';
import { StoreSidebar } from '../components/StoreSidebar';

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
  const [expectedCloseDetails, setExpectedCloseDetails] = useState<any>(null);
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


      const [analyticsData, accountingData, reconciliationData, expectedCloseData] = await Promise.all([
        apiFetch<any>(`/stores/${storeId}/analytics`),
        apiFetch<any[]>(`/stores/${storeId}/accounting-table`),
        apiFetch<any>(
          `/stores/${storeId}/accounting-reconciliation?date=${encodeURIComponent(accountingDate)}`,
        ),
        apiFetch<any>(
          `/stores/${storeId}/accounting-reconciliation/expected-close-details?date=${encodeURIComponent(accountingDate)}`,
        ),
      ]);
      setStore(storeData);
      setAnalytics(analyticsData);
      setAccountingRows(accountingData || []);
      setDayReconciliation(reconciliationData);
      setExpectedCloseDetails(expectedCloseData);
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
    void Promise.all([
      apiFetch<any>(
        `/stores/${storeId}/accounting-reconciliation?date=${encodeURIComponent(accountingDate)}`,
      ),
      apiFetch<any>(
        `/stores/${storeId}/accounting-reconciliation/expected-close-details?date=${encodeURIComponent(accountingDate)}`,
      ),
    ])
      .then(([reconciliation, expectedCloseData]) => {
        setDayReconciliation(reconciliation);
        setExpectedCloseDetails(expectedCloseData);
      })
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
    if (Number.isNaN(bank) || Number.isNaN(cash1) || Number.isNaN(cash2)) {
      alert('Введите корректные суммы');
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
    if (Number.isNaN(bank) || Number.isNaN(cash1) || Number.isNaN(cash2)) {
      alert('Введите корректные суммы');
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
        const openingByType = sorted.find((row) => row.recordType === 'OPEN') ?? null;
        const closingByType = sorted.find((row) => row.recordType === 'CLOSE') ?? null;
        const openingFallback =
          sorted.length === 1 && sorted[0]?.recordType === 'CLOSE'
            ? null
            : (sorted[0] ?? null);
        const closingFallback = sorted.length > 1 ? sorted[sorted.length - 1] : null;

        return {
          dayKey,
          opening: openingByType ?? openingFallback,
          closing: closingByType ?? closingFallback,
        };
      })
      .sort((a, b) => new Date(b.dayKey).getTime() - new Date(a.dayKey).getTime());
  }, [accountingRows]);

  const permissions = store?.permissions || [];
  const difference = dayReconciliation?.difference ?? null;
  const hasDifference =
    difference &&
    (Math.abs(Number(difference.bankTransferPaid ?? 0)) > 0.01 ||
      Math.abs(Number(difference.cashbox1Paid ?? 0)) > 0.01 ||
      Math.abs(Number(difference.cashbox2Paid ?? 0)) > 0.01 ||
      Math.abs(Number(difference.total ?? 0)) > 0.01);

  const dayIncomeByChannels = useMemo(() => {
    const sources = expectedCloseDetails?.actual?.sources;
    if (!sources) {
      return { bankTransferPaid: 0, cashbox1Paid: 0, cashbox2Paid: 0, total: 0 };
    }
    const bankTransferPaid =
      Number(sources?.pavilionPayments?.bankTransferPaid ?? 0) +
      Number(sources?.additionalCharges?.bankTransferPaid ?? 0) +
      Number(sources?.storeExtraIncome?.bankTransferPaid ?? 0);
    const cashbox1Paid =
      Number(sources?.pavilionPayments?.cashbox1Paid ?? 0) +
      Number(sources?.additionalCharges?.cashbox1Paid ?? 0) +
      Number(sources?.storeExtraIncome?.cashbox1Paid ?? 0);
    const cashbox2Paid =
      Number(sources?.pavilionPayments?.cashbox2Paid ?? 0) +
      Number(sources?.additionalCharges?.cashbox2Paid ?? 0) +
      Number(sources?.storeExtraIncome?.cashbox2Paid ?? 0);

    return {
      bankTransferPaid,
      cashbox1Paid,
      cashbox2Paid,
      total: bankTransferPaid + cashbox1Paid + cashbox2Paid,
    };
  }, [expectedCloseDetails]);

  const dayExpenseByChannels = useMemo(() => {
    const expenses = expectedCloseDetails?.actual?.sources?.expenses;
    const bankTransferPaid = Number(expenses?.bankTransferPaid ?? 0);
    const cashbox1Paid = Number(expenses?.cashbox1Paid ?? 0);
    const cashbox2Paid = Number(expenses?.cashbox2Paid ?? 0);
    return {
      bankTransferPaid,
      cashbox1Paid,
      cashbox2Paid,
      total: bankTransferPaid + cashbox1Paid + cashbox2Paid,
    };
  }, [expectedCloseDetails]);

  if (loading) return <div className="p-6 text-center text-lg">Загрузка...</div>;
  if (error) return <div className="p-6 text-center text-red-600">{error}</div>;
  if (!store) return <div className="p-6 text-center text-red-600">Объект не найден</div>;
  if (!hasPermission(permissions, 'VIEW_PAYMENTS')) {
    return <div className="p-6 text-center text-red-600">Нет доступа</div>;
  }


  return (
    <div className="min-h-screen bg-[#f6f1eb]">
      <div className="mx-auto flex max-w-[1600px] gap-6 px-3 py-1 md:px-6 md:py-6">
        <StoreSidebar storeId={storeId} store={store} />
        <main className="min-w-0 flex-1">
      <div className="mx-auto max-w-7xl p-4 md:p-2">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="mt-1 text-2xl font-bold md:text-3xl">Открытие/закрытие дня</h1>
          </div>
        </div>

        {analytics && (
          <div className="mb-4 rounded-xl border border-[#d8d1cb] bg-[#f8f4ef] px-4 py-3 text-sm text-[#111111]">
            Остаток с предыдущего месяца:{' '}
            <span className="font-semibold">
              {formatMoney(
                analytics?.summaryPage?.income?.previousMonthBalance ?? 0,
                store.currency,
              )}
            </span>
          </div>
        )}

        <div className="mb-5 rounded-2xl border border-[#d8d1cb] bg-white p-4 shadow-[0_12px_36px_-20px_rgba(17,17,17,0.2)]">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-base font-semibold text-[#111111]">Сверка по дням</h3>
            <div className="flex items-center gap-2">
              <span className="text-xs text-[#6b6b6b]">Дата:</span>
              <input
                type="date"
                value={accountingDate}
                onChange={(e) => setAccountingDate(e.target.value)}
                className="rounded-xl border border-[#d8d1cb] bg-[#f8f4ef] px-2 py-1 text-xs text-[#111111] outline-none transition focus:border-[#ff6a13] focus:bg-white focus:ring-2 focus:ring-[#ff6a13]/20"
              />
            </div>
          </div>

          {dayReconciliation ? (
            <div className="grid grid-cols-1 gap-2 text-sm lg:grid-cols-2">
              <div className="space-y-2">
                <div className="rounded-xl border border-[#d8d1cb] bg-[#f8f4ef] p-3">
                  <div className="text-xs text-[#6b6b6b]">Открытие дня</div>
                  <div className="font-medium">
                    {dayReconciliation.opening
                      ? formatMoney(dayReconciliation.opening.total ?? 0, store.currency)
                      : 'День не открыт'}
                  </div>
                  {dayReconciliation.opening && (
                    <div className="mt-1 space-y-0.5 text-xs text-[#6b6b6b]">
                      <div>Безналичные: {formatMoney(dayReconciliation.opening.bankTransferPaid ?? 0, store.currency)}</div>
                      <div>Наличные касса 1: {formatMoney(dayReconciliation.opening.cashbox1Paid ?? 0, store.currency)}</div>
                      <div>Наличные касса 2: {formatMoney(dayReconciliation.opening.cashbox2Paid ?? 0, store.currency)}</div>
                    </div>
                  )}
                </div>

                <div className="rounded-xl border border-[#d8d1cb] bg-[#f8f4ef] p-3">
                  <div className="text-xs text-[#6b6b6b]">Фактическое закрытие</div>
                  <div className="font-medium">
                    {dayReconciliation.closing
                      ? formatMoney(dayReconciliation.closing.total ?? 0, store.currency)
                      : '-'}
                  </div>
                  {dayReconciliation.closing && (
                    <div className="mt-1 space-y-0.5 text-xs text-[#6b6b6b]">
                      <div>Безналичные: {formatMoney(dayReconciliation.closing.bankTransferPaid ?? 0, store.currency)}</div>
                      <div>Наличные касса 1: {formatMoney(dayReconciliation.closing.cashbox1Paid ?? 0, store.currency)}</div>
                      <div>Наличные касса 2: {formatMoney(dayReconciliation.closing.cashbox2Paid ?? 0, store.currency)}</div>
                    </div>
                  )}
                </div>

                <div className="rounded-xl border border-[#d8d1cb] bg-[#f8f4ef] p-3">
                  <div className="text-xs text-[#6b6b6b]">Ожидаемое закрытие</div>
                  <div className="font-medium">
                    {dayReconciliation.expectedClose ? (
                      <Link
                        href={`/stores/${storeId}/accounting-expected-close?date=${encodeURIComponent(accountingDate)}`}
                        className="text-[#ff6a13] hover:underline"
                      >
                        {formatMoney(dayReconciliation.expectedClose.total ?? 0, store.currency)}
                      </Link>
                    ) : (
                      '-'
                    )}
                  </div>
                  {dayReconciliation.expectedClose && (
                    <div className="mt-1 space-y-0.5 text-xs text-[#6b6b6b]">
                      <div>
                        Безналичные:{' '}
                        {formatMoney(
                          dayReconciliation.expectedClose.bankTransferPaid ?? 0,
                          store.currency,
                        )}
                      </div>
                      <div>
                        Наличные касса 1:{' '}
                        {formatMoney(
                          dayReconciliation.expectedClose.cashbox1Paid ?? 0,
                          store.currency,
                        )}
                      </div>
                      <div>
                        Наличные касса 2:{' '}
                        {formatMoney(
                          dayReconciliation.expectedClose.cashbox2Paid ?? 0,
                          store.currency,
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <div className="rounded-xl border border-[#d8d1cb] bg-[#f8f4ef] p-3">
                  <div className="text-xs text-[#6b6b6b]">Приход за день</div>
                  <div className="font-medium">
                    {formatMoney(dayIncomeByChannels.total ?? 0, store.currency)}
                  </div>
                  <div className="mt-1 space-y-0.5 text-xs text-[#6b6b6b]">
                    <div>Безналичные: {formatMoney(dayIncomeByChannels.bankTransferPaid ?? 0, store.currency)}</div>
                    <div>Наличные касса 1: {formatMoney(dayIncomeByChannels.cashbox1Paid ?? 0, store.currency)}</div>
                    <div>Наличные касса 2: {formatMoney(dayIncomeByChannels.cashbox2Paid ?? 0, store.currency)}</div>
                  </div>
                </div>

                <div className="rounded-xl border border-[#d8d1cb] bg-[#f8f4ef] p-3">
                  <div className="text-xs text-[#6b6b6b]">Расход за день</div>
                  <div className="font-medium">
                    {formatMoney(dayExpenseByChannels.total ?? 0, store.currency)}
                  </div>
                  <div className="mt-1 space-y-0.5 text-xs text-[#6b6b6b]">
                    <div>Безналичные: {formatMoney(dayExpenseByChannels.bankTransferPaid ?? 0, store.currency)}</div>
                    <div>Наличные касса 1: {formatMoney(dayExpenseByChannels.cashbox1Paid ?? 0, store.currency)}</div>
                    <div>Наличные касса 2: {formatMoney(dayExpenseByChannels.cashbox2Paid ?? 0, store.currency)}</div>
                  </div>
                </div>

                <div
                  className={`rounded-xl p-3 ${
                    hasDifference
                      ? 'border border-[#ef4444]/30 bg-[#ef4444]/10'
                      : 'border border-[#22c55e]/30 bg-[#22c55e]/10'
                  }`}
                >
                  <div className="mb-2 text-xs text-[#6b6b6b]">Схождение при закрытии</div>
                  {dayReconciliation.isClosed && difference ? (
                    <div className="space-y-1 text-sm">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs text-[#6b6b6b]">Безналичные</span>
                        <span className={hasDifference ? 'font-semibold text-red-700' : 'font-semibold text-emerald-700'}>
                          {formatMoney(Number(difference.bankTransferPaid ?? 0), store.currency)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs text-[#6b6b6b]">Наличные касса 1</span>
                        <span className={hasDifference ? 'font-semibold text-red-700' : 'font-semibold text-emerald-700'}>
                          {formatMoney(Number(difference.cashbox1Paid ?? 0), store.currency)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs text-[#6b6b6b]">Наличные касса 2</span>
                        <span className={hasDifference ? 'font-semibold text-red-700' : 'font-semibold text-emerald-700'}>
                          {formatMoney(Number(difference.cashbox2Paid ?? 0), store.currency)}
                        </span>
                      </div>
                      <div className="mt-1 flex items-center justify-between gap-2 border-t border-[#d8d1cb] pt-1">
                        <span className="text-xs text-[#6b6b6b]">Итого</span>
                        <span className={hasDifference ? 'font-bold text-red-700' : 'font-bold text-emerald-700'}>
                          {formatMoney(Number(difference.total ?? 0), store.currency)}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="text-sm text-[#6b6b6b]">Появится после закрытия дня</div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-[#6b6b6b]">Загрузка сверки...</p>
          )}

          {hasPermission(permissions, 'CREATE_PAYMENTS') && dayReconciliation && (
            <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
              {!dayReconciliation.isOpened && (
                <div className="rounded-xl border border-[#d8d1cb] bg-[#f8f4ef] p-3">
                  <p className="mb-2 text-sm font-semibold text-[#111111]">Открыть день</p>
                  <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
                    <input
                      type="number"
                      step="0.01"
                      value={dayOpenBank}
                      onChange={(e) => setDayOpenBank(e.target.value)}
                      className="rounded-xl border border-[#d8d1cb] bg-white px-3 py-2 text-[#111111] outline-none transition focus:border-[#ff6a13] focus:ring-2 focus:ring-[#ff6a13]/20"
                      placeholder="Безналичные"
                    />
                    <input
                      type="number"
                      step="0.01"
                      value={dayOpenCash1}
                      onChange={(e) => setDayOpenCash1(e.target.value)}
                      className="rounded-xl border border-[#d8d1cb] bg-white px-3 py-2 text-[#111111] outline-none transition focus:border-[#ff6a13] focus:ring-2 focus:ring-[#ff6a13]/20"
                      placeholder="Касса 1"
                    />
                    <input
                      type="number"
                      step="0.01"
                      value={dayOpenCash2}
                      onChange={(e) => setDayOpenCash2(e.target.value)}
                      className="rounded-xl border border-[#d8d1cb] bg-white px-3 py-2 text-[#111111] outline-none transition focus:border-[#ff6a13] focus:ring-2 focus:ring-[#ff6a13]/20"
                      placeholder="Касса 2"
                    />
                  </div>
                  <button
                    onClick={handleOpenDay}
                    disabled={dayActionSaving}
                    className="mt-3 rounded-xl bg-[#22c55e] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#16a34a] disabled:opacity-60"
                  >
                    Открыть день
                  </button>
                </div>
              )}

              {dayReconciliation.isOpened && !dayReconciliation.isClosed && (
                <div className="rounded-xl border border-[#d8d1cb] bg-[#f8f4ef] p-3">
                  <p className="mb-2 text-sm font-semibold text-[#111111]">Закрыть день</p>
                  <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
                    <input
                      type="number"
                      step="0.01"
                      value={dayCloseBank}
                      onChange={(e) => setDayCloseBank(e.target.value)}
                      className="rounded-xl border border-[#d8d1cb] bg-white px-3 py-2 text-[#111111] outline-none transition focus:border-[#ff6a13] focus:ring-2 focus:ring-[#ff6a13]/20"
                      placeholder="Безналичные"
                    />
                    <input
                      type="number"
                      step="0.01"
                      value={dayCloseCash1}
                      onChange={(e) => setDayCloseCash1(e.target.value)}
                      className="rounded-xl border border-[#d8d1cb] bg-white px-3 py-2 text-[#111111] outline-none transition focus:border-[#ff6a13] focus:ring-2 focus:ring-[#ff6a13]/20"
                      placeholder="Касса 1"
                    />
                    <input
                      type="number"
                      step="0.01"
                      value={dayCloseCash2}
                      onChange={(e) => setDayCloseCash2(e.target.value)}
                      className="rounded-xl border border-[#d8d1cb] bg-white px-3 py-2 text-[#111111] outline-none transition focus:border-[#ff6a13] focus:ring-2 focus:ring-[#ff6a13]/20"
                      placeholder="Касса 2"
                    />
                  </div>
                  <button
                    onClick={handleCloseDay}
                    disabled={dayActionSaving}
                    className="mt-3 rounded-xl bg-[#ff6a13] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#e85a0c] disabled:opacity-60"
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
          <div className="space-y-3">
            {accountingDays.map((day: any) => {
              const openingTotal =
                Number(day.opening?.bankTransferPaid ?? 0) +
                Number(day.opening?.cashbox1Paid ?? 0) +
                Number(day.opening?.cashbox2Paid ?? 0);
              const closingTotal =
                Number(day.closing?.bankTransferPaid ?? 0) +
                Number(day.closing?.cashbox1Paid ?? 0) +
                Number(day.closing?.cashbox2Paid ?? 0);

              return (
                <section
                  key={day.dayKey}
                  className="rounded-2xl border border-[#d8d1cb] bg-white p-4 shadow-[0_12px_36px_-20px_rgba(17,17,17,0.2)]"
                >
                  <div className="mb-3 text-sm font-semibold text-[#111111]">
                    {new Date(day.dayKey).toLocaleDateString()}
                  </div>
                  <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                    <article className="rounded-xl border border-[#d8d1cb] bg-[#f8f4ef] p-3">
                      <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-emerald-700">
                        Открытие дня
                      </div>
                      {day.opening ? (
                        <>
                          <div className="space-y-1 text-sm text-[#111111]">
                            <div>Безналичные: {formatMoney(day.opening.bankTransferPaid ?? 0, store.currency)}</div>
                            <div>Наличные касса 1: {formatMoney(day.opening.cashbox1Paid ?? 0, store.currency)}</div>
                            <div>Наличные касса 2: {formatMoney(day.opening.cashbox2Paid ?? 0, store.currency)}</div>
                          </div>
                          <div className="mt-2 flex items-center justify-between border-t border-[#d8d1cb] pt-2">
                            <span className="text-xs text-[#6b6b6b]">Итого</span>
                            <span className="text-sm font-semibold">{formatMoney(openingTotal, store.currency)}</span>
                          </div>
                          {hasPermission(permissions, 'EDIT_PAYMENTS') && (
                            <button
                              onClick={() => handleDeleteAccountingRecord(day.opening.id)}
                              className="mt-2 rounded-lg border border-[#ef4444]/40 bg-[#ef4444]/10 px-2 py-1 text-xs font-semibold text-[#b91c1c] transition hover:bg-[#ef4444]/20"
                            >
                              Удалить
                            </button>
                          )}
                        </>
                      ) : (
                        <div className="text-sm text-[#6b6b6b]">Нет записи открытия</div>
                      )}
                    </article>

                    <article className="rounded-xl border border-[#d8d1cb] bg-[#f8f4ef] p-3">
                      <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-indigo-700">
                        Закрытие дня
                      </div>
                      {day.closing ? (
                        <>
                          <div className="space-y-1 text-sm text-[#111111]">
                            <div>Безналичные: {formatMoney(day.closing.bankTransferPaid ?? 0, store.currency)}</div>
                            <div>Наличные касса 1: {formatMoney(day.closing.cashbox1Paid ?? 0, store.currency)}</div>
                            <div>Наличные касса 2: {formatMoney(day.closing.cashbox2Paid ?? 0, store.currency)}</div>
                          </div>
                          <div className="mt-2 flex items-center justify-between border-t border-[#d8d1cb] pt-2">
                            <span className="text-xs text-[#6b6b6b]">Итого</span>
                            <span className="text-sm font-semibold">{formatMoney(closingTotal, store.currency)}</span>
                          </div>
                          {hasPermission(permissions, 'EDIT_PAYMENTS') && (
                            <button
                              onClick={() => handleDeleteAccountingRecord(day.closing.id)}
                              className="mt-2 rounded-lg border border-[#ef4444]/40 bg-[#ef4444]/10 px-2 py-1 text-xs font-semibold text-[#b91c1c] transition hover:bg-[#ef4444]/20"
                            >
                              Удалить
                            </button>
                          )}
                        </>
                      ) : (
                        <div className="text-sm text-[#6b6b6b]">Нет записи закрытия</div>
                      )}
                    </article>
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </div>
        </main>
      </div>
    </div>
  );
}


