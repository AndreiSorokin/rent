'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { formatMoney } from '@/lib/currency';
import { hasPermission } from '@/lib/permissions';
import { useDialog } from '@/components/dialog/DialogProvider';
import { useToast } from '@/components/toast/ToastProvider';
import {
  createPavilionExpense,
  deletePavilionExpense,
  listPavilionExpenses,
  updatePavilionExpense,
  type PavilionExpenseStatus,
  type PavilionExpenseType,
} from '@/lib/pavilionExpenses';
import { StoreSidebar } from '../components/StoreSidebar';
import {
  CirclePlus,
} from 'lucide-react';
import { getDatePartsInTimeZone, isSameMonthInTimeZone } from '@/lib/dateTime';
import { FullScreenLoader } from '@/components/AppLoader';
import { ExpenseEditModal } from '../components/ExpenseEditModal';
import { ExpenseSearchInput } from '../components/ExpenseSearchInput';

type AdminExpenseType = Exclude<PavilionExpenseType, 'SALARIES' | 'HOUSEHOLD' | 'OTHER'>;

type EditModalState = {
  id: number;
  note: string;
  amount: number;
  status: 'UNPAID' | 'PAID';
  bankTransferPaid: number;
  cashbox1Paid: number;
  cashbox2Paid: number;
};

const ADMIN_EXPENSE_TYPES: Array<{ value: AdminExpenseType; label: string }> = [
  { value: 'PAYROLL_TAX', label: 'Налоги с зарплаты' },
  { value: 'PROFIT_TAX', label: 'Налог на прибыль' },
  { value: 'VAT', label: 'НДС' },
  { value: 'BANK_SERVICES', label: 'Услуги банка' },
  { value: 'DIVIDENDS', label: 'Дивиденды' },
  { value: 'LAND_RENT', label: 'Аренда земли' },
  { value: 'STORE_FACILITIES', label: 'Коммуналка объекта' },
];

const ADMIN_TYPE_SET = new Set<PavilionExpenseType>(ADMIN_EXPENSE_TYPES.map((item) => item.value));

function getAdminTypeLabel(type: PavilionExpenseType | null | undefined) {
  const found = ADMIN_EXPENSE_TYPES.find((item) => item.value === type);
  return found?.label ?? 'Прочее';
}

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

