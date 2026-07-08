'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { AuthField } from '@/components/auth/AuthField';
import { AuthMessage } from '@/components/auth/AuthMessage';
import { AuthShell } from '@/components/auth/AuthShell';
import { apiFetch } from '@/lib/api';
import { setStoredAccessToken } from '@/lib/session';

export default function LoginPage() {
  const router = useRouter();
  const t = useTranslations('LoginPage');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const mapLoginError = (message: string) => {
    const normalized = message.toLowerCase();
    if (normalized.includes('invalid credentials') || normalized.includes('unauthorized')) {
      return t('errorInvalidCredentials');
    }
    return t('errorGeneric');
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await apiFetch<{ access_token: string }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: email.trim(), password }),
      });
      setStoredAccessToken(res.access_token);
      router.push('/dashboard');
    } catch (err: any) {
      console.error('Login failed:', err);
      setError(mapLoginError(String(err?.message || '')));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell
      title={t('title')}
      subtitle={t('subtitle')}
      sideTitle={t('sideTitle')}
      sideDescription={t('sideDescription')}
      sideFooter={t('sideFooter')}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <AuthField
          id="email"
          type="email"
          autoComplete="email"
          required
          label={t('emailLabel')}
          placeholder={t('emailPlaceholder')}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <AuthField
          id="password"
          type="password"
          autoComplete="current-password"
          required
          label={t('passwordLabel')}
          placeholder={t('passwordPlaceholder')}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        {error ? <AuthMessage>{error}</AuthMessage> : null}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-xl bg-[#111111] px-4 py-2.5 font-semibold text-white transition hover:bg-[#2a2a2a] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? t('submitLoading') : t('submit')}
        </button>
      </form>

      <div className="mt-5 flex items-center justify-between gap-3 text-sm">
        <Link href="/forgot-password" className="font-medium text-[#ff6a13] hover:underline">
          {t('forgotPassword')}
        </Link>
        <span className="text-[#6b6b6b]">
          {t('noAccount')}{' '}
          <Link href="/register" className="font-semibold text-[#111111] hover:underline">
            {t('register')}
          </Link>
        </span>
      </div>
    </AuthShell>
  );
}
