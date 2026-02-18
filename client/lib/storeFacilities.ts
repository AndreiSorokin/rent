import { apiFetch } from './api';

export type StoreFacilityStatus = 'UNPAID' | 'PAID';

export interface StoreFacility {
  id: number;
  storeId: number;
  name: string;
  amount: number;
  status: StoreFacilityStatus;
  createdAt: string;
}

export function listStoreFacilities(storeId: number) {
  return apiFetch<StoreFacility[]>(`/stores/${storeId}/facilities`);
}

export function createStoreFacility(
  storeId: number,
  data: { name: string; amount: number },
) {
  return apiFetch<StoreFacility>(`/stores/${storeId}/facilities`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function updateStoreFacilityStatus(
  storeId: number,
  facilityId: number,
  status: StoreFacilityStatus,
) {
  return apiFetch<StoreFacility>(
    `/stores/${storeId}/facilities/${facilityId}/status`,
    {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    },
  );
}

export function deleteStoreFacility(storeId: number, facilityId: number) {
  return apiFetch(`/stores/${storeId}/facilities/${facilityId}`, {
    method: 'DELETE',
  });
}

