import { apiFetch } from './api';

export type PavilionExpenseType =
  | 'SALARIES'
  | 'PAYROLL_TAX'
  | 'PROFIT_TAX'
  | 'DIVIDENDS'
  | 'BANK_SERVICES'
  | 'VAT'
  | 'LAND_RENT'
  | 'OTHER';

export type PavilionExpenseStatus = 'UNPAID' | 'PAID';

export type PavilionExpense = {
  id: number;
  type: PavilionExpenseType;
  status: PavilionExpenseStatus;
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
  data: {
    type: PavilionExpenseType;
    amount: number;
    note?: string | null;
    status?: PavilionExpenseStatus;
  },
) {
  return apiFetch<PavilionExpense>(`/pavilions/${pavilionId}/expenses`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function updatePavilionExpenseStatus(
  pavilionId: number,
  expenseId: number,
  status: PavilionExpenseStatus,
) {
  return apiFetch<PavilionExpense>(`/pavilions/${pavilionId}/expenses/${expenseId}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
}

export function deletePavilionExpense(pavilionId: number, expenseId: number) {
  return apiFetch(`/pavilions/${pavilionId}/expenses/${expenseId}`, {
    method: 'DELETE',
  });
}
