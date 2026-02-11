import { apiFetch } from './api';

export type PavilionExpenseType =
  | 'SALARIES'
  | 'PAYROLL_TAX'
  | 'PROFIT_TAX'
  | 'DIVIDENDS'
  | 'BANK_SERVICES'
  | 'VAT'
  | 'LAND_RENT';

export type PavilionExpense = {
  id: number;
  type: PavilionExpenseType;
  amount: number;
  note?: string | null;
  pavilionId: number;
  createdAt: string;
};

export function listPavilionExpenses(pavilionId: number) {
  return apiFetch<PavilionExpense[]>(`/pavilions/${pavilionId}/expenses`);
}

export function createPavilionExpense(
  pavilionId: number,
  data: { type: PavilionExpenseType; amount: number; note?: string | null },
) {
  return apiFetch<PavilionExpense>(`/pavilions/${pavilionId}/expenses`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function deletePavilionExpense(pavilionId: number, expenseId: number) {
  return apiFetch(`/pavilions/${pavilionId}/expenses/${expenseId}`, {
    method: 'DELETE',
  });
}
