'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { getCurrencySymbol } from '@/lib/currency';
import { hasPermission } from '@/lib/permissions';
import { useToast } from '@/components/toast/ToastProvider';
import { reorderPavilions, updatePavilion } from '@/lib/pavilions';
import { StoreSidebar } from '../components/StoreSidebar';

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
  const toast = useToast();

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

        initialUtilities[p.id] = p.utilitiesAmount == null ? '' : String(p.utilitiesAmount);
        initialAdvertising[p.id] =
          p.advertisingAmount == null ? '' : String(p.advertisingAmount);
      });
      setUtilitiesById(initialUtilities);
      setAdvertisingById(initialAdvertising);
      setError(null);
    } catch (err) {
      console.error(err);
      setError('Не удалось загрузить данные магазина');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (storeId) void fetchData();
  }, [storeId]);

  const defaultSortedPavilions: Pavilion[] = useMemo(
    () => [...(store?.pavilions || [])],
    [store?.pavilions],
  );

  useEffect(() => {
    if (!storeId || defaultSortedPavilions.length === 0) {
      setOrderedPavilionIds([]);
      return;
    }

    setOrderedPavilionIds(defaultSortedPavilions.map((p) => p.id));
  }, [storeId, defaultSortedPavilions]);

  const permissions = useMemo(() => store?.permissions || [], [store]);
  const hasPaymentsAccess =
    hasPermission(permissions, 'VIEW_PAYMENTS') &&
    hasPermission(permissions, 'EDIT_PAYMENTS');
  const canReorderPavilions = hasPermission(permissions, 'EDIT_PAVILIONS');
  const currencySymbol = getCurrencySymbol(store?.currency ?? 'RUB');

  const pavilions = useMemo(() => {
    if (!orderedPavilionIds.length) return defaultSortedPavilions;
    const byId = new Map(defaultSortedPavilions.map((p) => [p.id, p]));
    const ordered = orderedPavilionIds
      .map((id) => byId.get(id))
      .filter((p): p is Pavilion => Boolean(p));
    const missing = defaultSortedPavilions.filter((p) => !ordered.some((o) => o.id === p.id));
    return [...ordered, ...missing];
  }, [defaultSortedPavilions, orderedPavilionIds]);

  const movePavilion = async (draggedId: number, targetId: number) => {
    if (draggedId === targetId) return;
    const current = orderedPavilionIds.length
      ? [...orderedPavilionIds]
      : defaultSortedPavilions.map((p) => p.id);
    const from = current.indexOf(draggedId);
    const to = current.indexOf(targetId);
    if (from < 0 || to < 0 || from === to) return;

    current.splice(from, 1);
    current.splice(to, 0, draggedId);

    const previousOrder = orderedPavilionIds;
    setOrderedPavilionIds(current);
    try {
      await reorderPavilions(storeId, current);
    } catch (err) {
      console.error(err);
      setOrderedPavilionIds(previousOrder);
      await fetchData();
    }
  };

  const handleUtilitiesChange = (pavilionId: number, value: string) => {
    setUtilitiesById((prev) => ({ ...prev, [pavilionId]: value }));
  };

  const handleAdvertisingChange = (pavilionId: number, value: string) => {
    setAdvertisingById((prev) => ({ ...prev, [pavilionId]: value }));
  };

  const handleSaveAll = async () => {
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
        toast.error(`Некорректная сумма у павильона ${pavilion.number}`);
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
      await Promise.all(updates.map(({ pavilion, payload }) => updatePavilion(storeId, pavilion.id, payload)));

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
      toast.success('Все значения сохранены');
    } catch (err) {
      console.error(err);
      toast.error('Не удалось сохранить все значения');
    } finally {
      setSavingAll(false);
    }
  };

  if (loading) return <div className="p-6 text-center text-lg">Загрузка...</div>;
  if (error) return <div className="p-6 text-center text-red-600">{error}</div>;
  if (!store) return <div className="p-6 text-center text-red-600">Магазин не найден</div>;

  const inputClass =
    'w-32 rounded-xl border border-[#d8d1cb] bg-[#f8f4ef] px-2 py-1 text-sm text-[#111111] outline-none transition focus:border-[#ff6a13] focus:bg-white focus:ring-2 focus:ring-[#ff6a13]/20';

  if (!hasPaymentsAccess) {
    return (
      <div className="p-6">
        <div className="rounded-xl border border-[#ef4444]/30 bg-[#ef4444]/10 p-4 text-sm font-medium text-[#b91c1c]">
          Недостаточно прав для просмотра и редактирования коммунальных счетов.
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f6f1eb]">
      <div className="mx-auto flex max-w-[1600px] gap-6 px-3 py-1 md:px-6 md:py-6">
        <StoreSidebar storeId={storeId} store={store} />
        <main className="min-w-0 flex-1">
          <div className="mx-auto max-w-6xl space-y-6 p-4 md:space-y-8 md:p-2">
            <div className="rounded-2xl border border-[#d8d1cb] bg-white p-6 shadow-[0_12px_36px_-20px_rgba(17,17,17,0.2)] md:p-8">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <h1 className="mt-2 text-2xl font-bold text-[#111111] md:text-3xl">Начисления</h1>
                <p className="mt-1 text-sm text-[#6b6b6b]">
                  Валюта магазина: {store.currency} ({currencySymbol})
                </p>
              </div>
              <button
                onClick={handleSaveAll}
                disabled={savingAll || pavilions.length === 0}
                className="rounded-xl bg-[#ff6a13] px-4 py-2 font-semibold text-white transition hover:bg-[#e85a0c] disabled:opacity-60"
              >
                {savingAll ? 'Сохранение...' : 'Сохранить'}
              </button>
            </div>
              {pavilions.length === 0 ? (
                <p className="py-8 text-center text-[#6b6b6b]">В магазине пока нет павильонов</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-[#E5DED8]">
                    <thead className="bg-[#f4efeb]">
                      <tr>
                        <th className="rounded-l-xl px-4 py-3 text-left text-xs font-medium uppercase text-[#6B6B6B]">
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
                        <th className="rounded-r-xl px-4 py-3 text-left text-xs font-medium uppercase text-[#6B6B6B]">
                          Реклама
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#ece4dd] bg-white">
                      {pavilions.map((p) => {
                        const isAvailable = p.status === 'AVAILABLE';
                        const isPrepaid = p.status === 'PREPAID';

                        return (
                          <tr
                            key={p.id}
                            onDragOver={(e) => {
                              if (!canReorderPavilions) return;
                              if (draggedPavilionId == null) return;
                              e.preventDefault();
                              e.dataTransfer.dropEffect = 'move';
                            }}
                            onDrop={(e) => {
                              if (!canReorderPavilions) return;
                              e.preventDefault();
                              if (draggedPavilionId == null) return;
                              void movePavilion(draggedPavilionId, p.id);
                              setDraggedPavilionId(null);
                            }}
                          >
                            <td className="px-4 py-3 text-sm text-[#6b6b6b]">
                              <button
                                type="button"
                                draggable={canReorderPavilions}
                                onDragStart={(e) => {
                                  if (!canReorderPavilions) return;
                                  setDraggedPavilionId(p.id);
                                  e.dataTransfer.effectAllowed = 'move';
                                }}
                                onDragEnd={() => setDraggedPavilionId(null)}
                                className={`select-none rounded-lg border border-[#d8d1cb] bg-white px-2 py-1 text-lg leading-none transition ${
                                  canReorderPavilions
                                    ? 'cursor-grab text-[#6b6b6b] hover:bg-[#f8f4ef] active:cursor-grabbing'
                                    : 'cursor-not-allowed text-gray-300'
                                }`}
                                title="Потяните, чтобы изменить порядок"
                                aria-label={`Переместить павильон ${p.number}`}
                              >
                                ⋮⋮
                              </button>
                            </td>
                            <td className="px-4 py-3 text-sm font-semibold text-[#111111]">
                              {p.number}
                            </td>
                            <td className="px-4 py-3 text-sm text-[#6b6b6b]">{p.tenantName || '-'}</td>
                            <td className="px-4 py-3 text-sm text-[#6b6b6b]">
                              {isAvailable || isPrepaid ? (
                                <div className="w-32 rounded-xl border border-[#e2d9d1] bg-[#f1ece6] px-2 py-1 text-sm text-[#8a8a8a]">
                                  {isAvailable ? '-' : 'Недоступно'}
                                </div>
                              ) : (
                                <input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={utilitiesById[p.id] ?? ''}
                                  onChange={(e) => handleUtilitiesChange(p.id, e.target.value)}
                                  className={inputClass}
                                  placeholder="0"
                                />
                              )}
                            </td>
                            <td className="px-4 py-3 text-sm text-[#6b6b6b]">
                              {isAvailable || isPrepaid ? (
                                <div className="w-32 rounded-xl border border-[#e2d9d1] bg-[#f1ece6] px-2 py-1 text-sm text-[#8a8a8a]">
                                  {isAvailable ? '-' : 'Недоступно'}
                                </div>
                              ) : (
                                <input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={advertisingById[p.id] ?? ''}
                                  onChange={(e) => handleAdvertisingChange(p.id, e.target.value)}
                                  className={inputClass}
                                  placeholder="0"
                                />
                              )}
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
        </main>
      </div>
    </div>
  );
}
