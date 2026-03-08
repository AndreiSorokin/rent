import { apiFetch } from './api';

export function payAdditionalCharge(
  pavilionId: number,
  chargeId: number,
  amountPaid: number,
  channels?: {
    bankTransferPaid?: number;
    cashbox1Paid?: number;
    cashbox2Paid?: number;
  },
) {
  const idempotencyKey =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : undefined;
  return apiFetch(
    `/pavilions/${pavilionId}/additional-charges/${chargeId}/pay`,
    {
      method: 'POST',
      body: JSON.stringify({
        amountPaid,
        bankTransferPaid: channels?.bankTransferPaid,
        cashbox1Paid: channels?.cashbox1Paid,
        cashbox2Paid: channels?.cashbox2Paid,
        ...(idempotencyKey ? { idempotencyKey } : {}),
      }),
    }
  );
}

export const getAdditionalCharges = (pavilionId: number) =>
  apiFetch(`/pavilions/${pavilionId}/additional-charges`);

export const createAdditionalCharge = (
  pavilionId: number,
  data: { name: string; amount: number },
) => {
  const idempotencyKey =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : undefined;
  return apiFetch(`/pavilions/${pavilionId}/additional-charges`, {
    method: 'POST',
    body: JSON.stringify({
      ...data,
      ...(idempotencyKey ? { idempotencyKey } : {}),
    }),
  });
};

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

export const updateAdditionalChargePayment = (
  pavilionId: number,
  chargeId: number,
  paymentId: number,
  data: {
    amountPaid?: number;
    bankTransferPaid?: number;
    cashbox1Paid?: number;
    cashbox2Paid?: number;
  },
) =>
  apiFetch(
    `/pavilions/${pavilionId}/additional-charges/${chargeId}/payments/${paymentId}`,
    {
      method: 'PATCH',
      body: JSON.stringify(data),
    },
  );

export const deleteAdditionalChargePayment = (
  pavilionId: number,
  chargeId: number,
  paymentId: number,
) =>
  apiFetch(
    `/pavilions/${pavilionId}/additional-charges/${chargeId}/payments/${paymentId}`,
    {
      method: 'DELETE',
    },
  );
