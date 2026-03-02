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
export type PaymentMethod = 'BANK_TRANSFER' | 'CASHBOX1' | 'CASHBOX2';

export type PavilionExpense = {
  id: number;
  type: PavilionExpenseType;
  status: PavilionExpenseStatus;
  paymentMethod?: PaymentMethod | null;
  amount: number;
  bankTransferPaid?: number;
  cashbox1Paid?: number;
  cashbox2Paid?: number;
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
    paymentMethod?: PaymentMethod;
    bankTransferPaid?: number;
    cashbox1Paid?: number;
    cashbox2Paid?: number;
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
  paymentMethod?: PaymentMethod,
) {
  return apiFetch<PavilionExpense>(`/stores/${storeId}/expenses/${expenseId}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status, paymentMethod }),
  });
}

export function updatePavilionExpense(
  storeId: number,
  expenseId: number,
  data: {
    type?: PavilionExpenseType;
    amount?: number;
    note?: string | null;
    status?: PavilionExpenseStatus;
    paymentMethod?: PaymentMethod;
    bankTransferPaid?: number;
    cashbox1Paid?: number;
    cashbox2Paid?: number;
  },
) {
  return apiFetch<PavilionExpense>(`/stores/${storeId}/expenses/${expenseId}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export function deletePavilionExpense(storeId: number, expenseId: number) {
  return apiFetch(`/stores/${storeId}/expenses/${expenseId}`, {
    method: 'DELETE',
  });
}
