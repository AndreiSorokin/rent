'use client';

import { useTranslations } from 'next-intl';
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
  const t = useTranslations('PavilionHouseholdExpensesSection');
  const householdExpensesTotal = (pavilion.householdExpenses ?? []).reduce(
    (sum, expense) => sum + Number(expense.amount ?? 0),
    0,
  );

  return (
    <div className="rounded-2xl border border-[#d8d1cb] bg-white p-6 shadow-[0_12px_36px_-20px_rgba(17,17,17,0.2)]">
      <h2 className="mb-4 text-xl font-semibold">{t('heading')}</h2>

      {hasPermission(permissions, 'CREATE_CHARGES') && (
        <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-3">
          <input
            type="text"
            value={expenseName}
            onChange={(e) => setExpenseName(e.target.value)}
            className="rounded border px-3 py-2"
            placeholder={t('namePlaceholder')}
          />
          <input
            type="number"
            step="0.01"
            value={expenseAmount}
            onChange={(e) => setExpenseAmount(e.target.value)}
            className="rounded border px-3 py-2"
            placeholder={t('amountPlaceholder')}
          />
          <button
            onClick={onCreateHouseholdExpense}
            className="rounded-xl bg-[#111111] px-4 py-2 text-white hover:bg-[#2a2a2a]"
          >
            {t('addExpense')}
          </button>
        </div>
      )}

      {!pavilion.householdExpenses || pavilion.householdExpenses.length === 0 ? (
        <p className="text-gray-500">{t('emptyState')}</p>
      ) : (
        <div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-[#f4efeb]">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">{t('nameHeader')}</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">{t('amountHeader')}</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">{t('dateHeader')}</th>
                  <th className="px-6 py-3 text-right text-xs font-medium uppercase text-gray-500">{t('actionsHeader')}</th>
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
                          {t('delete')}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-3 text-right text-sm font-semibold">
            {t('totalLabel')}: {formatMoney(householdExpensesTotal, currency)}
          </div>
        </div>
      )}
    </div>
  );
}

