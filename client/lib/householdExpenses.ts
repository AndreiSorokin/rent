import { apiFetch } from './api';

export type HouseholdExpense = {
  id: number;
  name: string;
  amount: number;
  pavilionId: number;
  createdAt: string;
};

export function getHouseholdExpenses(pavilionId: number) {
  return apiFetch<HouseholdExpense[]>(`/pavilions/${pavilionId}/household-expenses`);
}

export function createHouseholdExpense(
  pavilionId: number,
  data: { name: string; amount: number },
) {
  return apiFetch<HouseholdExpense>(`/pavilions/${pavilionId}/household-expenses`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function deleteHouseholdExpense(pavilionId: number, expenseId: number) {
  return apiFetch(`/pavilions/${pavilionId}/household-expenses/${expenseId}`, {
    method: 'DELETE',
  });
}
