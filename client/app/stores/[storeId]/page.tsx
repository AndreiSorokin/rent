'use client';

import { useEffect, useState } from 'react';
import { useParams, usePathname, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { formatMoney, getCurrencySymbol } from '@/lib/currency';
import { hasPermission } from '@/lib/permissions';
import { LogoutButton } from '@/components/LogoutButton';
import {
  ArrowLeft,
  BanknoteArrowDown,
  CheckCheck,
  CirclePlus,
  HandCoins,
  LockKeyhole,
  Menu,
  Sigma,
  SlidersHorizontal,
  Store,
  Toolbox,
  UsersRound,
  X,
  type LucideIcon,
} from 'lucide-react';
import { CreatePavilionModal } from '@/app/dashboard/components/CreatePavilionModal';
import { StoreExtraIncomeModal } from './components/StoreExtraIncomeModal';
import {
  createHouseholdExpense,
  deleteHouseholdExpense,
  getHouseholdExpenses,
  updateHouseholdExpense,
} from '@/lib/householdExpenses';
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
  const initialPavilionsPage = Number(searchParams.get('page') ?? 1);
  const safeInitialPavilionsPage =
    Number.isFinite(initialPavilionsPage) && initialPavilionsPage > 0
      ? initialPavilionsPage
      : 1;

  const [store, setStore] = useState<any>(null);
  const [analytics, setAnalytics] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreatePavilionModal, setShowCreatePavilionModal] = useState(false);
  const [showExtraIncomeModal, setShowExtraIncomeModal] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
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
    amount: string;
  } | null>(null);
  const [editHouseholdModal, setEditHouseholdModal] = useState<{
    id: number;
    name: string;
    amount: string;
    status: 'UNPAID' | 'PAID';
    bankTransferPaid: number;
    cashbox1Paid: number;
    cashbox2Paid: number;
  } | null>(null);
  const [householdSaving, setHouseholdSaving] = useState(false);
  const [createOtherExpenseModal, setCreateOtherExpenseModal] = useState<{
    note: string;
    amount: string;
  } | null>(null);
  const [editOtherExpenseModal, setEditOtherExpenseModal] = useState<{
    id: number;
    note: string;
    amount: string;
    status: 'UNPAID' | 'PAID';
    bankTransferPaid: number;
    cashbox1Paid: number;
    cashbox2Paid: number;
  } | null>(null);
  const [otherExpenseSaving, setOtherExpenseSaving] = useState(false);
  const [createAdminExpenseModal, setCreateAdminExpenseModal] = useState<{
    type: CardExpenseType;
    label: string;
    amount: string;
  } | null>(null);
  const [editAdminExpenseModal, setEditAdminExpenseModal] = useState<{
    id: number;
    type: CardExpenseType;
    label: string;
    note: string;
    amount: string;
    status: 'UNPAID' | 'PAID';
    bankTransferPaid: number;
    cashbox1Paid: number;
    cashbox2Paid: number;
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
  const [pavilions, setPavilions] = useState<any[]>([]);
  const [pavilionsTotal, setPavilionsTotal] = useState(0);
  const [pavilionsPage, setPavilionsPage] = useState(safeInitialPavilionsPage);
  const [pavilionsPageSize] = useState(20);
  const [pavilionsHasMore, setPavilionsHasMore] = useState(false);
  const [pavilionsLoading, setPavilionsLoading] = useState(false);
  const [orderedPavilionIds, setOrderedPavilionIds] = useState<number[]>([]);
  const [draggedPavilionId, setDraggedPavilionId] = useState<number | null>(null);
  const [orderedStaffIds, setOrderedStaffIds] = useState<number[]>([]);
  const [draggedStaffId, setDraggedStaffId] = useState<number | null>(null);
  const [activeSection, setActiveSection] = useState('pavilions');

  useEffect(() => {
    if (!storeId) return;
    const hasUrlFilters =
      Boolean(searchParams.get('q')) ||
      Boolean(searchParams.get('category')) ||
      Boolean(searchParams.get('status')) ||
      Boolean(searchParams.get('groupId')) ||
      Boolean(searchParams.get('paymentStatus')) ||
      Boolean(searchParams.get('page'));
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
        page?: number;
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
      setPavilionsPage(
        Number.isFinite(Number(parsed.page)) && Number(parsed.page) > 0
          ? Number(parsed.page)
          : 1,
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

  const fetchPavilions = async (page = 1) => {
    if (!storeId) return;

    setPavilionsLoading(true);
    try {
      const query = new URLSearchParams();
      query.set('paginated', 'true');
      query.set('page', String(page));
      query.set('pageSize', String(pavilionsPageSize));
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
        hasMore: boolean;
      }>(`/stores/${storeId}/pavilions?${query.toString()}`);

      setPavilions(response.items || []);
      setPavilionsTotal(Number(response.total ?? 0));
      setPavilionsPage(Number(response.page ?? page));
      setPavilionsHasMore(Boolean(response.hasMore));
    } catch (err) {
      console.error(err);
      setPavilions([]);
      setPavilionsTotal(0);
      setPavilionsHasMore(false);
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
        await fetchPavilions(pavilionsPage);
      } else {
        setPavilions([]);
        setPavilionsTotal(0);
        setPavilionsHasMore(false);
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
    const key = `store-page-pavilions-order-${storeId}`;
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
          setOrderedPavilionIds([...restored, ...missing]);
          return;
        }
      }
    } catch (err) {
      console.warn('Failed to restore pavilion order on store page', err);
    }
    setOrderedPavilionIds(ids);
  }, [storeId, pavilions]);

  useEffect(() => {
    if (!store) return;
    if (!hasPermission(store.permissions || [], 'VIEW_PAVILIONS')) return;
    void fetchPavilions(pavilionsPage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    pavilionSearch,
    pavilionCategoryFilter,
    pavilionStatusFilter,
    pavilionGroupFilter,
    pavilionPaymentStatusFilter,
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
    if (pavilionsPage > 1) query.set('page', String(pavilionsPage));

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
    pavilionsPage,
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
          page: pavilionsPage,
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
    pavilionsPage,
  ]);

  useEffect(() => {
    if (!storeId || orderedPavilionIds.length === 0) return;
    try {
      localStorage.setItem(
        `store-page-pavilions-order-${storeId}`,
        JSON.stringify(orderedPavilionIds),
      );
    } catch (err) {
      console.warn('Failed to persist pavilion order on store page', err);
    }
  }, [storeId, orderedPavilionIds]);

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

  useEffect(() => {
    const sections = Array.from(
      document.querySelectorAll<HTMLElement>('[data-store-section]'),
    );
    if (sections.length === 0) return;

    const updateActiveSection = () => {
      const scrollY = window.scrollY + 140;
      let current = sections[0]?.id ?? 'pavilions';

      for (const section of sections) {
        if (section.offsetTop <= scrollY) {
          current = section.id;
        } else {
          break;
        }
      }

      setActiveSection(current);
    };

    updateActiveSection();
    window.addEventListener('scroll', updateActiveSection, { passive: true });
    window.addEventListener('resize', updateActiveSection);
    window.addEventListener('hashchange', updateActiveSection);

    return () => {
      window.removeEventListener('scroll', updateActiveSection);
      window.removeEventListener('resize', updateActiveSection);
      window.removeEventListener('hashchange', updateActiveSection);
    };
  }, [storeId, loading]);

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
      await apiFetch<any>(`/stores/${storeId}/staff`, {
        method: 'POST',
        body: JSON.stringify({
          fullName: addStaffModal.fullName.trim(),
          position: addStaffModal.position.trim(),
          salary,
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

  const handleDeleteHouseholdExpense = async (expenseId: number) => {
    if (!confirm('Удалить этот расход?')) return;

    try {
      await deleteHouseholdExpense(storeId, expenseId);
      await fetchData(false);
    } catch (err) {
      console.error(err);
      alert('Не удалось удалить расход');
    }
  };

  const handleCreateHouseholdExpense = async () => {
    if (!createHouseholdModal) return;
    const name = createHouseholdModal.name.trim();
    const amount = Number(createHouseholdModal.amount);
    if (!name) {
      alert('Введите название');
      return;
    }
    if (Number.isNaN(amount) || amount < 0) {
      alert('Сумма должна быть неотрицательной');
      return;
    }

    try {
      setHouseholdSaving(true);
      await createHouseholdExpense(storeId, { name, amount });
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
    const amount = Number(editHouseholdModal.amount);
    if (!name) {
      alert('Введите название');
      return;
    }
    if (Number.isNaN(amount) || amount < 0) {
      alert('Сумма должна быть неотрицательной');
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
      amount,
      status: editHouseholdModal.status,
    };

    if (editHouseholdModal.status === 'PAID') {
      const bank = Number(editHouseholdModal.bankTransferPaid ?? 0);
      const cash1 = Number(editHouseholdModal.cashbox1Paid ?? 0);
      const cash2 = Number(editHouseholdModal.cashbox2Paid ?? 0);
      const total = bank + cash1 + cash2;

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
      if (Math.abs(total - amount) > 0.01) {
        alert('Сумма каналов оплаты должна быть равна сумме расхода');
        return;
      }

      payload.bankTransferPaid = bank;
      payload.cashbox1Paid = cash1;
      payload.cashbox2Paid = cash2;
    }

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
    const amount = Number(createAdminExpenseModal.amount);

    if (Number.isNaN(amount) || amount < 0) {
      alert('Сумма должна быть неотрицательной');
      return;
    }

    try {
      setAdminExpenseSaving(true);
      await createPavilionExpense(storeId, {
        type: createAdminExpenseModal.type,
        note,
        amount,
        status: 'UNPAID',
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
    const amount = Number(editAdminExpenseModal.amount);

    if (!note) {
      alert('Введите название');
      return;
    }
    if (Number.isNaN(amount) || amount < 0) {
      alert('Сумма должна быть неотрицательной');
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
      amount,
      status: editAdminExpenseModal.status,
    };

    if (editAdminExpenseModal.status === 'PAID') {
      const bank = Number(editAdminExpenseModal.bankTransferPaid ?? 0);
      const cash1 = Number(editAdminExpenseModal.cashbox1Paid ?? 0);
      const cash2 = Number(editAdminExpenseModal.cashbox2Paid ?? 0);
      const total = bank + cash1 + cash2;

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
      if (Math.abs(total - amount) > 0.01) {
        alert('Сумма каналов оплаты должна быть равна сумме расхода');
        return;
      }

      payload.bankTransferPaid = bank;
      payload.cashbox1Paid = cash1;
      payload.cashbox2Paid = cash2;
    }

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
    const amount = Number(createOtherExpenseModal.amount);

    if (!note) {
      alert('Введите название');
      return;
    }
    if (Number.isNaN(amount) || amount < 0) {
      alert('Сумма должна быть неотрицательной');
      return;
    }

    try {
      setOtherExpenseSaving(true);
      await createPavilionExpense(storeId, {
        type: 'OTHER',
        note,
        amount,
        status: 'UNPAID',
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
    const amount = Number(editOtherExpenseModal.amount);

    if (!note) {
      alert('Введите название');
      return;
    }
    if (Number.isNaN(amount) || amount < 0) {
      alert('Сумма должна быть неотрицательной');
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
      amount,
      status: editOtherExpenseModal.status,
    };

    if (editOtherExpenseModal.status === 'PAID') {
      const bank = Number(editOtherExpenseModal.bankTransferPaid ?? 0);
      const cash1 = Number(editOtherExpenseModal.cashbox1Paid ?? 0);
      const cash2 = Number(editOtherExpenseModal.cashbox2Paid ?? 0);
      const total = bank + cash1 + cash2;

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
      if (Math.abs(total - amount) > 0.01) {
        alert('Сумма каналов оплаты должна быть равна сумме расхода');
        return;
      }

      payload.bankTransferPaid = bank;
      payload.cashbox1Paid = cash1;
      payload.cashbox2Paid = cash2;
    }

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
  const canReorderPavilions = true;
  const groupedManualExpenses = MANUAL_EXPENSE_CATEGORIES.reduce(
    (acc, category) => {
      acc[category.type] = storeExpenses.filter((item: any) => item.type === category.type);
      return acc;
    },
    {} as Record<CardExpenseType, any[]>,
  );
  const otherExpenses = storeExpenses.filter((item: any) => item.type === 'OTHER');
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
  const movePavilion = (dragId: number, targetId: number) => {
    if (dragId === targetId) return;
    setOrderedPavilionIds((prev) => {
      const source = prev.length > 0 ? [...prev] : (pavilions || []).map((p: any) => p.id);
      const fromIndex = source.indexOf(dragId);
      const toIndex = source.indexOf(targetId);
      if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) return source;

      const [moved] = source.splice(fromIndex, 1);
      source.splice(toIndex, 0, moved);
      return source;
    });
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

  const canManageStore =
    hasPermission(permissions, 'ASSIGN_PERMISSIONS') ||
    hasPermission(permissions, 'EDIT_PAVILIONS') ||
    hasPermission(permissions, 'INVITE_USERS');
  const canOpenUtilities =
    hasPermission(permissions, 'VIEW_PAYMENTS') && hasPermission(permissions, 'EDIT_PAYMENTS');
  const canCreatePavilion = hasPermission(permissions, 'CREATE_PAVILIONS');
  const canViewAccounting = hasPermission(permissions, 'VIEW_PAYMENTS');
  const buildStoreReturnTo = () => {
    const query = new URLSearchParams();
    if (pavilionSearch.trim()) query.set('q', pavilionSearch.trim());
    if (pavilionCategoryFilter) query.set('category', pavilionCategoryFilter);
    if (pavilionStatusFilter) query.set('status', pavilionStatusFilter);
    if (pavilionGroupFilter) query.set('groupId', pavilionGroupFilter);
    if (pavilionPaymentStatusFilter) {
      query.set('paymentStatus', pavilionPaymentStatusFilter);
    }
    if (pavilionsPage > 1) query.set('page', String(pavilionsPage));
    const qs = query.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  };

  const navSections: Array<{
    id: string;
    label: string;
    visible: boolean;
    icon: LucideIcon;
  }> = [
    { id: 'pavilions', label: 'Павильоны', visible: hasPermission(permissions, 'VIEW_PAVILIONS'), icon: Store },
    { id: 'household', label: 'Хоз расходы', visible: hasPermission(permissions, 'VIEW_CHARGES'), icon: Toolbox },
    { id: 'other-expenses', label: 'Прочие расходы', visible: hasPermission(permissions, 'VIEW_CHARGES'), icon: BanknoteArrowDown },
    { id: 'admin-expenses', label: 'Административные расходы', visible: hasPermission(permissions, 'VIEW_CHARGES'), icon: LockKeyhole },
    { id: 'staff', label: 'Штатное расписание', visible: hasPermission(permissions, 'VIEW_STAFF'), icon: UsersRound },
  ];

  return (
    <div className="min-h-screen scroll-smooth bg-[#f9f5f0]">
      <div className="mx-auto flex max-w-[1600px] gap-6 px-3 py-1 md:px-6 md:py-6">
        <aside className="sticky top-4 hidden h-[calc(100vh-2rem)] w-[320px] shrink-0 overflow-y-auto rounded-2xl border border-[#D8D1CB] bg-[#F4EFEB] p-5 shadow-[0_8px_30px_rgba(0,0,0,0.04)] lg:block">
          <div className="mb-5">
            <p className="text-xs uppercase tracking-[0.12em] text-[#6B6B6B]">Объект</p>
            <h1 className="mt-1 text-xl font-bold text-slate-900">{store.name}</h1>
            <p className="mt-1 text-sm text-slate-600">
              Валюта: {store.currency} ({getCurrencySymbol(store.currency)})
            </p>
          </div>

          <div className="space-y-2 border-b border-slate-100 pb-4">
            <Link href="/dashboard" className="flex items-center justify-center gap-2 rounded-xl border border-[#D8D1CB] px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-[#F4EFEB]">
              <ArrowLeft className="h-4 w-4" />
              Назад к объектам
            </Link>
          </div>

          <div className="mt-3 space-y-2 border-b border-slate-100 pb-4">
            {hasPermission(permissions, 'VIEW_SUMMARY') && (
              <Link
                href={`/stores/${storeId}/summary`}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#FF6A13] px-3 py-2 text-sm font-semibold text-white transition hover:bg-[#E65C00]"
              >
                <Sigma className="h-4 w-4" />
                СВОДКА
              </Link>
            )}
            {canCreatePavilion && (
              <button
                onClick={() => setShowCreatePavilionModal(true)}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#2563EB] px-3 py-2 text-sm font-semibold text-white transition hover:bg-[#1D4ED8]"
              >
                <CirclePlus className="h-4 w-4" />
                Добавить павильон
              </button>
            )}
            {canViewAccounting && (
              <Link
                href={`/stores/${storeId}/accounting`}
                className="flex items-center justify-center gap-2 rounded-xl bg-[#0F172A] px-3 py-2 text-sm font-semibold text-white transition hover:bg-[#020617]"
              >
                <CheckCheck className="h-4 w-4" />
                Открытие/закрытие смены
              </Link>
            )}
            {(canOpenUtilities || canViewAccounting) && (
              <div className="grid grid-cols-2 gap-2 pt-5">
                {canOpenUtilities && (
                  <Link
                    href={`/stores/${storeId}/utilities`}
                    className={`flex items-center justify-center gap-1.5 rounded-lg border border-[#D8D1CB] bg-white px-2 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-[#f9f5f0] ${
                      canViewAccounting ? '' : 'col-span-2'
                    }`}
                  >
                    <HandCoins className="h-3.5 w-3.5" />
                    Начисления
                  </Link>
                )}
                {canViewAccounting && (
                  <button
                    onClick={() => setShowExtraIncomeModal(true)}
                    className={`flex w-full items-center justify-center gap-1.5 rounded-lg border border-[#D8D1CB] bg-white px-2 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-[#f9f5f0] ${
                      canOpenUtilities ? '' : 'col-span-2'
                    }`}
                  >
                    <BanknoteArrowDown className="h-3.5 w-3.5" />
                    Доп приход
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="pt-4">
            <p className="mb-2 text-xs uppercase tracking-[0.12em] text-[#6B6B6B]">Навигация</p>
            <nav className="space-y-1">
              {navSections.filter((item) => item.visible).map((item) => (
                <a
                  key={item.id}
                  href={`#${item.id}`}
                  onClick={() => setActiveSection(item.id)}
                  className={`flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition ${
                    activeSection === item.id
                      ? 'bg-[#FFE8DB] text-[#C2410C]'
                      : 'text-slate-600 hover:bg-[#F4EFEB] hover:text-slate-900'
                  }`}
                >
                  <item.icon className="h-4 w-4 shrink-0" />
                  <span className="font-medium">{item.label}</span>
                </a>
              ))}
            </nav>
            {canManageStore && (
              <div className="mt-3 border-t border-slate-100 pt-3">
                <Link
                  href={`/stores/${storeId}/settings`}
                  className="flex items-center justify-center gap-2 rounded-xl border border-[#D8D1CB] px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-[#F4EFEB]"
                >
                  <SlidersHorizontal className="h-4 w-4" />
                  Управление объектом
                </Link>
              </div>
            )}
          </div>
        </aside>

        <main className="min-w-0 flex-1 space-y-3 pt-12 md:space-y-6 md:pt-0">
          <div className="fixed right-3 top-3 z-30 lg:hidden">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
                  className="inline-flex items-center gap-2 rounded-lg border border-[#D8D1CB] bg-[#F4EFEB] px-3 py-2 text-sm text-slate-700 shadow-sm"
            >
              <Menu className="h-4 w-4" />
              Меню
            </button>
          </div>

          <div
            className={`fixed inset-0 z-40 lg:hidden transition-opacity duration-300 ${
              mobileMenuOpen ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'
            }`}
          >
            <button
              type="button"
              aria-label="Закрыть меню"
              onClick={() => setMobileMenuOpen(false)}
              className="absolute inset-0 bg-black/35"
            />
            <aside
              className={`relative z-10 h-full w-[88%] max-w-[360px] overflow-y-auto bg-white p-5 shadow-xl transition-transform duration-300 ease-out ${
                mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
              }`}
            >
              <div className="mb-4 flex items-start justify-between gap-2">
                <div>
                  <p className="text-xs uppercase tracking-[0.12em] text-[#6B6B6B]">Объект</p>
                  <h2 className="text-lg font-bold text-slate-900">{store.name}</h2>
                  <p className="text-xs text-slate-600">
                    Валюта: {store.currency} ({getCurrencySymbol(store.currency)})
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setMobileMenuOpen(false)}
                    className="rounded-lg border border-[#D8D1CB] bg-white p-2 text-slate-700"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="space-y-2 border-b border-slate-100 pb-4">
                <Link
                  href="/dashboard"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center justify-center gap-2 rounded-xl border border-[#D8D1CB] px-3 py-2 text-sm font-medium text-slate-700"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Назад к объектам
                </Link>
              </div>

              <div className="mt-3 space-y-2 border-b border-slate-100 pb-4">
                {hasPermission(permissions, 'VIEW_SUMMARY') && (
                  <Link
                    href={`/stores/${storeId}/summary`}
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#FF6A13] px-3 py-2 text-sm font-semibold text-white"
                  >
                    <Sigma className="h-4 w-4" />
                    СВОДКА
                  </Link>
                )}
                {canCreatePavilion && (
                  <button
                    onClick={() => {
                      setShowCreatePavilionModal(true);
                      setMobileMenuOpen(false);
                    }}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#2563EB] px-3 py-2 text-sm font-semibold text-white"
                  >
                    <CirclePlus className="h-4 w-4" />
                    Добавить павильон
                  </button>
                )}
                {canViewAccounting && (
                  <Link
                    href={`/stores/${storeId}/accounting`}
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center justify-center gap-2 rounded-xl bg-[#0F172A] px-3 py-2 text-sm font-semibold text-white"
                  >
                    <CheckCheck className="h-4 w-4" />
                    Открытие/закрытие смены
                  </Link>
                )}
                {(canOpenUtilities || canViewAccounting) && (
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    {canOpenUtilities && (
                      <Link
                        href={`/stores/${storeId}/utilities`}
                        onClick={() => setMobileMenuOpen(false)}
                        className={`flex items-center justify-center gap-1.5 rounded-lg border border-[#D8D1CB] bg-white px-2 py-1.5 text-xs font-medium text-slate-700 ${
                          canViewAccounting ? '' : 'col-span-2'
                        }`}
                      >
                        <HandCoins className="h-3.5 w-3.5" />
                        Начисления
                      </Link>
                    )}
                    {canViewAccounting && (
                      <button
                        onClick={() => {
                          setShowExtraIncomeModal(true);
                          setMobileMenuOpen(false);
                        }}
                        className={`flex items-center justify-center gap-1.5 rounded-lg border border-[#D8D1CB] bg-white px-2 py-1.5 text-xs font-medium text-slate-700 ${
                          canOpenUtilities ? '' : 'col-span-2'
                        }`}
                      >
                        <BanknoteArrowDown className="h-3.5 w-3.5" />
                        Доп приход
                      </button>
                    )}
                  </div>
                )}
              </div>

              <div className="pt-4">
                <p className="mb-2 text-xs uppercase tracking-[0.12em] text-[#6B6B6B]">Навигация</p>
                <nav className="space-y-1">
                  {navSections.filter((item) => item.visible).map((item) => (
                    <a
                      key={`mobile-${item.id}`}
                      href={`#${item.id}`}
                      onClick={() => {
                        setActiveSection(item.id);
                        setMobileMenuOpen(false);
                      }}
                      className={`flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition ${
                        activeSection === item.id
                          ? 'bg-[#FFE8DB] text-[#C2410C]'
                          : 'text-slate-600 hover:bg-[#F4EFEB] hover:text-slate-900'
                      }`}
                    >
                      <item.icon className="h-4 w-4 shrink-0" />
                      <span className="font-medium">{item.label}</span>
                    </a>
                  ))}
                </nav>
                {canManageStore && (
                  <div className="mt-3 border-t border-slate-100 pt-3">
                    <Link
                      href={`/stores/${storeId}/settings`}
                      onClick={() => setMobileMenuOpen(false)}
                      className="flex items-center justify-center gap-2 rounded-xl border border-[#D8D1CB] px-3 py-2 text-sm font-medium text-slate-700"
                    >
                      <SlidersHorizontal className="h-4 w-4" />
                      Управление объектом
                    </Link>
                  </div>
                )}
              </div>
              <div className="mt-4 border-t border-slate-100 pt-4">
                <LogoutButton
                  onLoggedOut={() => setMobileMenuOpen(false)}
                  className="w-full rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700"
                />
              </div>
            </aside>
          </div>

        {hasPermission(permissions, 'VIEW_PAVILIONS') && (
          <section
            id="pavilions"
            data-store-section
            className="scroll-mt-24 rounded-2xl border border-[#D8D1CB] bg-white p-6 shadow-sm md:p-8"
          >
            <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <h2 className="text-xl font-semibold md:text-2xl">Павильоны</h2>
            </div>

            <div className="mb-4 space-y-3">
              <input
                type="text"
                value={pavilionSearch}
                onChange={(e) => {
                  setPavilionSearch(e.target.value);
                  setPavilionsPage(1);
                }}
                className="w-full rounded-lg border border-[#D8D1CB] px-3 py-2"
                placeholder="Поиск по имени павильона"
              />
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <select
                value={pavilionCategoryFilter}
                onChange={(e) => {
                  setPavilionCategoryFilter(e.target.value);
                  setPavilionsPage(1);
                }}
                className="rounded-lg border border-[#D8D1CB] px-3 py-2"
              >
                <option value="">Все категории</option>
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
                  setPavilionsPage(1);
                }}
                className="rounded-lg border border-[#D8D1CB] px-3 py-2"
              >
                <option value="">Все статусы</option>
                <option value="AVAILABLE">СВОБОДЕН</option>
                <option value="RENTED">ЗАНЯТ</option>
                <option value="PREPAID">ПРЕДОПЛАТА</option>
              </select>
              <select
                value={pavilionGroupFilter}
                onChange={(e) => {
                  setPavilionGroupFilter(e.target.value);
                  setPavilionsPage(1);
                }}
                className="rounded-lg border border-[#D8D1CB] px-3 py-2"
              >
                <option value="">Все группы</option>
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
                    setPavilionsPage(1);
                  }
                }
                className="rounded-lg border border-[#D8D1CB] px-3 py-2"
              >
                <option value="">все</option>
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
                <table className="min-w-full divide-y divide-[#E5DED8]">
                  <thead className="bg-[#F4EFEB]">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase text-[#6B6B6B]">
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
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase text-[#6B6B6B]">
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
                          movePavilion(draggedPavilionId, p.id);
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

            <div className="mt-4 flex items-center justify-between text-sm text-[#6B6B6B]">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    void runKeepingScroll(async () => {
                      await fetchPavilions(Math.max(1, pavilionsPage - 1));
                    })
                  }
                  disabled={pavilionsLoading || pavilionsPage <= 1}
                  className="rounded-lg border border-[#D8D1CB] bg-white px-3 py-1.5 transition hover:bg-[#f9f5f0] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Назад
                </button>
                <span>
                  Стр. {pavilionsPage}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    void runKeepingScroll(async () => {
                      await fetchPavilions(pavilionsPage + 1);
                    })
                  }
                  disabled={pavilionsLoading || !pavilionsHasMore}
                  className="rounded-lg border border-[#D8D1CB] bg-white px-3 py-1.5 transition hover:bg-[#f9f5f0] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Далее
                </button>
              </div>
            </div>
          </section>
        )}

        {hasPermission(permissions, 'VIEW_CHARGES') && (
          <section
            id="household"
            data-store-section
            className="scroll-mt-24 rounded-2xl border border-[#D8D1CB] bg-white p-6 shadow-sm md:p-8"
          >
            <h2 className="text-xl font-semibold text-slate-900 md:text-2xl">Хозяйственные расходы</h2>
            {hasPermission(permissions, 'CREATE_CHARGES') && (
              <div className="mb-5 mt-4">
                <button
                  onClick={() => setCreateHouseholdModal({ name: '', amount: '' })}
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
                              const amount = Number(expense.amount ?? 0);
                              const bank = Number(expense.bankTransferPaid ?? 0);
                              const cash1 = Number(expense.cashbox1Paid ?? 0);
                              const cash2 = Number(expense.cashbox2Paid ?? 0);
                              const hasChannels = bank + cash1 + cash2 > 0;

                              setEditHouseholdModal({
                                id: Number(expense.id),
                                name: String(expense.name ?? ''),
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
                        {hasPermission(permissions, 'DELETE_CHARGES') && (
                          <button
                            onClick={() => handleDeleteHouseholdExpense(expense.id)}
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
        )}

        {hasPermission(permissions, 'VIEW_CHARGES') && (
          <section
            id="other-expenses"
            data-store-section
            className="scroll-mt-24 rounded-2xl border border-[#D8D1CB] bg-white p-6 shadow-sm md:p-8"
          >
            <h2 className="mb-3 text-xl font-semibold text-slate-900 md:text-2xl">Прочие расходы</h2>

            {hasPermission(permissions, 'CREATE_CHARGES') && (
              <div className="mb-5">
                <button
                  onClick={() => setCreateOtherExpenseModal({ note: '', amount: '' })}
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
                <div className="hidden items-center gap-3 rounded-lg border border-[#D8D1CB] bg-[#F4EFEB] px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-[#6B6B6B] md:grid md:grid-cols-[minmax(180px,1fr)_minmax(220px,2fr)_minmax(110px,1fr)_minmax(170px,auto)]">
                  <div className="text-center">Название и статус</div>
                  <div className="text-center">Каналы оплаты</div>
                  <div className="text-center">Сумма</div>
                  <div className="text-center">Действия</div>
                </div>
                {otherExpenses.map((expense: any) => (
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
                              const amount = Number(expense.amount ?? 0);
                              const bank = Number(expense.bankTransferPaid ?? 0);
                              const cash1 = Number(expense.cashbox1Paid ?? 0);
                              const cash2 = Number(expense.cashbox2Paid ?? 0);
                              const hasChannels = bank + cash1 + cash2 > 0;

                              setEditOtherExpenseModal({
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
                        {hasPermission(permissions, 'DELETE_CHARGES') && (
                          <button
                            onClick={() => handleDeleteManualExpense(expense.id)}
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
        )}

        {hasPermission(permissions, 'VIEW_CHARGES') && (
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
                              amount: '',
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
                                      const amount = Number(item.amount ?? 0);
                                      const bank = Number(item.bankTransferPaid ?? 0);
                                      const cash1 = Number(item.cashbox1Paid ?? 0);
                                      const cash2 = Number(item.cashbox2Paid ?? 0);
                                      const hasChannels = bank + cash1 + cash2 > 0;

                                      setEditAdminExpenseModal({
                                        id: Number(item.id),
                                        type: category.type,
                                        label: category.label,
                                        note: String(item.note ?? category.label),
                                        amount: String(amount),
                                        status: (item.status as 'UNPAID' | 'PAID') ?? 'UNPAID',
                                        bankTransferPaid:
                                          (item.status as 'UNPAID' | 'PAID') === 'PAID'
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
                                {hasPermission(permissions, 'DELETE_CHARGES') && (
                                  <button
                                    onClick={() => handleDeleteManualExpense(item.id)}
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
                    ) : (
                      <p className="text-xs text-[#6B6B6B]">Записей нет</p>
                    )}
                  </div>
                );
              })}

            </div>

          </section>
        )}

        {hasPermission(permissions, 'VIEW_STAFF') && (
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
                          {hasPermission(permissions, 'MANAGE_STAFF') ? (
                            <div className="flex items-center gap-2">
                              <select
                                value={staff.salaryStatus ?? 'UNPAID'}
                                onChange={(e) => {
                                  const nextStatus = e.target.value as 'UNPAID' | 'PAID';
                                  if (nextStatus === 'PAID') {
                                    const salary = Number(staff.salary ?? 0);
                                    const bank = Number(staff.salaryBankTransferPaid ?? 0);
                                    const cash1 = Number(staff.salaryCashbox1Paid ?? 0);
                                    const cash2 = Number(staff.salaryCashbox2Paid ?? 0);
                                    const hasChannels = bank + cash1 + cash2 > 0;

                                    setPayStaffSalaryModal({
                                      id: Number(staff.id),
                                      fullName: String(staff.fullName ?? 'Сотрудник'),
                                      salary,
                                      bankTransfer: hasChannels ? String(bank || '') : String(salary),
                                      cashbox1: hasChannels ? String(cash1 || '') : '',
                                      cashbox2: hasChannels ? String(cash2 || '') : '',
                                    });
                                    return;
                                  }

                                  void handleUpdateStaffSalaryStatus(staff.id, nextStatus);
                                }}
                                className="rounded-lg border border-[#D8D1CB] bg-white px-2 py-1 text-xs text-[#374151]"
                              >
                                <option value="UNPAID">Не оплачено</option>
                                <option value="PAID">Оплачено</option>
                              </select>
                              {(staff.salaryStatus ?? 'UNPAID') === 'PAID' && (
                                <div className="space-y-0.5 text-[11px] text-slate-600">
                                  <div>
                                    Безналичные:{' '}
                                    {formatMoney(
                                      Number(staff.salaryBankTransferPaid ?? 0),
                                      store.currency,
                                    )}
                                  </div>
                                  <div>
                                    Наличные касса 1:{' '}
                                    {formatMoney(
                                      Number(staff.salaryCashbox1Paid ?? 0),
                                      store.currency,
                                    )}
                                  </div>
                                  <div>
                                    Наличные касса 2:{' '}
                                    {formatMoney(
                                      Number(staff.salaryCashbox2Paid ?? 0),
                                      store.currency,
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                          ) : staff.salaryStatus === 'PAID' ? (
                            <div className="space-y-0.5 text-[11px] text-slate-600">
                              <div>
                                Безналичные:{' '}
                                {formatMoney(
                                  Number(staff.salaryBankTransferPaid ?? 0),
                                  store.currency,
                                )}
                              </div>
                              <div>
                                Наличные касса 1:{' '}
                                {formatMoney(
                                  Number(staff.salaryCashbox1Paid ?? 0),
                                  store.currency,
                                )}
                              </div>
                              <div>
                                Наличные касса 2:{' '}
                                {formatMoney(
                                  Number(staff.salaryCashbox2Paid ?? 0),
                                  store.currency,
                                )}
                              </div>
                            </div>
                          ) : (
                            'Не оплачено'
                          )}
                        </td>
                        <td className="px-4 py-3 text-right text-sm">
                          {hasPermission(permissions, 'MANAGE_STAFF') && (
                            <div className="flex justify-end gap-3">
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
                                className="text-[#2563EB] hover:underline"
                              >
                                Изменить зарплату
                              </button>
                              <button
                                onClick={() => handleDeleteStaff(staff.id)}
                                className="text-red-600 hover:underline"
                              >
                                Удалить
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

      {addStaffModal && (
        <div className="fixed inset-0 z-[95] flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-xl md:p-6">
            <h3 className="text-lg font-semibold text-slate-900">Добавить сотрудника</h3>

            <div className="mt-4 grid grid-cols-1 gap-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Должность</label>
                <input
                  type="text"
                  value={addStaffModal.position}
                  onChange={(e) =>
                    setAddStaffModal((prev) => (prev ? { ...prev, position: e.target.value } : prev))
                  }
                  className="w-full rounded-xl border border-[#D8D1CB] px-3 py-2.5"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Имя фамилия</label>
                <input
                  type="text"
                  value={addStaffModal.fullName}
                  onChange={(e) =>
                    setAddStaffModal((prev) => (prev ? { ...prev, fullName: e.target.value } : prev))
                  }
                  className="w-full rounded-xl border border-[#D8D1CB] px-3 py-2.5"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Зарплата</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={addStaffModal.salary}
                  onChange={(e) =>
                    setAddStaffModal((prev) => (prev ? { ...prev, salary: e.target.value } : prev))
                  }
                  className="w-full rounded-xl border border-[#D8D1CB] px-3 py-2.5"
                />
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setAddStaffModal(null)}
                disabled={staffSaving}
                className="rounded-xl border border-[#CFC6BF] px-4 py-2 text-sm font-medium text-slate-700 hover:bg-[#F4EFEB] disabled:opacity-60"
              >
                Отмена
              </button>
              <button
                type="button"
                onClick={handleAddStaff}
                disabled={staffSaving}
                className="rounded-xl bg-[#FF6A13] px-4 py-2 text-sm font-medium text-white hover:bg-[#E65C00] disabled:opacity-60"
              >
                {staffSaving ? 'Сохранение...' : 'Добавить'}
              </button>
            </div>
          </div>
        </div>
      )}

      {payStaffSalaryModal && (
        <div className="fixed inset-0 z-[95] flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-xl md:p-6">
            <h3 className="text-lg font-semibold text-slate-900">Оплата зарплаты</h3>
            <p className="mt-1 text-sm text-slate-600">
              {payStaffSalaryModal.fullName}. Сумма: {formatMoney(payStaffSalaryModal.salary, store?.currency)}
            </p>

            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Безналичные</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={payStaffSalaryModal.bankTransfer}
                  onChange={(e) =>
                    setPayStaffSalaryModal((prev) =>
                      prev ? { ...prev, bankTransfer: e.target.value } : prev,
                    )
                  }
                  className="w-full rounded-xl border border-[#D8D1CB] px-3 py-2.5"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Наличные касса 1</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={payStaffSalaryModal.cashbox1}
                  onChange={(e) =>
                    setPayStaffSalaryModal((prev) =>
                      prev ? { ...prev, cashbox1: e.target.value } : prev,
                    )
                  }
                  className="w-full rounded-xl border border-[#D8D1CB] px-3 py-2.5"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Наличные касса 2</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={payStaffSalaryModal.cashbox2}
                  onChange={(e) =>
                    setPayStaffSalaryModal((prev) =>
                      prev ? { ...prev, cashbox2: e.target.value } : prev,
                    )
                  }
                  className="w-full rounded-xl border border-[#D8D1CB] px-3 py-2.5"
                />
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPayStaffSalaryModal(null)}
                disabled={payStaffSaving}
                className="rounded-xl border border-[#CFC6BF] px-4 py-2 text-sm font-medium text-slate-700 hover:bg-[#F4EFEB] disabled:opacity-60"
              >
                Отмена
              </button>
              <button
                type="button"
                onClick={handlePayStaffSalary}
                disabled={payStaffSaving}
                className="rounded-xl bg-[#FF6A13] px-4 py-2 text-sm font-medium text-white hover:bg-[#E65C00] disabled:opacity-60"
              >
                {payStaffSaving ? 'Сохранение...' : 'Сохранить'}
              </button>
            </div>
          </div>
        </div>
      )}

      {createHouseholdModal && (
        <div className="fixed inset-0 z-[95] flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-xl md:p-6">
            <h3 className="text-lg font-semibold text-slate-900">Новый хозяйственный расход</h3>
            <p className="mt-1 text-sm text-slate-600">
              Расход создается со статусом «Не оплачено».
            </p>

            <div className="mt-4 grid grid-cols-1 gap-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Название</label>
                <input
                  type="text"
                  value={createHouseholdModal.name}
                  onChange={(e) =>
                    setCreateHouseholdModal((prev) =>
                      prev ? { ...prev, name: e.target.value } : prev,
                    )
                  }
                  className="w-full rounded-xl border border-[#D8D1CB] px-3 py-2.5"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Сумма</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={createHouseholdModal.amount}
                  onChange={(e) =>
                    setCreateHouseholdModal((prev) =>
                      prev ? { ...prev, amount: e.target.value } : prev,
                    )
                  }
                  className="w-full rounded-xl border border-[#D8D1CB] px-3 py-2.5"
                />
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setCreateHouseholdModal(null)}
                disabled={householdSaving}
                className="rounded-xl border border-[#CFC6BF] px-4 py-2 text-sm font-medium text-slate-700 hover:bg-[#F4EFEB] disabled:opacity-60"
              >
                Отмена
              </button>
              <button
                type="button"
                onClick={handleCreateHouseholdExpense}
                disabled={householdSaving}
                className="rounded-xl bg-[#FF6A13] px-4 py-2 text-sm font-medium text-white hover:bg-[#E65C00] disabled:opacity-60"
              >
                {householdSaving ? 'Сохранение...' : 'Сохранить'}
              </button>
            </div>
          </div>
        </div>
      )}

      {editHouseholdModal && (
        <div className="fixed inset-0 z-[95] flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-xl md:p-6">
            <h3 className="text-lg font-semibold text-slate-900">Изменить хозяйственный расход</h3>

            <div className="mt-4 grid grid-cols-1 gap-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Название</label>
                <input
                  type="text"
                  value={editHouseholdModal.name}
                  onChange={(e) =>
                    setEditHouseholdModal((prev) =>
                      prev ? { ...prev, name: e.target.value } : prev,
                    )
                  }
                  className="w-full rounded-xl border border-[#D8D1CB] px-3 py-2.5"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Сумма</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={editHouseholdModal.amount}
                  onChange={(e) =>
                    setEditHouseholdModal((prev) =>
                      prev ? { ...prev, amount: e.target.value } : prev,
                    )
                  }
                  className="w-full rounded-xl border border-[#D8D1CB] px-3 py-2.5"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Статус оплаты
                </label>
                <select
                  value={editHouseholdModal.status}
                  onChange={(e) => {
                    const nextStatus = e.target.value as 'UNPAID' | 'PAID';
                    setEditHouseholdModal((prev) => {
                      if (!prev) return prev;
                      if (nextStatus === 'UNPAID') {
                        return { ...prev, status: 'UNPAID' };
                      }
                      const amount = Number(prev.amount || 0);
                      const hasChannels =
                        Number(prev.bankTransferPaid ?? 0) +
                          Number(prev.cashbox1Paid ?? 0) +
                          Number(prev.cashbox2Paid ?? 0) >
                        0;
                      return {
                        ...prev,
                        status: 'PAID',
                        bankTransferPaid: hasChannels ? prev.bankTransferPaid : amount,
                        cashbox1Paid: hasChannels ? prev.cashbox1Paid : 0,
                        cashbox2Paid: hasChannels ? prev.cashbox2Paid : 0,
                      };
                    });
                  }}
                  className="w-full rounded-xl border border-[#D8D1CB] px-3 py-2.5"
                >
                  <option value="UNPAID">Не оплачено</option>
                  <option value="PAID">Оплачено</option>
                </select>
              </div>

              {editHouseholdModal.status === 'PAID' && (
                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">
                      Безналичные
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={editHouseholdModal.bankTransferPaid}
                      onChange={(e) =>
                        setEditHouseholdModal((prev) =>
                          prev
                            ? { ...prev, bankTransferPaid: Number(e.target.value || 0) }
                            : prev,
                        )
                      }
                      className="w-full rounded-xl border border-[#D8D1CB] px-3 py-2.5"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">
                      Наличные касса 1
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={editHouseholdModal.cashbox1Paid}
                      onChange={(e) =>
                        setEditHouseholdModal((prev) =>
                          prev ? { ...prev, cashbox1Paid: Number(e.target.value || 0) } : prev,
                        )
                      }
                      className="w-full rounded-xl border border-[#D8D1CB] px-3 py-2.5"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">
                      Наличные касса 2
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={editHouseholdModal.cashbox2Paid}
                      onChange={(e) =>
                        setEditHouseholdModal((prev) =>
                          prev ? { ...prev, cashbox2Paid: Number(e.target.value || 0) } : prev,
                        )
                      }
                      className="w-full rounded-xl border border-[#D8D1CB] px-3 py-2.5"
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditHouseholdModal(null)}
                disabled={householdSaving}
                className="rounded-xl border border-[#CFC6BF] px-4 py-2 text-sm font-medium text-slate-700 hover:bg-[#F4EFEB] disabled:opacity-60"
              >
                Отмена
              </button>
              <button
                type="button"
                onClick={handleSaveEditedHouseholdExpense}
                disabled={householdSaving}
                className="rounded-xl bg-[#FF6A13] px-4 py-2 text-sm font-medium text-white hover:bg-[#E65C00] disabled:opacity-60"
              >
                {householdSaving ? 'Сохранение...' : 'Сохранить'}
              </button>
            </div>
          </div>
        </div>
      )}

      {createOtherExpenseModal && (
        <div className="fixed inset-0 z-[95] flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-xl md:p-6">
            <h3 className="text-lg font-semibold text-slate-900">Новый прочий расход</h3>
            <p className="mt-1 text-sm text-slate-600">
              Расход создается со статусом «Не оплачено».
            </p>

            <div className="mt-4 grid grid-cols-1 gap-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Название</label>
                <input
                  type="text"
                  value={createOtherExpenseModal.note}
                  onChange={(e) =>
                    setCreateOtherExpenseModal((prev) =>
                      prev ? { ...prev, note: e.target.value } : prev,
                    )
                  }
                  className="w-full rounded-xl border border-[#D8D1CB] px-3 py-2.5"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Сумма</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={createOtherExpenseModal.amount}
                  onChange={(e) =>
                    setCreateOtherExpenseModal((prev) =>
                      prev ? { ...prev, amount: e.target.value } : prev,
                    )
                  }
                  className="w-full rounded-xl border border-[#D8D1CB] px-3 py-2.5"
                />
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setCreateOtherExpenseModal(null)}
                disabled={otherExpenseSaving}
                className="rounded-xl border border-[#CFC6BF] px-4 py-2 text-sm font-medium text-slate-700 hover:bg-[#F4EFEB] disabled:opacity-60"
              >
                Отмена
              </button>
              <button
                type="button"
                onClick={handleCreateOtherExpense}
                disabled={otherExpenseSaving}
                className="rounded-xl bg-[#FF6A13] px-4 py-2 text-sm font-medium text-white hover:bg-[#E65C00] disabled:opacity-60"
              >
                {otherExpenseSaving ? 'Сохранение...' : 'Сохранить'}
              </button>
            </div>
          </div>
        </div>
      )}

      {editOtherExpenseModal && (
        <div className="fixed inset-0 z-[95] flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-xl md:p-6">
            <h3 className="text-lg font-semibold text-slate-900">Изменить прочий расход</h3>

            <div className="mt-4 grid grid-cols-1 gap-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Название</label>
                <input
                  type="text"
                  value={editOtherExpenseModal.note}
                  onChange={(e) =>
                    setEditOtherExpenseModal((prev) =>
                      prev ? { ...prev, note: e.target.value } : prev,
                    )
                  }
                  className="w-full rounded-xl border border-[#D8D1CB] px-3 py-2.5"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Сумма</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={editOtherExpenseModal.amount}
                  onChange={(e) =>
                    setEditOtherExpenseModal((prev) =>
                      prev ? { ...prev, amount: e.target.value } : prev,
                    )
                  }
                  className="w-full rounded-xl border border-[#D8D1CB] px-3 py-2.5"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Статус оплаты
                </label>
                <select
                  value={editOtherExpenseModal.status}
                  onChange={(e) => {
                    const nextStatus = e.target.value as 'UNPAID' | 'PAID';
                    setEditOtherExpenseModal((prev) => {
                      if (!prev) return prev;
                      if (nextStatus === 'UNPAID') {
                        return { ...prev, status: 'UNPAID' };
                      }
                      const amount = Number(prev.amount || 0);
                      const hasChannels =
                        Number(prev.bankTransferPaid ?? 0) +
                          Number(prev.cashbox1Paid ?? 0) +
                          Number(prev.cashbox2Paid ?? 0) >
                        0;
                      return {
                        ...prev,
                        status: 'PAID',
                        bankTransferPaid: hasChannels ? prev.bankTransferPaid : amount,
                        cashbox1Paid: hasChannels ? prev.cashbox1Paid : 0,
                        cashbox2Paid: hasChannels ? prev.cashbox2Paid : 0,
                      };
                    });
                  }}
                  className="w-full rounded-xl border border-[#D8D1CB] px-3 py-2.5"
                >
                  <option value="UNPAID">Не оплачено</option>
                  <option value="PAID">Оплачено</option>
                </select>
              </div>

              {editOtherExpenseModal.status === 'PAID' && (
                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">
                      Безналичные
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={editOtherExpenseModal.bankTransferPaid}
                      onChange={(e) =>
                        setEditOtherExpenseModal((prev) =>
                          prev
                            ? { ...prev, bankTransferPaid: Number(e.target.value || 0) }
                            : prev,
                        )
                      }
                      className="w-full rounded-xl border border-[#D8D1CB] px-3 py-2.5"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">
                      Наличные касса 1
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={editOtherExpenseModal.cashbox1Paid}
                      onChange={(e) =>
                        setEditOtherExpenseModal((prev) =>
                          prev
                            ? { ...prev, cashbox1Paid: Number(e.target.value || 0) }
                            : prev,
                        )
                      }
                      className="w-full rounded-xl border border-[#D8D1CB] px-3 py-2.5"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">
                      Наличные касса 2
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={editOtherExpenseModal.cashbox2Paid}
                      onChange={(e) =>
                        setEditOtherExpenseModal((prev) =>
                          prev
                            ? { ...prev, cashbox2Paid: Number(e.target.value || 0) }
                            : prev,
                        )
                      }
                      className="w-full rounded-xl border border-[#D8D1CB] px-3 py-2.5"
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditOtherExpenseModal(null)}
                disabled={otherExpenseSaving}
                className="rounded-xl border border-[#CFC6BF] px-4 py-2 text-sm font-medium text-slate-700 hover:bg-[#F4EFEB] disabled:opacity-60"
              >
                Отмена
              </button>
              <button
                type="button"
                onClick={handleSaveEditedOtherExpense}
                disabled={otherExpenseSaving}
                className="rounded-xl bg-[#FF6A13] px-4 py-2 text-sm font-medium text-white hover:bg-[#E65C00] disabled:opacity-60"
              >
                {otherExpenseSaving ? 'Сохранение...' : 'Сохранить'}
              </button>
            </div>
          </div>
        </div>
      )}

      {createAdminExpenseModal && (
        <div className="fixed inset-0 z-[95] flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-xl md:p-6">
            <h3 className="text-lg font-semibold text-slate-900">
              {createAdminExpenseModal.label}: новый расход
            </h3>
            <p className="mt-1 text-sm text-slate-600">
              Расход создается со статусом «Не оплачено».
            </p>

            <div className="mt-4 grid grid-cols-1 gap-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Сумма</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={createAdminExpenseModal.amount}
                  onChange={(e) =>
                    setCreateAdminExpenseModal((prev) =>
                      prev ? { ...prev, amount: e.target.value } : prev,
                    )
                  }
                  className="w-full rounded-xl border border-[#D8D1CB] px-3 py-2.5"
                />
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setCreateAdminExpenseModal(null)}
                disabled={adminExpenseSaving}
                className="rounded-xl border border-[#CFC6BF] px-4 py-2 text-sm font-medium text-slate-700 hover:bg-[#F4EFEB] disabled:opacity-60"
              >
                Отмена
              </button>
              <button
                type="button"
                onClick={handleCreateAdminExpense}
                disabled={adminExpenseSaving}
                className="rounded-xl bg-[#FF6A13] px-4 py-2 text-sm font-medium text-white hover:bg-[#E65C00] disabled:opacity-60"
              >
                {adminExpenseSaving ? 'Сохранение...' : 'Сохранить'}
              </button>
            </div>
          </div>
        </div>
      )}

      {editAdminExpenseModal && (
        <div className="fixed inset-0 z-[95] flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-xl md:p-6">
            <h3 className="text-lg font-semibold text-slate-900">
              {editAdminExpenseModal.label}: изменить расход
            </h3>

            <div className="mt-4 grid grid-cols-1 gap-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Название</label>
                <input
                  type="text"
                  value={editAdminExpenseModal.note}
                  onChange={(e) =>
                    setEditAdminExpenseModal((prev) =>
                      prev ? { ...prev, note: e.target.value } : prev,
                    )
                  }
                  className="w-full rounded-xl border border-[#D8D1CB] px-3 py-2.5"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Сумма</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={editAdminExpenseModal.amount}
                  onChange={(e) =>
                    setEditAdminExpenseModal((prev) =>
                      prev ? { ...prev, amount: e.target.value } : prev,
                    )
                  }
                  className="w-full rounded-xl border border-[#D8D1CB] px-3 py-2.5"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Статус оплаты
                </label>
                <select
                  value={editAdminExpenseModal.status}
                  onChange={(e) => {
                    const nextStatus = e.target.value as 'UNPAID' | 'PAID';
                    setEditAdminExpenseModal((prev) => {
                      if (!prev) return prev;
                      if (nextStatus === 'UNPAID') return { ...prev, status: 'UNPAID' };
                      const amount = Number(prev.amount || 0);
                      const hasChannels =
                        Number(prev.bankTransferPaid ?? 0) +
                          Number(prev.cashbox1Paid ?? 0) +
                          Number(prev.cashbox2Paid ?? 0) >
                        0;
                      return {
                        ...prev,
                        status: 'PAID',
                        bankTransferPaid: hasChannels ? prev.bankTransferPaid : amount,
                        cashbox1Paid: hasChannels ? prev.cashbox1Paid : 0,
                        cashbox2Paid: hasChannels ? prev.cashbox2Paid : 0,
                      };
                    });
                  }}
                  className="w-full rounded-xl border border-[#D8D1CB] px-3 py-2.5"
                >
                  <option value="UNPAID">Не оплачено</option>
                  <option value="PAID">Оплачено</option>
                </select>
              </div>

              {editAdminExpenseModal.status === 'PAID' && (
                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">
                      Безналичные
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={editAdminExpenseModal.bankTransferPaid}
                      onChange={(e) =>
                        setEditAdminExpenseModal((prev) =>
                          prev
                            ? { ...prev, bankTransferPaid: Number(e.target.value || 0) }
                            : prev,
                        )
                      }
                      className="w-full rounded-xl border border-[#D8D1CB] px-3 py-2.5"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">
                      Наличные касса 1
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={editAdminExpenseModal.cashbox1Paid}
                      onChange={(e) =>
                        setEditAdminExpenseModal((prev) =>
                          prev
                            ? { ...prev, cashbox1Paid: Number(e.target.value || 0) }
                            : prev,
                        )
                      }
                      className="w-full rounded-xl border border-[#D8D1CB] px-3 py-2.5"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">
                      Наличные касса 2
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={editAdminExpenseModal.cashbox2Paid}
                      onChange={(e) =>
                        setEditAdminExpenseModal((prev) =>
                          prev
                            ? { ...prev, cashbox2Paid: Number(e.target.value || 0) }
                            : prev,
                        )
                      }
                      className="w-full rounded-xl border border-[#D8D1CB] px-3 py-2.5"
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditAdminExpenseModal(null)}
                disabled={adminExpenseSaving}
                className="rounded-xl border border-[#CFC6BF] px-4 py-2 text-sm font-medium text-slate-700 hover:bg-[#F4EFEB] disabled:opacity-60"
              >
                Отмена
              </button>
              <button
                type="button"
                onClick={handleSaveEditedAdminExpense}
                disabled={adminExpenseSaving}
                className="rounded-xl bg-[#FF6A13] px-4 py-2 text-sm font-medium text-white hover:bg-[#E65C00] disabled:opacity-60"
              >
                {adminExpenseSaving ? 'Сохранение...' : 'Сохранить'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showCreatePavilionModal && (
        <CreatePavilionModal
          storeId={storeId}
          existingCategories={allCategories}
          onClose={() => setShowCreatePavilionModal(false)}
          onSaved={handlePavilionCreated}
        />
      )}

      {editStaffSalaryModal && (
        <div className="fixed inset-0 z-[95] flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-xl md:p-6">
            <h3 className="text-lg font-semibold text-slate-900">Изменить зарплату</h3>
            <p className="mt-1 text-sm text-slate-600">{editStaffSalaryModal.fullName}</p>

            <div className="mt-4 grid grid-cols-1 gap-3">
              <label className="mb-1 block text-sm font-medium text-slate-700">Новая зарплата</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={editStaffSalaryModal.salary}
                onChange={(e) =>
                  setEditStaffSalaryModal((prev) =>
                    prev ? { ...prev, salary: e.target.value } : prev,
                  )
                }
                className="w-full rounded-xl border border-[#D8D1CB] px-3 py-2.5"
              />

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Статус оплаты
                </label>
                <select
                  value={editStaffSalaryModal.salaryStatus}
                  onChange={(e) => {
                    const nextStatus = e.target.value as 'UNPAID' | 'PAID';
                    setEditStaffSalaryModal((prev) => {
                      if (!prev) return prev;
                      if (nextStatus === 'UNPAID') {
                        return { ...prev, salaryStatus: 'UNPAID' };
                      }

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
                    });
                  }}
                  className="w-full rounded-xl border border-[#D8D1CB] px-3 py-2.5"
                >
                  <option value="UNPAID">Не оплачено</option>
                  <option value="PAID">Оплачено</option>
                </select>
              </div>

              {editStaffSalaryModal.salaryStatus === 'PAID' && (
                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">
                      Безналичные
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={editStaffSalaryModal.salaryBankTransferPaid}
                      onChange={(e) =>
                        setEditStaffSalaryModal((prev) =>
                          prev
                            ? {
                                ...prev,
                                salaryBankTransferPaid: Number(e.target.value || 0),
                              }
                            : prev,
                        )
                      }
                      className="w-full rounded-xl border border-[#D8D1CB] px-3 py-2.5"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">
                      Наличные касса 1
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={editStaffSalaryModal.salaryCashbox1Paid}
                      onChange={(e) =>
                        setEditStaffSalaryModal((prev) =>
                          prev
                            ? {
                                ...prev,
                                salaryCashbox1Paid: Number(e.target.value || 0),
                              }
                            : prev,
                        )
                      }
                      className="w-full rounded-xl border border-[#D8D1CB] px-3 py-2.5"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">
                      Наличные касса 2
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={editStaffSalaryModal.salaryCashbox2Paid}
                      onChange={(e) =>
                        setEditStaffSalaryModal((prev) =>
                          prev
                            ? {
                                ...prev,
                                salaryCashbox2Paid: Number(e.target.value || 0),
                              }
                            : prev,
                        )
                      }
                      className="w-full rounded-xl border border-[#D8D1CB] px-3 py-2.5"
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditStaffSalaryModal(null)}
                disabled={staffSaving}
                className="rounded-xl border border-[#CFC6BF] px-4 py-2 text-sm font-medium text-slate-700 hover:bg-[#F4EFEB] disabled:opacity-60"
              >
                Отмена
              </button>
              <button
                type="button"
                onClick={handleSaveEditedStaffSalary}
                disabled={staffSaving}
                className="rounded-xl bg-[#FF6A13] px-4 py-2 text-sm font-medium text-white hover:bg-[#E65C00] disabled:opacity-60"
              >
                {staffSaving ? 'Сохранение...' : 'Сохранить'}
              </button>
            </div>
          </div>
        </div>
      )}
      <StoreExtraIncomeModal
        storeId={storeId}
        currency={store.currency}
        isOpen={showExtraIncomeModal}
        canCreate={hasPermission(permissions, 'CREATE_PAYMENTS')}
        canDelete={hasPermission(permissions, 'EDIT_PAYMENTS')}
        onClose={() => setShowExtraIncomeModal(false)}
        onChanged={() => fetchData(false)}
      />
    </div>
  );
}
