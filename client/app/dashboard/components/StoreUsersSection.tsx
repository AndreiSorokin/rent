'use client';

import { useState, useEffect } from 'react';
import { hasPermission } from '@/lib/permissions';
import { getStoreUsers, updateUserPermissions, removeStoreUser } from '@/lib/storeUsers';
import { InviteUserModal } from './InviteUserModal';
import { ManagePermissionsModal } from './ManagePermissionsModal';

const PERMISSION_LABELS = {
  VIEW_PAVILIONS: 'View Pavilions',
  CREATE_PAVILIONS: 'Create Pavilions',
  EDIT_PAVILIONS: 'Edit Pavilions',
  DELETE_PAVILIONS: 'Delete Pavilions',
  VIEW_PAYMENTS: 'View Payments',
  CREATE_PAYMENTS: 'Record Payments',
  EDIT_PAYMENTS: 'Edit Payments',
  CALCULATE_PAYMENTS: 'Calculate Payments',
  VIEW_CHARGES: 'View Charges',
  CREATE_CHARGES: 'Create Charges',
  EDIT_CHARGES: 'Edit Charges',
  DELETE_CHARGES: 'Delete Charges',
  VIEW_CONTRACTS: 'View Contracts',
  UPLOAD_CONTRACTS: 'Upload Contracts',
  DELETE_CONTRACTS: 'Delete Contracts',
  INVITE_USERS: 'Invite Users',
  ASSIGN_PERMISSIONS: 'Manage Permissions',
} as const;

type Permission = keyof typeof PERMISSION_LABELS;

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
  const [editingUser, setEditingUser] = useState<{ id: number; permissions: string[]; email: string } | null>(null);

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
    if (canManageUsers) {
      fetchUsers();
    }
  }, [storeId, canManageUsers]);

  const handlePermissionChange = async (userId: number, newPermissions: string[]) => {
    try {
      await updateUserPermissions(storeId, userId, newPermissions);
      fetchUsers();
      onUsersChanged();
    } catch (err) {
      console.error('Failed to update permissions:', err);
      alert('Could not update permissions. Please try again.');
    }
  };

  const handleRemove = async (userId: number, email: string) => {
    if (!confirm(`Remove ${email} from this store?`)) return;
    try {
      await removeStoreUser(storeId, userId);
      fetchUsers();
      onUsersChanged();
    } catch (err) {
      console.error('Failed to remove user:', err);
      alert('Could not remove user. Please try again.');
    }
  };

  const openPermissionsModal = (userId: number, currentPermissions: string[], email: string) => {
    setEditingUser({ id: userId, permissions: currentPermissions, email });
  };

  if (!canManageUsers) return null;

  return (
    <div className="border rounded-lg p-6 bg-white shadow-sm">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold">Store Users & Permissions</h2>
        {hasPermission(permissions, 'INVITE_USERS') && (
          <button
            onClick={() => setShowInviteModal(true)}
            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
          >
            + Invite User
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
        <p className="text-gray-500">Loading users...</p>
      ) : users.length === 0 ? (
        <p className="text-gray-500 italic">No users in this store yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Email
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Permissions
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {users.map((su) => (
                <tr key={su.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {su.user.email}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {su.user.name || '—'}
                  </td>
                  <td className="px-6 py-4">
                    <button
                      onClick={() => openPermissionsModal(su.user.id, su.permissions, su.user.email)}
                      className="text-blue-600 hover:text-blue-800 font-medium"
                    >
                      Manage Permissions ({su.permissions.length})
                    </button>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button
                      onClick={() => handleRemove(su.user.id, su.user.email)}
                      className="text-red-600 hover:text-red-800 transition-colors"
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
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