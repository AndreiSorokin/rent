import { apiFetch } from "@/lib/api";
import { hasPermission } from "@/lib/permissions";
import { Permission } from "@/types/store";
import { useEffect, useState } from "react";
import { InviteUserModal } from "./InviteUserModal";
import { PermissionEditor } from "./PermissionEditor";

// Example snippet in a StoreUsers page
export function StoreUsersPage({ storeId }: { storeId: number }) {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInvite, setShowInvite] = useState(false);

  const fetchUsers = async () => {
    const data = await apiFetch(`/stores/${storeId}/users`);
    setUsers(data);
    setLoading(false);
  };

  useEffect(() => { fetchUsers(); }, [storeId]);

  const handlePermissionChange = async (userId: number, newPermissions: Permission[]) => {
    await apiFetch(`/stores/${storeId}/users/${userId}/permissions`, {
      method: 'PUT',
      body: JSON.stringify({ permissions: newPermissions }),
    });
    fetchUsers(); // refresh
  };

  const handleRemove = async (userId: number) => {
    if (!confirm('Remove user?')) return;
    await apiFetch(`/stores/${storeId}/users/${userId}`, { method: 'DELETE' });
    fetchUsers();
  };

  return (
    <div>
      <div className="flex justify-between mb-4">
        <h2>Store Users</h2>
        {hasPermission(permissions, Permission.INVITE_USERS) && (
          <button onClick={() => setShowInvite(true)} className="btn-primary">
            + Invite User
          </button>
        )}
      </div>

      {showInvite && (
        <InviteUserModal
          storeId={storeId}
          onClose={() => setShowInvite(false)}
          onInvited={fetchUsers}
        />
      )}

      {loading ? (
        <p>Loading...</p>
      ) : (
        <table className="w-full border">
          <thead>
            <tr>
              <th>Email</th>
              <th>Name</th>
              <th>Permissions</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((su) => (
              <tr key={su.id}>
                <td>{su.user.email}</td>
                <td>{su.user.name || '-'}</td>
                <td>
                  {/* Multi-select or checkboxes for permissions */}
                  <PermissionEditor
                    current={su.permissions}
                    onChange={(newPerms) => handlePermissionChange(su.user.id, newPerms)}
                  />
                </td>
                <td>
                  <button
                    onClick={() => handleRemove(su.user.id)}
                    className="text-red-600"
                  >
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}