import { apiFetch } from "./api";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createPavilion(storeId: number, data: any) {
  return apiFetch(`/stores/${storeId}/pavilions`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function updatePavilion(storeId: number, pavilionId: number,data: any) {
  return apiFetch(`/stores/${storeId}/pavilions/${pavilionId}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export function deletePavilion(storeId: number, pavilionId: number) {
  return apiFetch(`/stores/${storeId}/pavilions/${pavilionId}`, {
    method: 'DELETE',
  });
}