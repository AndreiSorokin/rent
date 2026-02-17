'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
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

    const isStrongPassword =
      /^(?=.*\p{L})(?=.*\d)(?=.*[^\p{L}\d]).{6,}$/u.test(newPassword);
    if (!isStrongPassword) {
      setError(
        'Пароль должен быть минимум 6 символов и содержать буквы, цифры и специальный символ',
      );
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
      alert('Пароль обновлен. Выполните вход снова.');
      router.replace('/login');
    } catch (err: any) {
      setError(mapResetPasswordError(String(err?.message || '')));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
      <form onSubmit={handleSubmit} className="w-full max-w-md space-y-4 rounded-xl bg-white p-6 shadow">
        <div className="flex justify-between text-sm">
          <Link href="/dashboard" className="text-blue-600 hover:underline">
            Назад в личный кабинет
          </Link>
          <Link href="/forgot-password" className="text-blue-600 hover:underline">
            Забыли пароль?
          </Link>
        </div>

        <h1 className="text-xl font-bold">Смена пароля</h1>

        <input
          type="password"
          className="w-full rounded border p-2"
          placeholder="Текущий пароль"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
        />

        <input
          type="password"
          className="w-full rounded border p-2"
          placeholder="Новый пароль"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
        />

        <input
          type="password"
          className="w-full rounded border p-2"
          placeholder="Повторите новый пароль"
          value={confirmNewPassword}
          onChange={(e) => setConfirmNewPassword(e.target.value)}
        />

        <p className="text-xs text-gray-500">
          Минимум 6 символов, буквы, цифры и специальный символ.
        </p>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={saving}
          className="w-full rounded bg-blue-600 p-2 text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving ? 'Сохранение...' : 'Обновить пароль'}
        </button>
      </form>
    </div>
  );
}

