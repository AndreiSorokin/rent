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
import { AddExpenseModal } from './components/AddExpenseModal';
import {
  deleteHouseholdExpense,
  getHouseholdExpenses,
  updateHouseholdExpenseStatus,
} from '@/lib/householdExpenses';
import {
  createPavilionExpense,
  deletePavilionExpense,
  listPavilionExpenses,
  PaymentMethod,
  PavilionExpenseStatus,
  PavilionExpenseType,
  updatePavilionExpenseStatus,
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

type ExpenseCreateContext = {
  type: PavilionExpenseType;
  title: string;
  defaultName: string;
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
    bankTransfer: string;
    cashbox1: string;
    cashbox2: string;
  } | null>(null);
  const [staffSaving, setStaffSaving] = useState(false);
  const [householdExpenses, setHouseholdExpenses] = useState<any[]>([]);
  const [storeExpenses, setStoreExpenses] = useState<any[]>([]);
  const [expenseCreateContext, setExpenseCreateContext] =
    useState<ExpenseCreateContext | null>(null);
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

    const bank = Number(addStaffModal.bankTransfer || 0);
    const cash1 = Number(addStaffModal.cashbox1 || 0);
    const cash2 = Number(addStaffModal.cashbox2 || 0);
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
    if (channelsTotal > 0 && Math.abs(channelsTotal - salary) > 0.01) {
      alert('Сумма каналов оплаты должна быть равна зарплате');
      return;
    }

    try {
      setStaffSaving(true);
      const created = await apiFetch<any>(`/stores/${storeId}/staff`, {
        method: 'POST',
        body: JSON.stringify({
          fullName: addStaffModal.fullName.trim(),
          position: addStaffModal.position.trim(),
          salary,
        }),
      });

      if (channelsTotal > 0) {
        await apiFetch(`/stores/${storeId}/staff/${created.id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            salaryStatus: 'PAID',
            salaryBankTransferPaid: bank,
            salaryCashbox1Paid: cash1,
            salaryCashbox2Paid: cash2,
          }),
        });
      }

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

  const handleUpdateHouseholdExpenseStatus = async (
    expenseId: number,
    status: 'UNPAID' | 'PAID',
    paymentMethod?: PaymentMethod,
  ) => {
    try {
      await runKeepingScroll(async () => {
        await updateHouseholdExpenseStatus(
          storeId,
          expenseId,
          status,
          paymentMethod,
        );
        await fetchData(false);
      });
    } catch (err) {
      console.error(err);
      alert('Не удалось обновить статус хоз. расхода');
    }
  };

  const openExpenseCreateModal = (context: ExpenseCreateContext) => {
    setExpenseCreateContext(context);
  };

  const handleCreateExpenseFromModal = async (payload: {
    name: string;
    amount: number;
    bankTransfer: number;
    cashbox1: number;
    cashbox2: number;
  }) => {
    if (!expenseCreateContext) return;

    const bankTransferPaid = Number(payload.bankTransfer ?? 0);
    const cashbox1Paid = Number(payload.cashbox1 ?? 0);
    const cashbox2Paid = Number(payload.cashbox2 ?? 0);
    const channelsTotal = bankTransferPaid + cashbox1Paid + cashbox2Paid;
    const amount = Number(payload.amount ?? 0);

    if (Number.isNaN(amount) || amount < 0) {
      alert('Некорректная сумма');
      return;
    }
    if (channelsTotal > 0 && Math.abs(channelsTotal - amount) > 0.01) {
      alert('Сумма должна совпадать с суммой каналов оплаты');
      return;
    }

    const baseData = {
      type: expenseCreateContext.type,
      note: payload.name,
    };

    try {
      await createPavilionExpense(storeId, {
        ...baseData,
        amount,
        status: channelsTotal > 0 ? 'PAID' : 'UNPAID',
        bankTransferPaid,
        cashbox1Paid,
        cashbox2Paid,
      });
      setExpenseCreateContext(null);
      await fetchData(false);
    } catch (err) {
      console.error(err);
      alert('Не удалось добавить расход');
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

  const handleManualExpenseStatusChange = async (
    expenseId: number,
    status: PavilionExpenseStatus,
    paymentMethod?: PaymentMethod,
  ) => {
    try {
      await runKeepingScroll(async () => {
        await updatePavilionExpenseStatus(
          storeId,
          expenseId,
          status,
          paymentMethod,
        );
        await fetchData(false);
      });
    } catch (err) {
      console.error(err);
      alert('Не удалось изменить статус расхода');
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
    <div className="min-h-screen scroll-smooth bg-slate-100">
      <div className="mx-auto flex max-w-[1600px] gap-6 px-3 py-1 md:px-6 md:py-6">
        <aside className="sticky top-4 hidden h-[calc(100vh-2rem)] w-[320px] shrink-0 overflow-y-auto rounded-2xl border border-violet-100 bg-white p-5 shadow-sm lg:block">
          <div className="mb-5">
            <p className="text-xs uppercase tracking-[0.12em] text-violet-400">Объект</p>
            <h1 className="mt-1 text-xl font-bold text-slate-900">{store.name}</h1>
            <p className="mt-1 text-sm text-slate-600">
              Валюта: {store.currency} ({getCurrencySymbol(store.currency)})
            </p>
          </div>

          <div className="space-y-2 border-b border-slate-100 pb-4">
            <Link href="/dashboard" className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50">
              <ArrowLeft className="h-4 w-4" />
              Назад к объектам
            </Link>
            {canOpenUtilities && (
              <Link href={`/stores/${storeId}/utilities`} className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50">
                <HandCoins className="h-4 w-4" />
                Начисления
              </Link>
            )}
            {hasPermission(permissions, 'VIEW_PAYMENTS') && (
              <Link
                href={`/stores/${storeId}/accounting`}
                className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                <CheckCheck className="h-4 w-4" />
                Бух. таблица
              </Link>
            )}
            {hasPermission(permissions, 'VIEW_PAYMENTS') && (
              <button
                onClick={() => setShowExtraIncomeModal(true)}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                <BanknoteArrowDown className="h-4 w-4" />
                Доп приход
              </button>
            )}
          </div>

          <div className="mt-3 space-y-2 border-b border-slate-100 pb-4">
            {hasPermission(permissions, 'VIEW_SUMMARY') && (
              <Link
                href={`/stores/${storeId}/summary`}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700"
              >
                <Sigma className="h-4 w-4" />
                СВОДКА
              </Link>
            )}
            {canCreatePavilion && (
              <button
                onClick={() => setShowCreatePavilionModal(true)}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700"
              >
                <CirclePlus className="h-4 w-4" />
                Добавить павильон
              </button>
            )}
          </div>

          <div className="pt-4">
            <p className="mb-2 text-xs uppercase tracking-[0.12em] text-violet-400">Навигация</p>
            <nav className="space-y-1">
              {navSections.filter((item) => item.visible).map((item) => (
                <a
                  key={item.id}
                  href={`#${item.id}`}
                  onClick={() => setActiveSection(item.id)}
                  className={`flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition ${
                    activeSection === item.id
                      ? 'bg-violet-50 text-violet-700'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
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
                  className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
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
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm"
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
                  <p className="text-xs uppercase tracking-[0.12em] text-violet-400">Объект</p>
                  <h2 className="text-lg font-bold text-slate-900">{store.name}</h2>
                  <p className="text-xs text-slate-600">
                    Валюта: {store.currency} ({getCurrencySymbol(store.currency)})
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setMobileMenuOpen(false)}
                  className="rounded-lg border border-slate-200 p-2 text-slate-700"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="space-y-2 border-b border-slate-100 pb-4">
                <Link
                  href="/dashboard"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Назад к объектам
                </Link>
                {canOpenUtilities && (
                  <Link
                    href={`/stores/${storeId}/utilities`}
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700"
                  >
                    <HandCoins className="h-4 w-4" />
                    Начисления
                  </Link>
                )}
                {hasPermission(permissions, 'VIEW_PAYMENTS') && (
                  <Link
                    href={`/stores/${storeId}/accounting`}
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700"
                  >
                    <CheckCheck className="h-4 w-4" />
                    Бух. таблица
                  </Link>
                )}
                {hasPermission(permissions, 'VIEW_PAYMENTS') && (
                  <button
                    onClick={() => {
                      setShowExtraIncomeModal(true);
                      setMobileMenuOpen(false);
                    }}
                    className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700"
                  >
                    <BanknoteArrowDown className="h-4 w-4" />
                    Доп приход
                  </button>
                )}
              </div>

              <div className="mt-3 space-y-2 border-b border-slate-100 pb-4">
                {hasPermission(permissions, 'VIEW_SUMMARY') && (
                  <Link
                    href={`/stores/${storeId}/summary`}
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-3 py-2 text-sm font-semibold text-white"
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
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-3 py-2 text-sm font-semibold text-white"
                  >
                    <CirclePlus className="h-4 w-4" />
                    Добавить павильон
                  </button>
                )}
              </div>

              <div className="pt-4">
                <p className="mb-2 text-xs uppercase tracking-[0.12em] text-violet-400">Навигация</p>
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
                          ? 'bg-violet-50 text-violet-700'
                          : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
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
                      className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700"
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
            className="scroll-mt-24 rounded-2xl border border-violet-100 bg-white p-6 shadow-sm md:p-8"
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
                className="w-full rounded-lg border border-gray-300 px-3 py-2"
                placeholder="Поиск по имени павильона"
              />
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <select
                value={pavilionCategoryFilter}
                onChange={(e) => {
                  setPavilionCategoryFilter(e.target.value);
                  setPavilionsPage(1);
                }}
                className="rounded-lg border border-gray-300 px-3 py-2"
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
                className="rounded-lg border border-gray-300 px-3 py-2"
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
                className="rounded-lg border border-gray-300 px-3 py-2"
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
                className="rounded-lg border border-gray-300 px-3 py-2"
              >
                <option value="">все</option>
                <option value="PAID">Оплачено</option>
                <option value="PARTIAL">Частично оплачено</option>
                <option value="UNPAID">Не оплачено</option>
              </select>
              </div>
            </div>

            {pavilionsLoading ? (
              <p className="py-8 text-center text-gray-600">Загрузка павильонов...</p>
            ) : orderedPavilions.length === 0 ? (
              <p className="py-8 text-center text-gray-600">
                {pavilionsTotal === 0
                  ? 'В магазине пока нет павильонов'
                  : 'По текущим фильтрам павильоны не найдены'}
              </p>
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
                        м²
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                        Статус
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                        Оплата
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                        Категория
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                        Наименование организации
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                        Группы
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 bg-white">
                    {orderedPavilions.map((p: any) => (
                      (() => {
                        const paymentStatus = getPavilionPaymentStatus(p);
                        return (
                      <tr
                        key={p.id}
                        className="cursor-pointer transition-colors hover:bg-gray-50"
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
                        <td className="px-4 py-3 text-sm text-gray-700">
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
                                ? 'cursor-grab text-gray-500 hover:bg-gray-100 active:cursor-grabbing'
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
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">
                          {p.number}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700">
                          {p.squareMeters ?? 0}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700">
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
                        <td className="px-4 py-3 text-sm text-gray-700">
                          <span
                            className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold ${paymentStatus.className}`}
                          >
                            {paymentStatus.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700">
                          {p.category || '-'}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700">
                          {p.tenantName || 'Свободен'}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700">
                          <div
                            className="space-y-2"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div className="flex flex-wrap gap-2">
                              {(p.groupMemberships || []).length === 0 ? (
                                <span className="text-xs text-gray-500">Нет групп</span>
                              ) : (
                                p.groupMemberships.map((membership: any) => (
                                  <span
                                    key={`${p.id}-${membership.group.id}`}
                                    className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-1 text-xs"
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

            <div className="mt-4 flex items-center justify-between text-sm text-gray-600">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    void runKeepingScroll(async () => {
                      await fetchPavilions(Math.max(1, pavilionsPage - 1));
                    })
                  }
                  disabled={pavilionsLoading || pavilionsPage <= 1}
                  className="rounded border px-3 py-1 disabled:cursor-not-allowed disabled:opacity-50"
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
                  className="rounded border px-3 py-1 disabled:cursor-not-allowed disabled:opacity-50"
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
            className="scroll-mt-24 rounded-2xl border border-violet-100 bg-white p-6 shadow-sm md:p-8"
          >
            <h2 className="text-xl font-semibold text-slate-900 md:text-2xl">Хозяйственные расходы</h2>
            {hasPermission(permissions, 'CREATE_CHARGES') && (
              <div className="mb-5 mt-4">
                <button
                  onClick={() =>
                    openExpenseCreateModal({
                      type: 'HOUSEHOLD',
                      title: 'Новый хозяйственный расход',
                      defaultName: '',
                    })
                  }
                  className="rounded-xl bg-violet-600 px-4 py-2.5 text-white transition hover:bg-violet-700 disabled:opacity-60"
                >
                  Добавить
                </button>
              </div>
            )}

            {householdExpenses.length === 0 ? (
              <p className="text-slate-600">Расходов пока нет</p>
            ) : (
              <div className="grid grid-cols-1 justify-items-start gap-3 md:grid-cols-2">
                {householdExpenses.map((expense: any) => (
                  <article
                    key={expense.id}
                    className="flex min-h-[104px] w-full md:max-w-[400px] flex-col justify-between rounded-xl border border-slate-200 bg-slate-50/70 p-3.5"
                  >
                    <div className="mb-3 flex items-start justify-between gap-3">
                      <p className="pr-2 text-sm font-semibold leading-5 text-slate-900">
                        {expense.name}
                      </p>
                      <p className="shrink-0 text-sm font-bold text-slate-900">
                        {formatMoney(expense.amount, store.currency)}
                      </p>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        {hasPermission(permissions, 'EDIT_CHARGES') ? (
                          <div className="flex flex-wrap items-center gap-2">
                            <select
                              value={expense.status ?? 'UNPAID'}
                              onChange={(e) =>
                                handleUpdateHouseholdExpenseStatus(
                                  expense.id,
                                  e.target.value as 'UNPAID' | 'PAID',
                                  (expense.paymentMethod as PaymentMethod) ?? 'BANK_TRANSFER',
                                )
                              }
                              className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs"
                            >
                              <option value="UNPAID">Не оплачено</option>
                              <option value="PAID">Оплачено</option>
                            </select>
                            {(expense.status ?? 'UNPAID') === 'PAID' && (
                              <span className="truncate text-[11px] text-slate-600">
                                {expensePaymentLabel(expense, store.currency)}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span
                            className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                              expense.status === 'PAID'
                                ? 'bg-emerald-100 text-emerald-700'
                                : 'bg-amber-100 text-amber-700'
                            }`}
                          >
                            {expense.status === 'PAID'
                              ? `Оплачено (${expensePaymentLabel(expense, store.currency)})`
                              : 'Не оплачено'}
                          </span>
                        )}
                      </div>
                      {hasPermission(permissions, 'DELETE_CHARGES') && (
                        <button
                          onClick={() => handleDeleteHouseholdExpense(expense.id)}
                          className="shrink-0 rounded-lg border border-red-200 px-2.5 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
                        >
                          Удалить
                        </button>
                      )}
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
            className="scroll-mt-24 rounded-2xl border border-violet-100 bg-white p-6 shadow-sm md:p-8"
          >
            <h2 className="mb-3 text-xl font-semibold text-slate-900 md:text-2xl">Прочие расходы</h2>

            {hasPermission(permissions, 'CREATE_CHARGES') && (
              <div className="mb-5">
                <button
                  onClick={() =>
                    openExpenseCreateModal({
                      type: 'OTHER',
                      title: 'Новый прочий расход',
                      defaultName: '',
                    })
                  }
                  className="rounded-xl bg-violet-600 px-4 py-2.5 text-white transition hover:bg-violet-700 disabled:opacity-60"
                >
                  Добавить
                </button>
              </div>
            )}

            {otherExpenses.length === 0 ? (
              <p className="text-slate-600">Расходов пока нет</p>
            ) : (
              <div className="grid grid-cols-1 justify-items-start gap-3 md:grid-cols-2">
                {otherExpenses.map((expense: any) => (
                  <article
                    key={expense.id}
                    className="flex min-h-[104px] w-full md:max-w-[400px] flex-col justify-between rounded-xl border border-slate-200 bg-slate-50/70 p-3.5"
                  >
                    <div className="mb-3 flex items-start justify-between gap-3">
                      <p className="pr-2 text-sm font-semibold leading-5 text-slate-900">
                        {expense.note || 'Прочий расход'}
                      </p>
                      <p className="shrink-0 text-sm font-bold text-slate-900">
                        {formatMoney(expense.amount, store.currency)}
                      </p>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        {hasPermission(permissions, 'EDIT_CHARGES') ? (
                          <div className="flex flex-wrap items-center gap-2">
                            <select
                              value={expense.status ?? 'UNPAID'}
                              onChange={(e) =>
                                handleManualExpenseStatusChange(
                                  expense.id,
                                  e.target.value as PavilionExpenseStatus,
                                  (expense.paymentMethod as PaymentMethod) ?? 'BANK_TRANSFER',
                                )
                              }
                              className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs"
                            >
                              <option value="UNPAID">Не оплачено</option>
                              <option value="PAID">Оплачено</option>
                            </select>
                            {(expense.status ?? 'UNPAID') === 'PAID' && (
                              <span className="truncate text-[11px] text-slate-600">
                                {expensePaymentLabel(expense, store.currency)}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span
                            className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                              expense.status === 'PAID'
                                ? 'bg-emerald-100 text-emerald-700'
                                : 'bg-amber-100 text-amber-700'
                            }`}
                          >
                            {expense.status === 'PAID'
                              ? `Оплачено (${expensePaymentLabel(expense, store.currency)})`
                              : 'Не оплачено'}
                          </span>
                        )}
                      </div>
                      {hasPermission(permissions, 'DELETE_CHARGES') && (
                        <button
                          onClick={() => handleDeleteManualExpense(expense.id)}
                          className="shrink-0 rounded-lg border border-red-200 px-2.5 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
                        >
                          Удалить
                        </button>
                      )}
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
            className="scroll-mt-24 rounded-2xl border border-violet-100 bg-white p-6 shadow-sm md:p-8"
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
                  <div key={category.type} className="rounded-md border p-3">
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
                            openExpenseCreateModal({
                              type: category.type,
                              title: `${category.label}: новый расход`,
                              defaultName: category.label,
                            })
                          }
                          className="w-full rounded bg-amber-600 px-3 py-1.5 text-xs text-white hover:bg-amber-700"
                        >
                          Добавить
                        </button>
                      </div>
                    )}

                    {categoryItems.length > 0 ? (
                      <div className="max-h-28 space-y-1 overflow-auto">
                        {categoryItems.map((item: any) => (
                          <div
                            key={item.id}
                            className="flex items-center justify-between rounded bg-gray-50 px-2 py-1 text-xs"
                          >
                            <span>
                              {formatMoney(item.amount, store.currency)}{' '}
                              <span className="text-gray-500">
                                ({new Date(item.createdAt).toLocaleDateString()})
                              </span>
                            </span>
                            <div className="ml-2 flex items-center gap-2">
                              {hasPermission(permissions, 'EDIT_CHARGES') && (
                                <div className="flex items-center gap-1">
                                  <select
                                    value={item.status}
                                    onChange={(e) =>
                                      handleManualExpenseStatusChange(
                                        item.id,
                                        e.target.value as PavilionExpenseStatus,
                                        (item.paymentMethod as PaymentMethod) ?? 'BANK_TRANSFER',
                                      )
                                    }
                                    className="rounded border px-1 py-0.5 text-[10px]"
                                  >
                                    <option value="UNPAID">Не оплачено</option>
                                    <option value="PAID">Оплачено</option>
                                  </select>
                                  {(item.status ?? 'UNPAID') === 'PAID' && (
                                    <span className="text-[10px] text-gray-600">
                                      {expensePaymentLabel(item, store.currency)}
                                    </span>
                                  )}
                                </div>
                              )}
                              {hasPermission(permissions, 'DELETE_CHARGES') && (
                                <button
                                  onClick={() => handleDeleteManualExpense(item.id)}
                                  className="text-red-600 hover:underline"
                                >
                                  x
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-gray-500">Записей нет</p>
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
            className="scroll-mt-24 rounded-2xl border border-violet-100 bg-white p-6 shadow-sm md:p-8"
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
                      bankTransfer: '',
                      cashbox1: '',
                      cashbox2: '',
                    })
                  }
                  className="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-60"
                >
                  Добавить
                </button>
              </div>
            )}

            {!store.staff || store.staff.length === 0 ? (
              <p className="text-gray-600">Список сотрудников пуст</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                        Перенос
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                        Должность
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                        Имя фамилия
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                        Зарплата
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                        Статус оплаты
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500">
                        Действия
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
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
                        <td className="px-4 py-3 text-sm text-gray-700">
                          <button
                            type="button"
                            draggable
                            onDragStart={(e) => {
                              setDraggedStaffId(staff.id);
                              e.dataTransfer.effectAllowed = 'move';
                            }}
                            onDragEnd={() => setDraggedStaffId(null)}
                            className="cursor-grab select-none rounded px-2 py-1 text-lg leading-none text-gray-500 hover:bg-gray-100 active:cursor-grabbing"
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
                                  void handleUpdateStaffSalaryStatus(staff.id, nextStatus);
                                }}
                                className="rounded border px-2 py-1 text-xs"
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
                            <button
                              onClick={() => handleDeleteStaff(staff.id)}
                              className="text-red-600 hover:underline"
                            >
                              Удалить
                            </button>
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
            <h3 className="text-lg font-semibold text-slate-900">Новый сотрудник</h3>
            <p className="mt-1 text-sm text-slate-600">
              Заполните данные и укажите статус оплаты.
            </p>

            <div className="mt-4 grid grid-cols-1 gap-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Должность</label>
                <input
                  type="text"
                  value={addStaffModal.position}
                  onChange={(e) =>
                    setAddStaffModal((prev) => (prev ? { ...prev, position: e.target.value } : prev))
                  }
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5"
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
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5"
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
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5"
                />
              </div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Безналичные</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={addStaffModal.bankTransfer}
                    onChange={(e) =>
                      setAddStaffModal((prev) =>
                        prev ? { ...prev, bankTransfer: e.target.value } : prev,
                      )
                    }
                    className="w-full rounded-xl border border-slate-200 px-3 py-2.5"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Наличные касса 1</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={addStaffModal.cashbox1}
                    onChange={(e) =>
                      setAddStaffModal((prev) =>
                        prev ? { ...prev, cashbox1: e.target.value } : prev,
                      )
                    }
                    className="w-full rounded-xl border border-slate-200 px-3 py-2.5"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Наличные касса 2</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={addStaffModal.cashbox2}
                    onChange={(e) =>
                      setAddStaffModal((prev) =>
                        prev ? { ...prev, cashbox2: e.target.value } : prev,
                      )
                    }
                    className="w-full rounded-xl border border-slate-200 px-3 py-2.5"
                  />
                </div>
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setAddStaffModal(null)}
                disabled={staffSaving}
                className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
              >
                Отмена
              </button>
              <button
                type="button"
                onClick={handleAddStaff}
                disabled={staffSaving}
                className="rounded-xl bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-60"
              >
                {staffSaving ? 'Сохранение...' : 'Добавить'}
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
      <AddExpenseModal
        isOpen={Boolean(expenseCreateContext)}
        title={expenseCreateContext?.title ?? 'Новый расход'}
        currency={store.currency}
        defaultName={expenseCreateContext?.defaultName ?? ''}
        onClose={() => setExpenseCreateContext(null)}
        onSubmit={handleCreateExpenseFromModal}
      />
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
