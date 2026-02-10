'use client';

import { useEffect, useState } from 'react';
import { getCurrentUserFromToken } from '@/lib/auth';
import { hasPermission } from '@/lib/permissions';
import {
  getStoreUsers,
  removeStoreUser,
  updateUserPermissions,
} from '@/lib/storeUsers';
import { InviteUserModal } from './InviteUserModal';
import { ManagePermissionsModal } from './ManagePermissionsModal';

type StoreUsersSectionProps = {
  storeId: number;
  permissions: string[];
  onUsersChanged: () => void;
};

export function StoreUsersSection({
  storeId,
  permissions,
  onUsersChanged,
}: StoreUsersSectionProps) {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [editingUser, setEditingUser] = useState<{
    id: number;
    permissions: string[];
    email: string;
  } | null>(null);
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);

  const canManageUsers =
    hasPermission(permissions, 'INVITE_USERS') ||
    hasPermission(permissions, 'ASSIGN_PERMISSIONS');

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const data = await getStoreUsers(storeId);
      setUsers(data || []);
    } catch (err) {
      console.error('Failed to load store users:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const currentUser = getCurrentUserFromToken();
    setCurrentUserId(currentUser?.id ?? null);

    if (canManageUsers) {
      fetchUsers();
    }
  }, [storeId, canManageUsers]);

  const handlePermissionChange = async (
    userId: number,
    newPermissions: string[],
  ) => {
    try {
      await updateUserPermissions(storeId, userId, newPermissions);
      fetchUsers();
      onUsersChanged();
    } catch (err) {
      console.error('Failed to update permissions:', err);
      alert('Не удалось обновить права. Попробуйте снова.');
    }
  };

  const handleRemove = async (userId: number, email: string) => {
    if (!confirm(`Удалить ${email} из этого магазина?`)) return;

    try {
      await removeStoreUser(storeId, userId);
      fetchUsers();
      onUsersChanged();
    } catch (err) {
      console.error('Failed to remove user:', err);
      alert('Не удалось удалить пользователя. Попробуйте снова.');
    }
  };

  const openPermissionsModal = (
    userId: number,
    currentPermissions: string[],
    email: string,
  ) => {
    setEditingUser({ id: userId, permissions: currentPermissions, email });
  };

  if (!canManageUsers) return null;

  return (
    <div className="rounded-lg border bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        {hasPermission(permissions, 'INVITE_USERS') && (
          <button
            onClick={() => setShowInviteModal(true)}
            className="rounded bg-green-600 px-4 py-2 text-white transition-colors hover:bg-green-700"
          >
            + Пригласить пользователя
          </button>
        )}
      </div>

      {showInviteModal && (
        <InviteUserModal
          storeId={storeId}
          onClose={() => setShowInviteModal(false)}
          onSuccess={() => {
            fetchUsers();
            onUsersChanged();
          }}
        />
      )}

      {loading ? (
        <p className="text-gray-500">Загрузка пользователей...</p>
      ) : users.length === 0 ? (
        <p className="italic text-gray-500">В этом магазине пока нет пользователей.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Email
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Имя
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Права доступа
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                  Действия
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {users.map((su) => {
                const isSelf = currentUserId === su.user.id;

                return (
                  <tr key={su.id}>
                    <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-gray-900">
                      {su.user.email}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-900">
                      {su.user.name || '-'}
                    </td>
                    <td className="px-6 py-4">
                      {isSelf ? (
                        <span className="text-sm text-gray-500">Ваши права</span>
                      ) : (
                        <button
                          onClick={() =>
                            openPermissionsModal(
                              su.user.id,
                              su.permissions,
                              su.user.email,
                            )
                          }
                          className="font-medium text-blue-600 hover:text-blue-800"
                        >
                          Управление правами доступа ({su.permissions.length})
                        </button>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-right text-sm font-medium">
                      {isSelf ? (
                        <span className="text-sm text-gray-500">—</span>
                      ) : (
                        <button
                          onClick={() => handleRemove(su.user.id, su.user.email)}
                          className="text-red-600 transition-colors hover:text-red-800"
                        >
                          Удалить
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {editingUser && (
        <ManagePermissionsModal
          userId={editingUser.id}
          userEmail={editingUser.email}
          currentPermissions={editingUser.permissions}
          onSave={handlePermissionChange}
          onClose={() => setEditingUser(null)}
        />
      )}
    </div>
  );
}
