'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { apiFetch } from '@/lib/api';

function mapError(message: string) {
  const normalized = message.toLowerCase();
  if (
    normalized.includes('invalid or expired') ||
    normalized.includes('reset token')
  ) {
    return 'Ссылка недействительна или истек срок действия';
  }
  if (normalized.includes('password must be at least 6 characters')) {
    return 'Пароль должен быть минимум 6 символов и содержать буквы, цифры и специальный символ';
  }
  if (normalized.includes('new password must be different')) {
    return 'Новый пароль должен отличаться от предыдущего';
  }
  return 'Не удалось обновить пароль';
}

export default function ForgotPasswordResetPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = useMemo(() => searchParams.get('token') || '', [searchParams]);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!token) {
      setError('Отсутствует токен сброса пароля');
      return;
    }
    if (!newPassword || !confirmPassword) {
      setError('Заполните все поля');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Пароли не совпадают');
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
      await apiFetch('/auth/forgot-password/reset', {
        method: 'POST',
        body: JSON.stringify({
          token,
          newPassword,
        }),
      });
      localStorage.removeItem('token');
      alert('Пароль успешно обновлен. Войдите с новым паролем.');
      router.replace('/login');
    } catch (err: any) {
      setError(mapError(String(err?.message || '')));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
      <form onSubmit={handleSubmit} className="w-full max-w-md space-y-4 rounded-xl bg-white p-6 shadow">
        <Link href="/login" className="text-sm text-blue-600 hover:underline">
          Назад ко входу
        </Link>
        <h1 className="text-xl font-bold">Создать новый пароль</h1>

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
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
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
          {saving ? 'Сохранение...' : 'Сохранить новый пароль'}
        </button>
      </form>
    </div>
  );
}

