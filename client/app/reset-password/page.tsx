'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { AuthField } from '@/components/auth/AuthField';
import { AuthMessage } from '@/components/auth/AuthMessage';
import { AuthShell } from '@/components/auth/AuthShell';
import { apiFetch } from '@/lib/api';

export default function ResetPasswordPage() {
  const router = useRouter();
  const t = useTranslations('ResetPasswordPage');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const mapResetPasswordError = (message: string) => {
    const normalized = message.toLowerCase();
    if (normalized.includes('current password is incorrect')) {
      return t('errorCurrentPasswordIncorrect');
    }
    if (normalized.includes('new password must be different')) {
      return t('errorSamePassword');
    }
    if (normalized.includes('password must be at least 6 characters')) {
      return t('errorPasswordWeak');
    }
    return t('errorGeneric');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!currentPassword || !newPassword || !confirmNewPassword) {
      setError(t('errorFillAll'));
      return;
    }

    if (newPassword !== confirmNewPassword) {
      setError(t('errorMismatch'));
      return;
    }

    const isStrongPassword = /^(?=.*\p{L})(?=.*\d)(?=.*[^\p{L}\d]).{6,}$/u.test(newPassword);
    if (!isStrongPassword) {
      setError(t('errorPasswordWeak'));
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
      title={t('title')}
      subtitle={t('subtitle')}
      sideTitle={t('sideTitle')}
      sideDescription={t('sideDescription')}
      topActions={
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <Link
            href="/dashboard"
            className="inline-flex rounded-lg border border-[#d8d1cb] px-3 py-1.5 text-[#111111] hover:bg-[#f4efeb]"
          >
            {t('backToDashboard')}
          </Link>
          <Link href="/forgot-password" className="font-medium text-[#ff6a13] hover:underline">
            {t('forgotPassword')}
          </Link>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <AuthField
          id="currentPassword"
          type="password"
          required
          label={t('currentPasswordLabel')}
          placeholder={t('currentPasswordPlaceholder')}
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
        />

        <AuthField
          id="newPassword"
          type="password"
          required
          label={t('newPasswordLabel')}
          placeholder={t('newPasswordPlaceholder')}
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
        />

        <AuthField
          id="confirmNewPassword"
          type="password"
          required
          label={t('confirmNewPasswordLabel')}
          placeholder={t('confirmNewPasswordPlaceholder')}
          value={confirmNewPassword}
          onChange={(e) => setConfirmNewPassword(e.target.value)}
        />

        <p className="text-xs text-[#6b6b6b]">{t('passwordHint')}</p>

        {error ? <AuthMessage>{error}</AuthMessage> : null}

        <button
          type="submit"
          disabled={saving}
          className="w-full rounded-xl bg-[#111111] px-4 py-2.5 font-semibold text-white transition hover:bg-[#2a2a2a] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving ? t('submitLoading') : t('submit')}
        </button>
      </form>
    </AuthShell>
  );
}
