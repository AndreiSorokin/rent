'use client';

import { useEffect, useState } from 'react';
import { useParams, usePathname, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { formatMoney, getCurrencySymbol } from '@/lib/currency';
import { hasPermission } from '@/lib/permissions';
import { LogoutButton } from '@/components/LogoutButton';
import {
  CirclePlus,
} from 'lucide-react';
import { CreatePavilionModal } from '@/app/dashboard/components/CreatePavilionModal';
import { StoreExtraIncomeModal } from './components/StoreExtraIncomeModal';
import { ExpenseCreatePaidModal, ExpenseEditModal } from './components/ExpenseModals';
import { AddStaffModal, EditStaffSalaryModal, PayStaffSalaryModal } from './components/StaffModals';
import { StoreSidebar } from './components/StoreSidebar';
import {
  createHouseholdExpense,
  deleteHouseholdExpense,
  getHouseholdExpenses,
  updateHouseholdExpense,
} from '@/lib/householdExpenses';
import { reorderPavilions } from '@/lib/pavilions';
import {
  createPavilionExpense,
  deletePavilionExpense,
  listPavilionExpenses,
  PaymentMethod,
  PavilionExpenseStatus,
  PavilionExpenseType,
  updatePavilionExpense,
} from '@/lib/pavilionExpenses';

type ManualExpenseType = Exclude<PavilionExpenseType, 'SALARIES'>;
type CardExpenseType = Exclude<ManualExpenseType, 'OTHER'>;

const MANUAL_EXPENSE_CATEGORIES: Array<{
  type: CardExpenseType;
  label: string;
}> = [
  { type: 'PAYROLL_TAX', label: 'Налоги с зарплаты' },
  { type: 'PROFIT_TAX', label: 'Налог на прибыль' },
  { type: 'VAT', label: 'НДС' },
  { type: 'BANK_SERVICES', label: 'Услуги банка' },
  { type: 'DIVIDENDS', label: 'Дивиденды' },
  { type: 'LAND_RENT', label: 'Аренда земли' },
  { type: 'STORE_FACILITIES', label: 'Коммуналка объекта' },
];

const PAYMENT_METHOD_OPTIONS: Array<{ value: PaymentMethod; label: string }> = [
  { value: 'BANK_TRANSFER', label: 'Безналичные' },
  { value: 'CASHBOX1', label: 'Наличные касса 1' },
  { value: 'CASHBOX2', label: 'Наличные касса 2' },
];

const paymentMethodLabel = (value?: PaymentMethod | null) =>
  PAYMENT_METHOD_OPTIONS.find((option) => option.value === value)?.label ??
  'Безналичные';

const paymentChannelsLabel = (
  bankTransferPaid?: number | null,
  cashbox1Paid?: number | null,
  cashbox2Paid?: number | null,
  currency?: string,
) => {
  const labels: string[] = [];
  const bank = Number(bankTransferPaid ?? 0);
  const cash1 = Number(cashbox1Paid ?? 0);
  const cash2 = Number(cashbox2Paid ?? 0);

  if (bank > 0) {
    labels.push(
      `Безналичные: ${currency ? formatMoney(bank, currency) : bank.toFixed(2)}`,
    );
  }
  if (cash1 > 0) {
    labels.push(
      `Наличные касса 1: ${currency ? formatMoney(cash1, currency) : cash1.toFixed(2)}`,
    );
  }
  if (cash2 > 0) {
    labels.push(
      `Наличные касса 2: ${currency ? formatMoney(cash2, currency) : cash2.toFixed(2)}`,
    );
  }
  return labels.join(' + ');
};

const paymentChannelsLines = (
  bankTransferPaid?: number | null,
  cashbox1Paid?: number | null,
  cashbox2Paid?: number | null,
  currency?: string,
) => {
  const lines: string[] = [];
  const bank = Number(bankTransferPaid ?? 0);
  const cash1 = Number(cashbox1Paid ?? 0);
  const cash2 = Number(cashbox2Paid ?? 0);

  if (bank > 0) {
    lines.push(
      `Безналичные: ${currency ? formatMoney(bank, currency) : bank.toFixed(2)}`,
    );
  }
  if (cash1 > 0) {
    lines.push(
      `Наличные касса 1: ${currency ? formatMoney(cash1, currency) : cash1.toFixed(2)}`,
    );
  }
  if (cash2 > 0) {
    lines.push(
      `Наличные касса 2: ${currency ? formatMoney(cash2, currency) : cash2.toFixed(2)}`,
    );
  }
  return lines;
};

const expensePaymentLabel = (expense: {
  paymentMethod?: PaymentMethod | null;
  bankTransferPaid?: number | null;
  cashbox1Paid?: number | null;
  cashbox2Paid?: number | null;
}, currency: string) => {
  const channels = paymentChannelsLabel(
    expense.bankTransferPaid,
    expense.cashbox1Paid,
    expense.cashbox2Paid,
    currency,
  );
  if (channels) return channels;

  return paymentMethodLabel(expense.paymentMethod as PaymentMethod);
};

export default function StorePage() {
  const params = useParams();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const storeId = Number(params.storeId);
  const initialPavilionDisplayLimit =
    searchParams.get('show') === '100' || searchParams.get('show') === 'all'
      ? (searchParams.get('show') as '100' | 'all')
      : '50';

  const [store, setStore] = useState<any>(null);
  const [analytics, setAnalytics] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreatePavilionModal, setShowCreatePavilionModal] = useState(false);
  const [showExtraIncomeModal, setShowExtraIncomeModal] = useState(false);
  const [addStaffModal, setAddStaffModal] = useState<{
    fullName: string;
    position: string;
    salary: string;
  } | null>(null);
  const [staffSaving, setStaffSaving] = useState(false);
  const [payStaffSaving, setPayStaffSaving] = useState(false);
  const [payStaffSalaryModal, setPayStaffSalaryModal] = useState<{
    id: number;
    fullName: string;
    salary: number;
    bankTransfer: string;
    cashbox1: string;
    cashbox2: string;
  } | null>(null);
  const [editStaffSalaryModal, setEditStaffSalaryModal] = useState<{
    id: number;
    fullName: string;
    salary: string;
    salaryStatus: 'UNPAID' | 'PAID';
    salaryBankTransferPaid: number;
    salaryCashbox1Paid: number;
    salaryCashbox2Paid: number;
    salaryPaymentMethod?: PaymentMethod | null;
  } | null>(null);
  const [createHouseholdModal, setCreateHouseholdModal] = useState<{
    name: string;
    bankTransferPaid: string;
    cashbox1Paid: string;
    cashbox2Paid: string;
  } | null>(null);
  const [editHouseholdModal, setEditHouseholdModal] = useState<{
    id: number;
    name: string;
    amount: number;
    status: 'UNPAID' | 'PAID';
    bankTransferPaid: string;
    cashbox1Paid: string;
    cashbox2Paid: string;
  } | null>(null);
  const [householdSaving, setHouseholdSaving] = useState(false);
  const [createOtherExpenseModal, setCreateOtherExpenseModal] = useState<{
    note: string;
    bankTransferPaid: string;
    cashbox1Paid: string;
    cashbox2Paid: string;
  } | null>(null);
  const [editOtherExpenseModal, setEditOtherExpenseModal] = useState<{
    id: number;
    note: string;
    amount: number;
    status: PavilionExpenseStatus;
    bankTransferPaid: string;
    cashbox1Paid: string;
    cashbox2Paid: string;
  } | null>(null);
  const [otherExpenseSaving, setOtherExpenseSaving] = useState(false);
  const [createAdminExpenseModal, setCreateAdminExpenseModal] = useState<{
    type: CardExpenseType;
    label: string;
    bankTransferPaid: string;
    cashbox1Paid: string;
    cashbox2Paid: string;
  } | null>(null);
  const [editAdminExpenseModal, setEditAdminExpenseModal] = useState<{
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
  const [adminExpenseSaving, setAdminExpenseSaving] = useState(false);
  const [householdExpenses, setHouseholdExpenses] = useState<any[]>([]);
  const [storeExpenses, setStoreExpenses] = useState<any[]>([]);
  const [pavilionSearch, setPavilionSearch] = useState(searchParams.get('q') ?? '');
  const [pavilionCategoryFilter, setPavilionCategoryFilter] = useState(
    searchParams.get('category') ?? '',
  );
  const [pavilionStatusFilter, setPavilionStatusFilter] = useState(
    searchParams.get('status') ?? '',
  );
  const [pavilionGroupFilter, setPavilionGroupFilter] = useState(
    searchParams.get('groupId') ?? '',
  );
  const [pavilionPaymentStatusFilter, setPavilionPaymentStatusFilter] = useState<
    '' | 'PAID' | 'PARTIAL' | 'UNPAID'
  >(
    searchParams.get('paymentStatus') === 'PAID' ||
      searchParams.get('paymentStatus') === 'PARTIAL' ||
      searchParams.get('paymentStatus') === 'UNPAID'
      ? (searchParams.get('paymentStatus') as 'PAID' | 'PARTIAL' | 'UNPAID')
      : '',
  );
  const [pavilionDisplayLimit, setPavilionDisplayLimit] = useState<'50' | '100' | 'all'>(
    initialPavilionDisplayLimit,
  );
  const [pavilions, setPavilions] = useState<any[]>([]);
  const [pavilionsTotal, setPavilionsTotal] = useState(0);
  const [pavilionsLoading, setPavilionsLoading] = useState(false);
  const [orderedPavilionIds, setOrderedPavilionIds] = useState<number[]>([]);
  const [draggedPavilionId, setDraggedPavilionId] = useState<number | null>(null);
  const [orderedStaffIds, setOrderedStaffIds] = useState<number[]>([]);
  const [draggedStaffId, setDraggedStaffId] = useState<number | null>(null);

  useEffect(() => {
    if (!storeId) return;
    const hasUrlFilters =
      Boolean(searchParams.get('q')) ||
      Boolean(searchParams.get('category')) ||
      Boolean(searchParams.get('status')) ||
      Boolean(searchParams.get('groupId')) ||
      Boolean(searchParams.get('paymentStatus')) ||
      Boolean(searchParams.get('show'));
    if (hasUrlFilters) return;

    const storageKey = `store-page-filters-${storeId}`;
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return;
      const parsed = JSON.parse(raw) as {
        q?: string;
        category?: string;
        status?: string;
        groupId?: string;
        paymentStatus?: '' | 'PAID' | 'PARTIAL' | 'UNPAID';
        show?: '50' | '100' | 'all';
      };

      setPavilionSearch(parsed.q ?? '');
      setPavilionCategoryFilter(parsed.category ?? '');
      setPavilionStatusFilter(parsed.status ?? '');
      setPavilionGroupFilter(parsed.groupId ?? '');
      setPavilionPaymentStatusFilter(
        parsed.paymentStatus === 'PAID' ||
          parsed.paymentStatus === 'PARTIAL' ||
          parsed.paymentStatus === 'UNPAID'
          ? parsed.paymentStatus
          : '',
      );
      setPavilionDisplayLimit(
        parsed.show === '100' || parsed.show === 'all' ? parsed.show : '50',
      );
    } catch (err) {
      console.warn('Failed to restore pavilion filters on store page', err);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeId]);

  const statusLabel: Record<string, string> = {
    AVAILABLE: 'СВОБОДЕН',
    RENTED: 'ЗАНЯТ',
    PREPAID: 'ПРЕДОПЛАТА',
  };

  const getPavilionPaymentStatus = (pavilion: any) => {
    if (pavilion.paymentStatus) {
      if (pavilion.paymentStatus === 'PAID') {
        return {
          label: 'Оплачено',
          className: 'border-emerald-200 bg-emerald-50 text-emerald-700',
        };
      }
      if (pavilion.paymentStatus === 'PARTIAL') {
        return {
          label: 'Частично оплачено',
          className: 'border-amber-200 bg-amber-50 text-amber-700',
        };
      }
      return {
        label: 'Не оплачено',
        className: 'border-rose-200 bg-rose-50 text-rose-700',
      };
    }

    const now = new Date();
    const currentMonthPayment = (pavilion.payments || []).find((payment: any) => {
      const period = new Date(payment.period);
      return (
        period.getUTCFullYear() === now.getUTCFullYear() &&
        period.getUTCMonth() === now.getUTCMonth()
      );
    });

    const rentExpected = Number(
      pavilion.rentAmount ?? Number(pavilion.squareMeters ?? 0) * Number(pavilion.pricePerSqM ?? 0),
    );
    const utilitiesExpected =
      pavilion.status === 'RENTED' ? Number(pavilion.utilitiesAmount ?? 0) : 0;
    const advertisingExpected =
      pavilion.status === 'RENTED' ? Number(pavilion.advertisingAmount ?? 0) : 0;

    const expectedTotal =
      pavilion.status === 'AVAILABLE' ? 0 : rentExpected + utilitiesExpected + advertisingExpected;
    const paidTotal =
      Number(currentMonthPayment?.rentPaid ?? 0) +
      Number(currentMonthPayment?.utilitiesPaid ?? 0) +
      Number(currentMonthPayment?.advertisingPaid ?? 0);

    if (expectedTotal <= 0.01 || paidTotal + 0.01 >= expectedTotal) {
      return { label: 'Оплачено', className: 'border-emerald-200 bg-emerald-50 text-emerald-700' };
    }

    if (paidTotal <= 0.01) {
      return { label: 'Не оплачено', className: 'border-rose-200 bg-rose-50 text-rose-700' };
    }

    return { label: 'Частично оплачено', className: 'border-amber-200 bg-amber-50 text-amber-700' };
  };

  const fetchPavilions = async () => {
    if (!storeId) return;

    setPavilionsLoading(true);
    try {
      const pageSize =
        pavilionDisplayLimit === 'all'
          ? Math.max(1000, Number(pavilionsTotal || 0) + 100)
          : Number(pavilionDisplayLimit);
      const query = new URLSearchParams();
      query.set('paginated', 'true');
      query.set('page', '1');
      query.set('pageSize', String(pageSize));
      if (pavilionSearch.trim()) query.set('search', pavilionSearch.trim());
      if (pavilionCategoryFilter) query.set('category', pavilionCategoryFilter);
      if (pavilionStatusFilter) query.set('status', pavilionStatusFilter);
      if (pavilionGroupFilter) query.set('groupId', pavilionGroupFilter);
      if (pavilionPaymentStatusFilter) {
        query.set('paymentStatus', pavilionPaymentStatusFilter);
      }

      const response = await apiFetch<{
        items: any[];
        total: number;
        page: number;
        pageSize: number;
      }>(`/stores/${storeId}/pavilions?${query.toString()}`);

      setPavilions(response.items || []);
      setPavilionsTotal(Number(response.total ?? 0));
    } catch (err) {
      console.error(err);
      setPavilions([]);
      setPavilionsTotal(0);
    } finally {
      setPavilionsLoading(false);
    }
  };

  const fetchData = async (withLoader = true) => {
    if (withLoader) {
      setLoading(true);
    }
    try {
      const storeData = await apiFetch(`/stores/${storeId}?lite=true`);
      if (hasPermission(storeData.permissions || [], 'VIEW_PAYMENTS')) {
        const analyticsData = await apiFetch<any>(`/stores/${storeId}/analytics`);
        setAnalytics(analyticsData);
      } else {
        setAnalytics(null);
      }

      if (hasPermission(storeData.permissions || [], 'VIEW_CHARGES')) {
        const [householdData, expensesData] = await Promise.all([
          getHouseholdExpenses(storeId),
          listPavilionExpenses(storeId),
        ]);
        setHouseholdExpenses(householdData || []);
        setStoreExpenses(expensesData || []);
      } else {
        setHouseholdExpenses([]);
        setStoreExpenses([]);
      }

      if (hasPermission(storeData.permissions || [], 'VIEW_PAVILIONS')) {
        await fetchPavilions();
      } else {
        setPavilions([]);
        setPavilionsTotal(0);
      }

      setStore(storeData);
    } catch (err) {
      setError('Не удалось загрузить данные магазина');
      console.error(err);
    } finally {
      if (withLoader) {
        setLoading(false);
      }
    }
  };

  const runKeepingScroll = async (action: () => Promise<void>) => {
    const scrollY = window.scrollY;
    await action();
    requestAnimationFrame(() => {
      window.scrollTo({ top: scrollY });
    });
  };

  useEffect(() => {
    if (storeId) fetchData(true);
  }, [storeId]);

  useEffect(() => {
    if (!storeId || !pavilions) {
      setOrderedPavilionIds([]);
      return;
    }
    const ids: number[] = (pavilions || []).map((p: any) => Number(p.id));
    setOrderedPavilionIds(ids);
  }, [storeId, pavilions]);

  useEffect(() => {
    if (!store) return;
    if (!hasPermission(store.permissions || [], 'VIEW_PAVILIONS')) return;
    void fetchPavilions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    pavilionSearch,
    pavilionCategoryFilter,
    pavilionStatusFilter,
    pavilionGroupFilter,
    pavilionPaymentStatusFilter,
    pavilionDisplayLimit,
  ]);

  useEffect(() => {
    const query = new URLSearchParams();
    if (pavilionSearch.trim()) query.set('q', pavilionSearch.trim());
    if (pavilionCategoryFilter) query.set('category', pavilionCategoryFilter);
    if (pavilionStatusFilter) query.set('status', pavilionStatusFilter);
    if (pavilionGroupFilter) query.set('groupId', pavilionGroupFilter);
    if (pavilionPaymentStatusFilter) {
      query.set('paymentStatus', pavilionPaymentStatusFilter);
    }
    if (pavilionDisplayLimit !== '50') query.set('show', pavilionDisplayLimit);

    const next = query.toString() ? `${pathname}?${query.toString()}` : pathname;
    router.replace(next, { scroll: false });
  }, [
    pathname,
    router,
    pavilionSearch,
    pavilionCategoryFilter,
    pavilionStatusFilter,
    pavilionGroupFilter,
    pavilionPaymentStatusFilter,
    pavilionDisplayLimit,
  ]);

  useEffect(() => {
    if (!storeId) return;
    const storageKey = `store-page-filters-${storeId}`;
    try {
      localStorage.setItem(
        storageKey,
        JSON.stringify({
          q: pavilionSearch.trim(),
          category: pavilionCategoryFilter,
          status: pavilionStatusFilter,
          groupId: pavilionGroupFilter,
          paymentStatus: pavilionPaymentStatusFilter,
          show: pavilionDisplayLimit,
        }),
      );
    } catch (err) {
      console.warn('Failed to persist pavilion filters on store page', err);
    }
  }, [
    storeId,
    pavilionSearch,
    pavilionCategoryFilter,
    pavilionStatusFilter,
    pavilionGroupFilter,
    pavilionPaymentStatusFilter,
    pavilionDisplayLimit,
  ]);

  useEffect(() => {
    if (!storeId || !store?.staff) {
      setOrderedStaffIds([]);
      return;
    }
    const ids: number[] = (store.staff || []).map((s: any) => Number(s.id));
    const key = `store-page-staff-order-${storeId}`;
    try {
      const saved = localStorage.getItem(key);
      if (saved) {
        const parsed: unknown = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          const idSet = new Set(ids);
          const restored: number[] = parsed
            .map((v) => Number(v))
            .filter((id) => Number.isFinite(id) && idSet.has(id));
          const missing: number[] = ids.filter((id) => !restored.includes(id));
          setOrderedStaffIds([...restored, ...missing]);
          return;
        }
      }
    } catch (err) {
      console.warn('Failed to restore staff order on store page', err);
    }
    setOrderedStaffIds(ids);
  }, [storeId, store?.staff]);

  useEffect(() => {
    if (!storeId || orderedStaffIds.length === 0) return;
    try {
      localStorage.setItem(
        `store-page-staff-order-${storeId}`,
        JSON.stringify(orderedStaffIds),
      );
    } catch (err) {
      console.warn('Failed to persist staff order on store page', err);
    }
  }, [storeId, orderedStaffIds]);

  const handlePavilionCreated = () => {
    fetchData(false);
    setShowCreatePavilionModal(false);
  };

  const handleAddStaff = async () => {
    if (!addStaffModal) return;
    if (!addStaffModal.fullName.trim() || !addStaffModal.position.trim() || !addStaffModal.salary) {
      alert('Заполните поля "Имя фамилия", "Должность" и "Зарплата"');
      return;
    }

    const salary = Number(addStaffModal.salary);
    if (Number.isNaN(salary) || salary < 0) {
      alert('Зарплата должна быть неотрицательной');
      return;
    }

    try {
      setStaffSaving(true);
      const idempotencyKey =
        typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
          ? crypto.randomUUID()
          : undefined;
      await apiFetch<any>(`/stores/${storeId}/staff`, {
        method: 'POST',
        body: JSON.stringify({
          fullName: addStaffModal.fullName.trim(),
          position: addStaffModal.position.trim(),
          salary,
          ...(idempotencyKey ? { idempotencyKey } : {}),
        }),
      });

      setAddStaffModal(null);
      await fetchData(false);
    } catch (err) {
      console.error(err);
      alert('Не удалось добавить сотрудника');
    } finally {
      setStaffSaving(false);
    }
  };

  const handleDeleteStaff = async (staffId: number) => {
    if (!confirm('Удалить сотрудника из таблицы?')) return;

    try {
      await apiFetch(`/stores/${storeId}/staff/${staffId}`, {
        method: 'DELETE',
      });
      await fetchData(false);
    } catch (err) {
      console.error(err);
      alert('Не удалось удалить сотрудника');
    }
  };

  const handleUpdateStaffSalaryStatus = async (
    staffId: number,
    salaryStatus: 'UNPAID' | 'PAID',
    payload?: {
      salaryPaymentMethod?: PaymentMethod;
      salaryBankTransferPaid?: number;
      salaryCashbox1Paid?: number;
      salaryCashbox2Paid?: number;
    },
  ) => {
    try {
      await runKeepingScroll(async () => {
        await apiFetch(`/stores/${storeId}/staff/${staffId}`, {
          method: 'PATCH',
          body: JSON.stringify({
            salaryStatus,
            ...payload,
          }),
        });
        await fetchData(false);
      });
    } catch (err) {
      console.error(err);
      alert('Не удалось обновить статус зарплаты');
    }
  };

  const handlePayStaffSalary = async () => {
    if (!payStaffSalaryModal) return;

    const salary = Number(payStaffSalaryModal.salary ?? 0);
    const bank = Number(payStaffSalaryModal.bankTransfer || 0);
    const cash1 = Number(payStaffSalaryModal.cashbox1 || 0);
    const cash2 = Number(payStaffSalaryModal.cashbox2 || 0);
    const channelsTotal = bank + cash1 + cash2;

    if (
      Number.isNaN(bank) ||
      Number.isNaN(cash1) ||
      Number.isNaN(cash2) ||
      bank < 0 ||
      cash1 < 0 ||
      cash2 < 0
    ) {
      alert('Каналы оплаты должны быть неотрицательными');
      return;
    }

    if (Math.abs(channelsTotal - salary) > 0.01) {
      alert('Сумма каналов оплаты должна быть равна зарплате');
      return;
    }

    try {
      setPayStaffSaving(true);
      await runKeepingScroll(async () => {
        await apiFetch(`/stores/${storeId}/staff/${payStaffSalaryModal.id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            salaryStatus: 'PAID',
            salaryBankTransferPaid: bank,
            salaryCashbox1Paid: cash1,
            salaryCashbox2Paid: cash2,
          }),
        });
        await fetchData(false);
      });
      setPayStaffSalaryModal(null);
    } catch (err) {
      console.error(err);
      alert('Не удалось обновить статус зарплаты');
    } finally {
      setPayStaffSaving(false);
    }
  };

  const handleSaveEditedStaffSalary = async () => {
    if (!editStaffSalaryModal) return;

    const nextSalary = Number(editStaffSalaryModal.salary);
    if (Number.isNaN(nextSalary) || nextSalary < 0) {
      alert('Зарплата должна быть неотрицательной');
      return;
    }

    const payload: {
      salary: number;
      salaryStatus?: 'UNPAID' | 'PAID';
      salaryBankTransferPaid?: number;
      salaryCashbox1Paid?: number;
      salaryCashbox2Paid?: number;
      salaryPaymentMethod?: PaymentMethod;
    } = {
      salary: nextSalary,
    };

    if (editStaffSalaryModal.salaryStatus === 'PAID') {
      const bank = Number(editStaffSalaryModal.salaryBankTransferPaid ?? 0);
      const cash1 = Number(editStaffSalaryModal.salaryCashbox1Paid ?? 0);
      const cash2 = Number(editStaffSalaryModal.salaryCashbox2Paid ?? 0);
      const channelsTotal = bank + cash1 + cash2;

      if (
        Number.isNaN(bank) ||
        Number.isNaN(cash1) ||
        Number.isNaN(cash2) ||
        bank < 0 ||
        cash1 < 0 ||
        cash2 < 0
      ) {
        alert('Каналы оплаты должны быть неотрицательными');
        return;
      }

      if (Math.abs(channelsTotal - nextSalary) > 0.01) {
        alert('Сумма каналов оплаты должна быть равна зарплате');
        return;
      }

      payload.salaryStatus = 'PAID';
      payload.salaryBankTransferPaid = bank;
      payload.salaryCashbox1Paid = cash1;
      payload.salaryCashbox2Paid = cash2;
    } else {
      payload.salaryStatus = 'UNPAID';
    }

    try {
      setStaffSaving(true);
      await apiFetch(`/stores/${storeId}/staff/${editStaffSalaryModal.id}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });
      setEditStaffSalaryModal(null);
      await fetchData(false);
    } catch (err) {
      console.error(err);
      alert('Не удалось обновить зарплату');
    } finally {
      setStaffSaving(false);
    }
  };

  const handleCreateHouseholdExpense = async () => {
    if (!createHouseholdModal) return;
    const name = createHouseholdModal.name.trim();
    const bank = Number(createHouseholdModal.bankTransferPaid || 0);
    const cash1 = Number(createHouseholdModal.cashbox1Paid || 0);
    const cash2 = Number(createHouseholdModal.cashbox2Paid || 0);
    const amount = bank + cash1 + cash2;
    if (!name) {
      alert('Введите название');
      return;
    }
    if (
      Number.isNaN(bank) ||
      Number.isNaN(cash1) ||
      Number.isNaN(cash2) ||
      bank < 0 ||
      cash1 < 0 ||
      cash2 < 0
    ) {
      alert('Каналы оплаты должны быть неотрицательными');
      return;
    }
    if (amount <= 0) {
      alert('Введите сумму хотя бы в одном канале оплаты');
      return;
    }

    try {
      setHouseholdSaving(true);
      await createHouseholdExpense(storeId, {
        name,
        amount,
        status: 'PAID',
        bankTransferPaid: bank,
        cashbox1Paid: cash1,
        cashbox2Paid: cash2,
      });
      setCreateHouseholdModal(null);
      await fetchData(false);
    } catch (err) {
      console.error(err);
      alert('Не удалось добавить хоз. расход');
    } finally {
      setHouseholdSaving(false);
    }
  };

  const handleSaveEditedHouseholdExpense = async () => {
    if (!editHouseholdModal) return;

    const name = editHouseholdModal.name.trim();
    const status = editHouseholdModal.status;
    const baseAmount = Number(editHouseholdModal.amount ?? 0);
    const bank = Number(editHouseholdModal.bankTransferPaid || 0);
    const cash1 = Number(editHouseholdModal.cashbox1Paid || 0);
    const cash2 = Number(editHouseholdModal.cashbox2Paid || 0);
    const paidAmount = bank + cash1 + cash2;
    if (!name) {
      alert('Введите название');
      return;
    }
    if (
      Number.isNaN(bank) ||
      Number.isNaN(cash1) ||
      Number.isNaN(cash2) ||
      bank < 0 ||
      cash1 < 0 ||
      cash2 < 0
    ) {
      alert('Каналы оплаты должны быть неотрицательными');
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

    const payload: {
      name: string;
      amount: number;
      status: 'UNPAID' | 'PAID';
      bankTransferPaid?: number;
      cashbox1Paid?: number;
      cashbox2Paid?: number;
    } = {
      name,
      amount: status === 'PAID' ? paidAmount : baseAmount,
      status,
      bankTransferPaid: status === 'PAID' ? bank : 0,
      cashbox1Paid: status === 'PAID' ? cash1 : 0,
      cashbox2Paid: status === 'PAID' ? cash2 : 0,
    };

    try {
      setHouseholdSaving(true);
      await runKeepingScroll(async () => {
        await updateHouseholdExpense(storeId, editHouseholdModal.id, payload);
        await fetchData(false);
      });
      setEditHouseholdModal(null);
    } catch (err) {
      console.error(err);
      alert('Не удалось обновить хоз. расход');
    } finally {
      setHouseholdSaving(false);
    }
  };

  const handleDeleteManualExpense = async (expenseId: number) => {
    if (!confirm('Удалить этот расход?')) return;

    try {
      await deletePavilionExpense(storeId, expenseId);
      await fetchData(false);
    } catch (err) {
      console.error(err);
      alert('Не удалось удалить расход');
    }
  };

  const handleCreateAdminExpense = async () => {
    if (!createAdminExpenseModal) return;
    const note = createAdminExpenseModal.label.trim();
    const bank = Number(createAdminExpenseModal.bankTransferPaid || 0);
    const cash1 = Number(createAdminExpenseModal.cashbox1Paid || 0);
    const cash2 = Number(createAdminExpenseModal.cashbox2Paid || 0);
    const amount = bank + cash1 + cash2;

    if (
      Number.isNaN(bank) ||
      Number.isNaN(cash1) ||
      Number.isNaN(cash2) ||
      bank < 0 ||
      cash1 < 0 ||
      cash2 < 0
    ) {
      alert('Каналы оплаты должны быть неотрицательными');
      return;
    }
    if (amount <= 0) {
      alert('Введите сумму хотя бы в одном канале оплаты');
      return;
    }

    try {
      setAdminExpenseSaving(true);
      await createPavilionExpense(storeId, {
        type: createAdminExpenseModal.type,
        note,
        amount,
        status: 'PAID',
        bankTransferPaid: bank,
        cashbox1Paid: cash1,
        cashbox2Paid: cash2,
      });
      setCreateAdminExpenseModal(null);
      await fetchData(false);
    } catch (err) {
      console.error(err);
      alert('Не удалось добавить расход');
    } finally {
      setAdminExpenseSaving(false);
    }
  };

  const handleSaveEditedAdminExpense = async () => {
    if (!editAdminExpenseModal) return;
    const note = editAdminExpenseModal.note.trim();
    const status = editAdminExpenseModal.status;
    const baseAmount = Number(editAdminExpenseModal.amount ?? 0);
    const bank = Number(editAdminExpenseModal.bankTransferPaid || 0);
    const cash1 = Number(editAdminExpenseModal.cashbox1Paid || 0);
    const cash2 = Number(editAdminExpenseModal.cashbox2Paid || 0);
    const paidAmount = bank + cash1 + cash2;

    if (!note) {
      alert('Введите название');
      return;
    }
    if (
      Number.isNaN(bank) ||
      Number.isNaN(cash1) ||
      Number.isNaN(cash2) ||
      bank < 0 ||
      cash1 < 0 ||
      cash2 < 0
    ) {
      alert('Каналы оплаты должны быть неотрицательными');
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

    const payload: {
      note: string;
      amount: number;
      status: PavilionExpenseStatus;
      bankTransferPaid?: number;
      cashbox1Paid?: number;
      cashbox2Paid?: number;
    } = {
      note,
      amount: status === 'PAID' ? paidAmount : baseAmount,
      status,
      bankTransferPaid: status === 'PAID' ? bank : 0,
      cashbox1Paid: status === 'PAID' ? cash1 : 0,
      cashbox2Paid: status === 'PAID' ? cash2 : 0,
    };

    try {
      setAdminExpenseSaving(true);
      await runKeepingScroll(async () => {
        await updatePavilionExpense(storeId, editAdminExpenseModal.id, payload);
        await fetchData(false);
      });
      setEditAdminExpenseModal(null);
    } catch (err) {
      console.error(err);
      alert('Не удалось обновить расход');
    } finally {
      setAdminExpenseSaving(false);
    }
  };

  const handleCreateOtherExpense = async () => {
    if (!createOtherExpenseModal) return;
    const note = createOtherExpenseModal.note.trim();
    const bank = Number(createOtherExpenseModal.bankTransferPaid || 0);
    const cash1 = Number(createOtherExpenseModal.cashbox1Paid || 0);
    const cash2 = Number(createOtherExpenseModal.cashbox2Paid || 0);
    const amount = bank + cash1 + cash2;

    if (!note) {
      alert('Введите название');
      return;
    }
    if (
      Number.isNaN(bank) ||
      Number.isNaN(cash1) ||
      Number.isNaN(cash2) ||
      bank < 0 ||
      cash1 < 0 ||
      cash2 < 0
    ) {
      alert('Каналы оплаты должны быть неотрицательными');
      return;
    }
    if (amount <= 0) {
      alert('Введите сумму хотя бы в одном канале оплаты');
      return;
    }

    try {
      setOtherExpenseSaving(true);
      await createPavilionExpense(storeId, {
        type: 'OTHER',
        note,
        amount,
        status: 'PAID',
        bankTransferPaid: bank,
        cashbox1Paid: cash1,
        cashbox2Paid: cash2,
      });
      setCreateOtherExpenseModal(null);
      await fetchData(false);
    } catch (err) {
      console.error(err);
      alert('Не удалось добавить прочий расход');
    } finally {
      setOtherExpenseSaving(false);
    }
  };

  const handleSaveEditedOtherExpense = async () => {
    if (!editOtherExpenseModal) return;
    const note = editOtherExpenseModal.note.trim();
    const status = editOtherExpenseModal.status;
    const baseAmount = Number(editOtherExpenseModal.amount ?? 0);
    const bank = Number(editOtherExpenseModal.bankTransferPaid || 0);
    const cash1 = Number(editOtherExpenseModal.cashbox1Paid || 0);
    const cash2 = Number(editOtherExpenseModal.cashbox2Paid || 0);
    const paidAmount = bank + cash1 + cash2;

    if (!note) {
      alert('Введите название');
      return;
    }
    if (
      Number.isNaN(bank) ||
      Number.isNaN(cash1) ||
      Number.isNaN(cash2) ||
      bank < 0 ||
      cash1 < 0 ||
      cash2 < 0
    ) {
      alert('Каналы оплаты должны быть неотрицательными');
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

    const payload: {
      note: string;
      amount: number;
      status: PavilionExpenseStatus;
      bankTransferPaid?: number;
      cashbox1Paid?: number;
      cashbox2Paid?: number;
    } = {
      note,
      amount: status === 'PAID' ? paidAmount : baseAmount,
      status,
      bankTransferPaid: status === 'PAID' ? bank : 0,
      cashbox1Paid: status === 'PAID' ? cash1 : 0,
      cashbox2Paid: status === 'PAID' ? cash2 : 0,
    };

    try {
      setOtherExpenseSaving(true);
      await runKeepingScroll(async () => {
        await updatePavilionExpense(storeId, editOtherExpenseModal.id, payload);
        await fetchData(false);
      });
      setEditOtherExpenseModal(null);
    } catch (err) {
      console.error(err);
      alert('Не удалось обновить прочий расход');
    } finally {
      setOtherExpenseSaving(false);
    }
  };

  const handleDeleteHouseholdExpenseFromEditModal = async () => {
    if (!editHouseholdModal) return;
    if (!confirm('Удалить этот расход?')) return;

    try {
      setHouseholdSaving(true);
      await deleteHouseholdExpense(storeId, editHouseholdModal.id);
      setEditHouseholdModal(null);
      await fetchData(false);
    } catch (err) {
      console.error(err);
      alert('Не удалось удалить расход');
    } finally {
      setHouseholdSaving(false);
    }
  };

  const handleDeleteOtherExpenseFromEditModal = async () => {
    if (!editOtherExpenseModal) return;
    if (!confirm('Удалить этот расход?')) return;

    try {
      setOtherExpenseSaving(true);
      await deletePavilionExpense(storeId, editOtherExpenseModal.id);
      setEditOtherExpenseModal(null);
      await fetchData(false);
    } catch (err) {
      console.error(err);
      alert('Не удалось удалить расход');
    } finally {
      setOtherExpenseSaving(false);
    }
  };

  if (loading) return <div className="p-6 text-center text-lg">Загрузка...</div>;
  if (error) return <div className="p-6 text-center text-red-600">{error}</div>;
  if (!store) return <div className="p-6 text-center text-red-600">Магазин не найден</div>;

  const permissions = store.permissions || [];
  const allCategories: string[] = Array.from(
    new Set<string>([
      ...(pavilions || [])
        .map((p: any) => (p.category || '').trim())
        .filter((category: string) => category.length > 0),
      ...((store.pavilionCategoryPresets || [])
        .map((category: string) => String(category || '').trim())
        .filter((category: string) => category.length > 0) as string[]),
    ]),
  ).sort((a: string, b: string) => a.localeCompare(b));
  const pavilionMap = new Map<number, any>(
    (pavilions || []).map((p: any) => [Number(p.id), p]),
  );
  const orderedPavilions =
    orderedPavilionIds.length > 0
      ? orderedPavilionIds
          .map((id) => pavilionMap.get(id))
          .filter((p): p is any => Boolean(p))
      : (pavilions || []);
  const canReorderPavilions = hasPermission(permissions, 'EDIT_PAVILIONS');
  const groupedManualExpenses = MANUAL_EXPENSE_CATEGORIES.reduce(
    (acc, category) => {
      acc[category.type] = storeExpenses.filter((item: any) => item.type === category.type);
      return acc;
    },
    {} as Record<CardExpenseType, any[]>,
  );
  const otherExpenses = storeExpenses.filter((item: any) => item.type === 'OTHER');
  const otherExpensesSorted = [...otherExpenses].sort(
    (a: any, b: any) =>
      new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime(),
  );
  const recentOtherExpenses = otherExpensesSorted.slice(0, 5);
  const householdExpensesTotal = householdExpenses.reduce(
    (sum, expense) => sum + Number(expense.amount ?? 0),
    0,
  );
  const manualExpensesForecastTotal = storeExpenses.reduce(
    (sum, item) =>
      item.type === 'SALARIES' ||
      item.type === 'STORE_FACILITIES' ||
      item.type === 'HOUSEHOLD'
        ? sum
        : sum + Number(item.amount ?? 0),
    0,
  );
  const manualExpensesActualTotal = storeExpenses
    .filter(
      (item) =>
        item.type !== 'SALARIES' &&
        item.type !== 'STORE_FACILITIES' &&
        item.type !== 'HOUSEHOLD' &&
        item.status === 'PAID',
    )
    .reduce((sum, item) => sum + Number(item.amount ?? 0), 0);
  const staffSalariesForecastTotal = (store.staff || []).reduce(
    (sum: number, staff: any) => sum + Number(staff.salary ?? 0),
    0,
  );
  const staffSalariesActualTotal = (store.staff || [])
    .filter((staff: any) => staff.salaryStatus === 'PAID')
    .reduce((sum: number, staff: any) => sum + Number(staff.salary ?? 0), 0);
  const utilitiesExpenseForecast = storeExpenses
    .filter((item) => item.type === 'STORE_FACILITIES')
    .reduce(
      (sum: number, item: any) => sum + Number(item.amount ?? 0),
      0,
    );
  const utilitiesExpenseActual = storeExpenses
    .filter((item: any) => item.type === 'STORE_FACILITIES' && item.status === 'PAID')
    .reduce(
      (sum: number, item: any) => sum + Number(item.amount ?? 0),
      0,
    );
  const householdExpensesActual = householdExpenses.reduce(
    (sum, expense) =>
      expense.status === 'PAID' ? sum + Number(expense.amount ?? 0) : sum,
    0,
  );
  const expensesForecastTotal =
    manualExpensesForecastTotal +
    staffSalariesForecastTotal +
    householdExpensesTotal +
    utilitiesExpenseForecast;
  const expensesActualTotal =
    manualExpensesActualTotal +
    staffSalariesActualTotal +
    householdExpensesActual +
    utilitiesExpenseActual;

  const staffMap = new Map<number, any>(
    (store.staff || []).map((staff: any) => [Number(staff.id), staff]),
  );
  const orderedStaff =
    orderedStaffIds.length > 0
      ? orderedStaffIds
          .map((id) => staffMap.get(id))
          .filter((staff): staff is any => Boolean(staff))
      : (store.staff || []);
  const movePavilion = async (dragId: number, targetId: number) => {
    if (dragId === targetId) return;
    const source =
      orderedPavilionIds.length > 0
        ? [...orderedPavilionIds]
        : (pavilions || []).map((p: any) => Number(p.id));
    const fromIndex = source.indexOf(dragId);
    const toIndex = source.indexOf(targetId);
    if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) return;

    const [moved] = source.splice(fromIndex, 1);
    source.splice(toIndex, 0, moved);

    const previousOrder = orderedPavilionIds;
    setOrderedPavilionIds(source);
    try {
      await reorderPavilions(storeId, source);
    } catch (err) {
      console.error(err);
      setOrderedPavilionIds(previousOrder);
      await fetchPavilions();
    }
  };

  const moveStaff = (dragId: number, targetId: number) => {
    if (dragId === targetId) return;
    setOrderedStaffIds((prev) => {
      const source = prev.length > 0 ? [...prev] : (store.staff || []).map((s: any) => s.id);
      const fromIndex = source.indexOf(dragId);
      const toIndex = source.indexOf(targetId);
      if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) return source;

      const [moved] = source.splice(fromIndex, 1);
      source.splice(toIndex, 0, moved);
      return source;
    });
  };

  const canCreatePavilion = hasPermission(permissions, 'CREATE_PAVILIONS');
  const buildStoreReturnTo = () => {
    const query = new URLSearchParams();
    if (pavilionSearch.trim()) query.set('q', pavilionSearch.trim());
    if (pavilionCategoryFilter) query.set('category', pavilionCategoryFilter);
    if (pavilionStatusFilter) query.set('status', pavilionStatusFilter);
    if (pavilionGroupFilter) query.set('groupId', pavilionGroupFilter);
    if (pavilionPaymentStatusFilter) {
      query.set('paymentStatus', pavilionPaymentStatusFilter);
    }
    if (pavilionDisplayLimit !== '50') query.set('show', pavilionDisplayLimit);
    const qs = query.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  };

  return (
    <div className="min-h-screen scroll-smooth bg-[#f9f5f0]">
      <div className="mx-auto flex max-w-[1600px] gap-6 px-3 py-1 md:px-6 md:py-6">
        <StoreSidebar
          storeId={storeId}
          store={store}
          active="pavilions"
          onOpenExtraIncome={() => setShowExtraIncomeModal(true)}
        />

        <main className="min-w-0 flex-1 space-y-3 pt-16 md:space-y-6 md:pt-0">
        {hasPermission(permissions, 'VIEW_PAVILIONS') && (
          <section
            id="pavilions"
            data-store-section
            className="scroll-mt-24 rounded-2xl border border-[#D8D1CB] bg-white p-6 shadow-sm md:p-8"
          >
            <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <h2 className="text-xl font-semibold md:text-2xl bor">Павильоны</h2>
              <div className="flex flex-wrap items-center gap-2">
                {canCreatePavilion && (
                  <button
                    onClick={() => setShowCreatePavilionModal(true)}
                    className="inline-flex items-center gap-2 rounded-xl bg-[#2563EB] px-3 py-2 text-sm font-semibold text-white transition hover:bg-[#1D4ED8]"
                  >
                    <CirclePlus className="h-4 w-4" />
                    Добавить павильон
                  </button>
                )}
              </div>
            </div>

            <div className="mb-4 space-y-3">
              <input
                type="text"
                value={pavilionSearch}
                onChange={(e) => {
                  setPavilionSearch(e.target.value);
                }}
                className="w-full rounded-lg border border-[#D8D1CB] px-3 py-2"
                placeholder="Поиск по имени павильона"
              />
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <select
                value={pavilionCategoryFilter}
                onChange={(e) => {
                  setPavilionCategoryFilter(e.target.value);
                }}
                className="rounded-lg border border-[#D8D1CB] px-3 py-2"
              >
                <option value="">Категория</option>
                {allCategories.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
              <select
                value={pavilionStatusFilter}
                onChange={(e) => {
                  setPavilionStatusFilter(e.target.value);
                }}
                className="rounded-lg border border-[#D8D1CB] px-3 py-2"
              >
                <option value="">Статус</option>
                <option value="AVAILABLE">СВОБОДЕН</option>
                <option value="RENTED">ЗАНЯТ</option>
                <option value="PREPAID">ПРЕДОПЛАТА</option>
              </select>
              <select
                value={pavilionGroupFilter}
                onChange={(e) => {
                  setPavilionGroupFilter(e.target.value);
                }}
                className="rounded-lg border border-[#D8D1CB] px-3 py-2"
              >
                <option value="">Группы</option>
                {(store.pavilionGroups || []).map((group: any) => (
                  <option key={group.id} value={group.id}>
                    {group.name}
                  </option>
                ))}
              </select>
              <select
                value={pavilionPaymentStatusFilter}
                onChange={(e) =>
                  {
                    setPavilionPaymentStatusFilter(
                      (e.target.value as '' | 'PAID' | 'PARTIAL' | 'UNPAID') || '',
                    );
                  }
                }
                className="rounded-lg border border-[#D8D1CB] px-3 py-2"
              >
                <option value="">Статус оплаты</option>
                <option value="PAID">Оплачено</option>
                <option value="PARTIAL">Частично оплачено</option>
                <option value="UNPAID">Не оплачено</option>
              </select>
              </div>
            </div>

            {pavilionsLoading ? (
              <p className="py-8 text-center text-[#6B6B6B]">Загрузка павильонов...</p>
            ) : orderedPavilions.length === 0 ? (
              <p className="py-8 text-center text-[#6B6B6B]">
                {pavilionsTotal === 0
                  ? 'В магазине пока нет павильонов'
                  : 'По текущим фильтрам павильоны не найдены'}
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-[#E5DED8]">
                  <thead className="bg-[#F4EFEB]">
                    <tr>
                      <th className="rounded-l-xl px-4 py-3 text-left text-xs font-medium uppercase text-[#6B6B6B]">
                        Перенос
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase text-[#6B6B6B]">
                        Павильон
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase text-[#6B6B6B]">
                        м²
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase text-[#6B6B6B]">
                        Статус
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase text-[#6B6B6B]">
                        Оплата
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase text-[#6B6B6B]">
                        Категория
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase text-[#6B6B6B]">
                        Наименование организации
                      </th>
                      <th className="rounded-r-xl px-4 py-3 text-left text-xs font-medium uppercase text-[#6B6B6B]">
                        Группы
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E5DED8] bg-white">
                    {orderedPavilions.map((p: any) => (
                      (() => {
                        const paymentStatus = getPavilionPaymentStatus(p);
                        const carryAdjustment = Number(p.paymentCarryAdjustment ?? 0);
                        const carryBalance = -carryAdjustment;
                        const hasCarryAdjustment = Math.abs(carryBalance) > 0.009;
                        return (
                      <tr
                        key={p.id}
                        className="cursor-pointer transition-colors hover:bg-[#f9f5f0]"
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
                        onClick={() =>
                          router.push(
                            `/stores/${storeId}/pavilions/${p.id}?returnTo=${encodeURIComponent(buildStoreReturnTo())}`,
                          )
                        }
                      >
                        <td className="px-4 py-3 text-sm text-[#374151]">
                          <button
                            type="button"
                            draggable={canReorderPavilions}
                            onClick={(e) => e.stopPropagation()}
                            onDragStart={(e) => {
                              if (!canReorderPavilions) return;
                              e.stopPropagation();
                              setDraggedPavilionId(p.id);
                              e.dataTransfer.effectAllowed = 'move';
                            }}
                            onDragEnd={(e) => {
                              e.stopPropagation();
                              setDraggedPavilionId(null);
                            }}
                            className={`select-none rounded px-2 py-1 text-lg leading-none ${
                              canReorderPavilions
                                ? 'cursor-grab text-[#6B6B6B] hover:bg-[#ede7e2] active:cursor-grabbing'
                                : 'cursor-not-allowed text-gray-300'
                            }`}
                            title={
                              canReorderPavilions
                                ? 'Потяните, чтобы изменить порядок'
                                : 'Сортировка по оплате активна'
                            }
                            aria-label={`Переместить павильон ${p.number}`}
                          >
                            ⋮⋮
                          </button>
                        </td>
                        <td className="px-4 py-3 text-sm font-medium text-[#111111]">
                          {p.number}
                        </td>
                        <td className="px-4 py-3 text-sm text-[#374151]">
                          {p.squareMeters ?? 0}
                        </td>
                        <td className="px-4 py-3 text-sm text-[#374151]">
                          <span
                            className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
                              p.status === 'RENTED'
                                ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                                : p.status === 'PREPAID'
                                  ? 'border-indigo-200 bg-indigo-50 text-indigo-700'
                                  : 'border-amber-200 bg-amber-50 text-amber-700'
                            }`}
                          >
                            {statusLabel[p.status] ?? p.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-[#374151]">
                          <div className="space-y-1">
                            <span
                              className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold ${paymentStatus.className}`}
                            >
                              {paymentStatus.label}
                            </span>
                            {hasCarryAdjustment && (
                              <div
                                className={`text-xs ${
                                  carryBalance < 0
                                    ? 'text-amber-700'
                                    : 'text-emerald-700'
                                }`}
                              >
                                Перенос: {formatMoney(carryBalance, store.currency)}
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-[#374151]">
                          {p.category || '-'}
                        </td>
                        <td className="px-4 py-3 text-sm text-[#374151]">
                          {p.tenantName || 'Свободен'}
                        </td>
                        <td className="px-4 py-3 text-sm text-[#374151]">
                          <div
                            className="space-y-2"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div className="flex flex-wrap gap-2">
                              {(p.groupMemberships || []).length === 0 ? (
                                <span className="text-xs text-[#6B6B6B]">Нет групп</span>
                              ) : (
                                p.groupMemberships.map((membership: any) => (
                                  <span
                                    key={`${p.id}-${membership.group.id}`}
                                    className="inline-flex items-center gap-1 rounded-full bg-[#F4EFEB] px-2 py-1 text-xs"
                                  >
                                    {membership.group.name}
                                  </span>
                                ))
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                        );
                      })()
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="mt-4 flex items-start justify-between text-sm text-[#6B6B6B]">
              <div className="flex flex-col gap-2">
                <select
                  value={pavilionDisplayLimit}
                  onChange={(e) =>
                    setPavilionDisplayLimit((e.target.value as '50' | '100' | 'all') || '50')
                  }
                  className="w-fit rounded-lg border border-[#D8D1CB] bg-white px-3 py-2 text-sm text-[#111111]"
                >
                  <option value="50">Показать первые 50</option>
                  <option value="100">Показать первые 100</option>
                  <option value="all">Показать все</option>
                </select>
              </div>
            </div>
          </section>
        )}

        {false && (
          <section
            id="household"
            data-store-section
            className="scroll-mt-24 rounded-2xl border border-[#D8D1CB] bg-white p-6 shadow-sm md:p-8"
          >
            <h2 className="text-xl font-semibold text-slate-900 md:text-2xl">Хозяйственные расходы</h2>
            {hasPermission(permissions, 'CREATE_CHARGES') && (
              <div className="mb-5 mt-4">
                <button
                  onClick={() =>
                    setCreateHouseholdModal({
                      name: '',
                      bankTransferPaid: '',
                      cashbox1Paid: '',
                      cashbox2Paid: '',
                    })
                  }
                  className="rounded-xl bg-[#FF6A13] px-4 py-2.5 text-white transition hover:bg-[#E65C00] disabled:opacity-60"
                >
                  Добавить
                </button>
              </div>
            )}

            {householdExpenses.length === 0 ? (
              <p className="text-slate-600">Расходов пока нет</p>
            ) : (
              <div className="space-y-2">
                <div className="hidden items-center gap-3 rounded-lg border border-[#D8D1CB] bg-[#F4EFEB] px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-[#6B6B6B] md:grid md:grid-cols-[minmax(180px,1fr)_minmax(220px,2fr)_minmax(110px,1fr)_minmax(170px,auto)]">
                  <div className="text-center">Название и статус</div>
                  <div className="text-center">Каналы оплаты</div>
                  <div className="text-center">Сумма</div>
                  <div className="text-center">Действия</div>
                </div>
                {householdExpenses.map((expense: any) => (
                  <article
                    key={expense.id}
                    className="rounded-xl border border-[#D8D1CB] bg-white px-4 py-2.5"
                  >
                    <div className="grid items-center gap-2 md:grid-cols-[minmax(180px,1fr)_minmax(220px,2fr)_minmax(110px,1fr)_minmax(170px,auto)] md:gap-3">
                      <div className="min-w-0 md:text-center">
                        <p className="truncate text-sm font-semibold text-slate-900 md:mx-auto md:max-w-[260px]">
                          {expense.name}
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
                        <div className="md:hidden text-[10px] uppercase tracking-wide text-slate-400">
                          Каналы оплаты
                        </div>
                        <div className="md:mx-auto md:max-w-[260px] font-bold text-slate-900">
                          {(expense.status ?? 'UNPAID') === 'PAID'
                            ? paymentChannelsLabel(
                                expense.bankTransferPaid,
                                expense.cashbox1Paid,
                                expense.cashbox2Paid,
                                store.currency,
                              ) || 'Каналы оплаты не заданы'
                            : 'Каналы оплаты не заданы'}
                        </div>
                      </div>
                      <div className="text-left md:text-center">
                        <div className="md:hidden text-[10px] uppercase tracking-wide text-slate-400">
                          Сумма
                        </div>
                        <p className="text-sm font-bold text-slate-900">
                          {formatMoney(expense.amount, store.currency)}
                        </p>
                      </div>
                      <div className="flex items-center justify-start gap-2 md:flex-col md:items-center md:justify-center md:gap-1.5">
                        {hasPermission(permissions, 'EDIT_CHARGES') && (
                          <button
                            onClick={() => {
                              const bank = Number(expense.bankTransferPaid ?? 0);
                              const cash1 = Number(expense.cashbox1Paid ?? 0);
                              const cash2 = Number(expense.cashbox2Paid ?? 0);

                              setEditHouseholdModal({
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
        )}

        {false && (
          <section
            id="other-expenses"
            data-store-section
            className="scroll-mt-24 rounded-2xl border border-[#D8D1CB] bg-white p-6 shadow-sm md:p-8"
          >
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-xl font-semibold text-slate-900 md:text-2xl">Прочие расходы</h2>
              <Link
                href={`/stores/${storeId}/other-expenses`}
                className="rounded-xl border border-[#d8d1cb] bg-white px-3 py-2 text-sm font-semibold text-[#111111] transition hover:bg-[#f4efeb]"
              >
                Прочие расходы
              </Link>
            </div>

            {hasPermission(permissions, 'CREATE_CHARGES') && (
              <div className="mb-5">
                <button
                  onClick={() =>
                    setCreateOtherExpenseModal({
                      note: '',
                      bankTransferPaid: '',
                      cashbox1Paid: '',
                      cashbox2Paid: '',
                    })
                  }
                  className="rounded-xl bg-[#FF6A13] px-4 py-2.5 text-white transition hover:bg-[#E65C00] disabled:opacity-60"
                >
                  Добавить
                </button>
              </div>
            )}

            {otherExpenses.length === 0 ? (
              <p className="text-slate-600">Расходов пока нет</p>
            ) : (
              <div className="space-y-2">
                <p className="text-xs text-[#6b6b6b]">Показаны последние 5 записей за текущий месяц</p>
                <div className="hidden items-center gap-3 rounded-lg border border-[#D8D1CB] bg-[#F4EFEB] px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-[#6B6B6B] md:grid md:grid-cols-[minmax(180px,1fr)_minmax(220px,2fr)_minmax(110px,1fr)_minmax(170px,auto)]">
                  <div className="text-center">Название и статус</div>
                  <div className="text-center">Каналы оплаты</div>
                  <div className="text-center">Сумма</div>
                  <div className="text-center">Действия</div>
                </div>
                {recentOtherExpenses.map((expense: any) => (
                  <article
                    key={expense.id}
                    className="rounded-xl border border-[#D8D1CB] bg-white px-4 py-2.5"
                  >
                    <div className="grid items-center gap-2 md:grid-cols-[minmax(180px,1fr)_minmax(220px,2fr)_minmax(110px,1fr)_minmax(170px,auto)] md:gap-3">
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
                        <div className="md:hidden text-[10px] uppercase tracking-wide text-slate-400 text-bold">
                          Каналы оплаты
                        </div>
                        <div className="md:mx-auto md:max-w-[260px] font-bold text-slate-900">
                          {(expense.status ?? 'UNPAID') === 'PAID'
                            ? paymentChannelsLabel(
                                expense.bankTransferPaid,
                                expense.cashbox1Paid,
                                expense.cashbox2Paid,
                                store.currency,
                              ) || 'Каналы оплаты не заданы'
                            : 'Каналы оплаты не заданы'}
                        </div>
                      </div>
                      <div className="text-left md:text-center">
                        <div className="md:hidden text-[10px] uppercase tracking-wide text-slate-400">
                          Сумма
                        </div>
                        <p className="text-sm font-bold text-slate-900">
                          {formatMoney(expense.amount, store.currency)}
                        </p>
                      </div>
                      <div className="flex items-center justify-start gap-2 md:flex-col md:items-center md:justify-center md:gap-1.5">
                        {hasPermission(permissions, 'EDIT_CHARGES') && (
                          <button
                            onClick={() => {
                              const bank = Number(expense.bankTransferPaid ?? 0);
                              const cash1 = Number(expense.cashbox1Paid ?? 0);
                              const cash2 = Number(expense.cashbox2Paid ?? 0);

                              setEditOtherExpenseModal({
                                id: Number(expense.id),
                                note: String(expense.note ?? ''),
                                amount: Number(expense.amount ?? 0),
                                status: (expense.status ?? 'UNPAID') as PavilionExpenseStatus,
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
        )}

        {false && (
          <section
            id="admin-expenses"
            data-store-section
            className="scroll-mt-24 rounded-2xl border border-[#D8D1CB] bg-white p-6 shadow-sm md:p-8"
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold md:text-2xl">Административные расходы</h2>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
              {MANUAL_EXPENSE_CATEGORIES.map((category) => {
                const categoryItems = groupedManualExpenses[category.type] ?? [];
                const categoryTotal = categoryItems.reduce(
                  (sum: number, item: any) => sum + Number(item.amount ?? 0),
                  0,
                );

                return (
                  <div key={category.type} className="rounded-xl border border-[#D8D1CB] bg-white p-3">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <div className="text-sm font-semibold">{category.label}</div>
                      <div className="text-sm font-semibold">
                        {formatMoney(categoryTotal, store.currency)}
                      </div>
                    </div>

                    {hasPermission(permissions, 'CREATE_CHARGES') && (
                      <div className="mb-2">
                        <button
                          onClick={() =>
                            setCreateAdminExpenseModal({
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
                          <article
                            key={item.id}
                            className="flex min-h-[108px] w-full flex-col justify-between rounded-xl border border-[#D8D1CB] bg-[#F4EFEB]/70 p-3"
                          >
                            <div className="mb-2 flex items-start justify-between gap-3">
                              <p className="pr-2 text-xs font-semibold leading-5 text-slate-900">
                                {item.note || category.label}
                              </p>
                              <p className="shrink-0 text-xs font-bold text-slate-900">
                                {formatMoney(item.amount, store.currency)}
                              </p>
                            </div>

                            <div className="flex items-center justify-between gap-2">
                              <div className="min-w-0 space-y-1">
                                <span
                                  className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                                    item.status === 'PAID'
                                      ? 'bg-emerald-100 text-emerald-700'
                                      : 'bg-amber-100 text-amber-700'
                                  }`}
                                >
                                  {item.status === 'PAID' ? 'Оплачено' : 'Не оплачено'}
                                </span>
                                <div className="text-[11px] text-slate-600">
                                  {(item.status ?? 'UNPAID') === 'PAID' ? (
                                    paymentChannelsLines(
                                      item.bankTransferPaid,
                                      item.cashbox1Paid,
                                      item.cashbox2Paid,
                                      store.currency,
                                    ).map((line) => <div key={line}>{line}</div>)
                                  ) : (
                                    <div>Каналы оплаты не заданы</div>
                                  )}
                                </div>
                              </div>

                              <div className="flex flex-col items-end gap-2">
                                {hasPermission(permissions, 'EDIT_CHARGES') && (
                                  <button
                                    onClick={() => {
                                      const bank = Number(item.bankTransferPaid ?? 0);
                                      const cash1 = Number(item.cashbox1Paid ?? 0);
                                      const cash2 = Number(item.cashbox2Paid ?? 0);

                                      setEditAdminExpenseModal({
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
        )}

        {false && (
          <section
            id="staff"
            data-store-section
            className="scroll-mt-24 rounded-2xl border border-[#D8D1CB] bg-white p-6 shadow-sm md:p-8"
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold md:text-2xl">Штатное расписание</h2>
            </div>

            {hasPermission(permissions, 'MANAGE_STAFF') && (
              <div className="mb-4">
                <button
                  onClick={() =>
                    setAddStaffModal({
                      fullName: '',
                      position: '',
                      salary: '',
                    })
                  }
                  className="rounded-xl bg-[#FF6A13] px-4 py-2.5 text-white transition hover:bg-[#E65C00] disabled:opacity-60"
                >
                  Добавить
                </button>
              </div>
            )}

            {!store.staff || store.staff.length === 0 ? (
              <p className="text-[#6B6B6B]">Список сотрудников пуст</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-[#E5DED8]">
                  <thead className="bg-[#F4EFEB]">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase text-[#6B6B6B]">
                        Перенос
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase text-[#6B6B6B]">
                        Должность
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase text-[#6B6B6B]">
                        Имя фамилия
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase text-[#6B6B6B]">
                        Зарплата
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase text-[#6B6B6B]">
                        Статус оплаты
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium uppercase text-[#6B6B6B]">
                        Действия
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E5DED8]">
                    {orderedStaff.map((staff: any) => (
                      <tr
                        key={staff.id}
                        onDragOver={(e) => {
                          if (draggedStaffId == null) return;
                          e.preventDefault();
                          e.dataTransfer.dropEffect = 'move';
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          if (draggedStaffId == null) return;
                          moveStaff(draggedStaffId, staff.id);
                          setDraggedStaffId(null);
                        }}
                      >
                        <td className="px-4 py-3 text-sm text-[#374151]">
                          <button
                            type="button"
                            draggable
                            onDragStart={(e) => {
                              setDraggedStaffId(staff.id);
                              e.dataTransfer.effectAllowed = 'move';
                            }}
                            onDragEnd={() => setDraggedStaffId(null)}
                            className="cursor-grab select-none rounded px-2 py-1 text-lg leading-none text-[#6B6B6B] hover:bg-[#ede7e2] active:cursor-grabbing"
                            title="Потяните, чтобы изменить порядок"
                            aria-label={`Переместить сотрудника ${staff.fullName}`}
                          >
                            ⋮⋮
                          </button>
                        </td>
                        <td className="px-4 py-3 text-sm">{staff.position}</td>
                        <td className="px-4 py-3 text-sm">{staff.fullName}</td>
                        <td className="px-4 py-3 text-sm">
                          {formatMoney(Number(staff.salary ?? 0), store.currency)}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <span
                            className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                              (staff.salaryStatus ?? 'UNPAID') === 'PAID'
                                ? 'bg-emerald-100 text-emerald-700'
                                : 'bg-amber-100 text-amber-700'
                            }`}
                          >
                            {(staff.salaryStatus ?? 'UNPAID') === 'PAID' ? 'Оплачено' : 'Не оплачено'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right text-sm">
                          {hasPermission(permissions, 'MANAGE_STAFF') && (
                            <div className="flex justify-end gap-2">
                              <button
                                onClick={() =>
                                  setEditStaffSalaryModal({
                                    id: Number(staff.id),
                                    fullName: String(staff.fullName ?? 'Сотрудник'),
                                    salary: String(Number(staff.salary ?? 0)),
                                    salaryStatus:
                                      (staff.salaryStatus as 'UNPAID' | 'PAID') ?? 'UNPAID',
                                    salaryBankTransferPaid: Number(
                                      staff.salaryBankTransferPaid ?? 0,
                                    ),
                                    salaryCashbox1Paid: Number(staff.salaryCashbox1Paid ?? 0),
                                    salaryCashbox2Paid: Number(staff.salaryCashbox2Paid ?? 0),
                                    salaryPaymentMethod:
                                      (staff.salaryPaymentMethod as PaymentMethod | null) ?? null,
                                  })
                                }
                                className="rounded-lg border border-[#CFC6BF] bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-[#ede7e2]"
                              >
                                Оплатить/Изменить
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        </main>
      </div>

      <AddStaffModal
        open={Boolean(addStaffModal)}
        fullName={addStaffModal?.fullName ?? ''}
        position={addStaffModal?.position ?? ''}
        salary={addStaffModal?.salary ?? ''}
        onFullNameChange={(value) =>
          setAddStaffModal((prev) => (prev ? { ...prev, fullName: value } : prev))
        }
        onPositionChange={(value) =>
          setAddStaffModal((prev) => (prev ? { ...prev, position: value } : prev))
        }
        onSalaryChange={(value) =>
          setAddStaffModal((prev) => (prev ? { ...prev, salary: value } : prev))
        }
        saving={staffSaving}
        onClose={() => setAddStaffModal(null)}
        onSubmit={() => void handleAddStaff()}
      />

      <PayStaffSalaryModal
        open={Boolean(payStaffSalaryModal)}
        fullName={payStaffSalaryModal?.fullName ?? ''}
        salary={Number(payStaffSalaryModal?.salary ?? 0)}
        currency={store?.currency}
        bankTransfer={payStaffSalaryModal?.bankTransfer ?? ''}
        cashbox1={payStaffSalaryModal?.cashbox1 ?? ''}
        cashbox2={payStaffSalaryModal?.cashbox2 ?? ''}
        onBankTransferChange={(value) =>
          setPayStaffSalaryModal((prev) => (prev ? { ...prev, bankTransfer: value } : prev))
        }
        onCashbox1Change={(value) =>
          setPayStaffSalaryModal((prev) => (prev ? { ...prev, cashbox1: value } : prev))
        }
        onCashbox2Change={(value) =>
          setPayStaffSalaryModal((prev) => (prev ? { ...prev, cashbox2: value } : prev))
        }
        saving={payStaffSaving}
        onClose={() => setPayStaffSalaryModal(null)}
        onSubmit={() => void handlePayStaffSalary()}
      />

      <ExpenseCreatePaidModal
        open={Boolean(createHouseholdModal)}
        title="Новый хозяйственный расход"
        nameValue={createHouseholdModal?.name ?? ''}
        onNameChange={(value) =>
          setCreateHouseholdModal((prev) => (prev ? { ...prev, name: value } : prev))
        }
        bankTransferPaid={createHouseholdModal?.bankTransferPaid ?? ''}
        onBankTransferPaidChange={(value) =>
          setCreateHouseholdModal((prev) => (prev ? { ...prev, bankTransferPaid: value } : prev))
        }
        cashbox1Paid={createHouseholdModal?.cashbox1Paid ?? ''}
        onCashbox1PaidChange={(value) =>
          setCreateHouseholdModal((prev) => (prev ? { ...prev, cashbox1Paid: value } : prev))
        }
        cashbox2Paid={createHouseholdModal?.cashbox2Paid ?? ''}
        onCashbox2PaidChange={(value) =>
          setCreateHouseholdModal((prev) => (prev ? { ...prev, cashbox2Paid: value } : prev))
        }
        saving={householdSaving}
        onClose={() => setCreateHouseholdModal(null)}
        onSubmit={() => void handleCreateHouseholdExpense()}
      />

      <ExpenseEditModal
        open={Boolean(editHouseholdModal)}
        title="Изменить хозяйственный расход"
        nameValue={editHouseholdModal?.name ?? ''}
        onNameChange={(value) =>
          setEditHouseholdModal((prev) => (prev ? { ...prev, name: value } : prev))
        }
        status={editHouseholdModal?.status ?? 'UNPAID'}
        onStatusChange={(status) =>
          setEditHouseholdModal((prev) => (prev ? { ...prev, status } : prev))
        }
        bankTransferPaid={editHouseholdModal?.bankTransferPaid ?? ''}
        onBankTransferPaidChange={(value) =>
          setEditHouseholdModal((prev) => (prev ? { ...prev, bankTransferPaid: value } : prev))
        }
        cashbox1Paid={editHouseholdModal?.cashbox1Paid ?? ''}
        onCashbox1PaidChange={(value) =>
          setEditHouseholdModal((prev) => (prev ? { ...prev, cashbox1Paid: value } : prev))
        }
        cashbox2Paid={editHouseholdModal?.cashbox2Paid ?? ''}
        onCashbox2PaidChange={(value) =>
          setEditHouseholdModal((prev) => (prev ? { ...prev, cashbox2Paid: value } : prev))
        }
        saving={householdSaving}
        onClose={() => setEditHouseholdModal(null)}
        onSubmit={() => void handleSaveEditedHouseholdExpense()}
        onDelete={handleDeleteHouseholdExpenseFromEditModal}
        showDelete={hasPermission(permissions, 'DELETE_CHARGES')}
      />

      <ExpenseCreatePaidModal
        open={Boolean(createOtherExpenseModal)}
        title="Новый прочий расход"
        nameValue={createOtherExpenseModal?.note ?? ''}
        onNameChange={(value) =>
          setCreateOtherExpenseModal((prev) => (prev ? { ...prev, note: value } : prev))
        }
        bankTransferPaid={createOtherExpenseModal?.bankTransferPaid ?? ''}
        onBankTransferPaidChange={(value) =>
          setCreateOtherExpenseModal((prev) => (prev ? { ...prev, bankTransferPaid: value } : prev))
        }
        cashbox1Paid={createOtherExpenseModal?.cashbox1Paid ?? ''}
        onCashbox1PaidChange={(value) =>
          setCreateOtherExpenseModal((prev) => (prev ? { ...prev, cashbox1Paid: value } : prev))
        }
        cashbox2Paid={createOtherExpenseModal?.cashbox2Paid ?? ''}
        onCashbox2PaidChange={(value) =>
          setCreateOtherExpenseModal((prev) => (prev ? { ...prev, cashbox2Paid: value } : prev))
        }
        saving={otherExpenseSaving}
        onClose={() => setCreateOtherExpenseModal(null)}
        onSubmit={() => void handleCreateOtherExpense()}
      />

      <ExpenseEditModal
        open={Boolean(editOtherExpenseModal)}
        title="Изменить прочий расход"
        nameValue={editOtherExpenseModal?.note ?? ''}
        onNameChange={(value) =>
          setEditOtherExpenseModal((prev) => (prev ? { ...prev, note: value } : prev))
        }
        status={(editOtherExpenseModal?.status as 'UNPAID' | 'PAID') ?? 'UNPAID'}
        onStatusChange={(status) =>
          setEditOtherExpenseModal((prev) => (prev ? { ...prev, status } : prev))
        }
        bankTransferPaid={editOtherExpenseModal?.bankTransferPaid ?? ''}
        onBankTransferPaidChange={(value) =>
          setEditOtherExpenseModal((prev) => (prev ? { ...prev, bankTransferPaid: value } : prev))
        }
        cashbox1Paid={editOtherExpenseModal?.cashbox1Paid ?? ''}
        onCashbox1PaidChange={(value) =>
          setEditOtherExpenseModal((prev) => (prev ? { ...prev, cashbox1Paid: value } : prev))
        }
        cashbox2Paid={editOtherExpenseModal?.cashbox2Paid ?? ''}
        onCashbox2PaidChange={(value) =>
          setEditOtherExpenseModal((prev) => (prev ? { ...prev, cashbox2Paid: value } : prev))
        }
        saving={otherExpenseSaving}
        onClose={() => setEditOtherExpenseModal(null)}
        onSubmit={() => void handleSaveEditedOtherExpense()}
        onDelete={handleDeleteOtherExpenseFromEditModal}
        showDelete={hasPermission(permissions, 'DELETE_CHARGES')}
      />

      <ExpenseCreatePaidModal
        open={Boolean(createAdminExpenseModal)}
        title={`${createAdminExpenseModal?.label ?? ''}: новый расход`}
        nameValue={createAdminExpenseModal?.label ?? ''}
        onNameChange={() => {}}
        bankTransferPaid={createAdminExpenseModal?.bankTransferPaid ?? ''}
        onBankTransferPaidChange={(value) =>
          setCreateAdminExpenseModal((prev) => (prev ? { ...prev, bankTransferPaid: value } : prev))
        }
        cashbox1Paid={createAdminExpenseModal?.cashbox1Paid ?? ''}
        onCashbox1PaidChange={(value) =>
          setCreateAdminExpenseModal((prev) => (prev ? { ...prev, cashbox1Paid: value } : prev))
        }
        cashbox2Paid={createAdminExpenseModal?.cashbox2Paid ?? ''}
        onCashbox2PaidChange={(value) =>
          setCreateAdminExpenseModal((prev) => (prev ? { ...prev, cashbox2Paid: value } : prev))
        }
        saving={adminExpenseSaving}
        onClose={() => setCreateAdminExpenseModal(null)}
        onSubmit={() => void handleCreateAdminExpense()}
      />

      <ExpenseEditModal
        open={Boolean(editAdminExpenseModal)}
        title={`${editAdminExpenseModal?.label ?? ''}: изменить расход`}
        nameValue={editAdminExpenseModal?.note ?? ''}
        onNameChange={(value) =>
          setEditAdminExpenseModal((prev) => (prev ? { ...prev, note: value } : prev))
        }
        status={(editAdminExpenseModal?.status as 'UNPAID' | 'PAID') ?? 'UNPAID'}
        onStatusChange={(status) =>
          setEditAdminExpenseModal((prev) => (prev ? { ...prev, status } : prev))
        }
        bankTransferPaid={editAdminExpenseModal?.bankTransferPaid ?? ''}
        onBankTransferPaidChange={(value) =>
          setEditAdminExpenseModal((prev) => (prev ? { ...prev, bankTransferPaid: value } : prev))
        }
        cashbox1Paid={editAdminExpenseModal?.cashbox1Paid ?? ''}
        onCashbox1PaidChange={(value) =>
          setEditAdminExpenseModal((prev) => (prev ? { ...prev, cashbox1Paid: value } : prev))
        }
        cashbox2Paid={editAdminExpenseModal?.cashbox2Paid ?? ''}
        onCashbox2PaidChange={(value) =>
          setEditAdminExpenseModal((prev) => (prev ? { ...prev, cashbox2Paid: value } : prev))
        }
        saving={adminExpenseSaving}
        onClose={() => setEditAdminExpenseModal(null)}
        onSubmit={() => void handleSaveEditedAdminExpense()}
        onDelete={() => {
          if (!editAdminExpenseModal) return;
          void (async () => {
            await handleDeleteManualExpense(editAdminExpenseModal.id);
            setEditAdminExpenseModal(null);
          })();
        }}
        showDelete={hasPermission(permissions, 'DELETE_CHARGES')}
      />

      {showCreatePavilionModal && (
        <CreatePavilionModal
          storeId={storeId}
          existingCategories={allCategories}
          onClose={() => setShowCreatePavilionModal(false)}
          onSaved={handlePavilionCreated}
        />
      )}

      <EditStaffSalaryModal
        open={Boolean(editStaffSalaryModal)}
        fullName={editStaffSalaryModal?.fullName ?? ''}
        salary={editStaffSalaryModal?.salary ?? ''}
        salaryStatus={editStaffSalaryModal?.salaryStatus ?? 'UNPAID'}
        salaryBankTransferPaid={editStaffSalaryModal?.salaryBankTransferPaid ?? 0}
        salaryCashbox1Paid={editStaffSalaryModal?.salaryCashbox1Paid ?? 0}
        salaryCashbox2Paid={editStaffSalaryModal?.salaryCashbox2Paid ?? 0}
        onSalaryChange={(value) =>
          setEditStaffSalaryModal((prev) => (prev ? { ...prev, salary: value } : prev))
        }
        onSalaryStatusChange={(nextStatus) =>
          setEditStaffSalaryModal((prev) => {
            if (!prev) return prev;
            if (nextStatus === 'UNPAID') return { ...prev, salaryStatus: 'UNPAID' };

            const nextSalary = Number(prev.salary || 0);
            const oldTotal =
              Number(prev.salaryBankTransferPaid ?? 0) +
              Number(prev.salaryCashbox1Paid ?? 0) +
              Number(prev.salaryCashbox2Paid ?? 0);

            if (oldTotal > 0) {
              return { ...prev, salaryStatus: 'PAID' };
            }

            return {
              ...prev,
              salaryStatus: 'PAID',
              salaryBankTransferPaid: nextSalary,
              salaryCashbox1Paid: 0,
              salaryCashbox2Paid: 0,
            };
          })
        }
        onSalaryBankTransferPaidChange={(value) =>
          setEditStaffSalaryModal((prev) =>
            prev ? { ...prev, salaryBankTransferPaid: value } : prev,
          )
        }
        onSalaryCashbox1PaidChange={(value) =>
          setEditStaffSalaryModal((prev) => (prev ? { ...prev, salaryCashbox1Paid: value } : prev))
        }
        onSalaryCashbox2PaidChange={(value) =>
          setEditStaffSalaryModal((prev) => (prev ? { ...prev, salaryCashbox2Paid: value } : prev))
        }
        saving={staffSaving}
        onDelete={() => {
          if (!editStaffSalaryModal) return;
          void (async () => {
            await handleDeleteStaff(editStaffSalaryModal.id);
            setEditStaffSalaryModal(null);
          })();
        }}
        onClose={() => setEditStaffSalaryModal(null)}
        onSubmit={() => void handleSaveEditedStaffSalary()}
      />
      <StoreExtraIncomeModal
        storeId={storeId}
        currency={store.currency}
        timeZone={store.timeZone || 'UTC'}
        isOpen={showExtraIncomeModal}
        canCreate={hasPermission(permissions, 'CREATE_PAYMENTS')}
        canDelete={hasPermission(permissions, 'EDIT_PAYMENTS')}
        onClose={() => setShowExtraIncomeModal(false)}
        onChanged={() => fetchData(false)}
      />
    </div>
  );
}
