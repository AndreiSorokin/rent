'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { formatMoney } from '@/lib/currency';
import { hasPermission } from '@/lib/permissions';

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

        if (!hasPermission(storeData.permissions || [], 'VIEW_PAYMENTS')) {
          router.replace(`/stores/${storeId}`);
          return;
        }

        const analyticsData = await apiFetch<any>(`/stores/${storeId}/analytics`);
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

  if (loading) return <div className="p-6 text-center text-lg">Загрузка...</div>;
  if (error) return <div className="p-6 text-center text-red-600">{error}</div>;
  if (!store || !analytics) return null;

  const currency = store.currency;
  const summary = analytics.summaryPage || {};
  const income = summary.income || {};
  const expenses = summary.expenses || {};
  const expenseByType = expenses.byType || {};
  const tradeArea = summary.tradeArea || {};

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-8">
        <div className="flex flex-col gap-2">
          <Link href={`/stores/${storeId}`} className="text-blue-600 hover:underline">
            Назад к магазину
          </Link>
          <h1 className="text-2xl font-bold md:text-3xl">СВОДКА</h1>
          <p className="text-sm text-gray-600">
            Общая сумма денег: {formatMoney((income.total ?? 0) - (expenses.totals?.actual ?? 0), currency)}
          </p>
        </div>

        <div className="rounded-xl bg-white p-6 shadow">
          <h2 className="mb-4 text-xl font-semibold">1. Общий доход</h2>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
            <div>Остаток с предыдущего месяца: {formatMoney(income.previousMonthBalance ?? 0, currency)}</div>
            <div>Аренда: {formatMoney(income.rent ?? 0, currency)}</div>
            <div>Коммуналка: {formatMoney(income.facilities ?? 0, currency)}</div>
            <div>Доп. начисления: {formatMoney(income.additional ?? 0, currency)}</div>
            <div className="font-semibold">Итого доход: {formatMoney(income.total ?? 0, currency)}</div>
          </div>
          <div className="mt-4 border-t pt-4">
            <div>Безналичные: {formatMoney(income.channels?.bankTransfer ?? 0, currency)}</div>
            <div>Наличные касса 1: {formatMoney(income.channels?.cashbox1 ?? 0, currency)}</div>
            <div>Наличные касса 2: {formatMoney(income.channels?.cashbox2 ?? 0, currency)}</div>
            <div className="font-semibold">Итого по каналам: {formatMoney(income.channels?.total ?? 0, currency)}</div>
          </div>
        </div>

        <div className="rounded-xl bg-white p-6 shadow">
          <h2 className="mb-4 text-xl font-semibold">2. Общий расход</h2>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
            <div>Зарплаты: {formatMoney(expenseByType.salaries ?? 0, currency)}</div>
            <div>Налоги с зарплаты: {formatMoney(expenseByType.payrollTax ?? 0, currency)}</div>
            <div>Налог на прибыль: {formatMoney(expenseByType.profitTax ?? 0, currency)}</div>
            <div>Коммуналка: {formatMoney(expenseByType.facilities ?? 0, currency)}</div>
            <div>Дивиденды: {formatMoney(expenseByType.dividends ?? 0, currency)}</div>
            <div>Услуги банка: {formatMoney(expenseByType.bankServices ?? 0, currency)}</div>
            <div>Хозяйственные расходы: {formatMoney(expenseByType.household ?? 0, currency)}</div>
            <div>НДС: {formatMoney(expenseByType.vat ?? 0, currency)}</div>
            <div>Аренда земли: {formatMoney(expenseByType.landRent ?? 0, currency)}</div>
            <div>Прочие расходы: {formatMoney(expenseByType.other ?? 0, currency)}</div>
          </div>
          <div className="mt-4 border-t pt-4 font-semibold">
            Итого расход (факт): {formatMoney(expenses.totals?.actual ?? 0, currency)}
          </div>
        </div>

        <div className="rounded-xl bg-white p-6 shadow">
          <h2 className="mb-2 text-xl font-semibold">3. Сальдо</h2>
          <div className="text-lg font-semibold">
            {formatMoney(summary.saldo ?? 0, currency)}
          </div>
        </div>

        <div className="rounded-xl bg-white p-6 shadow">
          <h2 className="mb-4 text-xl font-semibold">4. Торговая площадь</h2>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
            <div>Павильонов всего: {tradeArea.pavilionsTotal ?? 0}</div>
            <div>Павильонов занято: {tradeArea.pavilionsRented ?? 0}</div>
            <div>Павильонов свободно: {tradeArea.pavilionsAvailable ?? 0}</div>
            <div>Общая площадь: {tradeArea.squareTotal ?? 0} м2</div>
            <div>Площадь в аренде: {tradeArea.squareRented ?? 0} м2</div>
            <div>Свободная площадь: {tradeArea.squareAvailable ?? 0} м2</div>
          </div>
        </div>
      </div>
    </div>
  );
}
