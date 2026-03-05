'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { formatMoney } from '@/lib/currency';
import { hasPermission } from '@/lib/permissions';
import { calcProfit, calcStoreLevelExpensesTotals, calcSummaryTotalMoney } from '@/lib/finance';

function getCurrentMonthValue() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

type MetricCardProps = {
  title: string;
  value: string;
  subtitle?: string;
  tone?: 'neutral' | 'success' | 'danger' | 'primary';
};

function MetricCard({ title, value, subtitle, tone = 'neutral' }: MetricCardProps) {
  const toneStyles: Record<NonNullable<MetricCardProps['tone']>, string> = {
    neutral: 'border-[#d8d1cb] bg-white',
    success: 'border-[#22c55e]/30 bg-[#22c55e]/10',
    danger: 'border-[#ef4444]/30 bg-[#ef4444]/10',
    primary: 'border-[#ff6a13]/30 bg-[#ff6a13]/10',
  };

  return (
    <div className={`rounded-xl border p-4 ${toneStyles[tone]}`}>
      <p className="text-xs font-medium uppercase tracking-wide text-[#6b6b6b]">{title}</p>
      <p className="mt-2 text-2xl font-semibold text-[#111111]">{value}</p>
      {subtitle ? <p className="mt-1 text-xs text-[#6b6b6b]">{subtitle}</p> : null}
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
        <span className="text-[#6b6b6b]">{label}</span>
        <span className="font-medium text-[#111111]">{formatMoney(value, currency)}</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-[#ece4dd]">
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
  const chartWidth = 420;
  const svgHeight = 276;
  const plotTop = 16;
  const plotBottom = 206;
  const plotHeight = plotBottom - plotTop;
  const plotLeft = 40;
  const plotRight = 410;
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
    <div className="rounded-xl border border-[#d8d1cb] bg-[#f8f4ef] p-4">
      <p className="text-sm font-semibold text-[#111111]">{title}</p>
      <div className="relative mt-4 rounded-xl border border-[#d8d1cb] bg-white p-3">
        <svg viewBox={`0 0 ${chartWidth} ${svgHeight}`} className="h-[39rem] w-full sm:h-[22rem]">
          <line x1={plotLeft} y1={plotTop} x2={plotLeft} y2={plotBottom} stroke="#d1d5db" strokeWidth="1" />
          {yTicks.map((tick, tickIndex) => {
            const y = plotBottom - (tick / maxValue) * plotHeight;
            return (
              <g key={`tick-${tickIndex}-${tick}`}>
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
                  fontSize="14"
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
              y={248}
              textAnchor="middle"
              fontSize="16"
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
            className="pointer-events-none absolute z-20 rounded-lg border border-[#d8d1cb] bg-white/95 px-3 py-2 text-xs shadow-lg"
            style={{ left: tooltip.x, top: tooltip.y }}
          >
            <div className="font-semibold text-[#111111]">{tooltip.label}</div>
            <div className="text-[#444]">Занято: {tooltip.value}</div>
            <div className="text-[#6b6b6b]">Из общего: {tooltip.total}</div>
          </div>
        ) : null}
      </div>
      <div className="mt-2 text-xs text-[#6b6b6b]">
        Текущее значение:{' '}
        <span className="font-medium text-[#111111]">
          {valueFormatter(points[points.length - 1]?.value ?? 0)}
        </span>
      </div>
    </div>
  );
}

type MonthlyFinancePoint = {
  period: string | Date;
  incomeForecast: number;
  incomeActual: number;
  expensesForecast: number;
  expensesActual: number;
  saldo: number;
};

type FinanceTrendChartProps = {
  title: string;
  items: MonthlyFinancePoint[];
  actualKey: 'incomeActual' | 'expensesActual' | 'saldo';
  forecastKey?: 'incomeForecast' | 'expensesForecast';
  valueFormatter?: (value: number) => string;
};

function FinanceTrendChart({
  title,
  items,
  actualKey,
  forecastKey,
  valueFormatter = (value: number) => String(Math.round(value)),
}: FinanceTrendChartProps) {
  const [tooltip, setTooltip] = useState<{
    x: number;
    y: number;
    label: string;
    actual: string;
    forecast?: string;
  } | null>(null);

  const allValues = items.flatMap((item) => {
    const values = [Number(item[actualKey] ?? 0)];
    if (forecastKey) values.push(Number(item[forecastKey] ?? 0));
    return values;
  });
  const maxValue = Math.max(...allValues, 0);
  const minValue = Math.min(0, ...allValues);
  const range = Math.max(1, maxValue - minValue);

  const chartWidth = 420;
  const svgHeight = 276;
  const plotTop = 16;
  const plotBottom = 206;
  const plotHeight = plotBottom - plotTop;
  const plotLeft = 40;
  const plotRight = 410;
  const plotWidth = plotRight - plotLeft;
  const step = items.length > 1 ? plotWidth / (items.length - 1) : plotWidth;

  const yScale = (value: number) =>
    plotBottom - ((value - minValue) / range) * plotHeight;
  const yTicks = [maxValue, maxValue - range * 0.25, maxValue - range * 0.5, maxValue - range * 0.75, minValue];

  const actualPoints = items.map((item, index) => ({
    x: items.length > 1 ? plotLeft + index * step : plotLeft + plotWidth / 2,
    y: yScale(Number(item[actualKey] ?? 0)),
    actual: Number(item[actualKey] ?? 0),
    forecast: forecastKey ? Number(item[forecastKey] ?? 0) : undefined,
    period: item.period,
  }));
  const actualPolyline = actualPoints.map((p) => `${p.x},${p.y}`).join(' ');

  const forecastPolyline = forecastKey
    ? actualPoints
        .map((p) => `${p.x},${yScale(Number(p.forecast ?? 0))}`)
        .join(' ')
    : '';

  return (
    <div className="rounded-xl border border-[#d8d1cb] bg-[#f8f4ef] p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm font-semibold text-[#111111]">{title}</p>
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <span className="inline-flex items-center gap-1.5 text-[#444]">
            <span className="inline-block h-0.5 w-5 rounded bg-blue-600" />
            Сплошная = Факт
          </span>
          {forecastKey ? (
            <span className="inline-flex items-center gap-1.5 text-[#6b6b6b]">
              <span className="inline-block h-0.5 w-5 border-t-2 border-dashed border-slate-400" />
              Пунктир = Прогноз
            </span>
          ) : null}
        </div>
      </div>
      <div className="relative mt-4 rounded-xl border border-[#d8d1cb] bg-white p-3">
        <svg viewBox={`0 0 ${chartWidth} ${svgHeight}`} className="h-[39rem] w-full sm:h-[22rem]">
          <line x1={plotLeft} y1={plotTop} x2={plotLeft} y2={plotBottom} stroke="#d1d5db" strokeWidth="1" />
          {yTicks.map((tick, idx) => {
            const y = yScale(tick);
            return (
              <g key={`finance-tick-${idx}`}>
                <line
                  x1={plotLeft}
                  y1={y}
                  x2={plotRight}
                  y2={y}
                  stroke={Math.abs(tick) < 0.0001 ? '#cbd5e1' : '#f3f4f6'}
                  strokeWidth={Math.abs(tick) < 0.0001 ? '1.5' : '1'}
                />
                <text
                  x={plotLeft - 1.5}
                  y={y}
                  textAnchor="end"
                  dominantBaseline="middle"
                  fontSize="14"
                  fill="#6b7280"
                >
                  {Math.round(tick)}
                </text>
              </g>
            );
          })}

          {actualPoints.map((point) => (
            <line
              key={`${String(point.period)}-finance-x-grid`}
              x1={point.x}
              y1={plotTop}
              x2={point.x}
              y2={plotBottom}
              stroke="#f8fafc"
              strokeWidth="1"
            />
          ))}

          {forecastKey ? (
            <polyline
              fill="none"
              stroke="#94a3b8"
              strokeWidth="2"
              strokeDasharray="6 4"
              strokeLinejoin="round"
              strokeLinecap="round"
              points={forecastPolyline}
            />
          ) : null}

          <polyline
            fill="none"
            stroke="#2563eb"
            strokeWidth="2.5"
            strokeLinejoin="round"
            strokeLinecap="round"
            points={actualPolyline}
          />

          {actualPoints.map((point) => (
            <circle
              key={`${String(point.period)}-finance-dot`}
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
                  actual: valueFormatter(point.actual),
                  forecast:
                    forecastKey && point.forecast !== undefined
                      ? valueFormatter(point.forecast)
                      : undefined,
                });
              }}
              onMouseLeave={() => setTooltip(null)}
            />
          ))}

          {actualPoints.map((point) => (
            <text
              key={`${String(point.period)}-finance-label`}
              x={point.x}
              y={248}
              textAnchor="middle"
              fontSize="16"
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
            className="pointer-events-none absolute z-20 rounded-lg border border-[#d8d1cb] bg-white/95 px-3 py-2 text-xs shadow-lg"
            style={{ left: tooltip.x, top: tooltip.y }}
          >
            <div className="font-semibold text-[#111111]">{tooltip.label}</div>
            <div className="text-[#444]">Факт: {tooltip.actual}</div>
            {tooltip.forecast ? <div className="text-[#6b6b6b]">Прогноз: {tooltip.forecast}</div> : null}
          </div>
        ) : null}
      </div>
      <div className="mt-2 text-xs text-[#6b6b6b]">
        Текущее значение:{' '}
        <span className="font-medium text-[#111111]">
          {valueFormatter(actualPoints[actualPoints.length - 1]?.actual ?? 0)}
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
  const [isMobile, setIsMobile] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState<string>(getCurrentMonthValue());
  const [showDownloadModal, setShowDownloadModal] = useState(false);
  const [downloadMonth, setDownloadMonth] = useState<string>(getCurrentMonthValue());
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const media = window.matchMedia('(max-width: 640px)');
    const apply = () => setIsMobile(media.matches);
    apply();
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        const storeData = await apiFetch<any>(`/stores/${storeId}`);

        if (!hasPermission(storeData.permissions || [], 'VIEW_SUMMARY')) {
          router.replace(`/stores/${storeId}`);
          return;
        }

        const analyticsData = await apiFetch<any>(
          `/stores/${storeId}/analytics/summary-view?period=${encodeURIComponent(selectedMonth)}`,
        );
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
  }, [router, selectedMonth, storeId]);

  const data = useMemo(() => {
    if (!store || !analytics) return null;

    const currency = store.currency;
    const summary = analytics.summaryPage || {};
    const income = summary.income || {};
    const channelsByEntity = income.channelsByEntity || {};
    const expenses = summary.expenses || {};
    const expenseChannels = expenses.channels || {};
    const expenseChannelsByType = expenses.channelsByType || {};
    const expenseByType = expenses.byType || {};
    const storeLevelExpenses = expenses.storeLevel || {};
    const tradeArea = summary.tradeArea || {};
    const groupedByPavilionGroups = summary.groupedByPavilionGroups || [];
    const financeTrend = summary.financeTrend || [];
    const tradeAreaTrend = Array.isArray(tradeArea?.monthlyTrend)
      ? tradeArea.monthlyTrend
      : [];
    const financeTrendFallback = Array.isArray(financeTrend) && financeTrend.length > 0
      ? financeTrend
      : (() => {
          if (tradeAreaTrend.length === 0) {
            return [
              {
                period: new Date(),
                incomeForecast: Number(analytics?.income?.forecast?.total ?? 0),
                incomeActual: Number(summary?.income?.total ?? 0),
                expensesForecast: Number(summary?.expenses?.totals?.forecast ?? 0),
                expensesActual: Number(summary?.expenses?.totals?.actual ?? 0),
                saldo:
                  Number(summary?.income?.total ?? 0) -
                  Number(summary?.expenses?.totals?.actual ?? 0),
              },
            ];
          }
          const fallback = tradeAreaTrend.map((point: any, index: number) => ({
            period: point.period,
            incomeForecast: 0,
            incomeActual: 0,
            expensesForecast: 0,
            expensesActual: 0,
            saldo: 0,
          }));
          const lastIndex = fallback.length - 1;
          fallback[lastIndex] = {
            ...fallback[lastIndex],
            incomeForecast: Number(analytics?.income?.forecast?.total ?? 0),
            incomeActual: Number(summary?.income?.total ?? 0),
            expensesForecast: Number(summary?.expenses?.totals?.forecast ?? 0),
            expensesActual: Number(summary?.expenses?.totals?.actual ?? 0),
            saldo:
              Number(summary?.income?.total ?? 0) -
              Number(summary?.expenses?.totals?.actual ?? 0),
          };
          return fallback;
        })();

    const carryAdjustment = Number(
      income.carryAdjustment ?? income.previousMonthBalance ?? 0,
    );
    const incomeTotalRaw = Number(income.total ?? 0);
    const incomeTotalWithPrevious = incomeTotalRaw + carryAdjustment;
    const incomeWithAdjustedTotal = {
      ...income,
      carryAdjustment,
      totalWithPrevious: incomeTotalWithPrevious,
    };

    const storeLevelTotals = calcStoreLevelExpensesTotals(storeLevelExpenses);
    const totalMoney = calcSummaryTotalMoney(
      incomeTotalRaw,
      expenses.totals?.actual,
    );
    const saldo = calcProfit(incomeTotalRaw, expenses.totals?.actual);
    const saldoChannels = summary.saldoChannels || {
      bankTransfer: Number(income.channels?.bankTransfer ?? 0) - Number(expenseChannels.bankTransfer ?? 0),
      cashbox1: Number(income.channels?.cashbox1 ?? 0) - Number(expenseChannels.cashbox1 ?? 0),
      cashbox2: Number(income.channels?.cashbox2 ?? 0) - Number(expenseChannels.cashbox2 ?? 0),
      total:
        Number(income.channels?.total ?? 0) -
        Number(expenseChannels.total ?? 0),
    };

    return {
      currency,
      income: incomeWithAdjustedTotal,
      channelsByEntity,
      expenses,
      expenseChannels,
      expenseChannelsByType,
      saldoChannels,
      expenseByType,
      tradeArea: {
        ...tradeArea,
        monthlyTrend: isMobile ? tradeAreaTrend.slice(-4) : tradeAreaTrend,
      },
      groupedByPavilionGroups,
      financeTrend: isMobile ? financeTrendFallback.slice(-4) : financeTrendFallback,
      storeLevelTotals,
      totalMoney,
      saldo,
    };
  }, [store, analytics, isMobile]);

  if (loading) return <div className="p-6 text-center text-lg">Загрузка...</div>;
  if (error) return <div className="p-6 text-center text-red-600">{error}</div>;
  if (!store || !analytics || !data) return null;

  const handleDownloadSummaryPdf = async () => {
    try {
      setDownloadingPdf(true);
      const token = localStorage.getItem('token');
      if (!token) {
        window.location.href = '/login';
        return;
      }

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/stores/${storeId}/analytics/summary-view/pdf?period=${encodeURIComponent(downloadMonth)}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      if (!response.ok) {
        throw new Error('Не удалось скачать сводку');
      }

      const blob = await response.blob();
      const fileUrl = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = fileUrl;
      anchor.download = `svodka-${storeId}-${downloadMonth}.pdf`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(fileUrl);
      setShowDownloadModal(false);
    } catch (downloadError) {
      console.error(downloadError);
      alert('Не удалось скачать PDF');
    } finally {
      setDownloadingPdf(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f6f1eb]">
      <div className="mx-auto max-w-7xl space-y-6 p-4 md:space-y-8 md:p-8">
        <section className="rounded-2xl border border-[#d8d1cb] bg-white p-5 shadow-[0_12px_36px_-20px_rgba(17,17,17,0.2)] md:p-6">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <Link
                href={`/stores/${storeId}`}
                className="inline-flex items-center rounded-xl border border-[#d8d1cb] bg-white px-3 py-1.5 text-sm font-medium text-[#111111] transition hover:bg-[#f4efeb]"
              >
                Назад к объекту
              </Link>
              <h1 className="mt-2 text-3xl font-bold tracking-tight text-[#111111]">СВОДКА</h1>
              <p className="mt-1 text-sm text-[#6b6b6b]">Ключевые финансовые показатели объекта</p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <label htmlFor="summary-month" className="text-sm text-[#6b6b6b]">
                  Месяц:
                </label>
                <input
                  id="summary-month"
                  type="month"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="rounded-xl border border-[#d8d1cb] bg-[#f8f4ef] px-2 py-1 text-sm text-[#111111] outline-none transition focus:border-[#ff6a13] focus:bg-white focus:ring-2 focus:ring-[#ff6a13]/20"
                />
                <button
                  onClick={() => {
                    setDownloadMonth(selectedMonth);
                    setShowDownloadModal(true);
                  }}
                  className="ml-1 rounded-xl bg-[#ff6a13] px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-[#e85a0c]"
                >
                  Скачать сводку
                </button>
              </div>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="rounded-xl border border-[#d8d1cb] bg-white p-5 shadow-sm">
            <h2 className="mb-3 text-lg font-semibold text-[#111111]">Доходы</h2>
            <div className="space-y-1 text-sm text-[#444]">
              <div>
                <Link
                  href={`/stores/${storeId}/income-forecast?period=${encodeURIComponent(selectedMonth)}`}
                  className="text-[#ff6a13] hover:underline"
                >
                  Прогноз: {formatMoney(data.income.forecast?.total ?? 0, data.currency)}
                </Link>
              </div>
              <div>Факт: {formatMoney(data.income.total ?? 0, data.currency)}</div>
            </div>
          </div>
          <div className="rounded-xl border border-[#d8d1cb] bg-white p-5 shadow-sm">
            <h2 className="mb-3 text-lg font-semibold text-[#111111]">Расходы</h2>
            <div className="space-y-1 text-sm text-[#444]">
              <div>Прогноз: {formatMoney(data.expenses.totals?.forecast ?? 0, data.currency)}</div>
              <div>Факт: {formatMoney(data.expenses.totals?.actual ?? 0, data.currency)}</div>
            </div>
          </div>
          <div className="rounded-xl border border-[#d8d1cb] bg-white p-5 shadow-sm">
            <h2 className="mb-3 text-lg font-semibold text-[#111111]">Прибыль</h2>
            <div className="space-y-1 text-sm text-[#444]">
              <div>
                Прогноз:{' '}
                {formatMoney(
                  calcProfit(
                    Number(data.income.forecast?.total ?? 0),
                    Number(data.expenses.totals?.forecast ?? 0),
                  ),
                  data.currency,
                )}
              </div>
              <div>
                Факт:{' '}
                {formatMoney(
                  calcProfit(
                    Number(data.income.total ?? 0),
                    Number(data.expenses.totals?.actual ?? 0),
                  ),
                  data.currency,
                )}
              </div>
            </div>
          </div>
        </section>

        <section className="space-y-4 rounded-2xl border border-[#d8d1cb] bg-white p-5 shadow-[0_12px_36px_-20px_rgba(17,17,17,0.2)] md:p-6">
          <h2 className="text-xl font-semibold text-[#111111]">Остаток с прошлого месяца</h2>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <MetricCard
              title="Итого остаток"
              value={formatMoney(data.income.previousMonthBalance ?? 0, data.currency)}
              subtitle="Факт прошлого месяца"
              tone="primary"
            />
            <div className="rounded-xl border border-[#d8d1cb] bg-[#f8f4ef] p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-[#6b6b6b]">
                Остаток по кассам
              </p>
              <div className="mt-2 space-y-1 text-sm text-[#444]">
                <div>
                  Безнал: {formatMoney(data.income.previousMonthChannels?.bankTransfer ?? 0, data.currency)}
                </div>
                <div>
                  Касса 1: {formatMoney(data.income.previousMonthChannels?.cashbox1 ?? 0, data.currency)}
                </div>
                <div>
                  Касса 2: {formatMoney(data.income.previousMonthChannels?.cashbox2 ?? 0, data.currency)}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="space-y-4 rounded-2xl border border-[#d8d1cb] bg-white p-5 shadow-[0_12px_36px_-20px_rgba(17,17,17,0.2)] md:p-6">
          <h2 className="text-xl font-semibold text-[#111111]">1. Общий доход</h2>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">Прогноз</p>
              <div className="mt-3 grid grid-cols-1 gap-3">
                <MetricCard
                  title="Итого приход (прогноз)"
                  value={formatMoney(
                    Number(data.income.forecast?.total ?? 0) +
                      Number(data.income.carryAdjustment ?? 0),
                    data.currency,
                  )}
                  subtitle="С учетом переноса"
                  tone="primary"
                />
              </div>
            </div>
            <div className="rounded-xl border border-emerald-100 bg-emerald-50/40 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Факт</p>
              <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                <MetricCard
                  title="Корректировка переносом"
                  value={formatMoney(-(Number(data.income.carryAdjustment ?? 0)), data.currency)}
                  subtitle="Баланс после переноса переплаты/долга"
                  tone="primary"
                />
                <MetricCard
                  title="Итого приход"
                  value={formatMoney(data.income.total ?? 0, data.currency)}
                  subtitle="Факт текущего месяца"
                  tone="success"
                />
              </div>
              <p className="mt-2 text-xs text-[#6b6b6b]">
                «Корректировка переносом» не подмешивается в факт текущего месяца.
              </p>
              <div className="mt-3 space-y-3">
                <p className="text-sm font-semibold text-[#111111]">Распределение по каналам оплаты</p>
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
            </div>
          </div>

          <div>
            <p className="mb-3 text-sm font-semibold text-[#111111]">По сущностям</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <div className="rounded-lg border border-gray-200 bg-white p-3">
                <p className="text-xs uppercase text-gray-500">Аренда</p>
                <p className="mt-1 text-lg font-semibold">{formatMoney(data.channelsByEntity.rent?.total ?? 0, data.currency)}</p>
                <div className="mt-2 space-y-1 text-[11px] text-gray-600">
                  <div>Безнал: {formatMoney(data.channelsByEntity.rent?.bankTransfer ?? 0, data.currency)}</div>
                  <div>Касса 1: {formatMoney(data.channelsByEntity.rent?.cashbox1 ?? 0, data.currency)}</div>
                  <div>Касса 2: {formatMoney(data.channelsByEntity.rent?.cashbox2 ?? 0, data.currency)}</div>
                </div>
              </div>
              <div className="rounded-lg border border-gray-200 bg-white p-3">
                <p className="text-xs uppercase text-gray-500">Коммунальные</p>
                <p className="mt-1 text-lg font-semibold">{formatMoney(data.channelsByEntity.facilities?.total ?? 0, data.currency)}</p>
                <div className="mt-2 space-y-1 text-[11px] text-gray-600">
                  <div>Безнал: {formatMoney(data.channelsByEntity.facilities?.bankTransfer ?? 0, data.currency)}</div>
                  <div>Касса 1: {formatMoney(data.channelsByEntity.facilities?.cashbox1 ?? 0, data.currency)}</div>
                  <div>Касса 2: {formatMoney(data.channelsByEntity.facilities?.cashbox2 ?? 0, data.currency)}</div>
                </div>
              </div>
              <div className="rounded-lg border border-gray-200 bg-white p-3">
                <p className="text-xs uppercase text-gray-500">Реклама</p>
                <p className="mt-1 text-lg font-semibold">{formatMoney(data.channelsByEntity.advertising?.total ?? 0, data.currency)}</p>
                <div className="mt-2 space-y-1 text-[11px] text-gray-600">
                  <div>Безнал: {formatMoney(data.channelsByEntity.advertising?.bankTransfer ?? 0, data.currency)}</div>
                  <div>Касса 1: {formatMoney(data.channelsByEntity.advertising?.cashbox1 ?? 0, data.currency)}</div>
                  <div>Касса 2: {formatMoney(data.channelsByEntity.advertising?.cashbox2 ?? 0, data.currency)}</div>
                </div>
              </div>
              <div className="rounded-lg border border-gray-200 bg-white p-3">
                <p className="text-xs uppercase text-gray-500">Доп. начисления</p>
                <p className="mt-1 text-lg font-semibold">{formatMoney(data.channelsByEntity.additional?.total ?? 0, data.currency)}</p>
                <div className="mt-2 space-y-1 text-[11px] text-gray-600">
                  <div>Безнал: {formatMoney(data.channelsByEntity.additional?.bankTransfer ?? 0, data.currency)}</div>
                  <div>Касса 1: {formatMoney(data.channelsByEntity.additional?.cashbox1 ?? 0, data.currency)}</div>
                  <div>Касса 2: {formatMoney(data.channelsByEntity.additional?.cashbox2 ?? 0, data.currency)}</div>
                </div>
              </div>
              <div className="rounded-lg border border-gray-200 bg-white p-3">
                <p className="text-xs uppercase text-gray-500">Доп приход</p>
                <p className="mt-1 text-lg font-semibold">{formatMoney(data.channelsByEntity.storeExtra?.total ?? 0, data.currency)}</p>
                <div className="mt-2 space-y-1 text-[11px] text-gray-600">
                  <div>Безнал: {formatMoney(data.channelsByEntity.storeExtra?.bankTransfer ?? 0, data.currency)}</div>
                  <div>Касса 1: {formatMoney(data.channelsByEntity.storeExtra?.cashbox1 ?? 0, data.currency)}</div>
                  <div>Касса 2: {formatMoney(data.channelsByEntity.storeExtra?.cashbox2 ?? 0, data.currency)}</div>
                </div>
              </div>
            </div>
          </div>
          <FinanceTrendChart
            title="Тренд дохода по месяцам"
            items={(data.financeTrend ?? []) as MonthlyFinancePoint[]}
            actualKey="incomeActual"
            forecastKey="incomeForecast"
            valueFormatter={(value) => formatMoney(value, data.currency)}
          />
        </section>

        <section className="space-y-4 rounded-2xl border border-[#d8d1cb] bg-white p-5 shadow-[0_12px_36px_-20px_rgba(17,17,17,0.2)] md:p-6">
          <h2 className="text-xl font-semibold text-[#111111]">2. Общий расход</h2>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">Прогноз</p>
              <div className="mt-3 grid grid-cols-1 gap-3">
                <MetricCard
                  title="Итого расход (прогноз)"
                  value={formatMoney(data.expenses.totals?.forecast ?? 0, data.currency)}
                  tone="danger"
                />
              </div>
            </div>
            <div className="rounded-xl border border-rose-100 bg-rose-50/40 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-rose-700">Факт</p>
              <div className="mt-3 grid grid-cols-1 gap-3">
                <MetricCard
                  title="Итого расход (факт)"
                  value={formatMoney(data.expenses.totals?.actual ?? 0, data.currency)}
                  tone="danger"
                />
              </div>
              <div className="mt-3 space-y-3">
                <p className="text-sm font-semibold text-[#111111]">Каналы оплаты расходов (факт)</p>
                <ChannelRow
                  label="Безналичные"
                  value={data.expenseChannels?.bankTransfer ?? 0}
                  total={data.expenseChannels?.total ?? 0}
                  currency={data.currency}
                  colorClass="bg-blue-500"
                />
                <ChannelRow
                  label="Наличные касса 1"
                  value={data.expenseChannels?.cashbox1 ?? 0}
                  total={data.expenseChannels?.total ?? 0}
                  currency={data.currency}
                  colorClass="bg-emerald-500"
                />
                <ChannelRow
                  label="Наличные касса 2"
                  value={data.expenseChannels?.cashbox2 ?? 0}
                  total={data.expenseChannels?.total ?? 0}
                  currency={data.currency}
                  colorClass="bg-amber-500"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 rounded-xl border border-[#d8d1cb] bg-[#f8f4ef] p-4 text-sm md:grid-cols-2 lg:grid-cols-3">
            {[
              { key: 'salaries', label: 'Зарплаты' },
              { key: 'payrollTax', label: 'Налоги с зарплаты' },
              { key: 'profitTax', label: 'Налог на прибыль' },
              { key: 'facilities', label: 'Коммуналка объекта' },
              { key: 'dividends', label: 'Дивиденды' },
              { key: 'bankServices', label: 'Услуги банка' },
              { key: 'household', label: 'Хоз. расходы' },
              { key: 'vat', label: 'НДС' },
              { key: 'landRent', label: 'Аренда земли' },
              { key: 'other', label: 'Прочие' },
            ].map((item) => {
              const channels = (data.expenseChannelsByType as any)?.[item.key] || {};
              return (
                <div key={item.key} className="rounded-lg border border-gray-200 bg-white p-3">
                  <div className="font-medium text-gray-800">
                    {item.label}: {formatMoney((data.expenseByType as any)?.[item.key] ?? 0, data.currency)}
                  </div>
                  <div className="mt-2 space-y-1 text-[11px] text-gray-600">
                    <div>Безнал: {formatMoney(channels.bankTransfer ?? 0, data.currency)}</div>
                    <div>Касса 1: {formatMoney(channels.cashbox1 ?? 0, data.currency)}</div>
                    <div>Касса 2: {formatMoney(channels.cashbox2 ?? 0, data.currency)}</div>
                  </div>
                </div>
              );
            })}
          </div>

          <FinanceTrendChart
            title="Тренд расхода по месяцам"
            items={(data.financeTrend ?? []) as MonthlyFinancePoint[]}
            actualKey="expensesActual"
            forecastKey="expensesForecast"
            valueFormatter={(value) => formatMoney(value, data.currency)}
          />
        </section>

        <section className="rounded-2xl border border-[#d8d1cb] bg-white p-5 shadow-[0_12px_36px_-20px_rgba(17,17,17,0.2)] md:p-6">
          <h2 className="text-xl font-semibold text-[#111111]">3. Остаток</h2>

          <div className="mt-3 grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">Прогноз</p>
              <div className="mt-3 grid grid-cols-1 gap-3">
                <MetricCard
                  title="Остаток (прогноз)"
                  value={formatMoney(
                    calcProfit(
                      data.income.forecast?.total ?? 0,
                      data.expenses.totals?.forecast ?? 0,
                    ),
                    data.currency,
                  )}
                  tone="primary"
                />
              </div>
            </div>
            <div className="rounded-xl border border-emerald-100 bg-emerald-50/40 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Факт</p>
              <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
                <MetricCard
                  title="Общий приход"
                  value={formatMoney(data.income.total ?? 0, data.currency)}
                  tone="success"
                />
                <MetricCard
                  title="Общий расход"
                  value={formatMoney(data.expenses.totals?.actual ?? 0, data.currency)}
                  tone="danger"
                />
                <MetricCard
                  title="Остаток"
                  value={formatMoney(data.saldo, data.currency)}
                  tone={data.saldo >= 0 ? 'success' : 'danger'}
                />
              </div>
              <div className="mt-3 space-y-3">
                <p className="text-sm font-semibold text-[#111111]">Каналы остатка (факт)</p>
                <ChannelRow
                  label="Безналичные"
                  value={data.saldoChannels?.bankTransfer ?? 0}
                  total={Math.max(1, Math.abs(data.saldoChannels?.total ?? 0))}
                  currency={data.currency}
                  colorClass="bg-blue-500"
                />
                <ChannelRow
                  label="Наличные касса 1"
                  value={data.saldoChannels?.cashbox1 ?? 0}
                  total={Math.max(1, Math.abs(data.saldoChannels?.total ?? 0))}
                  currency={data.currency}
                  colorClass="bg-emerald-500"
                />
                <ChannelRow
                  label="Наличные касса 2"
                  value={data.saldoChannels?.cashbox2 ?? 0}
                  total={Math.max(1, Math.abs(data.saldoChannels?.total ?? 0))}
                  currency={data.currency}
                  colorClass="bg-amber-500"
                />
              </div>
            </div>
          </div>
          <div className="mt-4">
            <FinanceTrendChart
              title="Тренд остатка по месяцам"
              items={(data.financeTrend ?? []) as MonthlyFinancePoint[]}
              actualKey="saldo"
              valueFormatter={(value) => formatMoney(value, data.currency)}
            />
          </div>
        </section>

        <section className="space-y-4 rounded-2xl border border-[#d8d1cb] bg-white p-5 shadow-[0_12px_36px_-20px_rgba(17,17,17,0.2)] md:p-6">
          <h2 className="text-xl font-semibold text-[#111111]">4. Торговая площадь</h2>

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

        <section className="space-y-4 rounded-2xl border border-[#d8d1cb] bg-white p-5 shadow-[0_12px_36px_-20px_rgba(17,17,17,0.2)] md:p-6">
          <h2 className="text-xl font-semibold text-[#111111]">5. Группы павильонов</h2>

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
      {showDownloadModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-[#d8d1cb] bg-white p-5 shadow-[0_20px_60px_-30px_rgba(17,17,17,0.45)]">
            <h3 className="text-lg font-semibold text-[#111111]">Скачать сводку (PDF)</h3>
            <p className="mt-1 text-sm text-[#6b6b6b]">
              Выберите месяц, за который нужно сформировать файл.
            </p>
            <div className="mt-4">
              <label htmlFor="download-month" className="mb-1 block text-sm text-[#444]">
                Месяц
              </label>
              <input
                id="download-month"
                type="month"
                value={downloadMonth}
                onChange={(e) => setDownloadMonth(e.target.value)}
                className="w-full rounded-xl border border-[#d8d1cb] bg-[#f8f4ef] px-2 py-1.5 text-sm text-[#111111] outline-none transition focus:border-[#ff6a13] focus:bg-white focus:ring-2 focus:ring-[#ff6a13]/20"
              />
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setShowDownloadModal(false)}
                disabled={downloadingPdf}
                className="rounded-xl border border-[#d8d1cb] px-3 py-1.5 text-sm font-semibold text-[#111111] transition hover:bg-[#f4efeb] disabled:opacity-60"
              >
                Отмена
              </button>
              <button
                onClick={handleDownloadSummaryPdf}
                disabled={downloadingPdf || !downloadMonth}
                className="rounded-xl bg-[#ff6a13] px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-[#e85a0c] disabled:opacity-60"
              >
                {downloadingPdf ? 'Формирование...' : 'Скачать PDF'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
