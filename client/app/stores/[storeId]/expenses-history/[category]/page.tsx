'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { FullScreenLoader } from '@/components/AppLoader';
import { apiFetch } from '@/lib/api';
import { formatMoney } from '@/lib/currency';
import {
  formatDateInTimeZone,
  getCurrentMonthKeyInTimeZone,
  getMonthKeyInTimeZone,
} from '@/lib/dateTime';
import { getHouseholdExpenses, type HouseholdExpense } from '@/lib/householdExpenses';
import {
  listPavilionExpenses,
  type PavilionExpense,
  type PavilionExpenseType,
} from '@/lib/pavilionExpenses';
import { hasPermission } from '@/lib/permissions';
import type { Permission } from '@/types/store';
import { StoreSidebar } from '../../components/StoreSidebar';

type HistoryCategory = 'household' | 'other' | 'admin' | 'staff';

type HistoryItem = {
  id: string;
  createdAt: string;
  amount: number;
  status: string;
  title: string;
  subtitle?: string;
  bankTransferPaid: number;
  cashbox1Paid: number;
  cashbox2Paid: number;
};

type StaffExpenseHistoryItem = PavilionExpense & {
  staffId?: number | null;
  staffName?: string | null;
};

const ADMIN_TYPES: PavilionExpenseType[] = [
  'PAYROLL_TAX',
  'PROFIT_TAX',
  'VAT',
  'BANK_SERVICES',
  'DIVIDENDS',
  'LAND_RENT',
  'STORE_FACILITIES',
];

const CATEGORY_META: Record<
  HistoryCategory,
  {
    title: string;
    permission: Permission;
  }
> = {
  household: {
    title: 'Хоз расходы за предыдущие месяцы',
    permission: 'VIEW_CHARGES',
  },
  other: {
    title: 'Прочие расходы за предыдущие месяцы',
    permission: 'VIEW_CHARGES',
  },
  admin: {
    title: 'Административные расходы за предыдущие месяцы',
    permission: 'VIEW_CHARGES',
  },
  staff: {
    title: 'Расходы по штату за предыдущие месяцы',
    permission: 'VIEW_STAFF',
  },
};

function isHistoryCategory(value: string): value is HistoryCategory {
  return value === 'household' || value === 'other' || value === 'admin' || value === 'staff';
}

function formatMonthLabel(monthKey: string) {
  const match = /^(\d{4})-(\d{2})$/.exec(monthKey);
  if (!match) return monthKey;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, 1);
  return date.toLocaleDateString('ru-RU', {
    month: 'long',
    year: 'numeric',
  });
}

function paymentChannelsLines(
  bankTransferPaid: number,
  cashbox1Paid: number,
  cashbox2Paid: number,
  currency: 'RUB' | 'KZT',
) {
  const lines: string[] = [];
  if (bankTransferPaid > 0) {
    lines.push(`Безналичные: ${formatMoney(bankTransferPaid, currency)}`);
  }
  if (cashbox1Paid > 0) {
    lines.push(`Наличные касса 1: ${formatMoney(cashbox1Paid, currency)}`);
  }
  if (cashbox2Paid > 0) {
    lines.push(`Наличные касса 2: ${formatMoney(cashbox2Paid, currency)}`);
  }
  return lines;
}

function getAdminTypeLabel(type: PavilionExpenseType) {
  switch (type) {
    case 'PAYROLL_TAX':
      return 'Налоги с зарплаты';
    case 'PROFIT_TAX':
      return 'Налог на прибыль';
    case 'VAT':
      return 'НДС';
    case 'BANK_SERVICES':
      return 'Услуги банка';
    case 'DIVIDENDS':
      return 'Дивиденды';
    case 'LAND_RENT':
      return 'Аренда земли';
    case 'STORE_FACILITIES':
      return 'Коммуналка объекта';
    default:
      return 'Административный расход';
  }
}

function getStaffTitle(note: string | null | undefined) {
  const raw = String(note ?? '').trim();
  const match = /^STAFF:(\d+):(.*)$/.exec(raw);
  if (!match) return raw || 'Расход по штату';
  const tail = String(match[2] ?? '').trim();
  if (tail && !/^\d{4}-\d{2}-\d{2}T/.test(tail)) {
    return tail;
  }
  return `Сотрудник #${match[1]}`;
}

