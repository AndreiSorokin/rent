'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { formatMoney } from '@/lib/currency';
import { hasPermission } from '@/lib/permissions';
import {
  createPavilionExpense,
  deletePavilionExpense,
  listPavilionExpenses,
  updatePavilionExpense,
  type PavilionExpenseStatus,
} from '@/lib/pavilionExpenses';

type EditModalState = {
  id: number;
  note: string;
  amount: string;
  status: 'UNPAID' | 'PAID';
  bankTransferPaid: number;
  cashbox1Paid: number;
  cashbox2Paid: number;
};

function paymentChannelsLines(
  bankTransferPaid: number | null | undefined,
  cashbox1Paid: number | null | undefined,
  cashbox2Paid: number | null | undefined,
  currency: 'RUB' | 'KZT',
) {
  const lines: string[] = [];
  const bank = Number(bankTransferPaid ?? 0);
  const cash1 = Number(cashbox1Paid ?? 0);
  const cash2 = Number(cashbox2Paid ?? 0);

  if (bank > 0) lines.push(`Безналичные: ${formatMoney(bank, currency)}`);
  if (cash1 > 0) lines.push(`Наличные касса 1: ${formatMoney(cash1, currency)}`);
  if (cash2 > 0) lines.push(`Наличные касса 2: ${formatMoney(cash2, currency)}`);

  return lines;
}

function isSameUtcMonth(dateValue: string | Date | null | undefined, year: number, month: number) {
  if (!dateValue) return false;
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return false;
  return date.getUTCFullYear() === year && date.getUTCMonth() === month;
}

