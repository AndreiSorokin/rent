import { apiFetch } from './api';

export type StoreExtraIncomeItem = {
  id: number;
  name: string;
  amount: number;
  bankTransferPaid: number;
  cashbox1Paid: number;
  cashbox2Paid: number;
  period: string;
  paidAt: string;
  createdAt: string;
};

export function listStoreExtraIncome(storeId: number, period?: string) {
  const query = period ? `?period=${encodeURIComponent(period)}` : '';
  return apiFetch<StoreExtraIncomeItem[]>(`/stores/${storeId}/extra-income${query}`);
}

export function createStoreExtraIncome(
  storeId: number,
  data: {
    name: string;
    amount: number;
    bankTransferPaid: number;
    cashbox1Paid: number;
    cashbox2Paid: number;
    period?: string;
    paidAt?: string;
  },
) {
  const idempotencyKey =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : undefined;
  return apiFetch(`/stores/${storeId}/extra-income`, {
    method: 'POST',
    body: JSON.stringify({
      ...data,
      ...(idempotencyKey ? { idempotencyKey } : {}),
    }),
  });
}

export function deleteStoreExtraIncome(storeId: number, incomeId: number) {
  return apiFetch(`/stores/${storeId}/extra-income/${incomeId}`, {
    method: 'DELETE',
  });
}
