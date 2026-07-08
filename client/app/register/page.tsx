'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { AuthField } from '@/components/auth/AuthField';
import { AuthMessage } from '@/components/auth/AuthMessage';
import { AuthShell } from '@/components/auth/AuthShell';
import { apiFetch } from '@/lib/api';

export default function RegisterPage() {
  const router = useRouter();
  const t = useTranslations('RegisterPage');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [acceptedConsent, setAcceptedConsent] = useState(false);
  const [sendingCode, setSendingCode] = useState(false);
  const [codeSent, setCodeSent] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const mapRegisterError = (message: string) => {
    const normalized = message.toLowerCase();
    if (
      normalized.includes('password must be at least 6 characters') ||
      (normalized.includes('password') &&
        normalized.includes('letters') &&
        normalized.includes('numbers'))
    ) {
      return t('errorPasswordWeak');
    }
    if (
      normalized.includes('verification code is required') ||
      normalized.includes('verification code is invalid') ||
      normalized.includes('invalid or expired')
    ) {
      return t('errorInvalidCode');
    }
    if (normalized.includes('email already registered') || normalized.includes('already registered')) {
      return t('errorEmailTaken');
    }
    if (normalized.includes('email verification service is not configured')) {
      return t('errorEmailServiceUnavailable');
    }
    if (normalized.includes('consent to personal data processing is required')) {
      return t('errorConsentRequired');
    }
    return t('errorGeneric');
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSuccessMessage('');

    const isStrongPassword = /^(?=.*\p{L})(?=.*\d)(?=.*[^\p{L}\d]).{6,}$/u.test(password);
    if (!isStrongPassword) {
      setError(t('errorPasswordWeak'));
      return;
    }

    if (password !== confirmPassword) {
      setError(t('errorPasswordsMismatch'));
      return;
    }

    if (!verificationCode.trim()) {
      setError(t('errorCodeRequired'));
      return;
    }

    if (!acceptedConsent) {
      setError(t('errorConsentRequired'));
      return;
    }

    try {
      setLoading(true);
      await apiFetch('/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          name: name.trim() || undefined,
          email: email.trim().toLowerCase(),
          password,
          verificationCode: verificationCode.trim(),
          personalDataConsent: true,
        }),
      });
      router.push('/login');
    } catch (err: any) {
      setError(mapRegisterError(String(err?.message || '')));
    } finally {
      setLoading(false);
    }
  }

  async function handleSendCode() {
    setError('');
    setSuccessMessage('');

    if (!email.trim()) {
      setError(t('errorEmailRequired'));
      return;
    }

    try {
      setSendingCode(true);
      await apiFetch('/auth/register/send-code', {
        method: 'POST',
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      setCodeSent(true);
      setSuccessMessage(t('codeSentMessage'));
    } catch (err: any) {
      setError(mapRegisterError(String(err?.message || '')));
    } finally {
      setSendingCode(false);
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
          id="name"
          label={t('nameLabel')}
          placeholder={t('namePlaceholder')}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />

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

        <button
          type="button"
          onClick={handleSendCode}
          disabled={sendingCode || !email.trim()}
          className="w-full rounded-xl border border-[#ff6a13] bg-white px-4 py-2.5 font-semibold text-[#ff6a13] transition hover:bg-[#ff6a13] hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          {sendingCode ? t('sendingCode') : codeSent ? t('sendCodeAgain') : t('sendCode')}
        </button>

        <AuthField
          id="verificationCode"
          label={t('codeLabel')}
          placeholder={t('codePlaceholder')}
          value={verificationCode}
          onChange={(e) => setVerificationCode(e.target.value)}
        />

        <AuthField
          id="password"
          type="password"
          autoComplete="new-password"
          required
          label={t('passwordLabel')}
          placeholder={t('passwordPlaceholder')}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        <AuthField
          id="confirmPassword"
          type="password"
          autoComplete="new-password"
          required
          label={t('confirmPasswordLabel')}
          placeholder={t('confirmPasswordPlaceholder')}
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
        />

        <p className="text-xs leading-6 text-[#6b6b6b]">{t('passwordHint')}</p>

        <label className="flex items-start gap-3 rounded-2xl border border-[#E8E1DA] bg-[#F9F5F0] px-4 py-4 text-sm leading-6 text-[#374151]">
          <input
            type="checkbox"
            checked={acceptedConsent}
            onChange={(e) => setAcceptedConsent(e.target.checked)}
            className="mt-1 h-4 w-4 rounded border-[#CFC6BF] text-[#FF6A13] focus:ring-[#FF6A13]"
          />
          <span>
            {t('consentPrefix')}{' '}
            <Link
              href="/offer"
              className="font-semibold text-[#111111] underline underline-offset-2 hover:text-[#ff6a13]"
            >
              {t('consentOffer')}
            </Link>
            ,{' '}
            <Link
              href="/user-agreement"
              className="font-semibold text-[#111111] underline underline-offset-2 hover:text-[#ff6a13]"
            >
              {t('consentUserAgreement')}
            </Link>
            ,{' '}
            <Link
              href="/site-consent"
              className="font-semibold text-[#111111] underline underline-offset-2 hover:text-[#ff6a13]"
            >
              {t('consentSiteConsent')}
            </Link>{' '}
            {t('consentAnd')}{' '}
            <Link
              href="/privacy"
              className="font-semibold text-[#111111] underline underline-offset-2 hover:text-[#ff6a13]"
            >
              {t('consentPrivacy')}
            </Link>
            .
          </span>
        </label>

        {successMessage ? <AuthMessage tone="success">{successMessage}</AuthMessage> : null}
        {error ? <AuthMessage>{error}</AuthMessage> : null}

        <button
          type="submit"
          disabled={loading || !acceptedConsent}
          className="w-full rounded-xl bg-[#111111] px-4 py-2.5 font-semibold text-white transition hover:bg-[#2a2a2a] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? t('submitLoading') : t('submit')}
        </button>
      </form>

      <p className="mt-5 text-sm text-[#6b6b6b]">
        {t('haveAccount')}{' '}
        <Link href="/login" className="font-semibold text-[#111111] hover:underline">
          {t('login')}
        </Link>
      </p>
    </AuthShell>
  );
}
