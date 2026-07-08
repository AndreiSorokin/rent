'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { apiFetch } from '@/lib/api';
import { formatMoney } from '@/lib/currency';
import { hasPermission } from '@/lib/permissions';
import { useDialog } from '@/components/dialog/DialogProvider';
import { useToast } from '@/components/toast/ToastProvider';
import { FullScreenLoader } from '@/components/AppLoader';
import { ExpenseEditModal } from '../components/ExpenseEditModal';
import { ExpenseSearchInput } from '../components/ExpenseSearchInput';
import {
  createPavilionExpense,
  deletePavilionExpense,
  listPavilionExpenses,
  updatePavilionExpense,
  type PavilionExpenseStatus,
} from '@/lib/pavilionExpenses';
import { StoreSidebar } from '../components/StoreSidebar';
import {
  CirclePlus,
} from 'lucide-react';
import {
  getDatePartsInTimeZone,
  isSameDayKeyInTimeZone,
  isSameMonthInTimeZone,
} from '@/lib/dateTime';

type EditModalState = {
  id: number;
  note: string;
  amount: number;
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
  t: ReturnType<typeof useTranslations>,
) {
  const lines: string[] = [];
  const bank = Number(bankTransferPaid ?? 0);
  const cash1 = Number(cashbox1Paid ?? 0);
  const cash2 = Number(cashbox2Paid ?? 0);

  if (bank > 0) lines.push(t('paymentChannels.bankTransfer', { amount: formatMoney(bank, currency) }));
  if (cash1 > 0) lines.push(t('paymentChannels.cashbox1', { amount: formatMoney(cash1, currency) }));
  if (cash2 > 0) lines.push(t('paymentChannels.cashbox2', { amount: formatMoney(cash2, currency) }));

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

export default function StoreOtherExpensesPage() {
  const params = useParams();
  const router = useRouter();
  const storeId = Number(params.storeId);
  const dialog = useDialog();
  const toast = useToast();
  const t = useTranslations('StoreOtherExpensesPage');

  const [store, setStore] = useState<any>(null);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [filterDate, setFilterDate] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [createModal, setCreateModal] = useState<{
    note: string;
    bankTransferPaid: string;
    cashbox1Paid: string;
    cashbox2Paid: string;
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
      setError(t('loadError'));
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
    const timeZone = store?.timeZone || 'UTC';
    const now = new Date();
    const nowParts = getDatePartsInTimeZone(now, timeZone);
    const year = nowParts?.year ?? now.getUTCFullYear();
    const month = (nowParts?.month ?? now.getUTCMonth() + 1) - 1;

    return expenses
      .filter((item: any) => item.type === 'OTHER')
      .filter((item: any) => isSameMonthInTimeZone(item.createdAt, year, month, timeZone))
      .filter((item: any) => isSameDayKeyInTimeZone(item.createdAt, filterDate, timeZone))
      .filter((item: any) =>
        String(item.note ?? '')
          .toLocaleLowerCase('ru-RU')
          .includes(searchQuery.trim().toLocaleLowerCase('ru-RU')),
      )
      .sort(
        (a: any, b: any) =>
          new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime(),
      );
  }, [expenses, filterDate, searchQuery, store?.timeZone]);
  const otherExpensesTotal = useMemo(
    () => otherExpenses.reduce((sum: number, expense: any) => sum + Number(expense.amount ?? 0), 0),
    [otherExpenses],
  );

  const handleCreate = async () => {
    if (!createModal) return;

    const note = createModal.note.trim();
    if (!note) {
      toast.error(t('toast.enterName'));
      return;
    }

    try {
      setSaving(true);
      const bank = Number(createModal.bankTransferPaid || 0);
      const cash1 = Number(createModal.cashbox1Paid || 0);
      const cash2 = Number(createModal.cashbox2Paid || 0);
      const amount = bank + cash1 + cash2;
      if (amount <= 0 || [bank, cash1, cash2].some((v) => Number.isNaN(v) || v < 0)) {
        toast.error(t('toast.enterValidChannelAmounts'));
        return;
      }

      await createPavilionExpense(storeId, {
        type: 'OTHER',
        amount,
        note,
        status: 'PAID',
        bankTransferPaid: bank,
        cashbox1Paid: cash1,
        cashbox2Paid: cash2,
      });
      setCreateModal(null);
      await fetchStore();
    } catch (err) {
      console.error(err);
      toast.error(t('toast.createError'));
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
      toast.error(t('toast.enterValidName'));
      return;
    }

    if (editModal.status === 'PAID') {
      if ([bank, cash1, cash2].some((value) => Number.isNaN(value) || value < 0)) {
        toast.error(t('toast.nonNegativeChannels'));
        return;
      }
      if (paidAmount <= 0) {
        toast.error(t('toast.enterAtLeastOneChannel'));
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
      toast.error(t('toast.updateError'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (expenseId: number) => {
    const confirmed = await dialog.confirm({
      title: t('deleteDialog.title'),
      message: t('deleteDialog.message'),
      tone: 'danger',
      confirmText: t('deleteDialog.confirmText'),
    });
    if (!confirmed) return;
    try {
      setSaving(true);
      await deletePavilionExpense(storeId, expenseId);
      await fetchStore();
    } catch (err) {
      console.error(err);
      toast.error(t('toast.deleteError'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <FullScreenLoader label={t('loading')} />;
  if (error) return <div className="p-6 text-center text-red-600">{error}</div>;
  if (!store) return null;

  return (
    <div className="min-h-screen bg-[#f6f1eb]">
      <div className="mx-auto flex max-w-[1600px] gap-6 px-3 py-1 md:px-6 md:py-6">
        <StoreSidebar storeId={storeId} store={store} active="other-expenses" />
        <main className="min-w-0 flex-1 pt-12 md:pt-0">
      <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-2">
        <section className="rounded-2xl border border-[#d8d1cb] bg-white p-6 shadow-[0_12px_36px_-20px_rgba(17,17,17,0.2)] md:p-8">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-xl font-semibold text-[#111111] md:text-2xl">{t('title')}</h1>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Link
                href={`/stores/${storeId}/expenses-history/other`}
                className="rounded-lg border border-[#d8d1cb] bg-white px-3 py-2 text-sm font-medium text-[#111111] hover:bg-[#f4efeb]"
              >
                {t('allExpenses')}
              </Link>
              <input
                type="date"
                value={filterDate}
                onChange={(e) => setFilterDate(e.target.value)}
                className="rounded-lg border border-[#d8d1cb] bg-white px-3 py-2 text-sm text-[#111111]"
                title={t('dateFilterTitle')}
              />
              {filterDate && (
                <button
                  onClick={() => setFilterDate('')}
                  className="rounded-lg border border-[#d8d1cb] bg-white px-3 py-2 text-sm font-medium text-[#111111] hover:bg-[#f4efeb]"
                >
                  {t('reset')}
                </button>
              )}
              {canCreate && (
                <button
                  onClick={() =>
                    setCreateModal({
                      note: '',
                      bankTransferPaid: '',
                      cashbox1Paid: '',
                      cashbox2Paid: '',
                    })
                  }
                  className="inline-flex items-center gap-2 rounded-xl bg-[#2563EB] px-3 py-2 text-sm font-semibold text-white transition hover:bg-[#1D4ED8]"
                >
                  <CirclePlus className="h-4 w-4" />
                  {t('addExpense')}
                </button>
              )}
            </div>
          </div>
          <div className="mb-4">
            <ExpenseSearchInput
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder={t('searchPlaceholder')}
            />
          </div>
          <div className="mb-4 rounded-xl border border-[#E5DED8] bg-[#F9F5F1] px-4 py-3">
            <p className="text-xs font-medium uppercase tracking-wide text-[#6B6B6B]">
              {t('totalAmountLabel')}
            </p>
            <p className="mt-1 text-xl font-semibold text-[#111111]">
              {formatMoney(otherExpensesTotal, currency)}
            </p>
          </div>

          {otherExpenses.length === 0 ? (
            <p className="text-[#6b6b6b]">{t('emptyState')}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead className="bg-[#F4EFEB]">
                  <tr>
                    <th className="rounded-l-xl px-4 py-3 text-left text-xs font-medium uppercase text-[#6B6B6B]">
                      {t('table.date')}
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-[#6B6B6B]">
                      {t('table.name')}
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-[#6B6B6B]">
                      {t('table.status')}
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-[#6B6B6B]">
                      {t('table.paymentChannels')}
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium uppercase text-[#6B6B6B]">
                      {t('table.amount')}
                    </th>
                    <th className="rounded-r-xl px-4 py-3 text-right text-xs font-medium uppercase text-[#6B6B6B]">
                      {t('table.actions')}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E5DED8] bg-white">
                  {otherExpenses.map((expense: any) => (
                    <tr key={expense.id} className="transition-colors hover:bg-[#f9f5f0]">
                      <td className="whitespace-nowrap px-4 py-2.5 align-middle text-xs text-[#6B6B6B]">
                        {formatDateTime(expense.createdAt, store?.timeZone || 'UTC')}
                      </td>
                      <td className="px-4 py-2.5 align-middle">
                        <p className="max-w-[260px] truncate text-sm font-medium text-[#111111]">
                          {expense.note || t('defaultExpenseName')}
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
                          {expense.status === 'PAID' ? t('statusPaid') : t('statusUnpaid')}
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
                              t,
                            );
                            if (!lines.length) return <div>{t('noPaymentChannels')}</div>;
                            return lines.map((line) => <div key={`${expense.id}-${line}`}>{line}</div>);
                          })()
                        ) : (
                          <div>{t('noPaymentChannels')}</div>
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
                            {t('payOrEdit')}
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
            <h3 className="text-lg font-semibold text-slate-900">{t('createModal.title')}</h3>
            <p className="mt-1 text-sm text-slate-600">
              {t('createModal.hint')}
            </p>

            <div className="mt-4 space-y-3">
              <input
                type="text"
                value={createModal.note}
                onChange={(e) =>
                  setCreateModal((prev) => (prev ? { ...prev, note: e.target.value } : prev))
                }
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
                placeholder={t('createModal.namePlaceholder')}
              />
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">{t('createModal.bankTransferLabel')}</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={createModal.bankTransferPaid}
                    onChange={(e) =>
                      setCreateModal((prev) =>
                        prev ? { ...prev, bankTransferPaid: e.target.value } : prev,
                      )
                    }
                    className="w-full rounded-lg border border-slate-300 px-3 py-2"
                    placeholder={t('createModal.amountPlaceholder')}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">{t('createModal.cashbox1Label')}</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={createModal.cashbox1Paid}
                    onChange={(e) =>
                      setCreateModal((prev) =>
                        prev ? { ...prev, cashbox1Paid: e.target.value } : prev,
                      )
                    }
                    className="w-full rounded-lg border border-slate-300 px-3 py-2"
                    placeholder={t('createModal.amountPlaceholder')}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">{t('createModal.cashbox2Label')}</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={createModal.cashbox2Paid}
                    onChange={(e) =>
                      setCreateModal((prev) =>
                        prev ? { ...prev, cashbox2Paid: e.target.value } : prev,
                      )
                    }
                    className="w-full rounded-lg border border-slate-300 px-3 py-2"
                    placeholder={t('createModal.amountPlaceholder')}
                  />
                </div>
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setCreateModal(null)}
                disabled={saving}
                className="rounded-lg border px-4 py-2 hover:bg-slate-100 disabled:opacity-60"
              >
                {t('createModal.cancel')}
              </button>
              <button
                type="submit"
                disabled={saving}
                className="rounded-lg bg-[#FF6A13] px-4 py-2 font-medium text-white hover:bg-[#E65C00] disabled:opacity-60"
              >
                {saving ? t('createModal.saving') : t('createModal.save')}
              </button>
            </div>
          </form>
        </div>
      )}

      <ExpenseEditModal
        open={Boolean(editModal)}
        title={t('editModal.title')}
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

