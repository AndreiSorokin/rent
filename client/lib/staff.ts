import { apiFetch } from './api';

export function reorderStaff(storeId: number, orderedIds: number[]) {
  return apiFetch(`/stores/${storeId}/staff/reorder`, {
    method: 'PATCH',
    body: JSON.stringify({ orderedIds }),
  });
}
