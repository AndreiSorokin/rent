'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { formatMoney } from '@/lib/currency';
import { hasPermission } from '@/lib/permissions';
import {
  createPavilionExpense,
  deletePavilionExpense,
  listPavilionExpenses,
  type PavilionExpenseStatus,
  type PavilionExpenseType,
  updatePavilionExpense,
} from '@/lib/pavilionExpenses';
import { ExpenseCreatePaidModal, ExpenseEditModal } from '../components/ExpenseModals';
import { StoreSidebar } from '../components/StoreSidebar';

type CardExpenseType = Exclude<PavilionExpenseType, 'SALARIES' | 'OTHER'>;

const CATEGORIES: Array<{ type: CardExpenseType; label: string }> = [
  { type: 'PAYROLL_TAX', label: 'Налоги с зарплаты' },
  { type: 'PROFIT_TAX', label: 'Налог на прибыль' },
  { type: 'VAT', label: 'НДС' },
  { type: 'BANK_SERVICES', label: 'Услуги банка' },
  { type: 'DIVIDENDS', label: 'Дивиденды' },
  { type: 'LAND_RENT', label: 'Аренда земли' },
  { type: 'STORE_FACILITIES', label: 'Коммуналка объекта' },
];

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

export default function StoreAdminExpensesPage() {
  const params = useParams();
  const router = useRouter();
  const storeId = Number(params.storeId);

  const [store, setStore] = useState<any>(null);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [createModal, setCreateModal] = useState<{
    type: CardExpenseType;
    label: string;
    bankTransferPaid: string;
    cashbox1Paid: string;
    cashbox2Paid: string;
  } | null>(null);
  const [editModal, setEditModal] = useState<{
    id: number;
    type: CardExpenseType;
    label: string;
    note: string;
    amount: number;
    status: PavilionExpenseStatus;
    bankTransferPaid: string;
    cashbox1Paid: string;
    cashbox2Paid: string;
  } | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [storeData, expensesData] = await Promise.all([
        apiFetch<any>(`/stores/${storeId}?lite=true`),
        listPavilionExpenses(storeId),
      ]);
      if (!hasPermission(storeData.permissions || [], 'VIEW_CHARGES')) {
        router.replace(`/stores/${storeId}`);
        return;
      }
      setStore(storeData);
      setExpenses(expensesData || []);
      setError(null);
    } catch (err) {
      console.error(err);
      setError('Не удалось загрузить административные расходы');
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

  const grouped = useMemo(() => {
    const source = expenses.filter((e) => CATEGORIES.some((c) => c.type === e.type));
    return CATEGORIES.reduce<Record<string, any[]>>((acc, c) => {
      acc[c.type] = source.filter((e) => e.type === c.type);
      return acc;
    }, {});
  }, [expenses]);

  const handleCreate = async () => {
    if (!createModal) return;
    const note = createModal.label.trim();
    const bank = Number(createModal.bankTransferPaid || 0);
    const cash1 = Number(createModal.cashbox1Paid || 0);
    const cash2 = Number(createModal.cashbox2Paid || 0);
    const amount = bank + cash1 + cash2;
    if (amount <= 0 || [bank, cash1, cash2].some((v) => Number.isNaN(v) || v < 0)) {
      alert('Введите корректные суммы каналов оплаты');
      return;
    }
    try {
      setSaving(true);
      await createPavilionExpense(storeId, {
        type: createModal.type,
        note,
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
    const note = editModal.note.trim();
    const status = editModal.status;
    const baseAmount = Number(editModal.amount ?? 0);
    const bank = Number(editModal.bankTransferPaid || 0);
    const cash1 = Number(editModal.cashbox1Paid || 0);
    const cash2 = Number(editModal.cashbox2Paid || 0);
    const paidAmount = bank + cash1 + cash2;
    if (!note || [bank, cash1, cash2].some((v) => Number.isNaN(v) || v < 0)) {
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
      await updatePavilionExpense(storeId, editModal.id, {
        note,
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
      await deletePavilionExpense(storeId, editModal.id);
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
        <StoreSidebar storeId={storeId} store={store} active="admin-expenses" />
        <main className="min-w-0 flex-1">
          <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-2">
            <div>
              <h1 className="mt-2 text-2xl font-bold text-[#111111] md:text-3xl">
                Административные расходы
              </h1>
            </div>

            <section className="rounded-2xl border border-[#d8d1cb] bg-white p-6 shadow-[0_12px_36px_-20px_rgba(17,17,17,0.2)] md:p-8">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                {CATEGORIES.map((category) => {
                  const categoryItems = grouped[category.type] ?? [];
                  const categoryTotal = categoryItems.reduce(
                    (sum: number, item: any) => sum + Number(item.amount ?? 0),
                    0,
                  );
                  return (
                    <div key={category.type} className="rounded-xl border border-[#D8D1CB] bg-white p-3">
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <div className="text-sm font-semibold">{category.label}</div>
                        <div className="text-sm font-semibold">{formatMoney(categoryTotal, currency)}</div>
                      </div>
                      {canCreate && (
                        <div className="mb-2">
                          <button
                            onClick={() =>
                              setCreateModal({
                                type: category.type,
                                label: category.label,
                                bankTransferPaid: '',
                                cashbox1Paid: '',
                                cashbox2Paid: '',
                              })
                            }
                            className="w-full rounded-lg bg-[#FF6A13] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[#E65C00]"
                          >
                            Добавить
                          </button>
                        </div>
                      )}
                      {categoryItems.length > 0 ? (
                        <div className="max-h-80 space-y-2 overflow-auto pr-1">
                          {categoryItems.map((item: any) => (
                            <article key={item.id} className="flex min-h-[108px] w-full flex-col justify-between rounded-xl border border-[#D8D1CB] bg-[#F4EFEB]/70 p-3">
                              <div className="mb-2 flex items-start justify-between gap-3">
                                <p className="pr-2 text-xs font-semibold leading-5 text-slate-900">
                                  {item.note || category.label}
                                </p>
                                <p className="shrink-0 text-xs font-bold text-slate-900">
                                  {formatMoney(item.amount, currency)}
                                </p>
                              </div>
                              <div className="flex items-center justify-between gap-2">
                                <div className="min-w-0 space-y-1">
                                  <span
                                    className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                                      item.status === 'PAID' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                                    }`}
                                  >
                                    {item.status === 'PAID' ? 'Оплачено' : 'Не оплачено'}
                                  </span>
                                  <div className="text-[11px] text-slate-600">
                                    {(item.status ?? 'UNPAID') === 'PAID'
                                      ? paymentChannelsLines(
                                          item.bankTransferPaid,
                                          item.cashbox1Paid,
                                          item.cashbox2Paid,
                                          currency,
                                        ).map((line) => <div key={`${item.id}-${line}`}>{line}</div>)
                                      : <div>Каналы оплаты не заданы</div>}
                                  </div>
                                </div>
                                {canEdit && (
                                  <button
                                    onClick={() => {
                                      const bank = Number(item.bankTransferPaid ?? 0);
                                      const cash1 = Number(item.cashbox1Paid ?? 0);
                                      const cash2 = Number(item.cashbox2Paid ?? 0);
                                      setEditModal({
                                        id: Number(item.id),
                                        type: category.type,
                                        label: category.label,
                                        note: String(item.note ?? category.label),
                                        amount: Number(item.amount ?? 0),
                                        status: (item.status ?? 'UNPAID') as PavilionExpenseStatus,
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
                            </article>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-[#6B6B6B]">Записей нет</p>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          </div>
        </main>
      </div>

      <ExpenseCreatePaidModal
        open={Boolean(createModal)}
        title={`${createModal?.label ?? ''}: новый расход`}
        nameValue={createModal?.label ?? ''}
        onNameChange={() => {}}
        bankTransferPaid={createModal?.bankTransferPaid ?? ''}
        onBankTransferPaidChange={(value) => setCreateModal((prev) => (prev ? { ...prev, bankTransferPaid: value } : prev))}
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
        title={`${editModal?.label ?? ''}: изменить расход`}
        nameValue={editModal?.note ?? ''}
        onNameChange={(value) => setEditModal((prev) => (prev ? { ...prev, note: value } : prev))}
        status={(editModal?.status as 'UNPAID' | 'PAID') ?? 'UNPAID'}
        onStatusChange={(status) => setEditModal((prev) => (prev ? { ...prev, status } : prev))}
        bankTransferPaid={editModal?.bankTransferPaid ?? ''}
        onBankTransferPaidChange={(value) => setEditModal((prev) => (prev ? { ...prev, bankTransferPaid: value } : prev))}
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
