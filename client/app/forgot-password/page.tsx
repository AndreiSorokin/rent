'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { BackButton } from '@/components/BackButton';
import { AuthField } from '@/components/auth/AuthField';
import { AuthMessage } from '@/components/auth/AuthMessage';
import { AuthShell } from '@/components/auth/AuthShell';
import { apiFetch } from '@/lib/api';

export default function ForgotPasswordPage() {
  const t = useTranslations('ForgotPasswordPage');
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');

    if (!email.trim()) {
      setError(t('errorEmailRequired'));
      return;
    }

    try {
      setSending(true);
      await apiFetch('/auth/forgot-password/request', {
        method: 'POST',
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      console.log('Password reset request sent for email:', email);
      setMessage(t('successMessage'));
    } catch (err: any) {
      setError(err?.message || t('errorGeneric'));
    } finally {
      setSending(false);
    }
  };

  return (
    <AuthShell
      title={t('title')}
      subtitle={t('subtitle')}
      sideTitle={t('sideTitle')}
      sideDescription={t('sideDescription')}
      topActions={
        <BackButton
          label={t('back')}
          className="inline-flex rounded-lg border border-[#d8d1cb] px-3 py-1.5 text-sm text-[#111111] hover:bg-[#f4efeb]"
        />
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <AuthField
          id="email"
          type="email"
          required
          label={t('emailLabel')}
          placeholder={t('emailPlaceholder')}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        {error ? <AuthMessage>{error}</AuthMessage> : null}
        {message ? <AuthMessage tone="success">{message}</AuthMessage> : null}

        <button
          type="submit"
          disabled={sending}
          className="w-full rounded-xl bg-[#111111] px-4 py-2.5 font-semibold text-white transition hover:bg-[#2a2a2a] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {sending ? t('submitLoading') : t('submit')}
        </button>
      </form>
    </AuthShell>
  );
}
