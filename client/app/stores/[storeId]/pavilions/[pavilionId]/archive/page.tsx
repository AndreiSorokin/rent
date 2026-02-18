'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { formatMoney } from '@/lib/currency';
import { hasPermission } from '@/lib/permissions';
import { getPavilion } from '@/lib/pavilions';
import { Pavilion } from '../pavilion.types';

type ArchiveMonth = {
  key: string;
  label: string;
  totals: {
    rent: number;
    utilities: number;
    advertising: number;
    additional: number;
    bankTransfer: number;
    cashbox1: number;
    cashbox2: number;
    total: number;
  };
  rentPayments: Array<{
    id: number;
    date: string;
    rent: number;
    utilities: number;
    advertising: number;
    bankTransfer: number;
    cashbox1: number;
    cashbox2: number;
  }>;
  additionalPayments: Array<{
    id: number;
    date: string;
    chargeName: string;
    amount: number;
    bankTransfer: number;
    cashbox1: number;
    cashbox2: number;
  }>;
};

function getMonthKey(value: Date) {
  const y = value.getFullYear();
  const m = String(value.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

function getMonthLabel(monthKey: string) {
  const [y, m] = monthKey.split('-').map(Number);
  const date = new Date(y, (m || 1) - 1, 1);
  return date.toLocaleDateString('ru-RU', {
    month: 'long',
    year: 'numeric',
  });
}

function buildArchiveMonths(pavilion: Pavilion): ArchiveMonth[] {
  const now = new Date();
  const currentMonthKey = getMonthKey(new Date(now.getFullYear(), now.getMonth(), 1));
  const map = new Map<string, ArchiveMonth>();

  const ensureMonth = (key: string) => {
    const existing = map.get(key);
    if (existing) return existing;

    const next: ArchiveMonth = {
      key,
      label: getMonthLabel(key),
      totals: {
        rent: 0,
        utilities: 0,
        advertising: 0,
        additional: 0,
        bankTransfer: 0,
        cashbox1: 0,
        cashbox2: 0,
        total: 0,
      },
      rentPayments: [],
      additionalPayments: [],
    };
    map.set(key, next);
    return next;
  };

  for (const payment of pavilion.paymentTransactions || []) {
    const paymentDate = new Date(payment.createdAt || payment.period);
    const monthKey = getMonthKey(paymentDate);
    if (monthKey >= currentMonthKey) continue;

    const month = ensureMonth(monthKey);
    const rent = Number(payment.rentPaid ?? 0);
    const utilities = Number(payment.utilitiesPaid ?? 0);
    const advertising = Number(payment.advertisingPaid ?? 0);
    const bankTransfer = Number(payment.bankTransferPaid ?? 0);
    const cashbox1 = Number(payment.cashbox1Paid ?? 0);
    const cashbox2 = Number(payment.cashbox2Paid ?? 0);
    const total = rent + utilities + advertising;

    month.totals.rent += rent;
    month.totals.utilities += utilities;
    month.totals.advertising += advertising;
    month.totals.bankTransfer += bankTransfer;
    month.totals.cashbox1 += cashbox1;
    month.totals.cashbox2 += cashbox2;
    month.totals.total += total;

    month.rentPayments.push({
      id: payment.id,
      date: payment.createdAt,
      rent,
      utilities,
      advertising,
      bankTransfer,
      cashbox1,
      cashbox2,
    });
  }

  for (const charge of pavilion.additionalCharges || []) {
    for (const chargePayment of charge.payments || []) {
      const paidAt = new Date(chargePayment.paidAt);
      const monthKey = getMonthKey(paidAt);
      if (monthKey >= currentMonthKey) continue;

      const month = ensureMonth(monthKey);
      const amount = Number(chargePayment.amountPaid ?? 0);
      const bankTransfer = Number(chargePayment.bankTransferPaid ?? 0);
      const cashbox1 = Number(chargePayment.cashbox1Paid ?? 0);
      const cashbox2 = Number(chargePayment.cashbox2Paid ?? 0);

      month.totals.additional += amount;
      month.totals.bankTransfer += bankTransfer;
      month.totals.cashbox1 += cashbox1;
      month.totals.cashbox2 += cashbox2;
      month.totals.total += amount;

      month.additionalPayments.push({
        id: chargePayment.id,
        date: chargePayment.paidAt,
        chargeName: charge.name,
        amount,
        bankTransfer,
        cashbox1,
        cashbox2,
      });
    }
  }

  const months = Array.from(map.values()).sort((a, b) => b.key.localeCompare(a.key));
  for (const month of months) {
    month.rentPayments.sort((a, b) => b.date.localeCompare(a.date));
    month.additionalPayments.sort((a, b) => b.date.localeCompare(a.date));
  }
  return months;
}

export default function PavilionArchivePage() {
  const params = useParams();
  const router = useRouter();
  const storeId = Number(params.storeId);
  const pavilionId = Number(params.pavilionId);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [pavilion, setPavilion] = useState<Pavilion | null>(null);
  const [currency, setCurrency] = useState<'RUB' | 'KZT'>('RUB');

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const [storeData, pavilionData] = await Promise.all([
          apiFetch<{ permissions?: string[]; currency?: 'RUB' | 'KZT' }>(
            `/stores/${storeId}`,
          ),
          getPavilion<Pavilion>(storeId, pavilionId),
        ]);

        const nextPermissions = storeData.permissions || [];
        if (!hasPermission(nextPermissions, 'VIEW_PAYMENTS')) {
          router.replace(`/stores/${storeId}/pavilions/${pavilionId}`);
          return;
        }

        setPermissions(nextPermissions);
        setCurrency(storeData.currency || pavilionData.store?.currency || 'RUB');
        setPavilion(pavilionData);
      } catch (err) {
        console.error(err);
        setError('Не удалось загрузить бухгалтерский архив');
      } finally {
        setLoading(false);
      }
    };

    if (storeId && pavilionId) load();
  }, [pavilionId, router, storeId]);

  const months = useMemo(
    () => (pavilion ? buildArchiveMonths(pavilion) : []),
    [pavilion],
  );

  if (loading) return <div className="p-6 text-center text-lg">Загрузка...</div>;
  if (error) return <div className="p-6 text-center text-red-600">{error}</div>;
  if (!pavilion) return <div className="p-6 text-center text-red-600">Павильон не найден</div>;
  if (!hasPermission(permissions, 'VIEW_PAYMENTS')) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-8">
        <div className="space-y-2">
          <Link
            href={`/stores/${storeId}/pavilions/${pavilionId}`}
            className="inline-block text-blue-600 hover:underline"
          >
            Назад к павильону
          </Link>
          <h1 className="text-2xl font-bold md:text-3xl">
            Бухгалтерский архив: павильон {pavilion.number}
          </h1>
          <p className="text-sm text-gray-600">
            Показаны платежи за предыдущие месяцы, сгруппированные по месяцам.
          </p>
        </div>

        {months.length === 0 ? (
          <div className="rounded-xl bg-white p-6 shadow">
            <p className="text-gray-600">Архивных платежей пока нет.</p>
          </div>
        ) : (
          months.map((month) => (
            <div key={month.key} className="rounded-xl bg-white p-6 shadow">
              <h2 className="mb-4 text-xl font-semibold capitalize">{month.label}</h2>

              <div className="mb-5 grid grid-cols-1 gap-2 rounded-lg bg-gray-50 p-3 text-sm md:grid-cols-2">
                <div>Аренда: {formatMoney(month.totals.rent, currency)}</div>
                <div>Коммунальные: {formatMoney(month.totals.utilities, currency)}</div>
                <div>Реклама: {formatMoney(month.totals.advertising, currency)}</div>
                <div>Доп. начисления: {formatMoney(month.totals.additional, currency)}</div>
                <div>Безналичные: {formatMoney(month.totals.bankTransfer, currency)}</div>
                <div>Наличные касса 1: {formatMoney(month.totals.cashbox1, currency)}</div>
                <div>Наличные касса 2: {formatMoney(month.totals.cashbox2, currency)}</div>
                <div className="font-semibold">Итого: {formatMoney(month.totals.total, currency)}</div>
              </div>

              <div className="space-y-5">
                <div>
                  <h3 className="mb-2 font-medium">Платежи аренды/коммуналки/рекламы</h3>
                  {month.rentPayments.length === 0 ? (
                    <p className="text-sm text-gray-500">Нет записей за этот месяц</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">Дата</th>
                            <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">Аренда</th>
                            <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">Коммунальные</th>
                            <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">Реклама</th>
                            <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">Безналичные</th>
                            <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">Касса 1</th>
                            <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">Касса 2</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {month.rentPayments.map((item) => (
                            <tr key={item.id}>
                              <td className="px-4 py-2 text-sm">
                                {new Date(item.date).toLocaleDateString('ru-RU')}
                              </td>
                              <td className="px-4 py-2 text-sm">{formatMoney(item.rent, currency)}</td>
                              <td className="px-4 py-2 text-sm">{formatMoney(item.utilities, currency)}</td>
                              <td className="px-4 py-2 text-sm">{formatMoney(item.advertising, currency)}</td>
                              <td className="px-4 py-2 text-sm">{formatMoney(item.bankTransfer, currency)}</td>
                              <td className="px-4 py-2 text-sm">{formatMoney(item.cashbox1, currency)}</td>
                              <td className="px-4 py-2 text-sm">{formatMoney(item.cashbox2, currency)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                <div>
                  <h3 className="mb-2 font-medium">Оплаты дополнительных начислений</h3>
                  {month.additionalPayments.length === 0 ? (
                    <p className="text-sm text-gray-500">Нет записей за этот месяц</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">Дата</th>
                            <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">Начисление</th>
                            <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">Сумма</th>
                            <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">Безналичные</th>
                            <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">Касса 1</th>
                            <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">Касса 2</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {month.additionalPayments.map((item) => (
                            <tr key={`${item.id}-${item.chargeName}`}>
                              <td className="px-4 py-2 text-sm">
                                {new Date(item.date).toLocaleDateString('ru-RU')}
                              </td>
                              <td className="px-4 py-2 text-sm">{item.chargeName}</td>
                              <td className="px-4 py-2 text-sm">{formatMoney(item.amount, currency)}</td>
                              <td className="px-4 py-2 text-sm">{formatMoney(item.bankTransfer, currency)}</td>
                              <td className="px-4 py-2 text-sm">{formatMoney(item.cashbox1, currency)}</td>
                              <td className="px-4 py-2 text-sm">{formatMoney(item.cashbox2, currency)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
