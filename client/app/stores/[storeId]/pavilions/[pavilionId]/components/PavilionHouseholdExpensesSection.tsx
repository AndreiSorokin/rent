'use client';

import { formatMoney } from '@/lib/currency';
import { hasPermission } from '@/lib/permissions';
import { Pavilion } from '../pavilion.types';

export function PavilionHouseholdExpensesSection({
  pavilion,
  currency,
  permissions,
  expenseName,
  setExpenseName,
  expenseAmount,
  setExpenseAmount,
  onCreateHouseholdExpense,
  onDeleteHouseholdExpense,
}: {
  pavilion: Pavilion;
  currency: 'RUB' | 'KZT';
  permissions: string[];
  expenseName: string;
  setExpenseName: (value: string) => void;
  expenseAmount: string;
  setExpenseAmount: (value: string) => void;
  onCreateHouseholdExpense: () => void;
  onDeleteHouseholdExpense: (expenseId: number) => void;
}) {
  const householdExpensesTotal = (pavilion.householdExpenses ?? []).reduce(
    (sum, expense) => sum + Number(expense.amount ?? 0),
    0,
  );

  return (
    <div className="rounded-xl bg-white p-6 shadow">
      <h2 className="mb-4 text-xl font-semibold">Расходы на хоз. часть</h2>

      {hasPermission(permissions, 'CREATE_CHARGES') && (
        <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-3">
          <input
            type="text"
            value={expenseName}
            onChange={(e) => setExpenseName(e.target.value)}
            className="rounded border px-3 py-2"
            placeholder="Название расхода"
          />
          <input
            type="number"
            step="0.01"
            value={expenseAmount}
            onChange={(e) => setExpenseAmount(e.target.value)}
            className="rounded border px-3 py-2"
            placeholder="Сумма"
          />
          <button
            onClick={onCreateHouseholdExpense}
            className="rounded bg-amber-600 px-4 py-2 text-white hover:bg-amber-700"
          >
            + Добавить расход
          </button>
        </div>
      )}

      {!pavilion.householdExpenses || pavilion.householdExpenses.length === 0 ? (
        <p className="text-gray-500">Расходов пока нет</p>
      ) : (
        <div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">Название</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">Сумма</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">Дата</th>
                  <th className="px-6 py-3 text-right text-xs font-medium uppercase text-gray-500">Действия</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {pavilion.householdExpenses.map((expense) => (
                  <tr key={expense.id}>
                    <td className="px-6 py-4 text-sm">{expense.name}</td>
                    <td className="px-6 py-4 text-sm">{formatMoney(expense.amount, currency)}</td>
                    <td className="px-6 py-4 text-sm">
                      {new Date(expense.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-right text-sm">
                      {hasPermission(permissions, 'DELETE_CHARGES') && (
                        <button
                          onClick={() => onDeleteHouseholdExpense(expense.id)}
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
          <div className="mt-3 text-right text-sm font-semibold">
            Итого: {formatMoney(householdExpensesTotal, currency)}
          </div>
        </div>
      )}
    </div>
  );
}
