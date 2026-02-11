'use client';

import type { Dispatch, SetStateAction } from 'react';
import { formatMoney } from '@/lib/currency';
import { hasPermission } from '@/lib/permissions';
import {
  MANUAL_EXPENSE_CATEGORIES,
  Pavilion,
  PavilionExpenseStatus,
  PavilionExpenseType,
} from '../pavilion.types';

export function PavilionExpensesSection({
  pavilion,
  currency,
  permissions,
  manualExpenseAmountByType,
  setManualExpenseAmountByType,
  onCreateManualExpense,
  onDeleteManualExpense,
  onManualExpenseStatusChange,
}: {
  pavilion: Pavilion;
  currency: 'RUB' | 'KZT';
  permissions: string[];
  manualExpenseAmountByType: Record<PavilionExpenseType, string>;
  setManualExpenseAmountByType: Dispatch<SetStateAction<Record<PavilionExpenseType, string>>>;
  onCreateManualExpense: (type: PavilionExpenseType) => void;
  onDeleteManualExpense: (expenseId: number) => void;
  onManualExpenseStatusChange: (
    expenseId: number,
    status: PavilionExpenseStatus,
  ) => void;
}) {
  const pavilionExpenses = pavilion.pavilionExpenses ?? [];
  const groupedManualExpenses = MANUAL_EXPENSE_CATEGORIES.reduce(
    (acc, category) => {
      acc[category.type] = pavilionExpenses.filter((item) => item.type === category.type);
      return acc;
    },
    {} as Record<
      PavilionExpenseType,
      Array<{
        id: number;
        type: PavilionExpenseType;
        status: PavilionExpenseStatus;
        amount: number;
        note?: string | null;
        createdAt: string;
      }>
    >,
  );

  const manualExpensesForecastTotal = pavilionExpenses.reduce(
    (sum, item) => sum + Number(item.amount ?? 0),
    0,
  );
  const manualExpensesActualTotal = pavilionExpenses
    .filter((item) => item.status === 'PAID')
    .reduce((sum, item) => sum + Number(item.amount ?? 0), 0);
  const householdExpensesTotal = (pavilion.householdExpenses ?? []).reduce(
    (sum, item) => sum + Number(item.amount ?? 0),
    0,
  );
  const utilitiesExpenseForecast =
    pavilion.status === 'RENTED' || pavilion.status === 'PREPAID'
      ? Number(pavilion.utilitiesAmount ?? 0)
      : 0;
  const utilitiesExpenseActual = (pavilion.payments ?? []).reduce(
    (sum, payment: any) => sum + Number(payment.utilitiesPaid ?? 0),
    0,
  );
  const pavilionExpenseForecastTotal =
    manualExpensesForecastTotal + utilitiesExpenseForecast + householdExpensesTotal;
  const pavilionExpenseActualTotal =
    manualExpensesActualTotal + utilitiesExpenseActual + householdExpensesTotal;

  return (
    <div className="rounded-xl bg-white p-6 shadow">
      <h2 className="mb-4 text-xl font-semibold">Расходы</h2>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {MANUAL_EXPENSE_CATEGORIES.map((category) => {
          const categoryItems = groupedManualExpenses[category.type] ?? [];
          const categoryTotal = categoryItems.reduce(
            (sum, item) => sum + Number(item.amount ?? 0),
            0,
          );

          return (
            <div key={category.type} className="rounded-md border p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <div className="text-sm font-semibold">{category.label}</div>
                <div className="text-sm font-semibold">{formatMoney(categoryTotal, currency)}</div>
              </div>

              {hasPermission(permissions, 'CREATE_CHARGES') && (
                <div className="mb-2 flex gap-2">
                  <input
                    type="number"
                    step="0.01"
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
                    onClick={() => onCreateManualExpense(category.type)}
                    className="shrink-0 rounded bg-amber-600 px-3 py-1 text-xs text-white hover:bg-amber-700"
                  >
                    +
                  </button>
                </div>
              )}

              {categoryItems.length > 0 ? (
                <div className="max-h-24 space-y-1 overflow-auto">
                  {categoryItems.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between rounded bg-gray-50 px-2 py-1 text-xs"
                    >
                      <span>
                        {formatMoney(item.amount, currency)}{' '}
                        <span className="text-gray-500">
                          ({new Date(item.createdAt).toLocaleDateString()})
                        </span>
                      </span>
                      <div className="ml-2 flex items-center gap-2">
                        {hasPermission(permissions, 'EDIT_CHARGES') && (
                          <select
                            value={item.status}
                            onChange={(e) =>
                              onManualExpenseStatusChange(
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
                            onClick={() => onDeleteManualExpense(item.id)}
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

        <div className="rounded-md border p-3">
          <div className="text-sm font-semibold">Коммуналка</div>
          <div className="text-xs text-gray-700">
            Прогноз: {formatMoney(utilitiesExpenseForecast, currency)}
          </div>
          <div className="text-xs text-gray-700">
            Факт: {formatMoney(utilitiesExpenseActual, currency)}
          </div>
        </div>

        <div className="rounded-md border p-3">
          <div className="text-sm font-semibold">Хозяйственные расходы</div>
          <div className="text-xs text-gray-700">
            Итого: {formatMoney(householdExpensesTotal, currency)}
          </div>
        </div>

        <div className="rounded-md border bg-gray-50 p-3 md:col-span-2 xl:col-span-1">
          <div className="text-sm font-semibold">
            Итого прогноз: {formatMoney(pavilionExpenseForecastTotal, currency)}
          </div>
          <div className="text-sm font-semibold">
            Итого факт: {formatMoney(pavilionExpenseActualTotal, currency)}
          </div>
        </div>
      </div>
    </div>
  );
}
