'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { AuthField } from '@/components/auth/AuthField';
import { AuthMessage } from '@/components/auth/AuthMessage';
import { AuthShell } from '@/components/auth/AuthShell';
import { apiFetch } from '@/lib/api';

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
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
      return 'Пароль должен быть минимум 6 символов и содержать буквы, цифры и специальный символ';
    }
    if (
      normalized.includes('verification code is required') ||
      normalized.includes('verification code is invalid') ||
      normalized.includes('invalid or expired')
    ) {
      return 'Неверный или просроченный код подтверждения';
    }
    if (normalized.includes('email already registered') || normalized.includes('already registered')) {
      return 'Пользователь с таким email уже зарегистрирован';
    }
    if (normalized.includes('email verification service is not configured')) {
      return 'Сервис отправки email не настроен';
    }
    return 'Не удалось выполнить регистрацию. Попробуйте снова.';
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSuccessMessage('');

    const isStrongPassword = /^(?=.*\p{L})(?=.*\d)(?=.*[^\p{L}\d]).{6,}$/u.test(password);
    if (!isStrongPassword) {
      setError('Пароль должен быть минимум 6 символов и содержать буквы, цифры и специальный символ');
      return;
    }

    if (password !== confirmPassword) {
      setError('Пароли не совпадают');
      return;
    }

    if (!verificationCode.trim()) {
      setError('Введите код подтверждения из email');
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
      setError('Введите email для подтверждения');
      return;
    }

    try {
      setSendingCode(true);
      await apiFetch('/auth/register/send-code', {
        method: 'POST',
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      setCodeSent(true);
      setSuccessMessage('Код подтверждения отправлен на ваш email');
    } catch (err: any) {
      setError(mapRegisterError(String(err?.message || '')));
    } finally {
      setSendingCode(false);
    }
  }

  return (
    <AuthShell
      title="Регистрация"
      subtitle="Заполните данные и подтвердите email"
      sideTitle="Создайте аккаунт для команды"
      sideDescription="После регистрации вы сможете управлять объектами, начислениями и доступами в единой системе."
      sideFooter="Для завершения регистрации нужен код подтверждения из email."
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <AuthField
          id="name"
          label="Имя"
          placeholder="Иван Иванов"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />

        <AuthField
          id="email"
          type="email"
          autoComplete="email"
          required
          label="Email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <button
          type="button"
          onClick={handleSendCode}
          disabled={sendingCode || !email.trim()}
          className="w-full rounded-xl border border-[#ff6a13] bg-white px-4 py-2.5 font-semibold text-[#ff6a13] transition hover:bg-[#ff6a13] hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          {sendingCode ? 'Отправка...' : codeSent ? 'Отправить код повторно' : 'Отправить код подтверждения'}
        </button>

        <AuthField
          id="verificationCode"
          label="Код подтверждения"
          placeholder="Введите код из письма"
          value={verificationCode}
          onChange={(e) => setVerificationCode(e.target.value)}
        />

        <AuthField
          id="password"
          type="password"
          autoComplete="new-password"
          required
          label="Пароль"
          placeholder="Введите пароль"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        <AuthField
          id="confirmPassword"
          type="password"
          autoComplete="new-password"
          required
          label="Повторите пароль"
          placeholder="Повторите пароль"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
        />

        <p className="text-xs text-[#6b6b6b]">
          Пароль: минимум 6 символов, буквы, цифры и специальный символ.
        </p>

        {successMessage ? <AuthMessage tone="success">{successMessage}</AuthMessage> : null}
        {error ? <AuthMessage>{error}</AuthMessage> : null}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-xl bg-[#111111] px-4 py-2.5 font-semibold text-white transition hover:bg-[#2a2a2a] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? 'Регистрация...' : 'Зарегистрироваться'}
        </button>
      </form>

      <p className="mt-5 text-sm text-[#6b6b6b]">
        Уже есть аккаунт?{' '}
        <Link href="/login" className="font-semibold text-[#111111] hover:underline">
          Войти
        </Link>
      </p>
    </AuthShell>
  );
}
