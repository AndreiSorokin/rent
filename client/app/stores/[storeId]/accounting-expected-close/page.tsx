'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { formatMoney } from '@/lib/currency';
import { hasPermission } from '@/lib/permissions';

type ChannelTotals = {
  bankTransferPaid: number;
  cashbox1Paid: number;
  cashbox2Paid: number;
  total: number;
};

type DetailsResponse = {
  date: string;
  opening: ChannelTotals | null;
  actual: {
    totals: ChannelTotals;
    sources: {
      pavilionPayments: ChannelTotals;
      additionalCharges: ChannelTotals;
      storeExtraIncome: ChannelTotals;
      expenses: ChannelTotals;
    };
  };
  expectedClose: ChannelTotals | null;
  items: {
    pavilionPayments: Array<{
      id: number;
      paidAt: string;
      pavilionId: number;
      pavilionNumber: string;
      rentPaid: number;
      utilitiesPaid: number;
      advertisingPaid: number;
      bankTransferPaid: number;
      cashbox1Paid: number;
      cashbox2Paid: number;
      total: number;
    }>;
    additionalCharges: Array<{
      id: number;
      paidAt: string;
      additionalChargeId: number;
      additionalChargeName: string;
      pavilionId: number;
      pavilionNumber: string;
      amountPaid: number;
      bankTransferPaid: number;
      cashbox1Paid: number;
      cashbox2Paid: number;
    }>;
    storeExtraIncome: Array<{
      id: number;
      paidAt: string;
      name: string;
      amount: number;
      bankTransferPaid: number;
      cashbox1Paid: number;
      cashbox2Paid: number;
    }>;
    expenses: Array<{
      id: number;
      paidAt: string;
      type: string;
      note: string | null;
      amount: number;
      pavilionId: number | null;
      pavilionNumber: string | null;
      bankTransferPaid: number;
      cashbox1Paid: number;
      cashbox2Paid: number;
      total: number;
    }>;
  };
};

type DayReconciliation = {
  closing: ChannelTotals | null;
  difference:
    | {
        bankTransferPaid: number;
        cashbox1Paid: number;
        cashbox2Paid: number;
        total: number;
      }
    | null;
};

function toDateInput(value?: string | null) {
  if (!value) return new Date().toISOString().slice(0, 10);
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return new Date().toISOString().slice(0, 10);
  return parsed.toISOString().slice(0, 10);
}

function formatExpenseTitle(note: string | null, type: string) {
  const normalizedNote = String(note ?? '').trim();
  if (normalizedNote.startsWith('STAFF:')) {
    return 'Зарплата сотрудника';
  }
  return normalizedNote || type;
}

