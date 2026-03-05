'use client';

import { Suspense, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { BackButton } from '@/components/BackButton';
import { AuthField } from '@/components/auth/AuthField';
import { AuthMessage } from '@/components/auth/AuthMessage';
import { AuthShell } from '@/components/auth/AuthShell';
import { apiFetch } from '@/lib/api';

function mapError(message: string) {
  const normalized = message.toLowerCase();
  if (normalized.includes('invalid or expired') || normalized.includes('reset token')) {
    return 'Ссылка недействительна или срок действия истек';
  }
  if (normalized.includes('password must be at least 6 characters')) {
    return 'Пароль должен быть минимум 6 символов и содержать буквы, цифры и специальный символ';
  }
  if (normalized.includes('new password must be different')) {
    return 'Новый пароль должен отличаться от предыдущего';
  }
  return 'Не удалось обновить пароль';
}

function ForgotPasswordResetForm() {
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

    const isStrongPassword = /^(?=.*\p{L})(?=.*\d)(?=.*[^\p{L}\d]).{6,}$/u.test(newPassword);
    if (!isStrongPassword) {
      setError('Пароль должен быть минимум 6 символов и содержать буквы, цифры и специальный символ');
      return;
    }

    try {
      setSaving(true);
      await apiFetch('/auth/forgot-password/reset', {
        method: 'POST',
        body: JSON.stringify({ token, newPassword }),
      });
      localStorage.removeItem('token');
      router.replace('/login');
    } catch (err: any) {
      setError(mapError(String(err?.message || '')));
    } finally {
      setSaving(false);
    }
  };

  return (
    <AuthShell
      title="Новый пароль"
      subtitle="Введите и подтвердите новый пароль"
      sideTitle="Создайте новый пароль"
      sideDescription="Новый пароль начнет действовать сразу после сохранения."
      topActions={
        <BackButton
          label="Назад"
          className="inline-flex rounded-lg border border-[#d8d1cb] px-3 py-1.5 text-sm text-[#111111] hover:bg-[#f4efeb]"
        />
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
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
          id="confirmPassword"
          type="password"
          required
          label="Повторите пароль"
          placeholder="Повторите новый пароль"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
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
          {saving ? 'Сохранение...' : 'Сохранить новый пароль'}
        </button>
      </form>
    </AuthShell>
  );
}

export default function ForgotPasswordResetPage() {
  return (
    <Suspense fallback={<div className="p-6 text-center text-lg">Загрузка...</div>}>
      <ForgotPasswordResetForm />
    </Suspense>
  );
}
