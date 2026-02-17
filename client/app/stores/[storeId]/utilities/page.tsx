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
  const [orderedPavilionIds, setOrderedPavilionIds] = useState<number[]>([]);
  const [draggedPavilionId, setDraggedPavilionId] = useState<number | null>(null);
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

  const defaultSortedPavilions: Pavilion[] = useMemo(() => {
    return [...(store?.pavilions || [])].sort((a, b) => {
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
  }, [store?.pavilions]);

  useEffect(() => {
    if (!storeId || defaultSortedPavilions.length === 0) {
      setOrderedPavilionIds([]);
      return;
    }

    const storageKey = `utilities-order-${storeId}`;
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed: unknown = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          const idSet = new Set(defaultSortedPavilions.map((p) => p.id));
          const restored = parsed
            .map((v) => Number(v))
            .filter((id) => Number.isFinite(id) && idSet.has(id));
          const missing = defaultSortedPavilions
            .map((p) => p.id)
            .filter((id) => !restored.includes(id));
          setOrderedPavilionIds([...restored, ...missing]);
          return;
        }
      }
    } catch (err) {
      console.warn('Failed to restore pavilion order', err);
    }

    setOrderedPavilionIds(defaultSortedPavilions.map((p) => p.id));
  }, [storeId, defaultSortedPavilions]);

  useEffect(() => {
    if (!storeId || orderedPavilionIds.length === 0) return;
    const storageKey = `utilities-order-${storeId}`;
    try {
      localStorage.setItem(storageKey, JSON.stringify(orderedPavilionIds));
    } catch (err) {
      console.warn('Failed to persist pavilion order', err);
    }
  }, [storeId, orderedPavilionIds]);

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

  const pavilionMap = new Map<number, Pavilion>(
    (store.pavilions || []).map((p: Pavilion) => [p.id, p]),
  );
  const pavilions: Pavilion[] =
    orderedPavilionIds.length > 0
      ? orderedPavilionIds
          .map((id) => pavilionMap.get(id))
          .filter((p): p is Pavilion => Boolean(p))
      : defaultSortedPavilions;

  const movePavilion = (dragId: number, targetId: number) => {
    if (dragId === targetId) return;
    setOrderedPavilionIds((prev) => {
      const source = prev.length > 0 ? [...prev] : defaultSortedPavilions.map((p) => p.id);
      const fromIndex = source.indexOf(dragId);
      const toIndex = source.indexOf(targetId);
      if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) return source;

      const [moved] = source.splice(fromIndex, 1);
      source.splice(toIndex, 0, moved);
      return source;
    });
  };

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
                      Перенос
                    </th>
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
                      <tr
                        key={p.id}
                        onDragOver={(e) => {
                          if (draggedPavilionId == null) return;
                          e.preventDefault();
                          e.dataTransfer.dropEffect = 'move';
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          if (draggedPavilionId == null) return;
                          movePavilion(draggedPavilionId, p.id);
                          setDraggedPavilionId(null);
                        }}
                      >
                        <td className="px-4 py-3 text-sm text-gray-700">
                          <button
                            type="button"
                            draggable
                            onDragStart={(e) => {
                              setDraggedPavilionId(p.id);
                              e.dataTransfer.effectAllowed = 'move';
                            }}
                            onDragEnd={() => setDraggedPavilionId(null)}
                            className="cursor-grab select-none rounded px-2 py-1 text-lg leading-none text-gray-500 hover:bg-gray-100 active:cursor-grabbing"
                            title="Потяните, чтобы изменить порядок"
                            aria-label={`Переместить павильон ${p.number}`}
                          >
                            ⋮⋮
                          </button>
                        </td>
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