export default function AccountingExpectedClosePage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const storeId = Number(params.storeId);

  const initialDate = useMemo(
    () => toDateInput(searchParams.get('date')),
    [searchParams],
  );

  const [selectedDate, setSelectedDate] = useState(initialDate);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currency, setCurrency] = useState<'RUB' | 'KZT'>('RUB');
  const [permissions, setPermissions] = useState<string[]>([]);
  const [storeName, setStoreName] = useState('');
  const [details, setDetails] = useState<DetailsResponse | null>(null);
  const [reconciliation, setReconciliation] = useState<DayReconciliation | null>(null);

  useEffect(() => {
    setSelectedDate(initialDate);
  }, [initialDate]);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const [store, data, reconciliationData] = await Promise.all([
          apiFetch<{ name?: string; currency?: 'RUB' | 'KZT'; permissions?: string[] }>(
            `/stores/${storeId}`,
          ),
          apiFetch<DetailsResponse>(
            `/stores/${storeId}/accounting-reconciliation/expected-close-details?date=${encodeURIComponent(
              selectedDate,
            )}`,
          ),
          apiFetch<DayReconciliation>(
            `/stores/${storeId}/accounting-reconciliation?date=${encodeURIComponent(selectedDate)}`,
          ),
        ]);

        const userPermissions = store.permissions || [];
        if (!hasPermission(userPermissions, 'VIEW_PAYMENTS')) {
          router.replace(`/stores/${storeId}`);
          return;
        }

        setPermissions(userPermissions);
        setStoreName(store.name || `Объект #${storeId}`);
        setCurrency(store.currency || 'RUB');
        setDetails(data);
        setReconciliation(reconciliationData);
      } catch (err) {
        console.error(err);
        setError('Не удалось загрузить расшифровку ожидаемого закрытия');
      } finally {
        setLoading(false);
      }
    };

    if (storeId && selectedDate) {
      void load();
    }
  }, [router, selectedDate, storeId]);

  const updateDate = (value: string) => {
    setSelectedDate(value);
    router.replace(
      `/stores/${storeId}/accounting-expected-close?date=${encodeURIComponent(value)}`,
    );
  };

  if (loading) return <div className="p-6 text-center text-lg">Загрузка...</div>;
  if (error) return <div className="p-6 text-center text-red-600">{error}</div>;
  if (!hasPermission(permissions, 'VIEW_PAYMENTS')) return null;

  const opening = details?.opening;
  const expectedClose = details?.expectedClose;
  const actualClosing = reconciliation?.closing;
  const hasMismatch =
    Boolean(reconciliation?.difference) &&
    (Math.abs(Number(reconciliation?.difference?.bankTransferPaid ?? 0)) > 0.01 ||
      Math.abs(Number(reconciliation?.difference?.cashbox1Paid ?? 0)) > 0.01 ||
      Math.abs(Number(reconciliation?.difference?.cashbox2Paid ?? 0)) > 0.01 ||
      Math.abs(Number(reconciliation?.difference?.total ?? 0)) > 0.01);

  return (
    <div className="min-h-screen bg-[#f6f1eb]">
      <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-6">
        <div className="space-y-2">
          <Link
            href={`/stores/${storeId}/accounting?date=${encodeURIComponent(selectedDate)}`}
            className="inline-flex items-center rounded-xl border border-[#d8d1cb] bg-white px-3 py-1.5 text-sm font-semibold text-[#111111] transition hover:bg-[#f8f4ef]"
          >
            Назад в бух.таблицу
          </Link>
        </div>

        <div className="rounded-2xl border border-[#d8d1cb] bg-white p-4 shadow-[0_12px_36px_-20px_rgba(17,17,17,0.2)] md:p-6">
          <h1 className="text-2xl font-bold text-[#111111] md:text-3xl">Ожидаемое закрытие дня</h1>
          <p className="text-sm text-[#6b6b6b]">{storeName}</p>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm text-[#6b6b6b]">
              Дата: <span className="font-medium">{selectedDate}</span>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <span className="text-[#6b6b6b]">Выбрать дату:</span>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => updateDate(e.target.value)}
                className="rounded-xl border border-[#d8d1cb] bg-[#f8f4ef] px-3 py-1.5 text-[#111111] outline-none transition focus:border-[#ff6a13] focus:bg-white focus:ring-2 focus:ring-[#ff6a13]/20"
              />
            </label>
          </div>

          <div className="mb-5 grid grid-cols-1 gap-3 rounded-xl bg-[#f8f4ef] p-3 md:grid-cols-4">
            <div className="rounded-xl border border-[#d8d1cb] bg-white p-3">
              <div className="text-xs uppercase text-[#6b6b6b]">Открытие дня</div>
              <div className="mt-1 font-semibold">
                {opening ? formatMoney(opening.total, currency) : 'День не открыт'}
              </div>
            </div>
            <div className="rounded-xl border border-[#d8d1cb] bg-white p-3">
              <div className="text-xs uppercase text-[#6b6b6b]">Операции за день</div>
              <div className="mt-1 font-semibold">
                {formatMoney(details?.actual?.totals?.total ?? 0, currency)}
              </div>
            </div>
            <div className="rounded-xl border border-violet-200 bg-violet-50 p-3">
              <div className="text-xs uppercase text-violet-600">Ожидаемое закрытие</div>
              <div className="mt-1 font-semibold text-violet-900">
                {expectedClose ? formatMoney(expectedClose.total, currency) : '-'}
              </div>
            </div>
            <div
              className={`rounded-xl border p-3 ${
                hasMismatch
                  ? 'border-rose-200 bg-rose-50'
                  : 'border-violet-200 bg-violet-50'
              }`}
            >
              <div
                className={`text-xs uppercase ${
                  hasMismatch ? 'text-rose-600' : 'text-violet-600'
                }`}
              >
                Фактическое закрытие
              </div>
              <div
                className={`mt-1 font-semibold ${
                  hasMismatch ? 'text-rose-900' : 'text-violet-900'
                }`}
              >
                {actualClosing ? formatMoney(actualClosing.total, currency) : '-'}
              </div>
            </div>
          </div>

          <div className="mb-5 overflow-x-auto rounded-xl border border-[#e5ded8]">
            <table className="min-w-full divide-y divide-[#e5ded8]">
              <thead className="bg-[#f4efeb]">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium uppercase text-[#6b6b6b]">
                    Источник
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium uppercase text-[#6b6b6b]">
                    Безналичные
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium uppercase text-[#6b6b6b]">
                    Касса 1
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium uppercase text-[#6b6b6b]">
                    Касса 2
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium uppercase text-[#6b6b6b]">
                    Итого
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e5ded8] bg-white">
                <tr>
                  <td className="px-4 py-2 text-sm">Платежи павильонов</td>
                  <td className="px-4 py-2 text-sm">
                    {formatMoney(details?.actual?.sources?.pavilionPayments?.bankTransferPaid ?? 0, currency)}
                  </td>
                  <td className="px-4 py-2 text-sm">
                    {formatMoney(details?.actual?.sources?.pavilionPayments?.cashbox1Paid ?? 0, currency)}
                  </td>
                  <td className="px-4 py-2 text-sm">
                    {formatMoney(details?.actual?.sources?.pavilionPayments?.cashbox2Paid ?? 0, currency)}
                  </td>
                  <td className="px-4 py-2 text-sm font-medium">
                    {formatMoney(details?.actual?.sources?.pavilionPayments?.total ?? 0, currency)}
                  </td>
                </tr>
                <tr>
                  <td className="px-4 py-2 text-sm">Доп. начисления</td>
                  <td className="px-4 py-2 text-sm">
                    {formatMoney(details?.actual?.sources?.additionalCharges?.bankTransferPaid ?? 0, currency)}
                  </td>
                  <td className="px-4 py-2 text-sm">
                    {formatMoney(details?.actual?.sources?.additionalCharges?.cashbox1Paid ?? 0, currency)}
                  </td>
                  <td className="px-4 py-2 text-sm">
                    {formatMoney(details?.actual?.sources?.additionalCharges?.cashbox2Paid ?? 0, currency)}
                  </td>
                  <td className="px-4 py-2 text-sm font-medium">
                    {formatMoney(details?.actual?.sources?.additionalCharges?.total ?? 0, currency)}
                  </td>
                </tr>
                <tr>
                  <td className="px-4 py-2 text-sm">Доп. приход объекта</td>
                  <td className="px-4 py-2 text-sm">
                    {formatMoney(details?.actual?.sources?.storeExtraIncome?.bankTransferPaid ?? 0, currency)}
                  </td>
                  <td className="px-4 py-2 text-sm">
                    {formatMoney(details?.actual?.sources?.storeExtraIncome?.cashbox1Paid ?? 0, currency)}
                  </td>
                  <td className="px-4 py-2 text-sm">
                    {formatMoney(details?.actual?.sources?.storeExtraIncome?.cashbox2Paid ?? 0, currency)}
                  </td>
                  <td className="px-4 py-2 text-sm font-medium">
                    {formatMoney(details?.actual?.sources?.storeExtraIncome?.total ?? 0, currency)}
                  </td>
                </tr>
                <tr>
                  <td className="px-4 py-2 text-sm">Расходы</td>
                  <td className="px-4 py-2 text-sm text-rose-700">
                    -{formatMoney(details?.actual?.sources?.expenses?.bankTransferPaid ?? 0, currency)}
                  </td>
                  <td className="px-4 py-2 text-sm text-rose-700">
                    -{formatMoney(details?.actual?.sources?.expenses?.cashbox1Paid ?? 0, currency)}
                  </td>
                  <td className="px-4 py-2 text-sm text-rose-700">
                    -{formatMoney(details?.actual?.sources?.expenses?.cashbox2Paid ?? 0, currency)}
                  </td>
                  <td className="px-4 py-2 text-sm font-medium text-rose-700">
                    -{formatMoney(details?.actual?.sources?.expenses?.total ?? 0, currency)}
                  </td>
                </tr>
                <tr className="bg-[#f8f4ef]">
                  <td className="px-4 py-2 text-sm font-semibold">Операции за день (итого)</td>
                  <td className="px-4 py-2 text-sm font-semibold">
                    {formatMoney(details?.actual?.totals?.bankTransferPaid ?? 0, currency)}
                  </td>
                  <td className="px-4 py-2 text-sm font-semibold">
                    {formatMoney(details?.actual?.totals?.cashbox1Paid ?? 0, currency)}
                  </td>
                  <td className="px-4 py-2 text-sm font-semibold">
                    {formatMoney(details?.actual?.totals?.cashbox2Paid ?? 0, currency)}
                  </td>
                  <td className="px-4 py-2 text-sm font-semibold">
                    {formatMoney(details?.actual?.totals?.total ?? 0, currency)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="rounded-xl border border-[#d8d1cb] bg-white p-3">
              <h2 className="mb-2 text-sm font-semibold text-[#111111]">Платежи павильонов</h2>
              {!details?.items?.pavilionPayments?.length ? (
                <p className="text-sm text-[#6b6b6b]">Записей нет</p>
              ) : (
                <div className="space-y-2">
                  {details.items.pavilionPayments.map((item) => (
                    <div key={item.id} className="rounded-lg border border-[#e5ded8] bg-[#f8f4ef] p-2 text-sm">
                      <div className="font-medium">{item.pavilionNumber}</div>
                      <div className="text-xs text-[#6b6b6b]">
                        {new Date(item.paidAt).toLocaleString('ru-RU')}
                      </div>
                      <div className="text-xs text-[#4b5563]">
                        Аренда: {formatMoney(item.rentPaid, currency)} | Коммуналка:{' '}
                        {formatMoney(item.utilitiesPaid, currency)} | Реклама:{' '}
                        {formatMoney(item.advertisingPaid, currency)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-xl border border-[#d8d1cb] bg-white p-3">
              <h2 className="mb-2 text-sm font-semibold text-[#111111]">Доп. начисления</h2>
              {!details?.items?.additionalCharges?.length ? (
                <p className="text-sm text-[#6b6b6b]">Записей нет</p>
              ) : (
                <div className="space-y-2">
                  {details.items.additionalCharges.map((item) => (
                    <div key={item.id} className="rounded-lg border border-[#e5ded8] bg-[#f8f4ef] p-2 text-sm">
                      <div className="font-medium">
                        {item.pavilionNumber}: {item.additionalChargeName}
                      </div>
                      <div className="text-xs text-[#6b6b6b]">
                        {new Date(item.paidAt).toLocaleString('ru-RU')}
                      </div>
                      <div className="text-xs text-[#4b5563]">
                        Сумма: {formatMoney(item.amountPaid, currency)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="mt-4 rounded-xl border border-[#d8d1cb] bg-white p-3">
            <h2 className="mb-2 text-sm font-semibold text-[#111111]">Доп. приход объекта</h2>
            {!details?.items?.storeExtraIncome?.length ? (
              <p className="text-sm text-[#6b6b6b]">Записей нет</p>
            ) : (
              <div className="space-y-2">
                {details.items.storeExtraIncome.map((item) => (
                  <div key={item.id} className="rounded-lg border border-[#e5ded8] bg-[#f8f4ef] p-2 text-sm">
                    <div className="font-medium">{item.name}</div>
                    <div className="text-xs text-[#6b6b6b]">
                      {new Date(item.paidAt).toLocaleString('ru-RU')}
                    </div>
                    <div className="text-xs text-[#4b5563]">
                      Сумма: {formatMoney(item.amount, currency)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="mt-4 rounded-xl border border-[#d8d1cb] bg-white p-3">
            <h2 className="mb-2 text-sm font-semibold text-[#111111]">Расходы</h2>
            {!details?.items?.expenses?.length ? (
              <p className="text-sm text-[#6b6b6b]">Записей нет</p>
            ) : (
              <div className="space-y-2">
                {details.items.expenses.map((item) => (
                    <div key={item.id} className="rounded-lg border border-[#e5ded8] bg-[#f8f4ef] p-2 text-sm">
                    <div className="font-medium">
                      {item.pavilionNumber ? `${item.pavilionNumber}: ` : ''}
                      {formatExpenseTitle(item.note, item.type)}
                    </div>
                    <div className="text-xs text-[#6b6b6b]">
                      {new Date(item.paidAt).toLocaleString('ru-RU')}
                    </div>
                    <div className="text-xs text-rose-700">
                      Сумма: -{formatMoney(item.total, currency)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
