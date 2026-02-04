import { Permission } from '@prisma/client';
import { apiFetch } from './api';

export async function inviteUserByEmail(storeId: number, email: string) {
  return apiFetch(`/stores/${storeId}/users/invite-by-email`, {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
}

export async function getStoreUsers(storeId: number) {
  return apiFetch(`/stores/${storeId}/users`);
}

export async function updateUserPermissions(
  storeId: number,
  userId: number,
  permissions: Permission[]
) {
  return apiFetch(`/stores/${storeId}/users/${userId}/permissions`, {
    method: 'PUT',
    body: JSON.stringify({ permissions }),
  });
}

export async function removeStoreUser(storeId: number, userId: number) {
  return apiFetch(`/stores/${storeId}/users/${userId}`, {
    method: 'DELETE',
  });
}