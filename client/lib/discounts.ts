import { apiFetch } from './api';

export type CreateDiscountPayload = {
  amount: number;
  startsAt: string;
  endsAt?: string;
  note?: string;
};

export function createPavilionDiscount(
  storeId: number,
  pavilionId: number,
  data: CreateDiscountPayload,
) {
  return apiFetch(`/stores/${storeId}/pavilions/${pavilionId}/discounts`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function deletePavilionDiscount(
  storeId: number,
  pavilionId: number,
  discountId: number,
) {
  return apiFetch(
    `/stores/${storeId}/pavilions/${pavilionId}/discounts/${discountId}`,
    {
      method: 'DELETE',
    },
  );
}
