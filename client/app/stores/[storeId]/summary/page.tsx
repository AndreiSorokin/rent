'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { formatMoney } from '@/lib/currency';
import { hasPermission } from '@/lib/permissions';
import { calcProfit, calcStoreLevelExpensesTotals, calcSummaryTotalMoney } from '@/lib/finance';

type MetricCardProps = {
  title: string;
  value: string;
  subtitle?: string;
  tone?: 'neutral' | 'success' | 'danger' | 'primary';
};

function MetricCard({ title, value, subtitle, tone = 'neutral' }: MetricCardProps) {
  const toneStyles: Record<NonNullable<MetricCardProps['tone']>, string> = {
    neutral: 'border-gray-200 bg-white',
    success: 'border-emerald-200 bg-emerald-50/60',
    danger: 'border-rose-200 bg-rose-50/60',
    primary: 'border-blue-200 bg-blue-50/60',
  };

  return (
    <div className={`rounded-xl border p-4 ${toneStyles[tone]}`}>
      <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{title}</p>
      <p className="mt-2 text-2xl font-semibold text-gray-900">{value}</p>
      {subtitle ? <p className="mt-1 text-xs text-gray-600">{subtitle}</p> : null}
    </div>
  );
}

type ChannelRowProps = {
  label: string;
  value: number;
  total: number;
  currency: string;
  colorClass: string;
};

function ChannelRow({ label, value, total, currency, colorClass }: ChannelRowProps) {
  const percent = total > 0 ? Math.min(100, Math.max(0, (value / total) * 100)) : 0;

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <span className="text-gray-700">{label}</span>
        <span className="font-medium text-gray-900">{formatMoney(value, currency)}</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
        <div className={`h-full rounded-full ${colorClass}`} style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

type MonthlyTradeAreaPoint = {
  period: string | Date;
  pavilionsTotal: number;
  pavilionsRented: number;
  pavilionsAvailable: number;
  squareTotal: number;
  squareRented: number;
  squareAvailable: number;
};

type MonthlyLineChartProps = {
  title: string;
  items: MonthlyTradeAreaPoint[];
  valueKey: 'pavilionsRented' | 'squareRented';
  totalKey: 'pavilionsTotal' | 'squareTotal';
  valueFormatter?: (value: number) => string;
};

function MonthlyLineChart({
  title,
  items,
  valueKey,
  totalKey,
  valueFormatter = (value: number) => String(value),
}: MonthlyLineChartProps) {
  const [tooltip, setTooltip] = useState<{
    x: number;
    y: number;
    label: string;
    value: string;
    total: string;
  } | null>(null);
  const maxValue = Math.max(
    1,
    ...items.map((item) => Number(item[totalKey] ?? item[valueKey] ?? 0)),
  );
  const chartWidth = 1000;
  const svgHeight = 264;
  const plotTop = 16;
  const plotBottom = 196;
  const plotHeight = plotBottom - plotTop;
  const plotLeft = 70;
  const plotRight = 980;
  const plotWidth = plotRight - plotLeft;
  const step = items.length > 1 ? plotWidth / (items.length - 1) : plotWidth;
  const yTicks = [
    maxValue,
    Math.round(maxValue * 0.75),
    Math.round(maxValue * 0.5),
    Math.round(maxValue * 0.25),
    0,
  ];
  const points = items.map((item, index) => {
    const value = Number(item[valueKey] ?? 0);
    const x = items.length > 1 ? plotLeft + index * step : plotLeft + plotWidth / 2;
    const y = plotBottom - (value / maxValue) * plotHeight;
    return {
      x,
      y,
      value,
      total: Number(item[totalKey] ?? 0),
      period: item.period,
    };
  });
  const polylinePoints = points.map((point) => `${point.x},${point.y}`).join(' ');

  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
      <p className="text-sm font-semibold text-gray-800">{title}</p>
      <div className="relative mt-4 rounded-xl border border-gray-200 bg-white p-3">
        <svg viewBox={`0 0 ${chartWidth} ${svgHeight}`} className="h-[21.5rem] w-full">
          <line x1={plotLeft} y1={plotTop} x2={plotLeft} y2={plotBottom} stroke="#d1d5db" strokeWidth="1" />
          {yTicks.map((tick) => {
            const y = plotBottom - (tick / maxValue) * plotHeight;
            return (
              <g key={`tick-${tick}`}>
                <line
                  x1={plotLeft}
                  y1={y}
                  x2={plotRight}
                  y2={y}
                  stroke={tick === 0 ? '#e5e7eb' : '#f3f4f6'}
                  strokeWidth="1"
                />
                <text
                  x={plotLeft - 1.5}
                  y={y}
                  textAnchor="end"
                  dominantBaseline="middle"
                  fontSize="9"
                  fill="#6b7280"
                >
                  {Math.max(0, tick)}
                </text>
              </g>
            );
          })}

          {points.map((point) => (
            <line
              key={`${String(point.period)}-x-grid`}
              x1={point.x}
              y1={plotTop}
              x2={point.x}
              y2={plotBottom}
              stroke="#f8fafc"
              strokeWidth="1"
            />
          ))}

          <polyline
            fill="none"
            stroke="#2563eb"
            strokeWidth="2.5"
            strokeLinejoin="round"
            strokeLinecap="round"
            points={polylinePoints}
          />

          {points.map((point) => (
            <circle
              key={`${String(point.period)}-dot`}
              cx={point.x}
              cy={point.y}
              r="3.2"
              fill="#1d4ed8"
              className="cursor-pointer"
              onMouseMove={(event) => {
                const bounds = event.currentTarget.ownerSVGElement?.getBoundingClientRect();
                if (!bounds) return;
                setTooltip({
                  x: event.clientX - bounds.left + 12,
                  y: event.clientY - bounds.top + 12,
                  label: new Date(point.period).toLocaleDateString('ru-RU', {
                    month: 'long',
                    year: 'numeric',
                  }),
                  value: valueFormatter(point.value),
                  total: valueFormatter(point.total),
                });
              }}
              onMouseLeave={() => setTooltip(null)}
            />
          ))}

          {points.map((point) => (
            <text
              key={`${String(point.period)}-label`}
              x={point.x}
              y={236}
              textAnchor="middle"
              fontSize="10"
              fill="#6b7280"
            >
              {new Date(point.period).toLocaleDateString('ru-RU', {
                month: 'short',
              })}
            </text>
          ))}
        </svg>
        {tooltip ? (
          <div
            className="pointer-events-none absolute z-20 rounded-lg border border-gray-200 bg-white/95 px-3 py-2 text-xs shadow-lg"
            style={{ left: tooltip.x, top: tooltip.y }}
          >
            <div className="font-semibold text-gray-900">{tooltip.label}</div>
            <div className="text-gray-700">Занято: {tooltip.value}</div>
            <div className="text-gray-500">Из общего: {tooltip.total}</div>
          </div>
        ) : null}
      </div>
      <div className="mt-2 text-xs text-gray-600">
        Текущее значение:{' '}
        <span className="font-medium text-gray-900">
          {valueFormatter(points[points.length - 1]?.value ?? 0)}
        </span>
      </div>
    </div>
  );
}

