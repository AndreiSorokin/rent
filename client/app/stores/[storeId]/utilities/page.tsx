'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { getCurrencySymbol } from '@/lib/currency';
import { hasPermission } from '@/lib/permissions';
import { updatePavilion } from '@/lib/pavilions';

type Pavilion = {
  id: number;
  number: string | number;
  category?: string | null;
  tenantName?: string | null;
  status: 'AVAILABLE' | 'RENTED' | 'PREPAID' | string;
  utilitiesAmount?: number | null;
  advertisingAmount?: number | null;
};

export default function UtilitiesPage() {
  const params = useParams();
  const storeId = Number(params.storeId);

  const [store, setStore] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [utilitiesById, setUtilitiesById] = useState<Record<number, string>>({});
  const [advertisingById, setAdvertisingById] = useState<Record<number, string>>({});
  const [savingAll, setSavingAll] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const storeData = await apiFetch(`/stores/${storeId}`);
      setStore(storeData);
      const initialUtilities: Record<number, string> = {};
      const initialAdvertising: Record<number, string> = {};
      (storeData.pavilions || []).forEach((p: Pavilion) => {
        if (p.status === 'PREPAID') {
          initialUtilities[p.id] = '0';
          initialAdvertising[p.id] = '0';
          return;
        }

        initialUtilities[p.id] =
          p.utilitiesAmount == null ? '' : String(p.utilitiesAmount);
        initialAdvertising[p.id] =
          p.advertisingAmount == null ? '' : String(p.advertisingAmount);
      });
      setUtilitiesById(initialUtilities);
      setAdvertisingById(initialAdvertising);
    } catch (err) {
      console.error(err);
      setError('Не удалось загрузить данные магазина');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (storeId) fetchData();
  }, [storeId]);

  const permissions = useMemo(() => store?.permissions || [], [store]);
  const hasPaymentsAccess =
    hasPermission(permissions, 'VIEW_PAYMENTS') &&
    hasPermission(permissions, 'EDIT_PAYMENTS');
  const currencySymbol = getCurrencySymbol(store?.currency ?? 'RUB');

  const handleUtilitiesChange = (pavilionId: number, value: string) => {
    setUtilitiesById((prev) => ({ ...prev, [pavilionId]: value }));
  };

  const handleAdvertisingChange = (pavilionId: number, value: string) => {
    setAdvertisingById((prev) => ({ ...prev, [pavilionId]: value }));
  };

  const handleSaveAll = async () => {
    const pavilions: Pavilion[] = store?.pavilions || [];
    const updates: Array<{
      pavilion: Pavilion;
      payload: { utilitiesAmount: number | null; advertisingAmount: number | null };
    }> = [];

    for (const pavilion of pavilions) {
      const rawUtilities = utilitiesById[pavilion.id] ?? '';
      const rawAdvertising = advertisingById[pavilion.id] ?? '';
      const utilitiesAmount = rawUtilities ? Number(rawUtilities) : 0;
      const advertisingAmount = rawAdvertising ? Number(rawAdvertising) : 0;

      if (
        Number.isNaN(utilitiesAmount) ||
        Number.isNaN(advertisingAmount) ||
        utilitiesAmount < 0 ||
        advertisingAmount < 0
      ) {
        alert(`Некорректная сумма у павильона ${pavilion.number}`);
        return;
      }

      updates.push({
        pavilion,
        payload: {
          utilitiesAmount:
            pavilion.status === 'AVAILABLE'
              ? null
              : pavilion.status === 'PREPAID'
                ? 0
                : utilitiesAmount,
          advertisingAmount:
            pavilion.status === 'AVAILABLE'
              ? null
              : pavilion.status === 'PREPAID'
                ? 0
                : advertisingAmount,
        },
      });
    }

    try {
      setSavingAll(true);
      await Promise.all(
        updates.map(({ pavilion, payload }) =>
          updatePavilion(storeId, pavilion.id, payload),
        ),
      );

      setStore((prev: any) => {
        if (!prev) return prev;
        return {
          ...prev,
          pavilions: (prev.pavilions || []).map((p: Pavilion) => {
            const updated = updates.find((u) => u.pavilion.id === p.id);
            if (!updated) return p;
            return {
              ...p,
              utilitiesAmount: updated.payload.utilitiesAmount,
              advertisingAmount: updated.payload.advertisingAmount,
            };
          }),
        };
      });
      alert('Все значения сохранены');
    } catch (err) {
      console.error(err);
      alert('Не удалось сохранить все значения');
    } finally {
      setSavingAll(false);
    }
  };

  if (loading) return <div className="p-6 text-center text-lg">Загрузка...</div>;
  if (error) return <div className="p-6 text-center text-red-600">{error}</div>;
  if (!store) return <div className="p-6 text-center text-red-600">Магазин не найден</div>;

  if (!hasPaymentsAccess) {
    return (
      <div className="p-6">
        <Link href={`/stores/${storeId}`} className="text-sm text-blue-600 hover:underline">
          Назад к магазину
        </Link>
        <div className="mt-4 rounded-lg bg-red-50 p-4 text-sm text-red-700">
          Недостаточно прав для просмотра и редактирования коммунальных счетов.
        </div>
      </div>
    );
  }

  const pavilions: Pavilion[] = [...(store.pavilions || [])].sort((a, b) => {
    const aNumber = String(a.number ?? '').trim();
    const bNumber = String(b.number ?? '').trim();
    const aNum = Number(aNumber.replace(',', '.'));
    const bNum = Number(bNumber.replace(',', '.'));

    const aIsNum = Number.isFinite(aNum);
    const bIsNum = Number.isFinite(bNum);
    if (aIsNum && bIsNum && aNum !== bNum) return aNum - bNum;
    if (aIsNum !== bIsNum) return aIsNum ? -1 : 1;

    const textCompare = aNumber.localeCompare(bNumber, 'ru');
    if (textCompare !== 0) return textCompare;
    return a.id - b.id;
  });

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-6xl space-y-6 p-4 md:space-y-8 md:p-8">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <Link href={`/stores/${storeId}`} className="text-sm text-blue-600 hover:underline">
              Назад к магазину
            </Link>
            <h1 className="mt-2 text-2xl font-bold text-gray-900 md:text-3xl">
              Начисления
            </h1>
            <p className="mt-1 text-sm text-gray-600">
              Валюта магазина: {store.currency} ({currencySymbol})
            </p>
          </div>
          <button
            onClick={handleSaveAll}
            disabled={savingAll || pavilions.length === 0}
            className="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {savingAll ? 'Сохранение...' : 'Сохранить'}
          </button>
        </div>

        <div className="rounded-xl bg-white p-6 shadow md:p-8">
          {pavilions.length === 0 ? (
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
                      Наименование организации
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                      Коммунальные
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                      Реклама
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {pavilions.map((p) => {
                    const isAvailable = p.status === 'AVAILABLE';
                    const isPrepaid = p.status === 'PREPAID';

                    return (
                      <tr key={p.id}>
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">
                          Павильон {p.number}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700">{p.tenantName || '-'}</td>
                        <td className="px-4 py-3 text-sm text-gray-700">
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={utilitiesById[p.id] ?? ''}
                            onChange={(e) => handleUtilitiesChange(p.id, e.target.value)}
                            disabled={isAvailable || isPrepaid}
                            className={`w-32 rounded border px-2 py-1 text-sm ${
                              isAvailable || isPrepaid ? 'bg-gray-100 text-gray-500' : ''
                            }`}
                            placeholder={isAvailable ? '-' : '0'}
                          />
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700">
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={advertisingById[p.id] ?? ''}
                            onChange={(e) => handleAdvertisingChange(p.id, e.target.value)}
                            disabled={isAvailable || isPrepaid}
                            className={`w-32 rounded border px-2 py-1 text-sm ${
                              isAvailable || isPrepaid ? 'bg-gray-100 text-gray-500' : ''
                            }`}
                            placeholder={isAvailable ? '-' : '0'}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
