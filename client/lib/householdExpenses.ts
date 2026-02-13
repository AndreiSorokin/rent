import { apiFetch } from './api';

export type HouseholdExpense = {
  id: number;
  name: string;
  amount: number;
  storeId?: number | null;
  pavilionId?: number | null;
  createdAt: string;
};

export function getHouseholdExpenses(storeId: number) {
  return apiFetch<HouseholdExpense[]>(`/stores/${storeId}/household-expenses`);
}

export function createHouseholdExpense(
  storeId: number,
  data: { name: string; amount: number },
) {
  return apiFetch<HouseholdExpense>(`/stores/${storeId}/household-expenses`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function deleteHouseholdExpense(storeId: number, expenseId: number) {
  return apiFetch(`/stores/${storeId}/household-expenses/${expenseId}`, {
    method: 'DELETE',
  });
}
