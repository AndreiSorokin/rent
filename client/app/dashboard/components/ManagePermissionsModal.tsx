'use client';

import { useState } from 'react';

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

type ManagePermissionsModalProps = {
  userId: number;
  userEmail: string;
  currentPermissions: string[];
  onSave: (userId: number, newPermissions: string[]) => Promise<void>;
  onClose: () => void;
};

export function ManagePermissionsModal({
  userId,
  userEmail,
  currentPermissions,
  onSave,
  onClose,
}: ManagePermissionsModalProps) {
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>(currentPermissions);
  const [saving, setSaving] = useState(false);

  const togglePermission = (perm: string) => {
    setSelectedPermissions((prev) =>
      prev.includes(perm) ? prev.filter((p) => p !== perm) : [...prev, perm]
    );
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(userId, selectedPermissions);
      onClose();
    } catch (err) {
      alert('Failed to save permissions');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-lg max-h-[80vh] overflow-y-auto">
        <h2 className="text-xl font-bold mb-4">Manage Permissions for {userEmail}</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-6">
          {Object.entries(PERMISSION_LABELS).map(([value, label]) => (
            <label key={value} className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={selectedPermissions.includes(value)}
                onChange={() => togglePermission(value)}
                className="form-checkbox h-5 w-5 text-blue-600"
              />
              <span className="text-sm">{label}</span>
            </label>
          ))}
        </div>

        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 border rounded hover:bg-gray-100 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}