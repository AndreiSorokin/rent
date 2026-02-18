import { apiFetch } from './api';

export type PavilionExpenseType =
  | 'SALARIES'
  | 'HOUSEHOLD'
  | 'STORE_FACILITIES'
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
  storeId?: number | null;
  pavilionId?: number | null;
  createdAt: string;
};

export function listPavilionExpenses(storeId: number) {
  return apiFetch<PavilionExpense[]>(`/stores/${storeId}/expenses`);
}

export function createPavilionExpense(
  storeId: number,
  data: {
    type: PavilionExpenseType;
    amount: number;
    note?: string | null;
    status?: PavilionExpenseStatus;
  },
) {
  return apiFetch<PavilionExpense>(`/stores/${storeId}/expenses`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function updatePavilionExpenseStatus(
  storeId: number,
  expenseId: number,
  status: PavilionExpenseStatus,
) {
  return apiFetch<PavilionExpense>(`/stores/${storeId}/expenses/${expenseId}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
}

export function deletePavilionExpense(storeId: number, expenseId: number) {
  return apiFetch(`/stores/${storeId}/expenses/${expenseId}`, {
    method: 'DELETE',
  });
}