function formatDateTime(value: string | Date | null | undefined, timeZone: string): string {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString('ru-RU', {
    timeZone,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function StoreAdminExpensesPage() {
  const params = useParams();
  const router = useRouter();
  const storeId = Number(params.storeId);
  const dialog = useDialog();
  const toast = useToast();

  const [store, setStore] = useState<any>(null);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [createModal, setCreateModal] = useState<{
    note: string;
    amount: string;
  } | null>(null);
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
      setError('Не удалось загрузить административные расходы');
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

  const adminExpenses = useMemo(() => {
    const timeZone = store?.timeZone || 'UTC';
    const now = new Date();
    const nowParts = getDatePartsInTimeZone(now, timeZone);
    const year = nowParts?.year ?? now.getUTCFullYear();
    const month = (nowParts?.month ?? now.getUTCMonth() + 1) - 1;

    return expenses
      .filter((item: any) => ADMIN_TYPE_SET.has(item.type))
      .filter((item: any) => isSameMonthInTimeZone(item.createdAt, year, month, timeZone))
      .filter((item: any) => {
        const needle = searchQuery.trim().toLocaleLowerCase('ru-RU');
        if (!needle) return true;
        return (
          String(item.note ?? '')
            .toLocaleLowerCase('ru-RU')
            .includes(needle) ||
          getAdminTypeLabel(item.type).toLocaleLowerCase('ru-RU').includes(needle)
        );
      })
      .sort(
        (a: any, b: any) =>
          new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime(),
      );
  }, [expenses, searchQuery, store?.timeZone]);
  const adminExpensesTotal = useMemo(
    () => adminExpenses.reduce((sum: number, expense: any) => sum + Number(expense.amount ?? 0), 0),
    [adminExpenses],
  );

  const handleCreate = async () => {
    if (!createModal) return;

    const note = createModal.note.trim();
    if (!note) {
      toast.error('Введите название расхода');
      return;
    }

    try {
      setSaving(true);
      const amount = Number(createModal.amount || 0);
      if (!Number.isFinite(amount) || amount <= 0) {
        toast.error('Введите корректную сумму');
        return;
      }

      await createPavilionExpense(storeId, {
        type: 'STORE_FACILITIES',
        amount,
        note,
        status: 'UNPAID',
      });
      setCreateModal(null);
      await fetchStore();
    } catch (err) {
      console.error(err);
      toast.error('Не удалось добавить административный расход');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!editModal) return;

    const note = editModal.note.trim();
    const bank = Number(editModal.bankTransferPaid || 0);
    const cash1 = Number(editModal.cashbox1Paid || 0);
    const cash2 = Number(editModal.cashbox2Paid || 0);
    const paidAmount = bank + cash1 + cash2;

    if (!note) {
      toast.error('Введите корректное название');
      return;
    }

    if (editModal.status === 'PAID') {
      if ([bank, cash1, cash2].some((value) => Number.isNaN(value) || value < 0)) {
        toast.error('Суммы по каналам оплаты должны быть неотрицательными');
        return;
      }
      if (paidAmount <= 0) {
        toast.error('Введите сумму хотя бы в одном канале оплаты');
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
        amount: editModal.status === 'PAID' ? paidAmount : Number(editModal.amount || 0),
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
      toast.error('Не удалось обновить административный расход');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (expenseId: number) => {
    const confirmed = await dialog.confirm({
      title: 'Удаление расхода',
      message: 'Удалить этот расход?',
      tone: 'danger',
      confirmText: 'Удалить',
    });
    if (!confirmed) return;
    try {
      setSaving(true);
      await deletePavilionExpense(storeId, expenseId);
      await fetchStore();
    } catch (err) {
      console.error(err);
      toast.error('Не удалось удалить расход');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <FullScreenLoader label="Загружаем расходы..." />;
  if (error) return <div className="p-6 text-center text-red-600">{error}</div>;
  if (!store) return null;

  return (
    <div className="min-h-screen bg-[#f6f1eb]">
      <div className="mx-auto flex max-w-[1600px] gap-6 px-3 py-1 md:px-6 md:py-6">
        <StoreSidebar storeId={storeId} store={store} active="admin-expenses" />
        <main className="min-w-0 flex-1 pt-12 md:pt-0">
          <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-2">
            <section className="rounded-2xl border border-[#d8d1cb] bg-white p-6 shadow-[0_12px_36px_-20px_rgba(17,17,17,0.2)] md:p-8">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h1 className="text-xl font-semibold text-[#111111] md:text-2xl">Административные расходы</h1>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    href={`/stores/${storeId}/expenses-history/admin`}
                    className="rounded-lg border border-[#d8d1cb] bg-white px-3 py-2 text-sm font-medium text-[#111111] hover:bg-[#f4efeb]"
                  >
                    Все расходы
                  </Link>
                  {canCreate && (
                    <button
                      onClick={() =>
                        setCreateModal({
                          note: '',
                          amount: '',
                        })
                      }
                      className="inline-flex items-center gap-2 rounded-xl bg-[#2563EB] px-3 py-2 text-sm font-semibold text-white transition hover:bg-[#1D4ED8]"
                    >
                      <CirclePlus className="h-4 w-4" />
                      Добавить расход
                    </button>
                  )}
                </div>
              </div>
              <div className="mb-4">
                <ExpenseSearchInput
                  value={searchQuery}
                  onChange={setSearchQuery}
                  placeholder="Поиск по названию или типу расхода"
                />
              </div>
              <div className="mb-4 rounded-xl border border-[#E5DED8] bg-[#F9F5F1] px-4 py-3">
                <p className="text-xs font-medium uppercase tracking-wide text-[#6B6B6B]">
                  Общая сумма расходов
                </p>
                <p className="mt-1 text-xl font-semibold text-[#111111]">
                  {formatMoney(adminExpensesTotal, currency)}
                </p>
              </div>

              {adminExpenses.length === 0 ? (
                <p className="text-[#6b6b6b]">Расходов пока нет</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full">
                    <thead className="bg-[#F4EFEB]">
                      <tr>
                        <th className="rounded-l-xl px-4 py-3 text-left text-xs font-medium uppercase text-[#6B6B6B]">
                          Дата
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium uppercase text-[#6B6B6B]">
                          Название
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium uppercase text-[#6B6B6B]">
                          Статус
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium uppercase text-[#6B6B6B]">
                          Каналы оплаты
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-medium uppercase text-[#6B6B6B]">
                          Сумма
                        </th>
                        <th className="rounded-r-xl px-4 py-3 text-right text-xs font-medium uppercase text-[#6B6B6B]">
                          Действия
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E5DED8] bg-white">
                      {adminExpenses.map((expense: any) => (
                        <tr key={expense.id} className="transition-colors hover:bg-[#f9f5f0]">
                          <td className="whitespace-nowrap px-4 py-2.5 align-middle text-xs text-[#6B6B6B]">
                            {formatDateTime(expense.createdAt, store?.timeZone || 'UTC')}
                          </td>
                          <td className="px-4 py-2.5 align-middle">
                            <p className="max-w-[260px] truncate text-sm font-medium text-[#111111]">
                              {expense.note || 'Административный расход'}
                            </p>
                          </td>
                          <td className="px-4 py-2.5 align-middle text-sm text-[#374151]">
                            <span
                              className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                                expense.status === 'PAID'
                                  ? 'bg-emerald-100 text-emerald-700'
                                  : 'bg-amber-100 text-amber-700'
                              }`}
                            >
                              {expense.status === 'PAID' ? 'Оплачено' : 'Не оплачено'}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 align-middle text-xs text-slate-600">
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
                          </td>
                          <td className="px-4 py-2.5 text-right align-middle text-sm font-bold text-slate-900">
                            {formatMoney(expense.amount, currency)}
                          </td>
                          <td className="px-4 py-2.5 text-right align-middle">
                            {canEdit ? (
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
                                    amount,
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
                            ) : (
                              <span className="text-xs text-[#6B6B6B]">-</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </div>
        </main>
      </div>

      {createModal && (
        <div className="fixed inset-0 z-[95] flex items-center justify-center bg-black/50 p-4">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void handleCreate();
            }}
            className="w-full max-w-[34rem] rounded-xl border border-[#D8D1CB] bg-white p-5 shadow-xl"
          >
            <h3 className="text-lg font-semibold text-slate-900">Новый административный расход</h3>
            <p className="mt-1 text-sm text-slate-600">
              Создаётся в статусе «Не оплачено».
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
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Сумма</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={createModal.amount}
                  onChange={(e) =>
                    setCreateModal((prev) =>
                      prev ? { ...prev, amount: e.target.value } : prev,
                    )
                  }
                  className="w-full rounded-lg border border-slate-300 px-3 py-2"
                  placeholder="0"
                />
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setCreateModal(null)}
                disabled={saving}
                className="rounded-lg border px-4 py-2 hover:bg-slate-100 disabled:opacity-60"
              >
                Отмена
              </button>
              <button
                type="submit"
                disabled={saving}
                className="rounded-lg bg-[#FF6A13] px-4 py-2 font-medium text-white hover:bg-[#E65C00] disabled:opacity-60"
              >
                {saving ? 'Сохранение...' : 'Сохранить'}
              </button>
            </div>
          </form>
        </div>
      )}

      <ExpenseEditModal
        open={Boolean(editModal)}
        title="Изменить административный расход"
        nameValue={editModal?.note ?? ''}
        status={editModal?.status ?? 'UNPAID'}
        bankTransferPaid={editModal?.bankTransferPaid ?? 0}
        cashbox1Paid={editModal?.cashbox1Paid ?? 0}
        cashbox2Paid={editModal?.cashbox2Paid ?? 0}
        saving={saving}
        canDelete={canDelete}
        onNameChange={(value) =>
          setEditModal((prev) => (prev ? { ...prev, note: value } : prev))
        }
        onStatusChange={(nextStatus) =>
          setEditModal((prev) => {
            if (!prev) return prev;
            if (nextStatus === 'UNPAID') {
              return { ...prev, status: 'UNPAID' };
            }
            const amountValue = Number(prev.amount || 0);
            return {
              ...prev,
              status: 'PAID',
              bankTransferPaid:
                Number.isFinite(amountValue) && amountValue > 0
                  ? amountValue
                  : prev.bankTransferPaid,
              cashbox1Paid: 0,
              cashbox2Paid: 0,
            };
          })
        }
        onBankTransferPaidChange={(value) =>
          setEditModal((prev) => (prev ? { ...prev, bankTransferPaid: value } : prev))
        }
        onCashbox1PaidChange={(value) =>
          setEditModal((prev) => (prev ? { ...prev, cashbox1Paid: value } : prev))
        }
        onCashbox2PaidChange={(value) =>
          setEditModal((prev) => (prev ? { ...prev, cashbox2Paid: value } : prev))
        }
        onDelete={async () => {
          if (!editModal) return;
          await handleDelete(editModal.id);
          setEditModal(null);
        }}
        onClose={() => setEditModal(null)}
        onSubmit={() => void handleSaveEdit()}
      />
    </div>
  );
}

