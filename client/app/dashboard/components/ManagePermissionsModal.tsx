'use client';

import { useState } from 'react';

const PERMISSION_LABELS = {
  VIEW_PAVILIONS: 'Просмотр павильонов',
  VIEW_STAFF: 'Просмотр штатного расписания',
  MANAGE_STAFF: 'Управление штатным расписанием',
  CREATE_PAVILIONS: 'Создавать павильоны',
  EDIT_PAVILIONS: 'Изменять павильоны',
  DELETE_PAVILIONS: 'Удалять павильоны',
  VIEW_PAYMENTS: 'Просмотр оплат',
  VIEW_SUMMARY: 'Просмотр сводки',
  CREATE_PAYMENTS: 'Записывать оплаты',
  EDIT_PAYMENTS: 'Изменять оплаты',
  CALCULATE_PAYMENTS: 'Рассчитывать оплаты',
  VIEW_CHARGES: 'Просмотр начислений',
  CREATE_CHARGES: 'Создавать начисления',
  EDIT_CHARGES: 'Изменять статус начислений',
  DELETE_CHARGES: 'Удалять начисления',
  VIEW_CONTRACTS: 'Просмотр контрактов',
  UPLOAD_CONTRACTS: 'Загружать контракты',
  DELETE_CONTRACTS: 'Удалять контракты',
  INVITE_USERS: 'Приглашать пользователей',
  ASSIGN_PERMISSIONS: 'Управлять правами доступа',
} as const;

type Permission = keyof typeof PERMISSION_LABELS;

const PERMISSION_SECTIONS: Array<{
  title: string;
  items: Permission[];
}> = [
  {
    title: 'Павильоны и штат',
    items: [
      'VIEW_PAVILIONS',
      'CREATE_PAVILIONS',
      'EDIT_PAVILIONS',
      'DELETE_PAVILIONS',
    ],
  },
  {
    title: 'Оплаты и бухгалтерия',
    items: [
      'VIEW_PAYMENTS',
      'VIEW_SUMMARY',
      'CREATE_PAYMENTS',
      'EDIT_PAYMENTS',
      'CALCULATE_PAYMENTS',
    ],
  },
  {
    title: 'Начисления',
    items: ['VIEW_CHARGES', 'CREATE_CHARGES', 'EDIT_CHARGES', 'DELETE_CHARGES'],
  },
  {
    title: 'Документы',
    items: ['VIEW_CONTRACTS', 'UPLOAD_CONTRACTS', 'DELETE_CONTRACTS'],
  },
  {
    title: 'Пользователи и права',
    items: ['INVITE_USERS', 'ASSIGN_PERMISSIONS','VIEW_STAFF','MANAGE_STAFF',],
  },
];

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
      prev.includes(perm) ? prev.filter((p) => p !== perm) : [...prev, perm],
    );
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(userId, selectedPermissions);
      onClose();
    } catch {
      alert('Не удалось сохранить права доступа');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="max-h-[80vh] w-full max-w-lg overflow-y-auto rounded-lg bg-white p-6">
        <h2 className="mb-4 text-xl font-bold">Управление правами доступа для {userEmail}</h2>

        <div className="mb-6 space-y-4">
          {PERMISSION_SECTIONS.map((section) => (
            <div key={section.title} className="rounded border border-gray-200 p-3">
              <h3 className="mb-2 text-sm font-semibold text-gray-800">{section.title}</h3>
              <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                {section.items.map((value) => (
                  <label key={value} className="flex cursor-pointer items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={selectedPermissions.includes(value)}
                      onChange={() => togglePermission(value)}
                      className="h-5 w-5"
                    />
                    <span className="text-sm">{PERMISSION_LABELS[value]}</span>
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            disabled={saving}
            className="rounded border px-4 py-2 hover:bg-gray-100 disabled:opacity-50"
          >
            Отмена
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? 'Сохранение...' : 'Сохранить изменения'}
          </button>
        </div>
      </div>
    </div>
  );
}
