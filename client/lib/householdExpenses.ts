import { apiFetch } from './api';

export type HouseholdExpense = {
  id: number;
  name: string;
  amount: number;
  status: 'UNPAID' | 'PAID';
  paymentMethod?: 'BANK_TRANSFER' | 'CASHBOX1' | 'CASHBOX2' | null;
  bankTransferPaid?: number;
  cashbox1Paid?: number;
  cashbox2Paid?: number;
  storeId?: number | null;
  pavilionId?: number | null;
  createdAt: string;
};

export function getHouseholdExpenses(storeId: number) {
  return apiFetch<HouseholdExpense[]>(`/stores/${storeId}/household-expenses`);
}

export function createHouseholdExpense(
  storeId: number,
  data: {
    name: string;
    amount: number;
    status?: 'UNPAID' | 'PAID';
    paymentMethod?: 'BANK_TRANSFER' | 'CASHBOX1' | 'CASHBOX2';
    bankTransferPaid?: number;
    cashbox1Paid?: number;
    cashbox2Paid?: number;
  },
) {
  const idempotencyKey =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : undefined;
  return apiFetch<HouseholdExpense>(`/stores/${storeId}/household-expenses`, {
    method: 'POST',
    body: JSON.stringify({
      ...data,
      ...(idempotencyKey ? { idempotencyKey } : {}),
    }),
  });
}

export function deleteHouseholdExpense(storeId: number, expenseId: number) {
  return apiFetch(`/stores/${storeId}/household-expenses/${expenseId}`, {
    method: 'DELETE',
  });
}

export function updateHouseholdExpenseStatus(
  storeId: number,
  expenseId: number,
  status: 'UNPAID' | 'PAID',
  paymentMethod?: 'BANK_TRANSFER' | 'CASHBOX1' | 'CASHBOX2',
) {
  return apiFetch<HouseholdExpense>(
    `/stores/${storeId}/household-expenses/${expenseId}/status`,
    {
      method: 'PATCH',
      body: JSON.stringify({ status, paymentMethod }),
    },
  );
}

export function updateHouseholdExpense(
  storeId: number,
  expenseId: number,
  data: {
    name?: string;
    amount?: number;
    status?: 'UNPAID' | 'PAID';
    paymentMethod?: 'BANK_TRANSFER' | 'CASHBOX1' | 'CASHBOX2';
    bankTransferPaid?: number;
    cashbox1Paid?: number;
    cashbox2Paid?: number;
  },
) {
  return apiFetch<HouseholdExpense>(`/stores/${storeId}/household-expenses/${expenseId}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}
