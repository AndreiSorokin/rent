'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api';

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');

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
      normalized.includes('email already registered') ||
      normalized.includes('already registered') ||
      normalized.includes('bad request')
    ) {
      return 'Пользователь с таким электронным адресом уже зарегистрирован';
    }
    return 'Не удалось выполнить регистрацию. Попробуйте снова.';
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    const isStrongPassword =
      /^(?=.*\p{L})(?=.*\d)(?=.*[^\p{L}\d]).{6,}$/u.test(password);
    if (!isStrongPassword) {
      setError(
        'Пароль должен быть минимум 6 символов и содержать буквы, цифры и специальный символ',
      );
      return;
    }

    if (password !== confirmPassword) {
      setError('Пароли не совпадают');
      return;
    }

    try {
      await apiFetch('/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          name: name.trim() || undefined,
          email,
          password,
        }),
      });

      router.push('/login');
    } catch (err: any) {
      console.error('Registration failed:', err);
      setError(mapRegisterError(String(err?.message || '')));
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center">
      <form onSubmit={handleSubmit} className="w-96 space-y-4 rounded border p-6">
        <h1 className="text-xl font-bold">Регистрация</h1>

        <input
          className="w-full border p-2"
          placeholder="Имя"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />

        <input
          className="w-full border p-2"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <input
          type="password"
          className="w-full border p-2"
          placeholder="Пароль"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        <input
          type="password"
          className="w-full border p-2"
          placeholder="Повторите пароль"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
        />

        <p className="text-xs text-gray-500">
          Пароль: минимум 6 символов, буквы, цифры и специальный символ.
        </p>

        {error && <p className="text-red-500">{error}</p>}

        <button className="w-full bg-black p-2 text-white">Зарегистрироваться</button>

        <p className="text-center text-sm text-gray-600">
          Уже есть аккаунт?{' '}
          <Link href="/login" className="text-blue-600 hover:underline">
            Войти
          </Link>
        </p>
      </form>
    </div>
  );
}