export default function StoreOtherExpensesPage() {
  const params = useParams();
  const router = useRouter();
  const storeId = Number(params.storeId);

  const [store, setStore] = useState<any>(null);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [createModal, setCreateModal] = useState<{ note: string; amount: string } | null>(null);
  const [editModal, setEditModal] = useState<EditModalState | null>(null);

  const fetchStore = async () => {
    setLoading(true);
    try {
      const data = await apiFetch<any>(`/stores/${storeId}?lite=true`);
      if (!hasPermission(data.permissions || [], 'VIEW_CHARGES')) {
        router.replace(`/stores/${storeId}`);
        return;
      }
      const expensesData = await listPavilionExpenses(storeId);
      setStore(data);
      setExpenses(expensesData || []);
      setError(null);
    } catch (err) {
      console.error(err);
      setError('Не удалось загрузить прочие расходы');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (storeId) {
      void fetchStore();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeId]);

  const permissions = useMemo(() => store?.permissions || [], [store]);
  const canCreate = hasPermission(permissions, 'CREATE_CHARGES');
  const canEdit = hasPermission(permissions, 'EDIT_CHARGES');
  const canDelete = hasPermission(permissions, 'DELETE_CHARGES');
  const currency: 'RUB' | 'KZT' = store?.currency ?? 'RUB';

  const otherExpenses = useMemo(() => {
    const now = new Date();
    const year = now.getUTCFullYear();
    const month = now.getUTCMonth();

    return expenses
      .filter((item: any) => item.type === 'OTHER')
      .filter((item: any) => isSameUtcMonth(item.createdAt, year, month))
      .sort(
        (a: any, b: any) =>
          new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime(),
      );
  }, [expenses]);

  const handleCreate = async () => {
    if (!createModal) return;

    const note = createModal.note.trim();
    const amount = Number(createModal.amount);
    if (!note || Number.isNaN(amount) || amount <= 0) {
      alert('Введите корректные название и сумму');
      return;
    }

    try {
      setSaving(true);
      await createPavilionExpense(storeId, {
        type: 'OTHER',
        amount,
        note,
        status: 'UNPAID',
      });
      setCreateModal(null);
      await fetchStore();
    } catch (err) {
      console.error(err);
      alert('Не удалось добавить прочий расход');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!editModal) return;

    const amount = Number(editModal.amount);
    const note = editModal.note.trim();
    const bank = Number(editModal.bankTransferPaid || 0);
    const cash1 = Number(editModal.cashbox1Paid || 0);
    const cash2 = Number(editModal.cashbox2Paid || 0);

    if (!note || Number.isNaN(amount) || amount <= 0) {
      alert('Введите корректные название и сумму');
      return;
    }

    if (editModal.status === 'PAID') {
      if ([bank, cash1, cash2].some((value) => Number.isNaN(value) || value < 0)) {
        alert('Суммы по каналам оплаты должны быть неотрицательными');
        return;
      }
      if (Math.abs(bank + cash1 + cash2 - amount) > 0.01) {
        alert('Сумма по каналам оплаты должна совпадать с суммой расхода');
        return;
      }
    }

    try {
      setSaving(true);
      const payload: {
        note: string;
        amount: number;
        status: PavilionExpenseStatus;
        bankTransferPaid?: number;
        cashbox1Paid?: number;
        cashbox2Paid?: number;
      } = {
        note,
        amount,
        status: editModal.status,
      };

      if (editModal.status === 'PAID') {
        payload.bankTransferPaid = bank;
        payload.cashbox1Paid = cash1;
        payload.cashbox2Paid = cash2;
      }

      await updatePavilionExpense(storeId, editModal.id, payload);
      setEditModal(null);
      await fetchStore();
    } catch (err) {
      console.error(err);
      alert('Не удалось обновить прочий расход');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (expenseId: number) => {
    if (!confirm('Удалить этот расход?')) return;
    try {
      setSaving(true);
      await deletePavilionExpense(storeId, expenseId);
      await fetchStore();
    } catch (err) {
      console.error(err);
      alert('Не удалось удалить расход');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-6 text-center text-lg">Загрузка...</div>;
  if (error) return <div className="p-6 text-center text-red-600">{error}</div>;
  if (!store) return null;

  return (
    <div className="min-h-screen bg-[#f6f1eb]">
      <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <Link
              href={`/stores/${storeId}`}
              className="inline-flex items-center rounded-xl border border-[#d8d1cb] bg-white px-3 py-1.5 text-sm font-medium text-[#111111] transition hover:bg-[#f4efeb]"
            >
              Назад к объекту
            </Link>
            <h1 className="mt-2 text-2xl font-bold text-[#111111] md:text-3xl">Все прочие расходы</h1>
            <p className="mt-1 text-sm text-[#6b6b6b]">Показаны расходы текущего месяца</p>
          </div>
          {canCreate && (
            <button
              onClick={() => setCreateModal({ note: '', amount: '' })}
              className="rounded-xl bg-[#ff6a13] px-4 py-2.5 font-semibold text-white transition hover:bg-[#e85a0c]"
            >
              Добавить
            </button>
          )}
        </div>

        <section className="rounded-2xl border border-[#d8d1cb] bg-white p-6 shadow-[0_12px_36px_-20px_rgba(17,17,17,0.2)] md:p-8">
          {otherExpenses.length === 0 ? (
            <p className="text-[#6b6b6b]">Расходов пока нет</p>
          ) : (
            <div className="space-y-2">
              <div className="hidden items-center gap-3 rounded-lg border border-[#D8D1CB] bg-[#F4EFEB] px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-[#6B6B6B] md:grid md:grid-cols-[minmax(180px,1fr)_minmax(240px,2fr)_minmax(110px,1fr)_minmax(170px,auto)]">
                <div className="text-center">Название и статус</div>
                <div className="text-center">Каналы оплаты</div>
                <div className="text-center">Сумма</div>
                <div className="text-center">Действия</div>
              </div>

              {otherExpenses.map((expense: any) => (
                <article key={expense.id} className="rounded-xl border border-[#D8D1CB] bg-white px-4 py-2.5">
                  <div className="grid items-center gap-2 md:grid-cols-[minmax(180px,1fr)_minmax(240px,2fr)_minmax(110px,1fr)_minmax(170px,auto)] md:gap-3">
                    <div className="min-w-0 md:text-center">
                      <p className="truncate text-sm font-semibold text-slate-900 md:mx-auto md:max-w-[260px]">
                        {expense.note || 'Прочий расход'}
                      </p>
                      <span
                        className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                          expense.status === 'PAID'
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-amber-100 text-amber-700'
                        }`}
                      >
                        {expense.status === 'PAID' ? 'Оплачено' : 'Не оплачено'}
                      </span>
                    </div>

                    <div className="min-w-0 text-[11px] text-slate-600 md:text-center">
                      <div className="md:mx-auto md:max-w-[260px] font-semibold text-slate-900">
                        {(expense.status ?? 'UNPAID') === 'PAID' ? (
                          (() => {
                            const lines = paymentChannelsLines(
                              expense.bankTransferPaid,
                              expense.cashbox1Paid,
                              expense.cashbox2Paid,
                              currency,
                            );
                            if (!lines.length) return <div>Каналы оплаты не заданы</div>;
                            return lines.map((line) => <div key={`${expense.id}-${line}`}>{line}</div>);
                          })()
                        ) : (
                          <div>Каналы оплаты не заданы</div>
                        )}
                      </div>
                    </div>

                    <div className="text-left md:text-center">
                      <p className="text-sm font-bold text-slate-900">{formatMoney(expense.amount, currency)}</p>
                    </div>

                    <div className="flex items-center justify-start gap-2 md:flex-col md:items-center md:justify-center md:gap-1.5">
                      {canEdit && (
                        <button
                          onClick={() => {
                            const amount = Number(expense.amount ?? 0);
                            const bank = Number(expense.bankTransferPaid ?? 0);
                            const cash1 = Number(expense.cashbox1Paid ?? 0);
                            const cash2 = Number(expense.cashbox2Paid ?? 0);
                            const hasChannels = bank + cash1 + cash2 > 0;

                            setEditModal({
                              id: Number(expense.id),
                              note: String(expense.note ?? ''),
                              amount: String(amount),
                              status: (expense.status as 'UNPAID' | 'PAID') ?? 'UNPAID',
                              bankTransferPaid:
                                (expense.status as 'UNPAID' | 'PAID') === 'PAID'
                                  ? hasChannels
                                    ? bank
                                    : amount
                                  : bank,
                              cashbox1Paid: cash1,
                              cashbox2Paid: cash2,
                            });
                          }}
                          className="rounded-lg border border-[#CFC6BF] bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-[#ede7e2]"
                        >
                          Оплатить/Изменить
                        </button>
                      )}

                      {canDelete && (
                        <button
                          onClick={() => handleDelete(expense.id)}
                          className="rounded-lg border border-red-200 px-2.5 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
                        >
                          Удалить
                        </button>
                      )}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>

      {createModal && (
        <div className="fixed inset-0 z-[95] flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl border border-[#D8D1CB] bg-white p-5 shadow-xl">
            <h3 className="text-lg font-semibold text-slate-900">Новый прочий расход</h3>
            <p className="mt-1 text-sm text-slate-600">
              Создаётся в статусе «Не оплачено». Каналы оплаты указываются при оплате.
            </p>

            <div className="mt-4 space-y-3">
              <input
                type="text"
                value={createModal.note}
                onChange={(e) =>
                  setCreateModal((prev) => (prev ? { ...prev, note: e.target.value } : prev))
                }
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
                placeholder="Название расхода"
              />
              <input
                type="number"
                step="0.01"
                min="0"
                value={createModal.amount}
                onChange={(e) =>
                  setCreateModal((prev) => (prev ? { ...prev, amount: e.target.value } : prev))
                }
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
                placeholder="Сумма"
              />
            </div>

            <div className="mt-5 flex justify-end gap-3">
              <button
                onClick={() => setCreateModal(null)}
                disabled={saving}
                className="rounded-lg border px-4 py-2 hover:bg-slate-100 disabled:opacity-60"
              >
                Отмена
              </button>
              <button
                onClick={handleCreate}
                disabled={saving}
                className="rounded-lg bg-[#FF6A13] px-4 py-2 font-medium text-white hover:bg-[#E65C00] disabled:opacity-60"
              >
                {saving ? 'Сохранение...' : 'Сохранить'}
              </button>
            </div>
          </div>
        </div>
      )}

      {editModal && (
        <div className="fixed inset-0 z-[95] flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl border border-[#D8D1CB] bg-white p-5 shadow-xl">
            <h3 className="text-lg font-semibold text-slate-900">Изменить прочий расход</h3>

            <div className="mt-4 space-y-3">
              <input
                type="text"
                value={editModal.note}
                onChange={(e) =>
                  setEditModal((prev) => (prev ? { ...prev, note: e.target.value } : prev))
                }
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
                placeholder="Название расхода"
              />

              <input
                type="number"
                step="0.01"
                min="0"
                value={editModal.amount}
                onChange={(e) =>
                  setEditModal((prev) => (prev ? { ...prev, amount: e.target.value } : prev))
                }
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
                placeholder="Сумма"
              />

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Статус оплаты</label>
                <select
                  value={editModal.status}
                  onChange={(e) =>
                    setEditModal((prev) => {
                      if (!prev) return prev;
                      const nextStatus = e.target.value as 'UNPAID' | 'PAID';
                      if (nextStatus === 'UNPAID') {
                        return { ...prev, status: 'UNPAID' };
                      }
                      const amountValue = Number(prev.amount || 0);
                      return {
                        ...prev,
                        status: 'PAID',
                        bankTransferPaid:
                          Number.isFinite(amountValue) && amountValue > 0 ? amountValue : prev.bankTransferPaid,
                        cashbox1Paid: 0,
                        cashbox2Paid: 0,
                      };
                    })
                  }
                  className="w-full rounded-lg border border-slate-300 px-3 py-2"
                >
                  <option value="UNPAID">Не оплачено</option>
                  <option value="PAID">Оплачено</option>
                </select>
              </div>

              {editModal.status === 'PAID' && (
                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">Безналичные</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={editModal.bankTransferPaid}
                      onChange={(e) =>
                        setEditModal((prev) =>
                          prev
                            ? {
                                ...prev,
                                bankTransferPaid:
                                  e.target.value === '' ? 0 : Number(e.target.value),
                              }
                            : prev,
                        )
                      }
                      className="w-full rounded-lg border border-slate-300 px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">Наличные касса 1</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={editModal.cashbox1Paid}
                      onChange={(e) =>
                        setEditModal((prev) =>
                          prev
                            ? {
                                ...prev,
                                cashbox1Paid: e.target.value === '' ? 0 : Number(e.target.value),
                              }
                            : prev,
                        )
                      }
                      className="w-full rounded-lg border border-slate-300 px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">Наличные касса 2</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={editModal.cashbox2Paid}
                      onChange={(e) =>
                        setEditModal((prev) =>
                          prev
                            ? {
                                ...prev,
                                cashbox2Paid: e.target.value === '' ? 0 : Number(e.target.value),
                              }
                            : prev,
                        )
                      }
                      className="w-full rounded-lg border border-slate-300 px-3 py-2"
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="mt-5 flex justify-end gap-3">
              <button
                onClick={() => setEditModal(null)}
                disabled={saving}
                className="rounded-lg border px-4 py-2 hover:bg-slate-100 disabled:opacity-60"
              >
                Отмена
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={saving}
                className="rounded-lg bg-[#FF6A13] px-4 py-2 font-medium text-white hover:bg-[#E65C00] disabled:opacity-60"
              >
                {saving ? 'Сохранение...' : 'Сохранить'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
