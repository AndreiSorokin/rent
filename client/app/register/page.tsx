'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
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
      return 'Пользователь с таким электронным адресом уже зарегистрирован';
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
    <div className="min-h-screen bg-[#f6f1eb] px-4 py-8">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-5xl items-center justify-center">
        <div className="grid w-full overflow-hidden rounded-3xl border border-[#d8d1cb] bg-white shadow-[0_20px_60px_-20px_rgba(17,17,17,0.25)] lg:grid-cols-2">
          <section className="hidden bg-[#f4efeb] p-10 lg:block">
            <div className="flex h-full flex-col justify-between">
              <div>
                <p className="text-sm font-semibold tracking-[0.2em] text-[#6b6b6b]">Palaci</p>
                <h1 className="mt-6 text-4xl font-extrabold leading-tight text-[#111111]">
                  Создайте аккаунт для команды
                </h1>
                <p className="mt-4 max-w-sm text-sm leading-6 text-[#6b6b6b]">
                  После регистрации вы сможете управлять объектами, начислениями и доступами в единой системе.
                </p>
              </div>
              <div className="rounded-2xl border border-[#e6ded7] bg-white p-4 text-sm text-[#6b6b6b]">
                Для завершения регистрации нужен код подтверждения из email.
              </div>
            </div>
          </section>

          <section className="p-6 sm:p-10">
            <h2 className="text-3xl font-bold text-[#111111]">Регистрация</h2>
            <p className="mt-2 text-sm text-[#6b6b6b]">Заполните данные и подтвердите email</p>

            <form onSubmit={handleSubmit} className="mt-8 space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-[#111111]" htmlFor="name">
                  Имя
                </label>
                <input
                  id="name"
                  className="w-full rounded-xl border border-[#d8d1cb] bg-white px-3 py-2.5 text-[#111111] outline-none transition focus:border-[#ff6a13] focus:ring-2 focus:ring-[#ff6a13]/20"
                  placeholder="Иван Иванов"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-[#111111]" htmlFor="email">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  className="w-full rounded-xl border border-[#d8d1cb] bg-white px-3 py-2.5 text-[#111111] outline-none transition focus:border-[#ff6a13] focus:ring-2 focus:ring-[#ff6a13]/20"
                  placeholder="Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>

              <button
                type="button"
                onClick={handleSendCode}
                disabled={sendingCode || !email.trim()}
                className="w-full rounded-xl border border-[#ff6a13] bg-white px-4 py-2.5 font-semibold text-[#ff6a13] transition hover:bg-[#ff6a13] hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                {sendingCode ? 'Отправка...' : codeSent ? 'Отправить код повторно' : 'Отправить код подтверждения'}
              </button>

              <div>
                <label className="mb-1 block text-sm font-medium text-[#111111]" htmlFor="verificationCode">
                  Код подтверждения
                </label>
                <input
                  id="verificationCode"
                  className="w-full rounded-xl border border-[#d8d1cb] bg-white px-3 py-2.5 text-[#111111] outline-none transition focus:border-[#ff6a13] focus:ring-2 focus:ring-[#ff6a13]/20"
                  placeholder="Введите код из письма"
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value)}
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-[#111111]" htmlFor="password">
                  Пароль
                </label>
                <input
                  id="password"
                  type="password"
                  autoComplete="new-password"
                  required
                  className="w-full rounded-xl border border-[#d8d1cb] bg-white px-3 py-2.5 text-[#111111] outline-none transition focus:border-[#ff6a13] focus:ring-2 focus:ring-[#ff6a13]/20"
                  placeholder="Введите пароль"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-[#111111]" htmlFor="confirmPassword">
                  Повторите пароль
                </label>
                <input
                  id="confirmPassword"
                  type="password"
                  autoComplete="new-password"
                  required
                  className="w-full rounded-xl border border-[#d8d1cb] bg-white px-3 py-2.5 text-[#111111] outline-none transition focus:border-[#ff6a13] focus:ring-2 focus:ring-[#ff6a13]/20"
                  placeholder="Повторите пароль"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </div>

              <p className="text-xs text-[#6b6b6b]">
                Пароль: минимум 6 символов, буквы, цифры и специальный символ.
              </p>

              {successMessage ? (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                  {successMessage}
                </div>
              ) : null}

              {error ? (
                <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {error}
                </div>
              ) : null}

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
          </section>
        </div>
      </div>
    </div>
  );
}
