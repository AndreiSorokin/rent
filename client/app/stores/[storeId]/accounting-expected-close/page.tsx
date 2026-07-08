'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { apiFetch } from '@/lib/api';
import { formatMoney } from '@/lib/currency';
import { hasPermission } from '@/lib/permissions';
import { FullScreenLoader } from '@/components/AppLoader';
import {
  getDateKeyInTimeZone,
  getTodayDateKeyInTimeZone,
} from '@/lib/dateTime';

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
  if (!value) return getTodayDateKeyInTimeZone('UTC');
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return getTodayDateKeyInTimeZone('UTC');
  return getDateKeyInTimeZone(parsed, 'UTC');
}

function formatExpenseTitle(note: string | null, type: string, staffSalaryLabel: string) {
  const normalizedNote = String(note ?? '').trim();
  if (normalizedNote.startsWith('STAFF:')) {
    return staffSalaryLabel;
  }
  return normalizedNote || type;
}

export default function AccountingExpectedClosePage() {
  const t = useTranslations('AccountingExpectedClosePage');
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
  const [storeTimeZone, setStoreTimeZone] = useState('UTC');
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
          apiFetch<{ name?: string; currency?: 'RUB' | 'KZT'; permissions?: string[]; timeZone?: string }>(
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
        setStoreName(store.name || t('storeFallbackName', { storeId }));
        setCurrency(store.currency || 'RUB');
        setStoreTimeZone(store.timeZone || 'UTC');
        if (!searchParams.get('date')) {
          setSelectedDate(getTodayDateKeyInTimeZone(store.timeZone || 'UTC'));
        }
        setDetails(data);
        setReconciliation(reconciliationData);
      } catch (err) {
        console.error(err);
        setError(t('loadError'));
      } finally {
        setLoading(false);
      }
    };

    if (storeId && selectedDate) {
      void load();
    }
  }, [router, searchParams, selectedDate, storeId]);

  const updateDate = (value: string) => {
    setSelectedDate(value);
    router.replace(
      `/stores/${storeId}/accounting-expected-close?date=${encodeURIComponent(value)}`,
    );
  };

  if (loading) return <FullScreenLoader label={t('loadingLabel')} />;
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
        <div className="rounded-2xl border border-[#d8d1cb] bg-white p-4 shadow-[0_12px_36px_-20px_rgba(17,17,17,0.2)] md:p-6">
          <div className="space-y-2">
          <Link
            href={`/stores/${storeId}/accounting?date=${encodeURIComponent(selectedDate)}`}
            className="inline-flex items-center rounded-xl border border-[#d8d1cb] bg-white px-3 py-1.5 text-sm font-semibold text-[#111111] transition hover:bg-[#f8f4ef]"
          >
            {t('backLink')}
          </Link>
        </div>
          <h1 className="text-2xl font-bold text-[#111111] md:text-3xl mt-5">{t('title')}</h1>
          <p className="text-sm text-[#6b6b6b]">{storeName}</p>
          <p className="text-xs text-[#8b7f76]">{t('timeZoneLabel', { timeZone: storeTimeZone })}</p>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm text-[#6b6b6b]">
              {t('dateLabel')} <span className="font-medium">{selectedDate}</span>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <span className="text-[#6b6b6b]">{t('selectDateLabel')}</span>
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
              <div className="text-xs uppercase text-[#6b6b6b]">{t('dayOpeningLabel')}</div>
              <div className="mt-1 font-semibold">
                {opening ? formatMoney(opening.total, currency) : t('dayNotOpened')}
              </div>
            </div>
            <div className="rounded-xl border border-[#d8d1cb] bg-white p-3">
              <div className="text-xs uppercase text-[#6b6b6b]">{t('dayOperationsLabel')}</div>
              <div className="mt-1 font-semibold">
                {formatMoney(details?.actual?.totals?.total ?? 0, currency)}
              </div>
            </div>
            <div className="rounded-xl border border-violet-200 bg-violet-50 p-3">
              <div className="text-xs uppercase text-violet-600">{t('expectedCloseLabel')}</div>
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
                {t('actualCloseLabel')}
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
                    {t('tableSource')}
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium uppercase text-[#6b6b6b]">
                    {t('tableBankTransfer')}
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium uppercase text-[#6b6b6b]">
                    {t('tableCash1')}
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium uppercase text-[#6b6b6b]">
                    {t('tableCash2')}
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium uppercase text-[#6b6b6b]">
                    {t('tableTotal')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e5ded8] bg-white">
                <tr>
                  <td className="px-4 py-2 text-sm">{t('pavilionPaymentsRow')}</td>
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
                  <td className="px-4 py-2 text-sm">{t('additionalChargesRow')}</td>
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
                  <td className="px-4 py-2 text-sm">{t('storeExtraIncomeRow')}</td>
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
                  <td className="px-4 py-2 text-sm">{t('expensesRow')}</td>
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
                  <td className="px-4 py-2 text-sm font-semibold">{t('dayTotalRow')}</td>
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
              <h2 className="mb-2 text-sm font-semibold text-[#111111]">{t('pavilionPaymentsHeading')}</h2>
              {!details?.items?.pavilionPayments?.length ? (
                <p className="text-sm text-[#6b6b6b]">{t('noRecords')}</p>
              ) : (
                <div className="space-y-2">
                  {details.items.pavilionPayments.map((item) => (
                    <div key={item.id} className="rounded-lg border border-[#e5ded8] bg-[#f8f4ef] p-2 text-sm">
                      <div className="font-medium">{item.pavilionNumber}</div>
                      <div className="text-xs text-[#6b6b6b]">
                        {new Date(item.paidAt).toLocaleString('ru-RU', { timeZone: storeTimeZone })}
                      </div>
                      <div className="text-xs text-[#4b5563]">
                        {t('pavilionPaymentDetail', {
                          rent: formatMoney(item.rentPaid, currency),
                          utilities: formatMoney(item.utilitiesPaid, currency),
                          advertising: formatMoney(item.advertisingPaid, currency),
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-xl border border-[#d8d1cb] bg-white p-3">
              <h2 className="mb-2 text-sm font-semibold text-[#111111]">{t('additionalChargesHeading')}</h2>
              {!details?.items?.additionalCharges?.length ? (
                <p className="text-sm text-[#6b6b6b]">{t('noRecords')}</p>
              ) : (
                <div className="space-y-2">
                  {details.items.additionalCharges.map((item) => (
                    <div key={item.id} className="rounded-lg border border-[#e5ded8] bg-[#f8f4ef] p-2 text-sm">
                      <div className="font-medium">
                        {item.pavilionNumber}: {item.additionalChargeName}
                      </div>
                      <div className="text-xs text-[#6b6b6b]">
                        {new Date(item.paidAt).toLocaleString('ru-RU', { timeZone: storeTimeZone })}
                      </div>
                      <div className="text-xs text-[#4b5563]">
                        {t('amountLabel', { amount: formatMoney(item.amountPaid, currency) })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="mt-4 rounded-xl border border-[#d8d1cb] bg-white p-3">
            <h2 className="mb-2 text-sm font-semibold text-[#111111]">{t('storeExtraIncomeHeading')}</h2>
            {!details?.items?.storeExtraIncome?.length ? (
              <p className="text-sm text-[#6b6b6b]">{t('noRecords')}</p>
            ) : (
              <div className="space-y-2">
                {details.items.storeExtraIncome.map((item) => (
                  <div key={item.id} className="rounded-lg border border-[#e5ded8] bg-[#f8f4ef] p-2 text-sm">
                    <div className="font-medium">{item.name}</div>
                    <div className="text-xs text-[#6b6b6b]">
                      {new Date(item.paidAt).toLocaleString('ru-RU', { timeZone: storeTimeZone })}
                    </div>
                    <div className="text-xs text-[#4b5563]">
                      {t('amountLabel', { amount: formatMoney(item.amount, currency) })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="mt-4 rounded-xl border border-[#d8d1cb] bg-white p-3">
            <h2 className="mb-2 text-sm font-semibold text-[#111111]">{t('expensesHeading')}</h2>
            {!details?.items?.expenses?.length ? (
              <p className="text-sm text-[#6b6b6b]">{t('noRecords')}</p>
            ) : (
              <div className="space-y-2">
                {details.items.expenses.map((item) => (
                    <div key={item.id} className="rounded-lg border border-[#e5ded8] bg-[#f8f4ef] p-2 text-sm">
                    <div className="font-medium">
                      {item.pavilionNumber ? `${item.pavilionNumber}: ` : ''}
                      {formatExpenseTitle(item.note, item.type, t('staffSalaryExpense'))}
                    </div>
                    <div className="text-xs text-[#6b6b6b]">
                      {new Date(item.paidAt).toLocaleString('ru-RU', { timeZone: storeTimeZone })}
                    </div>
                    <div className="text-xs text-rose-700">
                      {t('expenseAmountLabel', { amount: formatMoney(item.total, currency) })}
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
