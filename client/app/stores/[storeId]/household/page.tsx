'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { formatMoney } from '@/lib/currency';
import { hasPermission } from '@/lib/permissions';
import { apiFetch } from '@/lib/api';
import {
  createHouseholdExpense,
  deleteHouseholdExpense,
  getHouseholdExpenses,
  updateHouseholdExpense,
} from '@/lib/householdExpenses';
import { ExpenseCreatePaidModal, ExpenseEditModal } from '../components/ExpenseModals';
import { StoreSidebar } from '../components/StoreSidebar';

function paymentChannelsLines(
  bankTransferPaid?: number | null,
  cashbox1Paid?: number | null,
  cashbox2Paid?: number | null,
  currency: 'RUB' | 'KZT' = 'RUB',
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

export default function StoreHouseholdPage() {
  const params = useParams();
  const router = useRouter();
  const storeId = Number(params.storeId);

  const [store, setStore] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [createModal, setCreateModal] = useState<{
    name: string;
    bankTransferPaid: string;
    cashbox1Paid: string;
    cashbox2Paid: string;
  } | null>(null);
  const [editModal, setEditModal] = useState<{
    id: number;
    name: string;
    amount: number;
    status: 'UNPAID' | 'PAID';
    bankTransferPaid: string;
    cashbox1Paid: string;
    cashbox2Paid: string;
  } | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [storeData, expenses] = await Promise.all([
        apiFetch<any>(`/stores/${storeId}?lite=true`),
        getHouseholdExpenses(storeId),
      ]);
      if (!hasPermission(storeData.permissions || [], 'VIEW_CHARGES')) {
        router.replace(`/stores/${storeId}`);
        return;
      }
      setStore(storeData);
      setItems(expenses || []);
      setError(null);
    } catch (err) {
      console.error(err);
      setError('Не удалось загрузить хозяйственные расходы');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (storeId) void fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeId]);

  const permissions = store?.permissions || [];
  const currency: 'RUB' | 'KZT' = store?.currency ?? 'RUB';
  const canCreate = hasPermission(permissions, 'CREATE_CHARGES');
  const canEdit = hasPermission(permissions, 'EDIT_CHARGES');
  const canDelete = hasPermission(permissions, 'DELETE_CHARGES');

  const handleCreate = async () => {
    if (!createModal) return;
    const name = createModal.name.trim();
    const bank = Number(createModal.bankTransferPaid || 0);
    const cash1 = Number(createModal.cashbox1Paid || 0);
    const cash2 = Number(createModal.cashbox2Paid || 0);
    const amount = bank + cash1 + cash2;
    if (!name || amount <= 0 || [bank, cash1, cash2].some((v) => Number.isNaN(v) || v < 0)) {
      alert('Проверьте название и каналы оплаты');
      return;
    }
    try {
      setSaving(true);
      await createHouseholdExpense(storeId, {
        name,
        amount,
        status: 'PAID',
        bankTransferPaid: bank,
        cashbox1Paid: cash1,
        cashbox2Paid: cash2,
      });
      setCreateModal(null);
      await fetchData();
    } catch (err) {
      console.error(err);
      alert('Не удалось добавить расход');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!editModal) return;
    const name = editModal.name.trim();
    const status = editModal.status;
    const baseAmount = Number(editModal.amount ?? 0);
    const bank = Number(editModal.bankTransferPaid || 0);
    const cash1 = Number(editModal.cashbox1Paid || 0);
    const cash2 = Number(editModal.cashbox2Paid || 0);
    const paidAmount = bank + cash1 + cash2;
    if (!name || [bank, cash1, cash2].some((v) => Number.isNaN(v) || v < 0)) {
      alert('Проверьте данные');
      return;
    }
    if (status === 'PAID' && paidAmount <= 0) {
      alert('Введите сумму хотя бы в одном канале оплаты');
      return;
    }
    if (status === 'UNPAID' && baseAmount <= 0) {
      alert('Сумма расхода должна быть больше 0');
      return;
    }
    try {
      setSaving(true);
      await updateHouseholdExpense(storeId, editModal.id, {
        name,
        amount: status === 'PAID' ? paidAmount : baseAmount,
        status,
        bankTransferPaid: status === 'PAID' ? bank : 0,
        cashbox1Paid: status === 'PAID' ? cash1 : 0,
        cashbox2Paid: status === 'PAID' ? cash2 : 0,
      });
      setEditModal(null);
      await fetchData();
    } catch (err) {
      console.error(err);
      alert('Не удалось обновить расход');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!editModal) return;
    if (!confirm('Удалить этот расход?')) return;
    try {
      setSaving(true);
      await deleteHouseholdExpense(storeId, editModal.id);
      setEditModal(null);
      await fetchData();
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
      <div className="mx-auto flex max-w-[1600px] gap-6 px-3 py-1 md:px-6 md:py-6">
        <StoreSidebar storeId={storeId} store={store} active="household" />
        <main className="min-w-0 flex-1">
          <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-2">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h1 className="mt-2 text-2xl font-bold text-[#111111] md:text-3xl">
                  Хозяйственные расходы
                </h1>
              </div>
              {canCreate && (
                <button
                  onClick={() =>
                    setCreateModal({ name: '', bankTransferPaid: '', cashbox1Paid: '', cashbox2Paid: '' })
                  }
                  className="rounded-xl bg-[#ff6a13] px-4 py-2.5 font-semibold text-white transition hover:bg-[#e85a0c]"
                >
                  Добавить
                </button>
              )}
            </div>

            <section className="rounded-2xl border border-[#d8d1cb] bg-white p-6 shadow-[0_12px_36px_-20px_rgba(17,17,17,0.2)] md:p-8">
              {items.length === 0 ? (
                <p className="text-[#6b6b6b]">Расходов пока нет</p>
              ) : (
                <div className="space-y-2">
                  <div className="hidden items-center gap-3 rounded-lg border border-[#D8D1CB] bg-[#F4EFEB] px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-[#6B6B6B] md:grid md:grid-cols-[minmax(180px,1.2fr)_minmax(140px,0.9fr)_minmax(240px,2fr)_minmax(110px,1fr)_minmax(170px,auto)]">
                    <div className="text-center">Название</div>
                    <div className="text-center">Статус</div>
                    <div className="text-center">Каналы оплаты</div>
                    <div className="text-center">Сумма</div>
                    <div className="text-center">Действия</div>
                  </div>
                  {items.map((expense) => (
                    <article key={expense.id} className="rounded-xl border border-[#D8D1CB] bg-white px-4 py-2.5">
                      <div className="grid items-center gap-2 md:grid-cols-[minmax(180px,1.2fr)_minmax(140px,0.9fr)_minmax(240px,2fr)_minmax(110px,1fr)_minmax(170px,auto)] md:gap-3">
                        <div className="min-w-0 text-left">
                          <p className="truncate text-sm font-semibold text-slate-900">{expense.name}</p>
                        </div>
                        <div className="min-w-0 md:text-center">
                          <span
                            className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                              expense.status === 'PAID' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                            }`}
                          >
                            {expense.status === 'PAID' ? 'Оплачено' : 'Не оплачено'}
                          </span>
                        </div>
                        <div className="text-[11px] font-semibold text-slate-900 md:text-center">
                          {(expense.status ?? 'UNPAID') === 'PAID'
                            ? paymentChannelsLines(
                                expense.bankTransferPaid,
                                expense.cashbox1Paid,
                                expense.cashbox2Paid,
                                currency,
                              ).map((line) => <div key={`${expense.id}-${line}`}>{line}</div>)
                            : 'Каналы оплаты не заданы'}
                        </div>
                        <div className="text-left md:text-center">
                          <p className="text-sm font-bold text-slate-900">{formatMoney(expense.amount, currency)}</p>
                        </div>
                        <div className="flex items-center justify-start gap-2 md:flex-col md:items-center">
                          {canEdit && (
                            <button
                              onClick={() => {
                                const bank = Number(expense.bankTransferPaid ?? 0);
                                const cash1 = Number(expense.cashbox1Paid ?? 0);
                                const cash2 = Number(expense.cashbox2Paid ?? 0);
                                setEditModal({
                                  id: Number(expense.id),
                                  name: String(expense.name ?? ''),
                                  amount: Number(expense.amount ?? 0),
                                  status: (expense.status ?? 'UNPAID') as 'UNPAID' | 'PAID',
                                  bankTransferPaid: String(bank || ''),
                                  cashbox1Paid: String(cash1 || ''),
                                  cashbox2Paid: String(cash2 || ''),
                                });
                              }}
                              className="rounded-lg border border-[#CFC6BF] bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-[#ede7e2]"
                            >
                              Оплатить/Изменить
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
        </main>
      </div>

      <ExpenseCreatePaidModal
        open={Boolean(createModal)}
        title="Новый хозяйственный расход"
        nameValue={createModal?.name ?? ''}
        onNameChange={(value) => setCreateModal((prev) => (prev ? { ...prev, name: value } : prev))}
        bankTransferPaid={createModal?.bankTransferPaid ?? ''}
        onBankTransferPaidChange={(value) =>
          setCreateModal((prev) => (prev ? { ...prev, bankTransferPaid: value } : prev))
        }
        cashbox1Paid={createModal?.cashbox1Paid ?? ''}
        onCashbox1PaidChange={(value) => setCreateModal((prev) => (prev ? { ...prev, cashbox1Paid: value } : prev))}
        cashbox2Paid={createModal?.cashbox2Paid ?? ''}
        onCashbox2PaidChange={(value) => setCreateModal((prev) => (prev ? { ...prev, cashbox2Paid: value } : prev))}
        saving={saving}
        onClose={() => setCreateModal(null)}
        onSubmit={() => void handleCreate()}
      />

      <ExpenseEditModal
        open={Boolean(editModal)}
        title="Изменить хозяйственный расход"
        nameValue={editModal?.name ?? ''}
        onNameChange={(value) => setEditModal((prev) => (prev ? { ...prev, name: value } : prev))}
        status={editModal?.status ?? 'UNPAID'}
        onStatusChange={(status) => setEditModal((prev) => (prev ? { ...prev, status } : prev))}
        bankTransferPaid={editModal?.bankTransferPaid ?? ''}
        onBankTransferPaidChange={(value) =>
          setEditModal((prev) => (prev ? { ...prev, bankTransferPaid: value } : prev))
        }
        cashbox1Paid={editModal?.cashbox1Paid ?? ''}
        onCashbox1PaidChange={(value) => setEditModal((prev) => (prev ? { ...prev, cashbox1Paid: value } : prev))}
        cashbox2Paid={editModal?.cashbox2Paid ?? ''}
        onCashbox2PaidChange={(value) => setEditModal((prev) => (prev ? { ...prev, cashbox2Paid: value } : prev))}
        saving={saving}
        onClose={() => setEditModal(null)}
        onSubmit={() => void handleSaveEdit()}
        onDelete={canDelete ? () => void handleDelete() : undefined}
        showDelete={canDelete}
      />
    </div>
  );
}
