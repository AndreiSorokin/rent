'use client';

import { useState } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');

    if (!email.trim()) {
      setError('Введите email');
      return;
    }

    try {
      setSending(true);
      await apiFetch('/auth/forgot-password/request', {
        method: 'POST',
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      setMessage('Если аккаунт с таким email существует, ссылка отправлена.');
    } catch (err: any) {
      setError(err?.message || 'Не удалось отправить письмо');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
      <form onSubmit={handleSubmit} className="w-full max-w-md space-y-4 rounded-xl bg-white p-6 shadow">
        <Link href="/login" className="text-sm text-blue-600 hover:underline">
          Назад
        </Link>
        <h1 className="text-xl font-bold">Забыли пароль?</h1>
        <p className="text-sm text-gray-600">
          Введите email, и мы отправим ссылку для создания нового пароля.
        </p>

        <input
          className="w-full rounded border p-2"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        {error && <p className="text-sm text-red-600">{error}</p>}
        {message && <p className="text-sm text-green-700">{message}</p>}

        <button
          type="submit"
          disabled={sending}
          className="w-full rounded bg-blue-600 p-2 text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {sending ? 'Отправка...' : 'Отправить ссылку'}
        </button>
      </form>
    </div>
  );
}

