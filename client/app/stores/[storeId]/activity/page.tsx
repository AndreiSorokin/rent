'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, usePathname, useRouter, useSearchParams } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { hasPermission } from '@/lib/permissions';

type ActivityItem = {
  id: number;
  action: string;
  entityType: string;
  entityId: number | null;
  details?: Record<string, unknown> | null;
  createdAt: string;
  pavilion?: { id: number; number: string } | null;
  user?: { id: number; name: string | null; email: string } | null;
};

type ActivityResponse = {
  items: ActivityItem[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

const ACTION_LABELS: Record<string, string> = {
  CREATE: 'Добавление',
  UPDATE: 'Изменение',
  DELETE: 'Удаление',
  OPEN: 'Открытие',
  CLOSE: 'Закрытие',
  IMPORT: 'Импорт',
};

const ACTION_STYLES: Record<string, string> = {
  CREATE: 'bg-emerald-50 text-emerald-700 border border-emerald-100',
  UPDATE: 'bg-amber-50 text-amber-700 border border-amber-100',
  DELETE: 'bg-rose-50 text-rose-700 border border-rose-100',
  OPEN: 'bg-sky-50 text-sky-700 border border-sky-100',
  CLOSE: 'bg-slate-100 text-slate-700 border border-slate-200',
  IMPORT: 'bg-indigo-50 text-indigo-700 border border-indigo-100',
};

const ENTITY_LABELS: Record<string, string> = {
  PAVILION: 'Павильон',
  STAFF: 'Штатное расписание',
  HOUSEHOLD_EXPENSE: 'Хозяйственные расходы',
  PAVILION_EXPENSE: 'Расходы',
  STORE_EXTRA_INCOME: 'Доп. приход объекта',
  ACCOUNTING_RECORD: 'Бух. запись',
  ACCOUNTING_DAY: 'Сверка дня',
  ADDITIONAL_CHARGE: 'Доп. начисление',
  ADDITIONAL_CHARGE_PAYMENT: 'Оплата доп. начисления',
  PAYMENT_TRANSACTION: 'Платеж',
  CONTRACT: 'Договор',
  DISCOUNT: 'Скидка',
  PAVILION_IMPORT: 'Выгрузка павильонов',
  STORE_USER_INVITE: 'Приглашение пользователя',
  STORE_USER_PERMISSIONS: 'Права пользователя',
};

const STATUS_LABELS: Record<string, string> = {
  PAID: 'Оплачено',
  UNPAID: 'Не оплачено',
  AVAILABLE: 'Свободен',
  RENTED: 'Занят',
  PREPAID: 'Предоплата',
};

const DETAIL_LABELS: Record<string, string> = {
  name: 'Название',
  note: 'Примечание',
  number: 'Номер',
  category: 'Категория',
  pavilionNumber: 'Павильон',
  position: 'Должность',
  fullName: 'Сотрудник',
  tenantName: 'Арендатор',
  status: 'Статус',
  salaryStatus: 'Статус оплаты',
  amount: 'Сумма',
  salary: 'Зарплата',
  amountPaid: 'Оплачено',
  rentPaid: 'Аренда (оплачено)',
  utilitiesPaid: 'Коммунальные (оплачено)',
  advertisingPaid: 'Реклама (оплачено)',
  squareMeters: 'Площадь',
  pricePerSqM: 'Цена за м2',
  rentAmount: 'Аренда',
  utilitiesAmount: 'Коммунальные',
  advertisingAmount: 'Реклама',
  prepaidUntil: 'Предоплата до',
  startsAt: 'Дата начала',
  endsAt: 'Дата окончания',
  bankTransferPaid: 'Безналичные',
  cashbox1Paid: 'Наличные касса 1',
  cashbox2Paid: 'Наличные касса 2',
  rentBankTransferPaid: 'Аренда: безналичные',
  rentCashbox1Paid: 'Аренда: наличные касса 1',
  rentCashbox2Paid: 'Аренда: наличные касса 2',
  utilitiesBankTransferPaid: 'Коммунальные: безналичные',
  utilitiesCashbox1Paid: 'Коммунальные: наличные касса 1',
  utilitiesCashbox2Paid: 'Коммунальные: наличные касса 2',
  advertisingBankTransferPaid: 'Реклама: безналичные',
  advertisingCashbox1Paid: 'Реклама: наличные касса 1',
  advertisingCashbox2Paid: 'Реклама: наличные касса 2',
  salaryBankTransferPaid: 'Безналичные',
  salaryCashbox1Paid: 'Наличные касса 1',
  salaryCashbox2Paid: 'Наличные касса 2',
  recordDate: 'Дата',
  date: 'Дата',
  diffBank: 'Расхождение безнал',
  diffCash1: 'Расхождение касса 1',
  diffCash2: 'Расхождение касса 2',
  fileName: 'Файл',
  fileType: 'Тип файла',
  invitedUserId: 'ID пользователя',
  invitedUserEmail: 'Email пользователя',
  invitedUserName: 'Имя пользователя',
  targetUserId: 'ID пользователя',
  targetUserEmail: 'Email пользователя',
  targetUserName: 'Имя пользователя',
  permissions: 'Права',
};

const DETAIL_ORDER = [
  'number',
  'status',
  'prepaidUntil',
  'startsAt',
  'endsAt',
  'tenantName',
  'category',
  'squareMeters',
  'pricePerSqM',
  'rentAmount',
  'utilitiesAmount',
  'advertisingAmount',
  'name',
  'note',
  'position',
  'fullName',
  'salaryStatus',
  'amount',
  'salary',
  'amountPaid',
  'rentPaid',
  'utilitiesPaid',
  'advertisingPaid',
  'bankTransferPaid',
  'cashbox1Paid',
  'cashbox2Paid',
  'rentBankTransferPaid',
  'rentCashbox1Paid',
  'rentCashbox2Paid',
  'utilitiesBankTransferPaid',
  'utilitiesCashbox1Paid',
  'utilitiesCashbox2Paid',
  'advertisingBankTransferPaid',
  'advertisingCashbox1Paid',
  'advertisingCashbox2Paid',
  'salaryBankTransferPaid',
  'salaryCashbox1Paid',
  'salaryCashbox2Paid',
  'recordDate',
  'date',
  'diffBank',
  'diffCash1',
  'diffCash2',
  'fileName',
  'fileType',
  'invitedUserId',
  'invitedUserEmail',
  'invitedUserName',
  'targetUserId',
  'targetUserEmail',
  'targetUserName',
  'permissions',
];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const formatAmount = (value: unknown) => {
  const num = Number(value ?? 0);
  if (!Number.isFinite(num)) return String(value ?? '-');
  return `${num.toLocaleString('ru-RU', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })} ₽`;
};

const formatUtcDateTime = (value: unknown) => {
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return String(value ?? '-');
  const dd = String(date.getUTCDate()).padStart(2, '0');
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
  const yyyy = date.getUTCFullYear();
  const hh = String(date.getUTCHours()).padStart(2, '0');
  const min = String(date.getUTCMinutes()).padStart(2, '0');
  return `${dd}.${mm}.${yyyy} ${hh}:${min} UTC`;
};

const formatDetailValue = (key: string, value: unknown) => {
  if (value === null || value === undefined || value === '') return '-';
  if (Array.isArray(value)) return value.join(', ');

  if (key.toLowerCase().includes('status')) {
    return STATUS_LABELS[String(value)] ?? String(value);
  }

  if (
    key.toLowerCase().includes('date') ||
    key.toLowerCase().includes('until') ||
    key === 'startsAt' ||
    key === 'endsAt'
  ) {
    return formatUtcDateTime(value);
  }

  if (
    key.toLowerCase().includes('amount') ||
    key.toLowerCase().includes('salary') ||
    key.toLowerCase().includes('paid') ||
    key.toLowerCase().includes('cashbox') ||
    key.toLowerCase().includes('banktransfer') ||
    key.toLowerCase().includes('price')
  ) {
    return formatAmount(value);
  }

  return String(value);
};

const renderDiffDetails = (
  before: Record<string, unknown>,
  after: Record<string, unknown>,
) => {
  const changedKeys = new Set([...Object.keys(before), ...Object.keys(after)]);
  const ordered = [
    ...DETAIL_ORDER.filter((key) => changedKeys.has(key) && key !== 'type'),
    ...Array.from(changedKeys).filter(
      (key) => !DETAIL_ORDER.includes(key) && key !== 'type',
    ),
  ];

  return ordered.map((key) => {
    const label = DETAIL_LABELS[key] ?? key;
    const beforeValue = formatDetailValue(key, before[key]);
    const afterValue = formatDetailValue(key, after[key]);
    return `${label}: ${beforeValue} -> ${afterValue}`;
  });
};

const renderDetails = (details?: Record<string, unknown> | null) => {
  if (!details) return ['-'];

  const before = isRecord(details.before) ? details.before : null;
  const after = isRecord(details.after) ? details.after : null;
  if (before && after) {
    return renderDiffDetails(before, after);
  }

  const keys = [
    ...DETAIL_ORDER.filter((key) => key in details && key !== 'type'),
    ...Object.keys(details).filter(
      (key) =>
        !DETAIL_ORDER.includes(key) &&
        key !== 'type' &&
        key !== 'before' &&
        key !== 'after' &&
        key !== 'changedFields',
    ),
  ];

  return keys.map((key) => {
    const label = DETAIL_LABELS[key] ?? key;
    const value = formatDetailValue(key, details[key]);
    return `${label}: ${value}`;
  });
};

export default function StoreActivityPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const storeId = Number(params.storeId);

  const currentPage = Math.max(1, Number(searchParams.get('page') ?? 1));
  const queryDate = searchParams.get('date') ?? '';
  const queryPavilion = searchParams.get('pavilion') ?? '';
  const queryAction = searchParams.get('action') ?? '';
  const queryEntityType = searchParams.get('entityType') ?? '';

  const [filterDate, setFilterDate] = useState(queryDate);
  const [filterPavilion, setFilterPavilion] = useState(queryPavilion);
  const [filterAction, setFilterAction] = useState(queryAction);
  const [filterEntityType, setFilterEntityType] = useState(queryEntityType);
  const [store, setStore] = useState<any>(null);
  const [data, setData] = useState<ActivityResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [isFetching, setIsFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setFilterDate(queryDate);
    setFilterPavilion(queryPavilion);
    setFilterAction(queryAction);
    setFilterEntityType(queryEntityType);
  }, [queryDate, queryPavilion, queryAction, queryEntityType]);

  const applyFiltersToUrl = (
    nextDate: string,
    nextPavilion: string,
    nextAction: string,
    nextEntityType: string,
  ) => {
    const next = new URLSearchParams();
    if (nextDate) next.set('date', nextDate);
    if (nextPavilion.trim()) next.set('pavilion', nextPavilion.trim());
    if (nextAction) next.set('action', nextAction);
    if (nextEntityType) next.set('entityType', nextEntityType);

    const current = new URLSearchParams(searchParams.toString());
    current.delete('page');

    if (current.toString() === next.toString()) return;
    router.replace(next.toString() ? `${pathname}?${next.toString()}` : pathname);
  };

  const permissions: string[] = useMemo(
    () => (Array.isArray(store?.permissions) ? store.permissions : []),
    [store],
  );

  const buildQueryString = (page: number) => {
    const query = new URLSearchParams();
    if (page > 1) query.set('page', String(page));
    if (queryDate) query.set('date', queryDate);
    if (queryPavilion) query.set('pavilion', queryPavilion);
    if (queryAction) query.set('action', queryAction);
    if (queryEntityType) query.set('entityType', queryEntityType);
    return query.toString();
  };

  const getPavilionLabel = (item: ActivityItem) => {
    if (item.pavilion?.number) return item.pavilion.number;
    if (isRecord(item.details) && typeof item.details.pavilionNumber === 'string') {
      const value = item.details.pavilionNumber.trim();
      if (value.length > 0) return value;
    }
    return '-';
  };

  const getEntityLabel = (item: ActivityItem) => {
    if (item.entityType === 'PAVILION_EXPENSE') {
      const details = isRecord(item.details) ? item.details : null;
      const directType = typeof details?.type === 'string' ? details.type : null;
      const beforeType =
        isRecord(details?.before) && typeof details.before.type === 'string'
          ? (details.before.type as string)
          : null;
      const afterType =
        isRecord(details?.after) && typeof details.after.type === 'string'
          ? (details.after.type as string)
          : null;
      const expenseType = directType ?? afterType ?? beforeType;
      return expenseType === 'OTHER' ? 'Прочие расходы' : 'Административные расходы';
    }
    return ENTITY_LABELS[item.entityType] || item.entityType;
  };

  const resetFilters = () => {
    router.replace(pathname);
  };

  useEffect(() => {
    const timeout = setTimeout(() => {
      if (filterPavilion.trim() === queryPavilion.trim()) return;
      applyFiltersToUrl(filterDate, filterPavilion, filterAction, filterEntityType);
    }, 350);
    return () => clearTimeout(timeout);
  }, [
    filterPavilion,
    queryPavilion,
    filterDate,
    filterAction,
    filterEntityType,
  ]);

  useEffect(() => {
    const load = async () => {
      if (!Number.isFinite(storeId) || storeId <= 0) return;
      const isFirstLoad = store === null;
      if (isFirstLoad) {
        setLoading(true);
      } else {
        setIsFetching(true);
      }
      setError(null);
      try {
        const query = buildQueryString(currentPage);
        const [storeData, activityData] = await Promise.all([
          apiFetch<any>(`/stores/${storeId}?lite=1`),
          apiFetch<ActivityResponse>(
            `/stores/${storeId}/activity?${query}&pageSize=30`,
          ),
        ]);
        setStore(storeData);
        setData(activityData);
      } catch (e: unknown) {
        setError(
          e instanceof Error ? e.message : 'Не удалось загрузить журнал действий',
        );
      } finally {
        if (isFirstLoad) {
          setLoading(false);
        }
        setIsFetching(false);
      }
    };
    void load();
  }, [storeId, currentPage, queryDate, queryPavilion, queryAction, queryEntityType]);

  if (loading) {
    return <div className="p-6 text-sm text-slate-600">Загрузка журнала действий...</div>;
  }

  if (error) {
    return <div className="p-6 text-sm text-red-600">{error}</div>;
  }

  if (!store || !hasPermission(permissions, 'VIEW_ACTIVITY')) {
    return <div className="p-6 text-sm text-red-600">Нет доступа к журналу действий</div>;
  }

  return (
    <div className="min-h-screen bg-slate-100 p-4 md:p-6">
      <div className="mx-auto max-w-6xl space-y-4">
        <div className="space-y-3">
          <Link
            href={`/stores/${storeId}`}
            className="inline-flex items-center justify-center rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            Назад к объекту
          </Link>
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="flex items-center justify-between gap-3">
              <h1 className="text-xl font-semibold text-slate-900">Журнал действий</h1>
              {isFetching && (
                <span className="text-xs font-medium text-slate-500">Обновление...</span>
              )}
            </div>
            <p className="text-sm text-slate-600">{store.name}</p>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <label className="space-y-1">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Дата
              </span>
              <input
                type="date"
                value={filterDate}
                onChange={(e) => {
                  const value = e.target.value;
                  setFilterDate(value);
                  applyFiltersToUrl(value, filterPavilion, filterAction, filterEntityType);
                }}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-violet-500"
              />
            </label>
            <label className="space-y-1">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Павильон
              </span>
              <input
                type="text"
                value={filterPavilion}
                onChange={(e) => setFilterPavilion(e.target.value)}
                placeholder="Номер павильона"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-violet-500"
              />
            </label>
            <label className="space-y-1">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Действие
              </span>
              <select
                value={filterAction}
                onChange={(e) => {
                  const value = e.target.value;
                  setFilterAction(value);
                  applyFiltersToUrl(filterDate, filterPavilion, value, filterEntityType);
                }}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-violet-500"
              >
                <option value="">Все</option>
                {Object.entries(ACTION_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Сущность
              </span>
              <select
                value={filterEntityType}
                onChange={(e) => {
                  const value = e.target.value;
                  setFilterEntityType(value);
                  applyFiltersToUrl(filterDate, filterPavilion, filterAction, value);
                }}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-violet-500"
              >
                <option value="">Все</option>
                {Object.entries(ENTITY_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={resetFilters}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
            >
              Сбросить
            </button>
          </div>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Когда</th>
                <th className="px-4 py-3">Пользователь</th>
                <th className="px-4 py-3">Павильон</th>
                <th className="px-4 py-3">Действие</th>
                <th className="px-4 py-3">Сущность</th>
                <th className="px-4 py-3">Детали</th>
              </tr>
            </thead>
            <tbody>
              {data?.items?.length ? (
                data.items.map((item) => (
                  <tr key={item.id} className="border-t border-slate-100">
                    <td className="px-4 py-3 text-slate-700">
                      {new Date(item.createdAt).toLocaleString('ru-RU')}
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {item.user?.email || 'Система'}
                    </td>
                    <td className="px-4 py-3 text-slate-700">{getPavilionLabel(item)}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${ACTION_STYLES[item.action] ?? 'bg-slate-100 text-slate-700 border border-slate-200'}`}
                      >
                        {ACTION_LABELS[item.action] || item.action}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-700">{getEntityLabel(item)}</td>
                    <td className="max-w-[460px] px-4 py-3 text-xs text-slate-600">
                      <div className="space-y-0.5">
                        {renderDetails(item.details).map((line, idx) => (
                          <div key={`${item.id}-line-${idx}`}>{line}</div>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="px-4 py-6 text-sm text-slate-500" colSpan={6}>
                    Пока нет записей
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {data && data.totalPages > 1 && (
          <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm">
            <span className="text-slate-600">
              Страница {data.page} из {data.totalPages}
            </span>
            <div className="flex gap-2">
              <Link
                href={`${pathname}?${buildQueryString(Math.max(1, data.page - 1))}`}
                className={`rounded-lg border px-3 py-1.5 ${
                  data.page <= 1
                    ? 'pointer-events-none border-slate-200 text-slate-400'
                    : 'border-slate-300 text-slate-700 hover:bg-slate-50'
                }`}
              >
                Назад
              </Link>
              <Link
                href={`${pathname}?${buildQueryString(
                  Math.min(data.totalPages, data.page + 1),
                )}`}
                className={`rounded-lg border px-3 py-1.5 ${
                  data.page >= data.totalPages
                    ? 'pointer-events-none border-slate-200 text-slate-400'
                    : 'border-slate-300 text-slate-700 hover:bg-slate-50'
                }`}
              >
                Далее
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
