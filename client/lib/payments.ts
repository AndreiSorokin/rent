import { apiFetch } from './api';

export function createPavilionPayment(
  storeId: number,
  pavilionId: number,
  data: {
    rentPaid?: number;
    utilitiesPaid?: number;
  },
) {
  return apiFetch(
    `/stores/${storeId}/pavilions/${pavilionId}/payments`,
    {
      method: 'POST',
      body: JSON.stringify(data),
    },
  );
}
