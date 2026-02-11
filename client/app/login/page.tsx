'use client';

import { useState } from 'react';
import { apiFetch } from '@/lib/api';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    try {
      const res = await apiFetch<{ access_token: string }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });

      localStorage.setItem('token', res.access_token);
      router.push('/dashboard');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      console.error('Login failed:', err);
      setError(err.message);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center">
      <form
        onSubmit={handleSubmit}
        className="w-96 space-y-4 rounded border p-6"
      >
        <h1 className="text-xl font-bold">Login</h1>

        <input
          className="w-full border p-2"
          placeholder="Email"
          value={email}
          onChange={e => setEmail(e.target.value)}
        />

        <input
          type="password"
          className="w-full border p-2"
          placeholder="Password"
          value={password}
          onChange={e => setPassword(e.target.value)}
        />

        {error && <p className="text-red-500">{error}</p>}

        <button className="w-full bg-black p-2 text-white">
          Login
        </button>

        <p className="text-center text-sm text-gray-600">
          Нет аккаунта?{' '}
          <Link href="/register" className="text-blue-600 hover:underline">
            Зарегестироваться
          </Link>
        </p>
      </form>
    </div>
  );
}
