import { apiFetch } from './api';

export function createPavilionPayment(
  storeId: number,
  pavilionId: number,
  data: {
    period: string;
    rentPaid?: number;
    utilitiesPaid?: number;
    advertisingPaid?: number;
    bankTransferPaid?: number;
    cashbox1Paid?: number;
    cashbox2Paid?: number;
    rentBankTransferPaid?: number;
    rentCashbox1Paid?: number;
    rentCashbox2Paid?: number;
    utilitiesBankTransferPaid?: number;
    utilitiesCashbox1Paid?: number;
    utilitiesCashbox2Paid?: number;
    advertisingBankTransferPaid?: number;
    advertisingCashbox1Paid?: number;
    advertisingCashbox2Paid?: number;
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

export function deletePavilionPaymentEntry(
  storeId: number,
  pavilionId: number,
  entryId: number,
) {
  return apiFetch(
    `/stores/${storeId}/pavilions/${pavilionId}/payments/entries/${entryId}`,
    {
      method: 'DELETE',
    },
  );
}
