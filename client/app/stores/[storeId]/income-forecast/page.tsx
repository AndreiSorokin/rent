'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { formatMoney } from '@/lib/currency';
import { hasPermission } from '@/lib/permissions';

type ForecastBreakdownResponse = {
  period: string;
  totals: {
    rent: number;
    utilities: number;
    advertising: number;
    additional: number;
    storeExtra: number;
    total: number;
  };
  items: Array<{
    pavilionId: number;
    number: string;
    tenantName: string | null;
    status: 'AVAILABLE' | 'RENTED' | 'PREPAID';
    rent: number;
    utilities: number;
    advertising: number;
    additional: number;
    total: number;
  }>;
  storeItems?: Array<{
    id: number;
    name: string;
    amount: number;
    bankTransferPaid: number;
    cashbox1Paid: number;
    cashbox2Paid: number;
    paidAt: string;
  }>;
};

function isValidPeriod(value: string | null | undefined) {
  return Boolean(value && /^\d{4}-\d{2}$/.test(value));
}

function currentPeriod() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

const statusMap: Record<string, string> = {
  AVAILABLE: 'Свободен',
  RENTED: 'Занят',
  PREPAID: 'Предоплата',
};

export default function IncomeForecastBreakdownPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const storeId = Number(params.storeId);

  const initialPeriod = useMemo(() => {
    const fromQuery = searchParams.get('period');
    return isValidPeriod(fromQuery) ? String(fromQuery) : currentPeriod();
  }, [searchParams]);

  const [selectedPeriod, setSelectedPeriod] = useState(initialPeriod);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currency, setCurrency] = useState<'RUB' | 'KZT'>('RUB');
  const [permissions, setPermissions] = useState<string[]>([]);
  const [storeName, setStoreName] = useState('');
  const [data, setData] = useState<ForecastBreakdownResponse | null>(null);

  useEffect(() => {
    setSelectedPeriod(initialPeriod);
  }, [initialPeriod]);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const [store, breakdown] = await Promise.all([
          apiFetch<{ name?: string; currency?: 'RUB' | 'KZT'; permissions?: string[] }>(
            `/stores/${storeId}`,
          ),
          apiFetch<ForecastBreakdownResponse>(
            `/stores/${storeId}/analytics/income-forecast-breakdown?period=${encodeURIComponent(selectedPeriod)}`,
          ),
        ]);

        const nextPermissions = store.permissions || [];
        if (!hasPermission(nextPermissions, 'VIEW_PAYMENTS')) {
          router.replace(`/stores/${storeId}`);
          return;
        }

        setPermissions(nextPermissions);
        setStoreName(store.name || `Объект #${storeId}`);
        setCurrency(store.currency || 'RUB');
        setData(breakdown);
      } catch (err) {
        console.error(err);
        setError('Не удалось загрузить расшифровку прогноза доходов');
      } finally {
        setLoading(false);
      }
    };

    if (storeId && selectedPeriod) {
      void load();
    }
  }, [router, selectedPeriod, storeId]);

  const handlePeriodChange = (value: string) => {
    setSelectedPeriod(value);
    router.replace(`/stores/${storeId}/income-forecast?period=${encodeURIComponent(value)}`);
  };

  if (loading) return <div className="p-6 text-center text-lg">Загрузка...</div>;
  if (error) return <div className="p-6 text-center text-red-600">{error}</div>;
  if (!hasPermission(permissions, 'VIEW_PAYMENTS')) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-8">
        <div className="space-y-2">
          <Link href={`/stores/${storeId}/summary`} className="text-blue-600 hover:underline">
            Назад к объекту
          </Link>
          <h1 className="text-2xl font-bold md:text-3xl">Расшифровка прогноза доходов</h1>
          <p className="text-sm text-gray-600">{storeName}</p>
        </div>

        <div className="rounded-xl bg-white p-4 shadow md:p-6">
          <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="text-sm text-gray-700">
              Период расчета: <span className="font-medium">{selectedPeriod}</span>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <span className="text-gray-600">Месяц:</span>
              <input
                type="month"
                value={selectedPeriod}
                onChange={(e) => handlePeriodChange(e.target.value)}
                className="rounded border border-gray-300 px-3 py-1.5"
              />
            </label>
          </div>

          <div className="mb-4 grid grid-cols-1 gap-2 rounded-lg bg-gray-50 p-3 text-sm md:grid-cols-2">
            <div>Аренда: {formatMoney(data?.totals.rent ?? 0, currency)}</div>
            <div>Коммуналка: {formatMoney(data?.totals.utilities ?? 0, currency)}</div>
            <div>Реклама: {formatMoney(data?.totals.advertising ?? 0, currency)}</div>
            <div>Доп. начисления: {formatMoney(data?.totals.additional ?? 0, currency)}</div>
            <div>Доп приход: {formatMoney(data?.totals.storeExtra ?? 0, currency)}</div>
            <div className="font-semibold md:col-span-2">
              Итого прогноз: {formatMoney(data?.totals.total ?? 0, currency)}
            </div>
          </div>

          {!data?.items?.length ? (
            <p className="text-sm text-gray-500">Нет павильонов с прогнозом на выбранный месяц.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">Павильон</th>
                    <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">Статус</th>
                    <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">Аренда</th>
                    <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">Коммуналка</th>
                    <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">Реклама</th>
                    <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">Доп. начисления</th>
                    <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">Итого</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {data.items.map((item) => (
                    <tr key={item.pavilionId}>
                      <td className="px-4 py-2 text-sm">
                        <div className="font-medium">{item.number}</div>
                        <div className="text-xs text-gray-500">{item.tenantName || 'Без арендатора'}</div>
                      </td>
                      <td className="px-4 py-2 text-sm">{statusMap[item.status] || item.status}</td>
                      <td className="px-4 py-2 text-sm">{formatMoney(item.rent, currency)}</td>
                      <td className="px-4 py-2 text-sm">{formatMoney(item.utilities, currency)}</td>
                      <td className="px-4 py-2 text-sm">{formatMoney(item.advertising, currency)}</td>
                      <td className="px-4 py-2 text-sm">{formatMoney(item.additional, currency)}</td>
                      <td className="px-4 py-2 text-sm font-semibold">{formatMoney(item.total, currency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {(data?.storeItems || []).length > 0 && (
            <div className="mt-5">
              <h2 className="mb-2 text-base font-semibold text-gray-800">Доходы уровня объекта</h2>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">Дата</th>
                      <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">Название</th>
                      <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">Сумма</th>
                      <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">Безнал</th>
                      <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">Касса 1</th>
                      <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">Касса 2</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {(data?.storeItems || []).map((item) => (
                      <tr key={item.id}>
                        <td className="px-4 py-2 text-sm">
                          {new Date(item.paidAt).toLocaleDateString('ru-RU')}
                        </td>
                        <td className="px-4 py-2 text-sm">{item.name}</td>
                        <td className="px-4 py-2 text-sm">{formatMoney(item.amount, currency)}</td>
                        <td className="px-4 py-2 text-sm">{formatMoney(item.bankTransferPaid, currency)}</td>
                        <td className="px-4 py-2 text-sm">{formatMoney(item.cashbox1Paid, currency)}</td>
                        <td className="px-4 py-2 text-sm">{formatMoney(item.cashbox2Paid, currency)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


