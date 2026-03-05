'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { AuthField } from '@/components/auth/AuthField';
import { AuthMessage } from '@/components/auth/AuthMessage';
import { AuthShell } from '@/components/auth/AuthShell';
import { apiFetch } from '@/lib/api';

function mapResetPasswordError(message: string) {
  const normalized = message.toLowerCase();
  if (normalized.includes('current password is incorrect')) {
    return 'Текущий пароль введен неверно';
  }
  if (normalized.includes('new password must be different')) {
    return 'Новый пароль должен отличаться от текущего';
  }
  if (normalized.includes('password must be at least 6 characters')) {
    return 'Пароль должен быть минимум 6 символов и содержать буквы, цифры и специальный символ';
  }
  return 'Не удалось обновить пароль';
}

export default function ResetPasswordPage() {
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!currentPassword || !newPassword || !confirmNewPassword) {
      setError('Заполните все поля');
      return;
    }

    if (newPassword !== confirmNewPassword) {
      setError('Новый пароль и подтверждение не совпадают');
      return;
    }

    const isStrongPassword = /^(?=.*\p{L})(?=.*\d)(?=.*[^\p{L}\d]).{6,}$/u.test(newPassword);
    if (!isStrongPassword) {
      setError('Пароль должен быть минимум 6 символов и содержать буквы, цифры и специальный символ');
      return;
    }

    try {
      setSaving(true);
      await apiFetch('/users/me/password', {
        method: 'PATCH',
        body: JSON.stringify({
          currentPassword,
          newPassword,
        }),
      });

      localStorage.removeItem('token');
      router.replace('/login');
    } catch (err: any) {
      setError(mapResetPasswordError(String(err?.message || '')));
    } finally {
      setSaving(false);
    }
  };

  return (
    <AuthShell
      title="Изменить пароль"
      subtitle="Введите текущий и новый пароль"
      sideTitle="Смена пароля"
      sideDescription="После сохранения потребуется повторный вход в систему."
      topActions={
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <Link
            href="/dashboard"
            className="inline-flex rounded-lg border border-[#d8d1cb] px-3 py-1.5 text-[#111111] hover:bg-[#f4efeb]"
          >
            Назад в кабинет
          </Link>
          <Link href="/forgot-password" className="font-medium text-[#ff6a13] hover:underline">
            Забыли пароль?
          </Link>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <AuthField
          id="currentPassword"
          type="password"
          required
          label="Текущий пароль"
          placeholder="Введите текущий пароль"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
        />

        <AuthField
          id="newPassword"
          type="password"
          required
          label="Новый пароль"
          placeholder="Введите новый пароль"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
        />

        <AuthField
          id="confirmNewPassword"
          type="password"
          required
          label="Подтверждение пароля"
          placeholder="Повторите новый пароль"
          value={confirmNewPassword}
          onChange={(e) => setConfirmNewPassword(e.target.value)}
        />

        <p className="text-xs text-[#6b6b6b]">
          Минимум 6 символов, буквы, цифры и специальный символ.
        </p>

        {error ? <AuthMessage>{error}</AuthMessage> : null}

        <button
          type="submit"
          disabled={saving}
          className="w-full rounded-xl bg-[#111111] px-4 py-2.5 font-semibold text-white transition hover:bg-[#2a2a2a] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving ? 'Сохранение...' : 'Обновить пароль'}
        </button>
      </form>
    </AuthShell>
  );
}
