import { apiFetch } from './api';

export function payAdditionalCharge(
  pavilionId: number,
  chargeId: number,
  amountPaid: number,
) {
  return apiFetch(
    `/pavilions/${pavilionId}/additional-charges/${chargeId}/pay`,
    {
      method: 'POST',
      body: JSON.stringify({ amountPaid }),
    }
  );
}

export const getAdditionalCharges = (pavilionId: number) =>
  apiFetch(`/pavilions/${pavilionId}/additional-charges`);

export const createAdditionalCharge = (
  pavilionId: number,
  data: { name: string; amount: number },
) =>
  apiFetch(`/pavilions/${pavilionId}/additional-charges`, {
    method: 'POST',
    body: JSON.stringify(data),
  });

export const updateAdditionalCharge = (
  pavilionId: number,
  chargeId: number,
  data: { name?: string; amount?: number },
) =>
  apiFetch(`/pavilions/${pavilionId}/additional-charges/${chargeId}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });

export const deleteAdditionalCharge = (
  pavilionId: number,
  chargeId: number,
) =>
  apiFetch(`/pavilions/${pavilionId}/additional-charges/${chargeId}`, {
    method: 'DELETE',
  });