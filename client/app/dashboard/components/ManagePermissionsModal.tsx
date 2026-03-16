'use client';

import { useState } from 'react';
import { ErrorMessage } from '@/components/messages/StatusMessage';

const PERMISSION_LABELS = {
  VIEW_PAVILIONS: 'Просмотр павильонов',
  VIEW_STAFF: 'Просмотр штатного расписания',
  MANAGE_STAFF: 'Управление штатным расписанием',
  CREATE_PAVILIONS: 'Создавать павильоны',
  EXPORT_STORE_DATA: 'Выгружать данные',
  MANAGE_MEDIA: 'Работа с описаниями и изображениями',
  EDIT_PAVILIONS: 'Изменять павильоны',
  DELETE_PAVILIONS: 'Удалять павильоны',
  VIEW_PAYMENTS: 'Просмотр оплат',
  VIEW_SUMMARY: 'Просмотр сводки',
  VIEW_ACTIVITY: 'Просмотр журнала действий',
  CREATE_PAYMENTS: 'Записывать оплаты',
  EDIT_PAYMENTS: 'Изменять оплаты',
  VIEW_CHARGES: 'Просмотр начислений',
  CREATE_CHARGES: 'Создавать начисления',
  EDIT_CHARGES: 'Изменять начисления',
  DELETE_CHARGES: 'Удалять начисления',
  VIEW_CONTRACTS: 'Просмотр договоров',
  UPLOAD_CONTRACTS: 'Загружать договоры',
  DELETE_CONTRACTS: 'Удалять договоры',
  INVITE_USERS: 'Приглашать пользователей',
  REMOVE_USERS: 'Удалять пользователей из объекта',
  ASSIGN_PERMISSIONS: 'Управлять правами доступа',
} as const;

type Permission = keyof typeof PERMISSION_LABELS;

const PERMISSION_SECTIONS: Array<{
  title: string;
  items: Permission[];
}> = [
  {
    title: 'Павильоны и объект',
    items: [
      'VIEW_PAVILIONS',
      'CREATE_PAVILIONS',
      'EXPORT_STORE_DATA',
      'MANAGE_MEDIA',
      'EDIT_PAVILIONS',
      'DELETE_PAVILIONS',
    ],
  },
  {
    title: 'Оплаты и аналитика',
    items: [
      'VIEW_PAYMENTS',
      'VIEW_SUMMARY',
      'VIEW_ACTIVITY',
      'CREATE_PAYMENTS',
      'EDIT_PAYMENTS',
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
    title: 'Пользователи и штат',
    items: [
      'INVITE_USERS',
      'REMOVE_USERS',
      'ASSIGN_PERMISSIONS',
      'VIEW_STAFF',
      'MANAGE_STAFF',
    ],
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
  const [error, setError] = useState<string | null>(null);

  const togglePermission = (permission: string) => {
    setSelectedPermissions((prev) =>
      prev.includes(permission)
        ? prev.filter((value) => value !== permission)
        : [...prev, permission],
    );
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);

    try {
      await onSave(userId, selectedPermissions);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Не удалось сохранить права доступа');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm">
      <div className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-[#d8d1cb] bg-white shadow-[0_20px_60px_-30px_rgba(17,17,17,0.45)]">
        <div className="flex items-center justify-between border-b border-[#e8e1da] bg-white/95 px-6 py-4 backdrop-blur">
          <div>
            <h2 className="text-xl font-extrabold text-[#111111]">
              Управление правами доступа
            </h2>
            <p className="mt-1 text-sm text-[#6b6b6b]">{userEmail}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            aria-label="Закрыть"
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#d8d1cb] bg-white text-xl leading-none text-[#6b6b6b] transition hover:bg-[#f4efeb] hover:text-[#111111] disabled:opacity-50"
          >
            ×
          </button>
        </div>

        <div className="overflow-y-auto px-6 py-5">
          {error ? <ErrorMessage className="mb-4">{error}</ErrorMessage> : null}

          <div className="space-y-4">
            {PERMISSION_SECTIONS.map((section) => (
              <section
                key={section.title}
                className="rounded-2xl border border-[#d8d1cb] bg-[#f8f4ef] p-4"
              >
                <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[#6b6b6b]">
                  {section.title}
                </h3>
                <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                  {section.items.map((value) => {
                    const checked = selectedPermissions.includes(value);
                    return (
                      <label
                        key={value}
                        className={`flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-3 transition ${
                          checked
                            ? 'border-[#ff6a13]/40 bg-white'
                            : 'border-transparent bg-white/70 hover:border-[#d8d1cb]'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => togglePermission(value)}
                          className="h-4 w-4 rounded border-[#d8d1cb] text-[#ff6a13] focus:ring-[#ff6a13]"
                        />
                        <span className="text-sm font-medium text-[#111111]">
                          {PERMISSION_LABELS[value]}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-3 border-t border-[#e8e1da] px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-xl border border-[#d8d1cb] bg-white px-4 py-2.5 font-semibold text-[#111111] transition hover:bg-[#f4efeb] disabled:opacity-50"
          >
            Отмена
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="rounded-xl bg-[#ff6a13] px-4 py-2.5 font-semibold text-white transition hover:bg-[#e85a0c] disabled:opacity-50"
          >
            {saving ? 'Сохранение...' : 'Сохранить изменения'}
          </button>
        </div>
      </div>
    </div>
  );
}
