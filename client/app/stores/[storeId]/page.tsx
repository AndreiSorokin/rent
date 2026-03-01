'use client';

import { Fragment, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { formatMoney, getCurrencySymbol } from '@/lib/currency';
import { hasPermission } from '@/lib/permissions';
import { calcProfit } from '@/lib/finance';
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
  Upload,
  UsersRound,
  X,
  type LucideIcon,
} from 'lucide-react';
import { CreatePavilionModal } from '@/app/dashboard/components/CreatePavilionModal';
import { ImportStoreDataModal } from '@/app/dashboard/components/ImportStoreDataModal';
import { StoreExtraIncomeModal } from './components/StoreExtraIncomeModal';
import {
  createHouseholdExpense,
  deleteHouseholdExpense,
  getHouseholdExpenses,
  updateHouseholdExpenseStatus,
} from '@/lib/householdExpenses';
import {
  createPavilionExpense,
  deletePavilionExpense,
  listPavilionExpenses,
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

export default function StorePage() {
  const params = useParams();
  const router = useRouter();
  const storeId = Number(params.storeId);

  const [store, setStore] = useState<any>(null);
  const [analytics, setAnalytics] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreatePavilionModal, setShowCreatePavilionModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showExtraIncomeModal, setShowExtraIncomeModal] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [staffFullName, setStaffFullName] = useState('');
  const [staffPosition, setStaffPosition] = useState('');
  const [staffSalary, setStaffSalary] = useState('');
  const [staffSaving, setStaffSaving] = useState(false);
  const [staffSalaryDraftById, setStaffSalaryDraftById] = useState<
    Record<number, string>
  >({});
  const [staffSalaryUpdatingById, setStaffSalaryUpdatingById] = useState<
    Record<number, boolean>
  >({});
  const [accountingRows, setAccountingRows] = useState<any[]>([]);
  const [accountingDate, setAccountingDate] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [dayReconciliation, setDayReconciliation] = useState<any>(null);
  const [dayOpenBank, setDayOpenBank] = useState('');
  const [dayOpenCash1, setDayOpenCash1] = useState('');
  const [dayOpenCash2, setDayOpenCash2] = useState('');
  const [dayCloseBank, setDayCloseBank] = useState('');
  const [dayCloseCash1, setDayCloseCash1] = useState('');
  const [dayCloseCash2, setDayCloseCash2] = useState('');
  const [dayActionSaving, setDayActionSaving] = useState(false);
  const [householdExpenses, setHouseholdExpenses] = useState<any[]>([]);
  const [householdName, setHouseholdName] = useState('');
  const [householdAmount, setHouseholdAmount] = useState('');
  const [householdSaving, setHouseholdSaving] = useState(false);
  const [otherExpenseName, setOtherExpenseName] = useState('');
  const [otherExpenseAmount, setOtherExpenseAmount] = useState('');
  const [otherExpenseSaving, setOtherExpenseSaving] = useState(false);
  const [storeExpenses, setStoreExpenses] = useState<any[]>([]);
  const [manualExpenseAmountByType, setManualExpenseAmountByType] = useState<
    Record<ManualExpenseType, string>
  >({
    HOUSEHOLD: '',
    STORE_FACILITIES: '',
    PAYROLL_TAX: '',
    PROFIT_TAX: '',
    DIVIDENDS: '',
    BANK_SERVICES: '',
    VAT: '',
    LAND_RENT: '',
    OTHER: '',
  });
  const [pavilionSearch, setPavilionSearch] = useState('');
  const [pavilionCategoryFilter, setPavilionCategoryFilter] = useState('');
  const [pavilionStatusFilter, setPavilionStatusFilter] = useState('');
  const [pavilionGroupFilter, setPavilionGroupFilter] = useState('');
  const [pavilions, setPavilions] = useState<any[]>([]);
  const [pavilionsTotal, setPavilionsTotal] = useState(0);
  const [pavilionsPage, setPavilionsPage] = useState(1);
  const [pavilionsPageSize] = useState(20);
  const [pavilionsHasMore, setPavilionsHasMore] = useState(false);
  const [pavilionsLoading, setPavilionsLoading] = useState(false);
  const [orderedPavilionIds, setOrderedPavilionIds] = useState<number[]>([]);
  const [draggedPavilionId, setDraggedPavilionId] = useState<number | null>(null);
  const [orderedStaffIds, setOrderedStaffIds] = useState<number[]>([]);
  const [draggedStaffId, setDraggedStaffId] = useState<number | null>(null);
  const [activeSection, setActiveSection] = useState('pavilions');

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
        const [analyticsData, accountingData] = await Promise.all([
          apiFetch<any>(`/stores/${storeId}/analytics`),
          apiFetch<any[]>(`/stores/${storeId}/accounting-table`),
        ]);
        setAnalytics(analyticsData);
        setAccountingRows(accountingData || []);
        const dayData = await apiFetch<any>(
          `/stores/${storeId}/accounting-reconciliation?date=${encodeURIComponent(accountingDate)}`,
        );
        setDayReconciliation(dayData);
      } else {
        setAnalytics(null);
        setAccountingRows([]);
        setDayReconciliation(null);
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
        await fetchPavilions(1);
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

  const fetchDayReconciliation = async (date?: string) => {
    if (!storeId) return;
    try {
      const dayData = await apiFetch<any>(
        `/stores/${storeId}/accounting-reconciliation?date=${encodeURIComponent(
          date || accountingDate,
        )}`,
      );
      setDayReconciliation(dayData);
    } catch (err) {
      console.error(err);
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
    void fetchPavilions(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pavilionSearch, pavilionCategoryFilter, pavilionStatusFilter, pavilionGroupFilter]);

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
    const nextDrafts: Record<number, string> = {};
    for (const staffMember of store?.staff || []) {
      nextDrafts[staffMember.id] = String(staffMember.salary ?? 0);
    }
    setStaffSalaryDraftById(nextDrafts);
  }, [store?.staff]);

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
    if (!storeId) return;
    if (!store) return;
    if (!hasPermission(store.permissions || [], 'VIEW_PAYMENTS')) return;
    void fetchDayReconciliation(accountingDate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeId, accountingDate, store?.id]);

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
    if (!staffFullName.trim() || !staffPosition.trim() || !staffSalary) {
      alert('Заполните поля "Имя фамилия", "Должность" и "Зарплата"');
      return;
    }

    const salary = Number(staffSalary);
    if (Number.isNaN(salary) || salary < 0) {
      alert('Зарплата должна быть неотрицательной');
      return;
    }

    try {
      setStaffSaving(true);
      await apiFetch(`/stores/${storeId}/staff`, {
        method: 'POST',
        body: JSON.stringify({
          fullName: staffFullName.trim(),
          position: staffPosition.trim(),
          salary,
        }),
      });
      setStaffFullName('');
      setStaffPosition('');
      setStaffSalary('');
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
  ) => {
    try {
      await runKeepingScroll(async () => {
        await apiFetch(`/stores/${storeId}/staff/${staffId}`, {
          method: 'PATCH',
          body: JSON.stringify({ salaryStatus }),
        });
        await fetchData(false);
      });
    } catch (err) {
      console.error(err);
      alert('Не удалось обновить статус зарплаты');
    }
  };

  const handleUpdateStaffSalary = async (staffId: number) => {
    const rawSalary = staffSalaryDraftById[staffId];
    const salary = Number(rawSalary);

    if (rawSalary === undefined || rawSalary === '') {
      alert('Введите зарплату');
      return;
    }
    if (Number.isNaN(salary) || salary < 0) {
      alert('Зарплата должна быть неотрицательной');
      return;
    }

    try {
      setStaffSalaryUpdatingById((prev) => ({ ...prev, [staffId]: true }));
      await apiFetch(`/stores/${storeId}/staff/${staffId}`, {
        method: 'PATCH',
        body: JSON.stringify({ salary }),
      });
      await fetchData(false);
    } catch (err) {
      console.error(err);
      alert('Не удалось обновить зарплату');
    } finally {
      setStaffSalaryUpdatingById((prev) => ({ ...prev, [staffId]: false }));
    }
  };

  const handleDeleteAccountingRecord = async (recordId: number) => {
    if (!confirm('Удалить эту запись из бух. таблицы?')) return;

    try {
      await apiFetch(`/stores/${storeId}/accounting-table/${recordId}`, {
        method: 'DELETE',
      });
      await fetchData(false);
    } catch (err) {
      console.error(err);
      alert('Не удалось удалить запись');
    }
  };

  const handleOpenDay = async () => {
    const bank = dayOpenBank ? Number(dayOpenBank) : 0;
    const cash1 = dayOpenCash1 ? Number(dayOpenCash1) : 0;
    const cash2 = dayOpenCash2 ? Number(dayOpenCash2) : 0;

    if (bank < 0 || cash1 < 0 || cash2 < 0) {
      alert('Суммы не могут быть отрицательными');
      return;
    }

    try {
      setDayActionSaving(true);
      const data = await apiFetch<any>(`/stores/${storeId}/accounting-reconciliation/open`, {
        method: 'POST',
        body: JSON.stringify({
          date: accountingDate,
          bankTransferPaid: bank,
          cashbox1Paid: cash1,
          cashbox2Paid: cash2,
        }),
      });
      setDayReconciliation(data);
      await fetchData(false);
    } catch (err: any) {
      console.error(err);
      alert(err?.message || 'Не удалось открыть день');
    } finally {
      setDayActionSaving(false);
    }
  };

  const handleCloseDay = async () => {
    const bank = dayCloseBank ? Number(dayCloseBank) : 0;
    const cash1 = dayCloseCash1 ? Number(dayCloseCash1) : 0;
    const cash2 = dayCloseCash2 ? Number(dayCloseCash2) : 0;

    if (bank < 0 || cash1 < 0 || cash2 < 0) {
      alert('Суммы не могут быть отрицательными');
      return;
    }

    const expected = dayReconciliation?.expectedClose;
    const expectedBank = Number(expected?.bankTransferPaid ?? bank);
    const expectedCash1 = Number(expected?.cashbox1Paid ?? cash1);
    const expectedCash2 = Number(expected?.cashbox2Paid ?? cash2);
    const isMismatch =
      Math.abs(bank - expectedBank) > 0.01 ||
      Math.abs(cash1 - expectedCash1) > 0.01 ||
      Math.abs(cash2 - expectedCash2) > 0.01;

    if (isMismatch) {
      const confirmed = confirm(
        'Вы уверены что хотите закрыть день с не схождением?',
      );
      if (!confirmed) return;
    }

    try {
      setDayActionSaving(true);
      const data = await apiFetch<any>(`/stores/${storeId}/accounting-reconciliation/close`, {
        method: 'POST',
        body: JSON.stringify({
          date: accountingDate,
          bankTransferPaid: bank,
          cashbox1Paid: cash1,
          cashbox2Paid: cash2,
          forceClose: isMismatch,
        }),
      });
      setDayReconciliation(data);
      await fetchData(false);
    } catch (err: any) {
      console.error(err);
      if (
        typeof err?.message === 'string' &&
        err.message.includes('не схождением')
      ) {
        const confirmed = confirm(err.message);
        if (!confirmed) return;
        try {
          setDayActionSaving(true);
          const data = await apiFetch<any>(`/stores/${storeId}/accounting-reconciliation/close`, {
            method: 'POST',
            body: JSON.stringify({
              date: accountingDate,
              bankTransferPaid: bank,
              cashbox1Paid: cash1,
              cashbox2Paid: cash2,
              forceClose: true,
            }),
          });
          setDayReconciliation(data);
          await fetchData(false);
        } catch (innerErr: any) {
          console.error(innerErr);
          alert(innerErr?.message || 'Не удалось закрыть день');
        }
      } else {
        alert(err?.message || 'Не удалось закрыть день');
      }
    } finally {
      setDayActionSaving(false);
    }
  };

  const handleCreateHouseholdExpense = async () => {
    if (!householdName.trim() || !householdAmount) {
      alert('Введите название и сумму расхода');
      return;
    }

    const amount = Number(householdAmount);
    if (Number.isNaN(amount) || amount < 0) {
      alert('Некорректная сумма');
      return;
    }

    try {
      setHouseholdSaving(true);
      await createHouseholdExpense(storeId, {
        name: householdName.trim(),
        amount,
      });
      setHouseholdName('');
      setHouseholdAmount('');
      await fetchData(false);
    } catch (err) {
      console.error(err);
      alert('Не удалось добавить расход');
    } finally {
      setHouseholdSaving(false);
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
  ) => {
    try {
      await runKeepingScroll(async () => {
        await updateHouseholdExpenseStatus(storeId, expenseId, status);
        await fetchData(false);
      });
    } catch (err) {
      console.error(err);
      alert('Не удалось обновить статус хоз. расхода');
    }
  };

  const handleCreateManualExpense = async (type: ManualExpenseType) => {
    const raw = manualExpenseAmountByType[type];
    if (!raw) {
      alert('Введите сумму');
      return;
    }

    const amount = Number(raw);
    if (Number.isNaN(amount) || amount < 0) {
      alert('Некорректная сумма');
      return;
    }

    try {
      await createPavilionExpense(storeId, { type, amount });
      setManualExpenseAmountByType((prev) => ({ ...prev, [type]: '' }));
      await fetchData(false);
    } catch (err) {
      console.error(err);
      alert('Не удалось добавить расход');
    }
  };

  const handleCreateOtherExpense = async () => {
    if (!otherExpenseName.trim() || !otherExpenseAmount) {
      alert('Введите название и сумму расхода');
      return;
    }

    const amount = Number(otherExpenseAmount);
    if (Number.isNaN(amount) || amount < 0) {
      alert('Некорректная сумма');
      return;
    }

    try {
      setOtherExpenseSaving(true);
      await createPavilionExpense(storeId, {
        type: 'OTHER',
        amount,
        note: otherExpenseName.trim(),
      });
      setOtherExpenseName('');
      setOtherExpenseAmount('');
      await fetchData(false);
    } catch (err) {
      console.error(err);
      alert('Не удалось добавить расход');
    } finally {
      setOtherExpenseSaving(false);
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
  ) => {
    try {
      await runKeepingScroll(async () => {
        await updatePavilionExpenseStatus(storeId, expenseId, status);
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
  const analyticsPeriodDate = analytics?.period ? new Date(analytics.period) : new Date();
  const safeAnalyticsPeriodDate = Number.isNaN(analyticsPeriodDate.getTime())
    ? new Date()
    : analyticsPeriodDate;
  const forecastPeriodParam = `${safeAnalyticsPeriodDate.getFullYear()}-${String(
    safeAnalyticsPeriodDate.getMonth() + 1,
  ).padStart(2, '0')}`;
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
  const accountingDayEntries = Array.from(
    (accountingRows || []).reduce((map, row: any) => {
      const dayKey = new Date(row.recordDate).toISOString().slice(0, 10);
      const list = map.get(dayKey) ?? [];
      list.push(row);
      map.set(dayKey, list);
      return map;
    }, new Map<string, any[]>()),
  ) as Array<[string, any[]]>;

  const accountingDays = accountingDayEntries
    .map(([dayKey, rows]) => {
      const sorted = [...rows].sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      );
      return {
        dayKey,
        opening: sorted[0] ?? null,
        closing: sorted.length > 1 ? sorted[sorted.length - 1] : null,
      };
    })
    .sort((a, b) => new Date(b.dayKey).getTime() - new Date(a.dayKey).getTime());

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
  const canImportData = hasPermission(permissions, 'ASSIGN_PERMISSIONS');
  const canCreatePavilion = hasPermission(permissions, 'CREATE_PAVILIONS');

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
    { id: 'finance-overview', label: 'Финансовая панель', visible: hasPermission(permissions, 'VIEW_PAYMENTS') && Boolean(analytics), icon: HandCoins },
    { id: 'accounting', label: 'Бух таблица', visible: hasPermission(permissions, 'VIEW_PAYMENTS'), icon: CheckCheck },
    { id: 'summary', label: 'СВОДКА', visible: hasPermission(permissions, 'VIEW_SUMMARY'), icon: Sigma },
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
            {canManageStore && (
              <Link href={`/stores/${storeId}/settings`} className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50">
                <SlidersHorizontal className="h-4 w-4" />
                Управление объектом
              </Link>
            )}
            {canOpenUtilities && (
              <Link href={`/stores/${storeId}/utilities`} className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50">
                <HandCoins className="h-4 w-4" />
                Начисления
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
            {canImportData && (
              <button
                onClick={() => setShowImportModal(true)}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-violet-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-violet-700"
              >
                <Upload className="h-4 w-4" />
                Загрузить данные
              </button>
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
                {canManageStore && (
                  <Link
                    href={`/stores/${storeId}/settings`}
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700"
                  >
                    <SlidersHorizontal className="h-4 w-4" />
                    Управление объектом
                  </Link>
                )}
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
                {canImportData && (
                  <button
                    onClick={() => {
                      setShowImportModal(true);
                      setMobileMenuOpen(false);
                    }}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-violet-600 px-3 py-2 text-sm font-semibold text-white"
                  >
                    <Upload className="h-4 w-4" />
                    Загрузить данные
                  </button>
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

            <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-[1fr_220px_220px_220px]">
              <input
                type="text"
                value={pavilionSearch}
                onChange={(e) => setPavilionSearch(e.target.value)}
                className="rounded-lg border border-gray-300 px-3 py-2"
                placeholder="Поиск по имени павильона"
              />
              <select
                value={pavilionCategoryFilter}
                onChange={(e) => setPavilionCategoryFilter(e.target.value)}
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
                onChange={(e) => setPavilionStatusFilter(e.target.value)}
                className="rounded-lg border border-gray-300 px-3 py-2"
              >
                <option value="">Все статусы</option>
                <option value="AVAILABLE">СВОБОДЕН</option>
                <option value="RENTED">ЗАНЯТ</option>
                <option value="PREPAID">ПРЕДОПЛАТА</option>
              </select>
              <select
                value={pavilionGroupFilter}
                onChange={(e) => setPavilionGroupFilter(e.target.value)}
                className="rounded-lg border border-gray-300 px-3 py-2"
              >
                <option value="">Все группы</option>
                {(store.pavilionGroups || []).map((group: any) => (
                  <option key={group.id} value={group.id}>
                    {group.name}
                  </option>
                ))}
              </select>
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
                        onClick={() => router.push(`/stores/${storeId}/pavilions/${p.id}`)}
                      >
                        <td className="px-4 py-3 text-sm text-gray-700">
                          <button
                            type="button"
                            draggable
                            onClick={(e) => e.stopPropagation()}
                            onDragStart={(e) => {
                              e.stopPropagation();
                              setDraggedPavilionId(p.id);
                              e.dataTransfer.effectAllowed = 'move';
                            }}
                            onDragEnd={(e) => {
                              e.stopPropagation();
                              setDraggedPavilionId(null);
                            }}
                            className="cursor-grab select-none rounded px-2 py-1 text-lg leading-none text-gray-500 hover:bg-gray-100 active:cursor-grabbing"
                            title="Потяните, чтобы изменить порядок"
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
              <div className="mb-5 mt-4 grid grid-cols-1 gap-3 md:grid-cols-[1fr_220px_auto]">
                <input
                  type="text"
                  value={householdName}
                  onChange={(e) => setHouseholdName(e.target.value)}
                  className="rounded-xl border border-slate-200 px-3 py-2.5"
                  placeholder="Название расхода"
                />
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={householdAmount}
                  onChange={(e) => setHouseholdAmount(e.target.value)}
                  className="rounded-xl border border-slate-200 px-3 py-2.5"
                  placeholder="Сумма"
                />
                <button
                  onClick={handleCreateHouseholdExpense}
                  disabled={householdSaving}
                  className="rounded-xl bg-violet-600 px-4 py-2.5 text-white transition hover:bg-violet-700 disabled:opacity-60"
                >
                  Добавить
                </button>
              </div>
            )}

            {householdExpenses.length === 0 ? (
              <p className="text-slate-600">Расходов пока нет</p>
            ) : (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {householdExpenses.map((expense: any) => (
                  <article
                    key={expense.id}
                    className="min-h-[128px] rounded-2xl border border-slate-200 bg-slate-50/60 p-4"
                  >
                    <div className="mb-6 flex items-start justify-between gap-3">
                      <p className="text-base font-semibold text-slate-900">{expense.name}</p>
                      <p className="text-base font-bold text-slate-900">
                        {formatMoney(expense.amount, store.currency)}
                      </p>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        {hasPermission(permissions, 'EDIT_CHARGES') ? (
                          <select
                            value={expense.status ?? 'UNPAID'}
                            onChange={(e) =>
                              handleUpdateHouseholdExpenseStatus(
                                expense.id,
                                e.target.value as 'UNPAID' | 'PAID',
                              )
                            }
                            className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs"
                          >
                            <option value="UNPAID">Не оплачено</option>
                            <option value="PAID">Оплачено</option>
                          </select>
                        ) : (
                          <span
                            className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                              expense.status === 'PAID'
                                ? 'bg-emerald-100 text-emerald-700'
                                : 'bg-amber-100 text-amber-700'
                            }`}
                          >
                            {expense.status === 'PAID' ? 'Оплачено' : 'Не оплачено'}
                          </span>
                        )}
                      </div>
                      {hasPermission(permissions, 'DELETE_CHARGES') && (
                        <button
                          onClick={() => handleDeleteHouseholdExpense(expense.id)}
                          className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
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
              <div className="mb-5 grid grid-cols-1 gap-3 md:grid-cols-[1fr_220px_auto]">
                <input
                  type="text"
                  value={otherExpenseName}
                  onChange={(e) => setOtherExpenseName(e.target.value)}
                  className="rounded-xl border border-slate-200 px-3 py-2.5"
                  placeholder="Название расхода"
                />
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={otherExpenseAmount}
                  onChange={(e) => setOtherExpenseAmount(e.target.value)}
                  className="rounded-xl border border-slate-200 px-3 py-2.5"
                  placeholder="Сумма"
                />
                <button
                  onClick={handleCreateOtherExpense}
                  disabled={otherExpenseSaving}
                  className="rounded-xl bg-violet-600 px-4 py-2.5 text-white transition hover:bg-violet-700 disabled:opacity-60"
                >
                  Добавить
                </button>
              </div>
            )}

            {otherExpenses.length === 0 ? (
              <p className="text-slate-600">Расходов пока нет</p>
            ) : (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {otherExpenses.map((expense: any) => (
                  <article
                    key={expense.id}
                    className="min-h-[128px] rounded-2xl border border-slate-200 bg-slate-50/60 p-4"
                  >
                    <div className="mb-6 flex items-start justify-between gap-3">
                      <p className="text-base font-semibold text-slate-900">
                        {expense.note || 'Прочий расход'}
                      </p>
                      <p className="text-base font-bold text-slate-900">
                        {formatMoney(expense.amount, store.currency)}
                      </p>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        {hasPermission(permissions, 'EDIT_CHARGES') ? (
                          <select
                            value={expense.status ?? 'UNPAID'}
                            onChange={(e) =>
                              handleManualExpenseStatusChange(
                                expense.id,
                                e.target.value as PavilionExpenseStatus,
                              )
                            }
                            className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs"
                          >
                            <option value="UNPAID">Не оплачено</option>
                            <option value="PAID">Оплачено</option>
                          </select>
                        ) : (
                          <span
                            className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                              expense.status === 'PAID'
                                ? 'bg-emerald-100 text-emerald-700'
                                : 'bg-amber-100 text-amber-700'
                            }`}
                          >
                            {expense.status === 'PAID' ? 'Оплачено' : 'Не оплачено'}
                          </span>
                        )}
                      </div>
                      {hasPermission(permissions, 'DELETE_CHARGES') && (
                        <button
                          onClick={() => handleDeleteManualExpense(expense.id)}
                          className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
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
                      <div className="mb-2 flex gap-2">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={manualExpenseAmountByType[category.type]}
                          onChange={(e) =>
                            setManualExpenseAmountByType((prev) => ({
                              ...prev,
                              [category.type]: e.target.value,
                            }))
                          }
                          className="w-full rounded border px-2 py-1 text-sm"
                          placeholder="Сумма"
                        />
                        <button
                          onClick={() => handleCreateManualExpense(category.type)}
                          className="shrink-0 rounded bg-amber-600 px-3 py-1 text-xs text-white hover:bg-amber-700"
                        >
                          +
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
                                <select
                                  value={item.status}
                                  onChange={(e) =>
                                    handleManualExpenseStatusChange(
                                      item.id,
                                      e.target.value as PavilionExpenseStatus,
                                    )
                                  }
                                  className="rounded border px-1 py-0.5 text-[10px]"
                                >
                                  <option value="UNPAID">Не оплачено</option>
                                  <option value="PAID">Оплачено</option>
                                </select>
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
              <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-[1fr_1fr_180px_auto]">
                <input
                  type="text"
                  value={staffPosition}
                  onChange={(e) => setStaffPosition(e.target.value)}
                  className="rounded-lg border border-gray-300 px-3 py-2"
                  placeholder="Должность"
                />
                <input
                  type="text"
                  value={staffFullName}
                  onChange={(e) => setStaffFullName(e.target.value)}
                  className="rounded-lg border border-gray-300 px-3 py-2"
                  placeholder="Имя фамилия"
                />
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={staffSalary}
                  onChange={(e) => setStaffSalary(e.target.value)}
                  className="rounded-lg border border-gray-300 px-3 py-2"
                  placeholder="Зарплата"
                />
                <button
                  onClick={handleAddStaff}
                  disabled={staffSaving}
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
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={
                                staffSalaryDraftById[staff.id] ??
                                String(staff.salary ?? 0)
                              }
                              onChange={(e) =>
                                setStaffSalaryDraftById((prev) => ({
                                  ...prev,
                                  [staff.id]: e.target.value,
                                }))
                              }
                              className="w-32 rounded border px-2 py-1 text-sm"
                            />
                            {hasPermission(permissions, 'MANAGE_STAFF') && (
                              <button
                                onClick={() => handleUpdateStaffSalary(staff.id)}
                                disabled={
                                  Boolean(staffSalaryUpdatingById[staff.id]) ||
                                  Number(
                                    staffSalaryDraftById[staff.id] ?? staff.salary ?? 0,
                                  ) === Number(staff.salary ?? 0)
                                }
                                className="rounded bg-blue-600 px-2 py-1 text-xs text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                {staffSalaryUpdatingById[staff.id] ? '...' : 'Сохранить'}
                              </button>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm">
                          {hasPermission(permissions, 'MANAGE_STAFF') ? (
                            <select
                              value={staff.salaryStatus ?? 'UNPAID'}
                              onChange={(e) =>
                                handleUpdateStaffSalaryStatus(
                                  staff.id,
                                  e.target.value as 'UNPAID' | 'PAID',
                                )
                              }
                              className="rounded border px-2 py-1 text-xs"
                            >
                              <option value="UNPAID">Не оплачено</option>
                              <option value="PAID">Оплачено</option>
                            </select>
                          ) : staff.salaryStatus === 'PAID' ? (
                            'Оплачено'
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

        {hasPermission(permissions, 'VIEW_PAYMENTS') && analytics && (
          <section
            id="finance-overview"
            data-store-section
            className="scroll-mt-24 grid grid-cols-1 gap-4 lg:grid-cols-3"
          >
            <div className="rounded-xl bg-white p-6 shadow">
              <h3 className="mb-3 text-lg font-semibold">Доходы</h3>
              <div className="text-sm text-gray-700">
                <Link
                  href={`/stores/${storeId}/income-forecast?period=${encodeURIComponent(
                    forecastPeriodParam,
                  )}`}
                  className="text-blue-700 hover:underline"
                >
                  Прогноз: {formatMoney(analytics?.income?.forecast?.total ?? 0, store.currency)}
                </Link>
              </div>
              <div className="text-sm text-gray-700">
                Факт: {formatMoney(analytics?.income?.actual?.total ?? 0, store.currency)}
              </div>
            </div>
            <div className="rounded-xl bg-white p-6 shadow">
              <h3 className="mb-3 text-lg font-semibold">Расходы</h3>
              <div className="text-sm text-gray-700">
                Прогноз: {formatMoney(analytics?.expenses?.total?.forecast ?? 0, store.currency)}
              </div>
              <div className="text-sm text-gray-700">
                Факт: {formatMoney(analytics?.expenses?.total?.actual ?? 0, store.currency)}
              </div>
            </div>
            <div className="rounded-xl bg-white p-6 shadow">
              <h3 className="mb-3 text-lg font-semibold">Прибыль</h3>
              <div className="text-sm text-gray-700">
                Прогноз:{' '}
                {formatMoney(
                  calcProfit(
                    analytics?.income?.forecast?.total,
                    analytics?.expenses?.total?.forecast,
                  ),
                  store.currency,
                )}
              </div>
              <div className="text-sm text-gray-700">
                Факт:{' '}
                {formatMoney(
                  calcProfit(
                    analytics?.income?.actual?.total,
                    analytics?.expenses?.total?.actual,
                  ),
                  store.currency,
                )}
              </div>
            </div>
          </section>
        )}

        {hasPermission(permissions, 'VIEW_PAYMENTS') && (
          <section
            id="accounting"
            data-store-section
            className="scroll-mt-24 rounded-2xl border border-violet-100 bg-white p-6 shadow-sm md:p-8"
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold md:text-2xl">Бух. таблица</h2>
            </div>

            {analytics && (
              <div className="mb-4 rounded-lg bg-blue-50 px-4 py-3 text-sm text-blue-800">
                Остаток с предыдущего месяца:{' '}
                <span className="font-semibold">
                  {formatMoney(
                    analytics?.summaryPage?.income?.previousMonthBalance ?? 0,
                    store.currency,
                  )}
                </span>
              </div>
            )}

            <div className="mb-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-base font-semibold text-slate-900">Сверка по дням</h3>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-600">Дата:</span>
                  <input
                    type="date"
                    value={accountingDate}
                    onChange={(e) => setAccountingDate(e.target.value)}
                    className="rounded-md border border-gray-300 px-2 py-1 text-xs"
                  />
                </div>
              </div>

              {dayReconciliation ? (
                <div className="grid grid-cols-1 gap-2 text-sm md:grid-cols-2">
                  <div className="rounded-lg bg-white p-3">
                    <div className="text-xs text-gray-500">Открытие дня</div>
                    <div className="font-medium">
                      {dayReconciliation.opening
                        ? formatMoney(dayReconciliation.opening.total ?? 0, store.currency)
                        : 'День не открыт'}
                    </div>
                  </div>
                  <div className="rounded-lg bg-white p-3">
                    <div className="text-xs text-gray-500">Операции за день (факт)</div>
                    <div className="font-medium">
                      {formatMoney(dayReconciliation.actual?.total ?? 0, store.currency)}
                    </div>
                  </div>
                  <div className="rounded-lg bg-white p-3">
                    <div className="text-xs text-gray-500">Ожидаемое закрытие</div>
                    <div className="font-medium">
                      {dayReconciliation.expectedClose
                        ? (
                            <Link
                              href={`/stores/${storeId}/accounting-expected-close?date=${encodeURIComponent(accountingDate)}`}
                              className="text-blue-700 hover:underline"
                            >
                              {formatMoney(dayReconciliation.expectedClose.total ?? 0, store.currency)}
                            </Link>
                          )
                        : '-'}
                    </div>
                  </div>
                  <div className="rounded-lg bg-white p-3">
                    <div className="text-xs text-gray-500">Фактическое закрытие</div>
                    <div className="font-medium">
                      {dayReconciliation.closing
                        ? formatMoney(dayReconciliation.closing.total ?? 0, store.currency)
                        : '-'}
                    </div>
                  </div>
                  {dayReconciliation.difference && (
                    <div className="rounded-lg bg-white p-3 md:col-span-2">
                      <div className="text-xs text-gray-500">Схождение при закрытии</div>
                      <div className="mt-2 grid grid-cols-1 gap-2 text-sm md:grid-cols-2">
                        <div className="rounded border border-slate-200 p-2">
                          <div className="text-xs text-gray-500">Безналичные</div>
                          <div
                            className={`font-semibold ${
                              dayReconciliation.difference.bankTransferPaid > 0
                                ? 'text-green-600'
                                : dayReconciliation.difference.bankTransferPaid < 0
                                  ? 'text-red-600'
                                  : 'text-gray-700'
                            }`}
                          >
                            {dayReconciliation.difference.bankTransferPaid > 0 ? '+' : ''}
                            {formatMoney(
                              dayReconciliation.difference.bankTransferPaid ?? 0,
                              store.currency,
                            )}
                          </div>
                        </div>
                        <div className="rounded border border-slate-200 p-2">
                          <div className="text-xs text-gray-500">Наличные касса 1</div>
                          <div
                            className={`font-semibold ${
                              dayReconciliation.difference.cashbox1Paid > 0
                                ? 'text-green-600'
                                : dayReconciliation.difference.cashbox1Paid < 0
                                  ? 'text-red-600'
                                  : 'text-gray-700'
                            }`}
                          >
                            {dayReconciliation.difference.cashbox1Paid > 0 ? '+' : ''}
                            {formatMoney(
                              dayReconciliation.difference.cashbox1Paid ?? 0,
                              store.currency,
                            )}
                          </div>
                        </div>
                        <div className="rounded border border-slate-200 p-2">
                          <div className="text-xs text-gray-500">Наличные касса 2</div>
                          <div
                            className={`font-semibold ${
                              dayReconciliation.difference.cashbox2Paid > 0
                                ? 'text-green-600'
                                : dayReconciliation.difference.cashbox2Paid < 0
                                  ? 'text-red-600'
                                  : 'text-gray-700'
                            }`}
                          >
                            {dayReconciliation.difference.cashbox2Paid > 0 ? '+' : ''}
                            {formatMoney(
                              dayReconciliation.difference.cashbox2Paid ?? 0,
                              store.currency,
                            )}
                          </div>
                        </div>
                        <div className="rounded border border-slate-200 p-2">
                          <div className="text-xs text-gray-500">Итого</div>
                          <div
                            className={`font-semibold ${
                              dayReconciliation.difference.total > 0
                                ? 'text-green-600'
                                : dayReconciliation.difference.total < 0
                                  ? 'text-red-600'
                                  : 'text-gray-700'
                            }`}
                          >
                            {dayReconciliation.difference.total > 0 ? '+' : ''}
                            {formatMoney(dayReconciliation.difference.total ?? 0, store.currency)}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-gray-600">Загрузка сверки...</p>
              )}

              {hasPermission(permissions, 'CREATE_PAYMENTS') && dayReconciliation && (
                <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
                  {!dayReconciliation.isOpened && (
                    <div className="rounded-lg border border-slate-200 bg-white p-3">
                      <p className="mb-2 text-sm font-medium text-slate-800">Открыть день</p>
                      <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={dayOpenBank}
                          onChange={(e) => setDayOpenBank(e.target.value)}
                          className="rounded-lg border border-gray-300 px-3 py-2"
                          placeholder="Безналичные"
                        />
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={dayOpenCash1}
                          onChange={(e) => setDayOpenCash1(e.target.value)}
                          className="rounded-lg border border-gray-300 px-3 py-2"
                          placeholder="Касса 1"
                        />
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={dayOpenCash2}
                          onChange={(e) => setDayOpenCash2(e.target.value)}
                          className="rounded-lg border border-gray-300 px-3 py-2"
                          placeholder="Касса 2"
                        />
                      </div>
                      <button
                        onClick={handleOpenDay}
                        disabled={dayActionSaving}
                        className="mt-3 rounded-lg bg-emerald-600 px-4 py-2 text-sm text-white hover:bg-emerald-700 disabled:opacity-60"
                      >
                        Открыть день
                      </button>
                    </div>
                  )}

                  {dayReconciliation.isOpened && !dayReconciliation.isClosed && (
                    <div className="rounded-lg border border-slate-200 bg-white p-3">
                      <p className="mb-2 text-sm font-medium text-slate-800">Закрыть день</p>
                      <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={dayCloseBank}
                          onChange={(e) => setDayCloseBank(e.target.value)}
                          className="rounded-lg border border-gray-300 px-3 py-2"
                          placeholder="Безналичные"
                        />
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={dayCloseCash1}
                          onChange={(e) => setDayCloseCash1(e.target.value)}
                          className="rounded-lg border border-gray-300 px-3 py-2"
                          placeholder="Касса 1"
                        />
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={dayCloseCash2}
                          onChange={(e) => setDayCloseCash2(e.target.value)}
                          className="rounded-lg border border-gray-300 px-3 py-2"
                          placeholder="Касса 2"
                        />
                      </div>
                      <button
                        onClick={handleCloseDay}
                        disabled={dayActionSaving}
                        className="mt-3 rounded-lg bg-indigo-600 px-4 py-2 text-sm text-white hover:bg-indigo-700 disabled:opacity-60"
                      >
                        Закрыть день
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {accountingDays.length === 0 ? (
              <p className="text-gray-600">Записей пока нет</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Дата</th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Тип записи</th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Безналичные</th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Наличные касса 1</th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Наличные касса 2</th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Итого</th>
                      {hasPermission(permissions, 'EDIT_PAYMENTS') && (
                        <th className="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500">Действия</th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 bg-white">
                    {accountingDays.map((day: any) => (
                      <Fragment key={day.dayKey}>
                        {day.opening && (
                          <tr>
                            <td className="px-4 py-3 text-sm">{new Date(day.dayKey).toLocaleDateString()}</td>
                            <td className="px-4 py-3 text-sm font-medium text-emerald-700">Открытие дня</td>
                            <td className="px-4 py-3 text-sm">{formatMoney(day.opening.bankTransferPaid ?? 0, store.currency)}</td>
                            <td className="px-4 py-3 text-sm">{formatMoney(day.opening.cashbox1Paid ?? 0, store.currency)}</td>
                            <td className="px-4 py-3 text-sm">{formatMoney(day.opening.cashbox2Paid ?? 0, store.currency)}</td>
                            <td className="px-4 py-3 text-sm font-medium">
                              {formatMoney(
                                Number(day.opening.bankTransferPaid ?? 0) +
                                  Number(day.opening.cashbox1Paid ?? 0) +
                                  Number(day.opening.cashbox2Paid ?? 0),
                                store.currency,
                              )}
                            </td>
                            {hasPermission(permissions, 'EDIT_PAYMENTS') && (
                              <td className="px-4 py-3 text-right text-sm">
                                <button
                                  onClick={() => handleDeleteAccountingRecord(day.opening.id)}
                                  className="text-red-600 hover:underline"
                                >
                                  Удалить
                                </button>
                              </td>
                            )}
                          </tr>
                        )}
                        {day.closing && (
                          <tr className="bg-slate-50/40">
                            <td className="px-4 py-3 text-sm">{new Date(day.dayKey).toLocaleDateString()}</td>
                            <td className="px-4 py-3 text-sm font-medium text-indigo-700">Закрытие дня</td>
                            <td className="px-4 py-3 text-sm">{formatMoney(day.closing.bankTransferPaid ?? 0, store.currency)}</td>
                            <td className="px-4 py-3 text-sm">{formatMoney(day.closing.cashbox1Paid ?? 0, store.currency)}</td>
                            <td className="px-4 py-3 text-sm">{formatMoney(day.closing.cashbox2Paid ?? 0, store.currency)}</td>
                            <td className="px-4 py-3 text-sm font-medium">
                              {formatMoney(
                                Number(day.closing.bankTransferPaid ?? 0) +
                                  Number(day.closing.cashbox1Paid ?? 0) +
                                  Number(day.closing.cashbox2Paid ?? 0),
                                store.currency,
                              )}
                            </td>
                            {hasPermission(permissions, 'EDIT_PAYMENTS') && (
                              <td className="px-4 py-3 text-right text-sm">
                                <button
                                  onClick={() => handleDeleteAccountingRecord(day.closing.id)}
                                  className="text-red-600 hover:underline"
                                >
                                  Удалить
                                </button>
                              </td>
                            )}
                          </tr>
                        )}
                      </Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        {hasPermission(permissions, 'VIEW_SUMMARY') && (
          <section
            id="summary"
            data-store-section
            className="scroll-mt-24 rounded-2xl border border-violet-100 bg-white p-6 shadow-sm md:p-8"
          >
            <h2 className="mb-4 text-xl font-semibold md:text-2xl">СВОДКА</h2>
            <p className="mb-4 text-gray-600">
              Основные финансовые показатели магазина на отдельной странице.
            </p>
            <Link
              href={`/stores/${storeId}/summary`}
              className="inline-flex rounded-lg bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-700"
            >
              Открыть СВОДКУ
            </Link>
          </section>
        )}
        </main>
      </div>

      {showCreatePavilionModal && (
        <CreatePavilionModal
          storeId={storeId}
          existingCategories={allCategories}
          onClose={() => setShowCreatePavilionModal(false)}
          onSaved={handlePavilionCreated}
        />
      )}
      {showImportModal && (
        <ImportStoreDataModal
          storeId={storeId}
          onClose={() => setShowImportModal(false)}
          onImported={() => {
            setShowImportModal(false);
            fetchData(false);
          }}
        />
      )}
      <StoreExtraIncomeModal
        storeId={storeId}
        currency={store.currency}
        isOpen={showExtraIncomeModal}
        canCreate={hasPermission(permissions, 'CREATE_PAYMENTS')}
        canDelete={hasPermission(permissions, 'EDIT_PAYMENTS')}
        defaultPaidAtDate={accountingDate}
        onClose={() => setShowExtraIncomeModal(false)}
        onChanged={() => fetchData(false)}
      />
    </div>
  );
}