export default function StoreSummaryPage() {
  const params = useParams();
  const router = useRouter();
  const storeId = Number(params.storeId);

  const [store, setStore] = useState<any>(null);
  const [analytics, setAnalytics] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const storeData = await apiFetch<any>(`/stores/${storeId}`);

        if (!hasPermission(storeData.permissions || [], 'VIEW_SUMMARY')) {
          router.replace(`/stores/${storeId}`);
          return;
        }

        const analyticsData = await apiFetch<any>(`/stores/${storeId}/analytics/summary-view`);
        setStore(storeData);
        setAnalytics(analyticsData);
      } catch (err) {
        console.error(err);
        setError('Не удалось загрузить сводку');
      } finally {
        setLoading(false);
      }
    };

    if (storeId) fetchData();
  }, [router, storeId]);

  const data = useMemo(() => {
    if (!store || !analytics) return null;

    const currency = store.currency;
    const summary = analytics.summaryPage || {};
    const income = summary.income || {};
    const channelsByEntity = income.channelsByEntity || {};
    const expenses = summary.expenses || {};
    const expenseByType = expenses.byType || {};
    const storeLevelExpenses = expenses.storeLevel || {};
    const tradeArea = summary.tradeArea || {};
    const groupedByPavilionGroups = summary.groupedByPavilionGroups || [];

    const storeLevelTotals = calcStoreLevelExpensesTotals(storeLevelExpenses);
    const totalMoney = calcSummaryTotalMoney(income.total, expenses.totals?.actual);
    const saldo = calcProfit(income.total, expenses.totals?.actual);

    return {
      currency,
      income,
      channelsByEntity,
      expenses,
      expenseByType,
      tradeArea,
      groupedByPavilionGroups,
      storeLevelTotals,
      totalMoney,
      saldo,
    };
  }, [store, analytics]);

  if (loading) return <div className="p-6 text-center text-lg">Загрузка...</div>;
  if (error) return <div className="p-6 text-center text-red-600">{error}</div>;
  if (!store || !analytics || !data) return null;

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-gray-100">
      <div className="mx-auto max-w-7xl space-y-6 p-4 md:space-y-8 md:p-8">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <Link href={`/stores/${storeId}`} className="text-sm text-blue-600 hover:underline">
                Назад к объекту
              </Link>
              <h1 className="mt-2 text-3xl font-bold tracking-tight text-gray-900">СВОДКА</h1>
              <p className="mt-1 text-sm text-gray-600">Ключевые финансовые показатели объекта</p>
            </div>
            <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3">
              <p className="text-xs font-medium uppercase tracking-wide text-blue-700">Общая сумма денег</p>
              <p className="mt-1 text-2xl font-semibold text-blue-900">
                {formatMoney(data.totalMoney, data.currency)}
              </p>
            </div>
          </div>
        </section>

        <section className="space-y-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm md:p-6">
          <h2 className="text-xl font-semibold text-gray-900">1. Общий доход</h2>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <MetricCard
              title="Остаток с прошлого месяца"
              value={formatMoney(data.income.previousMonthBalance ?? 0, data.currency)}
              tone="primary"
            />
            <MetricCard
              title="Итого по каналам"
              value={formatMoney(data.income.channels?.total ?? 0, data.currency)}
              subtitle="Безнал + касса 1 + касса 2"
              tone="neutral"
            />
            <MetricCard
              title="Итого доход"
              value={formatMoney(data.income.total ?? 0, data.currency)}
              tone="success"
            />
          </div>

          <div className="grid grid-cols-1 gap-6 rounded-xl border border-gray-200 bg-gray-50 p-4 lg:grid-cols-2">
            <div className="space-y-3">
              <p className="text-sm font-semibold text-gray-800">Распределение по каналам оплаты</p>
              <ChannelRow
                label="Безналичные"
                value={data.income.channels?.bankTransfer ?? 0}
                total={data.income.channels?.total ?? 0}
                currency={data.currency}
                colorClass="bg-blue-500"
              />
              <ChannelRow
                label="Наличные касса 1"
                value={data.income.channels?.cashbox1 ?? 0}
                total={data.income.channels?.total ?? 0}
                currency={data.currency}
                colorClass="bg-emerald-500"
              />
              <ChannelRow
                label="Наличные касса 2"
                value={data.income.channels?.cashbox2 ?? 0}
                total={data.income.channels?.total ?? 0}
                currency={data.currency}
                colorClass="bg-amber-500"
              />
            </div>

            <div>
              <p className="mb-3 text-sm font-semibold text-gray-800">По сущностям</p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="rounded-lg border border-gray-200 bg-white p-3">
                  <p className="text-xs uppercase text-gray-500">Аренда</p>
                  <p className="mt-1 text-lg font-semibold">{formatMoney(data.channelsByEntity.rent?.total ?? 0, data.currency)}</p>
                </div>
                <div className="rounded-lg border border-gray-200 bg-white p-3">
                  <p className="text-xs uppercase text-gray-500">Коммунальные</p>
                  <p className="mt-1 text-lg font-semibold">{formatMoney(data.channelsByEntity.facilities?.total ?? 0, data.currency)}</p>
                </div>
                <div className="rounded-lg border border-gray-200 bg-white p-3">
                  <p className="text-xs uppercase text-gray-500">Реклама</p>
                  <p className="mt-1 text-lg font-semibold">{formatMoney(data.channelsByEntity.advertising?.total ?? 0, data.currency)}</p>
                </div>
                <div className="rounded-lg border border-gray-200 bg-white p-3">
                  <p className="text-xs uppercase text-gray-500">Доп. начисления</p>
                  <p className="mt-1 text-lg font-semibold">{formatMoney(data.channelsByEntity.additional?.total ?? 0, data.currency)}</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="space-y-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm md:p-6">
          <h2 className="text-xl font-semibold text-gray-900">2. Общий расход</h2>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <MetricCard
              title="Расходы уровня объекта (прогноз)"
              value={formatMoney(data.storeLevelTotals.forecast, data.currency)}
            />
            <MetricCard
              title="Расходы уровня объекта (факт)"
              value={formatMoney(data.storeLevelTotals.actual, data.currency)}
            />
          </div>

          <div className="grid grid-cols-1 gap-2 rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm md:grid-cols-2 lg:grid-cols-3">
            <div>Зарплаты: <span className="font-medium">{formatMoney(data.expenseByType.salaries ?? 0, data.currency)}</span></div>
            <div>Налоги с зарплаты: <span className="font-medium">{formatMoney(data.expenseByType.payrollTax ?? 0, data.currency)}</span></div>
            <div>Налог на прибыль: <span className="font-medium">{formatMoney(data.expenseByType.profitTax ?? 0, data.currency)}</span></div>
            <div>Коммуналка объекта: <span className="font-medium">{formatMoney(data.expenseByType.facilities ?? 0, data.currency)}</span></div>
            <div>Дивиденды: <span className="font-medium">{formatMoney(data.expenseByType.dividends ?? 0, data.currency)}</span></div>
            <div>Услуги банка: <span className="font-medium">{formatMoney(data.expenseByType.bankServices ?? 0, data.currency)}</span></div>
            <div>Хоз. расходы: <span className="font-medium">{formatMoney(data.expenseByType.household ?? 0, data.currency)}</span></div>
            <div>НДС: <span className="font-medium">{formatMoney(data.expenseByType.vat ?? 0, data.currency)}</span></div>
            <div>Аренда земли: <span className="font-medium">{formatMoney(data.expenseByType.landRent ?? 0, data.currency)}</span></div>
            <div>Прочие: <span className="font-medium">{formatMoney(data.expenseByType.other ?? 0, data.currency)}</span></div>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <MetricCard
              title="Итого расход (прогноз)"
              value={formatMoney(data.expenses.totals?.forecast ?? 0, data.currency)}
              tone="danger"
            />
            <MetricCard
              title="Итого расход (факт)"
              value={formatMoney(data.expenses.totals?.actual ?? 0, data.currency)}
              tone="danger"
            />
          </div>
        </section>

        <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm md:p-6">
          <h2 className="text-xl font-semibold text-gray-900">3. Сальдо</h2>
          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
            <MetricCard
              title="Общий доход"
              value={formatMoney(data.income.total ?? 0, data.currency)}
              tone="success"
            />
            <MetricCard
              title="Общий расход (факт)"
              value={formatMoney(data.expenses.totals?.actual ?? 0, data.currency)}
              tone="danger"
            />
            <MetricCard
              title="Сальдо"
              value={formatMoney(data.saldo, data.currency)}
              tone={data.saldo >= 0 ? 'success' : 'danger'}
            />
          </div>
        </section>

        <section className="space-y-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm md:p-6">
          <h2 className="text-xl font-semibold text-gray-900">4. Торговая площадь</h2>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <MetricCard title="Павильонов всего" value={String(data.tradeArea.pavilionsTotal ?? 0)} />
            <MetricCard title="Павильонов занято" value={String(data.tradeArea.pavilionsRented ?? 0)} />
            <MetricCard title="Павильонов свободно" value={String(data.tradeArea.pavilionsAvailable ?? 0)} />
          </div>
          <MonthlyLineChart
            title="Динамика занятых павильонов по месяцам"
            items={(data.tradeArea.monthlyTrend ?? []) as MonthlyTradeAreaPoint[]}
            valueKey="pavilionsRented"
            totalKey="pavilionsTotal"
          />

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <MetricCard title="Общая площадь" value={`${data.tradeArea.squareTotal ?? 0} м²`} />
            <MetricCard title="Площадь в аренде" value={`${data.tradeArea.squareRented ?? 0} м²`} />
            <MetricCard title="Свободная площадь" value={`${data.tradeArea.squareAvailable ?? 0} м²`} />
          </div>
          <MonthlyLineChart
            title="Динамика занятой площади по месяцам"
            items={(data.tradeArea.monthlyTrend ?? []) as MonthlyTradeAreaPoint[]}
            valueKey="squareRented"
            totalKey="squareTotal"
            valueFormatter={(value) => `${Math.round(value)} м²`}
          />
        </section>

        <section className="space-y-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm md:p-6">
          <h2 className="text-xl font-semibold text-gray-900">5. Группы павильонов</h2>

          {data.groupedByPavilionGroups.length === 0 ? (
            <p className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-4 text-gray-600">Группы не созданы</p>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {data.groupedByPavilionGroups.map((group: any) => (
                <div key={group.groupId} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-gray-900">{group.name}</h3>
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                      {group.pavilionsTotal} пав.
                    </span>
                  </div>

                  <div className="space-y-1 text-sm text-gray-700">
                    <div>Занято/предоплата: <span className="font-medium">{group.pavilionsRentedOrPrepaid}</span></div>
                    <div>Площадь: <span className="font-medium">{group.squareTotal} м²</span></div>
                  </div>

                  <div className="mt-3 border-t border-gray-100 pt-3 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">Прогнозный доход</span>
                      <span className="font-medium">{formatMoney(group.forecastIncome ?? 0, data.currency)}</span>
                    </div>
                    <div className="mt-1 flex items-center justify-between">
                      <span className="text-gray-600">Фактический доход</span>
                      <span className="font-medium">{formatMoney(group.actualIncome ?? 0, data.currency)}</span>
                    </div>
                    <div className="mt-2 flex items-center justify-between border-t border-gray-100 pt-2">
                      <span className="text-gray-700">Схождение</span>
                      <span className={`font-semibold ${(group.delta ?? 0) >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {formatMoney(group.delta ?? 0, data.currency)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
