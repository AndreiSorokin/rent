'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { apiFetch } from '@/lib/api';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const mapLoginError = (message: string) => {
    const normalized = message.toLowerCase();
    if (normalized.includes('invalid credentials') || normalized.includes('unauthorized')) {
      return 'Неверный логин или пароль';
    }
    return 'Не удалось выполнить вход. Попробуйте снова.';
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
      localStorage.setItem('token', res.access_token);
      router.push('/dashboard');
    } catch (err: any) {
      console.error('Login failed:', err);
      setError(mapLoginError(String(err?.message || '')));
    } finally {
      setLoading(false);
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
                  Управляйте объектами без хаоса
                </h1>
                <p className="mt-4 max-w-sm text-sm leading-6 text-[#6b6b6b]">
                  Доходы, расходы, права доступа и сводка по объектам в одном рабочем пространстве.
                </p>
              </div>
              <div className="rounded-2xl border border-[#e6ded7] bg-white p-4 text-sm text-[#6b6b6b]">
                Вход доступен только зарегистрированным пользователям.
              </div>
            </div>
          </section>

          <section className="p-6 sm:p-10">
            <h2 className="text-3xl font-bold text-[#111111]">Вход</h2>
            <p className="mt-2 text-sm text-[#6b6b6b]">Введите email и пароль, чтобы продолжить</p>

            <form onSubmit={handleSubmit} className="mt-8 space-y-4">
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

              <div>
                <label className="mb-1 block text-sm font-medium text-[#111111]" htmlFor="password">
                  Пароль
                </label>
                <input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  className="w-full rounded-xl border border-[#d8d1cb] bg-white px-3 py-2.5 text-[#111111] outline-none transition focus:border-[#ff6a13] focus:ring-2 focus:ring-[#ff6a13]/20"
                  placeholder="Введите пароль"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>

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
                {loading ? 'Выполняется вход...' : 'Войти'}
              </button>
            </form>

            <div className="mt-5 flex items-center justify-between gap-3 text-sm">
              <Link href="/forgot-password" className="font-medium text-[#ff6a13] hover:underline">
                Забыли пароль?
              </Link>
              <span className="text-[#6b6b6b]">
                Нет аккаунта?{' '}
                <Link href="/register" className="font-semibold text-[#111111] hover:underline">
                  Зарегистрироваться
                </Link>
              </span>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