export default function StoreExpenseHistoryPage() {
  const params = useParams();
  const router = useRouter();
  const storeId = Number(params.storeId);
  const categoryParam = String(params.category ?? '');

  const [store, setStore] = useState<any>(null);
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const category = isHistoryCategory(categoryParam) ? categoryParam : null;
  const meta = category ? CATEGORY_META[category] : null;

  useEffect(() => {
    if (!storeId || !category || !meta) return;

    const fetchData = async () => {
      setLoading(true);
      try {
        const storeData = await apiFetch<any>(`/stores/${storeId}`);
        if (!hasPermission(storeData.permissions || [], meta.permission)) {
          router.replace(`/stores/${storeId}`);
          return;
        }

        let nextItems: HistoryItem[] = [];

        if (category === 'household') {
          const householdItems = await getHouseholdExpenses(storeId);
          nextItems = (householdItems || []).map((item: HouseholdExpense) => ({
            id: `household-${item.id}`,
            createdAt: item.createdAt,
            amount: Number(item.amount ?? 0),
            status: String(item.status ?? 'UNPAID'),
            title: String(item.name ?? 'Хозяйственный расход'),
            bankTransferPaid: Number(item.bankTransferPaid ?? 0),
            cashbox1Paid: Number(item.cashbox1Paid ?? 0),
            cashbox2Paid: Number(item.cashbox2Paid ?? 0),
          }));
        } else if (category === 'staff') {
          const expenseItems = await apiFetch<StaffExpenseHistoryItem[]>(
            `/stores/${storeId}/staff/expense-history`,
          );
          nextItems = (expenseItems || []).map((item) => ({
            id: `expense-${item.id}`,
            createdAt: item.createdAt,
            amount: Number(item.amount ?? 0),
            status: String(item.status ?? 'UNPAID'),
            title: String(item.staffName ?? getStaffTitle(item.note)),
            bankTransferPaid: Number(item.bankTransferPaid ?? 0),
            cashbox1Paid: Number(item.cashbox1Paid ?? 0),
            cashbox2Paid: Number(item.cashbox2Paid ?? 0),
          }));
        } else {
          const expenseItems = await listPavilionExpenses(storeId);
          nextItems = (expenseItems || [])
            .filter((item: PavilionExpense) => {
              if (category === 'other') return item.type === 'OTHER';
              if (category === 'admin') return ADMIN_TYPES.includes(item.type);
              return false;
            })
            .map((item: PavilionExpense) => ({
              id: `expense-${item.id}`,
              createdAt: item.createdAt,
              amount: Number(item.amount ?? 0),
              status: String(item.status ?? 'UNPAID'),
              title:
                category === 'admin'
                  ? getAdminTypeLabel(item.type)
                  : String(item.note ?? 'Прочий расход'),
              subtitle:
                category === 'admin'
                  ? String(item.note ?? '').trim() || undefined
                  : undefined,
              bankTransferPaid: Number(item.bankTransferPaid ?? 0),
              cashbox1Paid: Number(item.cashbox1Paid ?? 0),
              cashbox2Paid: Number(item.cashbox2Paid ?? 0),
            }));
        }

        setStore(storeData);
        setItems(nextItems);
        setError(null);
      } catch (err) {
        console.error(err);
        setError('Не удалось загрузить историю расходов');
      } finally {
        setLoading(false);
      }
    };

    void fetchData();
  }, [category, meta, router, storeId]);

  const groupedHistory = useMemo(() => {
    const timeZone = store?.timeZone || 'UTC';
    const currentMonthKey = getCurrentMonthKeyInTimeZone(timeZone);
    const filtered = items
      .filter((item) => getMonthKeyInTimeZone(item.createdAt, timeZone) !== currentMonthKey)
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );

    const groups = new Map<string, HistoryItem[]>();
    for (const item of filtered) {
      const monthKey = getMonthKeyInTimeZone(item.createdAt, timeZone);
      const list = groups.get(monthKey) ?? [];
      list.push(item);
      groups.set(monthKey, list);
    }

    return Array.from(groups.entries()).map(([monthKey, monthItems]) => ({
      monthKey,
      monthLabel: formatMonthLabel(monthKey),
      total: monthItems.reduce((sum, item) => sum + Number(item.amount ?? 0), 0),
      items: monthItems,
    }));
  }, [items, store?.timeZone]);

  if (!category || !meta) {
    return <div className="p-6 text-center text-red-600">Категория не найдена</div>;
  }

  if (loading) return <FullScreenLoader label="Загружаем историю расходов..." />;
  if (error) return <div className="p-6 text-center text-red-600">{error}</div>;
  if (!store) return null;

  const currency: 'RUB' | 'KZT' = store?.currency ?? 'RUB';

  return (
    <div className="min-h-screen bg-[#f6f1eb]">
      <div className="mx-auto flex max-w-[1600px] gap-6 px-3 py-1 md:px-6 md:py-6">
        <StoreSidebar
          storeId={storeId}
          store={store}
          active={
            category === 'household'
              ? 'household'
              : category === 'other'
                ? 'other-expenses'
                : category === 'admin'
                  ? 'admin-expenses'
                  : 'staff'
          }
        />
        <main className="min-w-0 flex-1 pt-12 md:pt-0">
          <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-2">
            <section className="rounded-2xl border border-[#d8d1cb] bg-white p-6 shadow-[0_12px_36px_-20px_rgba(17,17,17,0.2)] md:p-8">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h1 className="text-xl font-semibold text-[#111111] md:text-2xl">
                    {meta.title}
                  </h1>
                </div>
                <Link
                  href={
                    category === 'household'
                      ? `/stores/${storeId}/household`
                      : category === 'other'
                        ? `/stores/${storeId}/other-expenses`
                        : category === 'admin'
                          ? `/stores/${storeId}/admin-expenses`
                          : `/stores/${storeId}/staff`
                  }
                  className="rounded-lg border border-[#d8d1cb] bg-white px-3 py-2 text-sm font-medium text-[#111111] hover:bg-[#f4efeb]"
                >
                  Назад
                </Link>
              </div>

              {groupedHistory.length === 0 ? (
                <p className="text-[#6b6b6b]">За предыдущие месяцы записей пока нет</p>
              ) : (
                <div className="space-y-6">
                  {groupedHistory.map((group) => (
                    <section
                      key={group.monthKey}
                      className="rounded-2xl border border-[#E5DED8] bg-[#FCFAF8] p-4"
                    >
                      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <h2 className="text-lg font-semibold capitalize text-[#111111]">
                            {group.monthLabel}
                          </h2>
                        </div>
                        <div className="rounded-xl border border-[#E5DED8] bg-white px-4 py-2">
                          <p className="text-xs font-medium uppercase tracking-wide text-[#6B6B6B]">
                            Общая сумма
                          </p>
                          <p className="mt-1 text-lg font-semibold text-[#111111]">
                            {formatMoney(group.total, currency)}
                          </p>
                        </div>
                      </div>

                      <div className="space-y-3">
                        {group.items.map((item) => {
                          const paymentLines = paymentChannelsLines(
                            item.bankTransferPaid,
                            item.cashbox1Paid,
                            item.cashbox2Paid,
                            currency,
                          );

                          return (
                            <article
                              key={item.id}
                              className="rounded-xl border border-[#E5DED8] bg-white p-4"
                            >
                              <div className="flex flex-wrap items-start justify-between gap-3">
                                <div className="min-w-0 flex-1">
                                  <p className="text-sm font-semibold text-[#111111]">
                                    {item.title}
                                  </p>
                                  {item.subtitle ? (
                                    <p className="mt-1 text-sm text-[#6B6B6B]">{item.subtitle}</p>
                                  ) : null}
                                  <p className="mt-1 text-xs text-[#6B6B6B]">
                                    {formatDateInTimeZone(
                                      item.createdAt,
                                      store?.timeZone || 'UTC',
                                      'ru-RU',
                                      {
                                        day: '2-digit',
                                        month: '2-digit',
                                        year: 'numeric',
                                        hour: '2-digit',
                                        minute: '2-digit',
                                      },
                                    )}
                                  </p>
                                </div>
                                <div className="text-right">
                                  <p className="text-sm font-bold text-[#111111]">
                                    {formatMoney(item.amount, currency)}
                                  </p>
                                  <span
                                    className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                                      item.status === 'PAID'
                                        ? 'bg-emerald-100 text-emerald-700'
                                        : 'bg-amber-100 text-amber-700'
                                    }`}
                                  >
                                    {item.status === 'PAID' ? 'Оплачено' : 'Не оплачено'}
                                  </span>
                                </div>
                              </div>

                              <div className="mt-3 text-xs text-slate-600">
                                {paymentLines.length ? (
                                  paymentLines.map((line) => <div key={`${item.id}-${line}`}>{line}</div>)
                                ) : (
                                  <div>Каналы оплаты не заданы</div>
                                )}
                              </div>
                            </article>
                          );
                        })}
                      </div>
                    </section>
                  ))}
                </div>
              )}
            </section>
          </div>
        </main>
      </div>
    </div>
  );
}
