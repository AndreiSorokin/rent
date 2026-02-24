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
  const [verificationCode, setVerificationCode] = useState('');
  const [sendingCode, setSendingCode] = useState(false);
  const [codeSent, setCodeSent] = useState(false);
  const [error, setError] = useState('');

  const mapRegisterError = (message: string) => {
    const normalized = message.toLowerCase();
    if (
      normalized.includes('password must be at least 6 characters') ||
      (normalized.includes('password') &&
        normalized.includes('letters') &&
        normalized.includes('numbers'))
    ) {
      return 'РџР°СЂРѕР»СЊ РґРѕР»Р¶РµРЅ Р±С‹С‚СЊ РјРёРЅРёРјСѓРј 6 СЃРёРјРІРѕР»РѕРІ Рё СЃРѕРґРµСЂР¶Р°С‚СЊ Р±СѓРєРІС‹, С†РёС„СЂС‹ Рё СЃРїРµС†РёР°Р»СЊРЅС‹Р№ СЃРёРјРІРѕР»';
    }
    if (
      normalized.includes('verification code is required') ||
      normalized.includes('verification code is invalid') ||
      normalized.includes('invalid or expired')
    ) {
      return 'РќРµРІРµСЂРЅС‹Р№ РёР»Рё РїСЂРѕСЃСЂРѕС‡РµРЅРЅС‹Р№ РєРѕРґ РїРѕРґС‚РІРµСЂР¶РґРµРЅРёСЏ';
    }
    if (normalized.includes('verification code sent')) {
      return 'РљРѕРґ РїРѕРґС‚РІРµСЂР¶РґРµРЅРёСЏ РѕС‚РїСЂР°РІР»РµРЅ РЅР° email';
    }
    if (
      normalized.includes('email already registered') ||
      normalized.includes('already registered') ) {
      return 'РџРѕР»СЊР·РѕРІР°С‚РµР»СЊ СЃ С‚Р°РєРёРј СЌР»РµРєС‚СЂРѕРЅРЅС‹Рј Р°РґСЂРµСЃРѕРј СѓР¶Рµ Р·Р°СЂРµРіРёСЃС‚СЂРёСЂРѕРІР°РЅ';
    }
    return 'РќРµ СѓРґР°Р»РѕСЃСЊ РІС‹РїРѕР»РЅРёС‚СЊ СЂРµРіРёСЃС‚СЂР°С†РёСЋ. РџРѕРїСЂРѕР±СѓР№С‚Рµ СЃРЅРѕРІР°.';
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    const isStrongPassword =
      /^(?=.*\p{L})(?=.*\d)(?=.*[^\p{L}\d]).{6,}$/u.test(password);
    if (!isStrongPassword) {
      setError(
        'РџР°СЂРѕР»СЊ РґРѕР»Р¶РµРЅ Р±С‹С‚СЊ РјРёРЅРёРјСѓРј 6 СЃРёРјРІРѕР»РѕРІ Рё СЃРѕРґРµСЂР¶Р°С‚СЊ Р±СѓРєРІС‹, С†РёС„СЂС‹ Рё СЃРїРµС†РёР°Р»СЊРЅС‹Р№ СЃРёРјРІРѕР»',
      );
      return;
    }

    if (password !== confirmPassword) {
      setError('РџР°СЂРѕР»Рё РЅРµ СЃРѕРІРїР°РґР°СЋС‚');
      return;
    }
    if (!verificationCode.trim()) {
      setError('Р’РІРµРґРёС‚Рµ РєРѕРґ РїРѕРґС‚РІРµСЂР¶РґРµРЅРёСЏ РёР· email');
      return;
    }

    try {
      await apiFetch('/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          name: name.trim() || undefined,
          email,
          password,
          verificationCode: verificationCode.trim(),
        }),
      });

      router.push('/login');
    } catch (err: any) {
      console.error('Registration failed:', err);
      setError(mapRegisterError(String(err?.message || '')));
    }
  }

  async function handleSendCode() {
    setError('');

    if (!email.trim()) {
      setError('Р’РІРµРґРёС‚Рµ email РґР»СЏ РїРѕРґС‚РІРµСЂР¶РґРµРЅРёСЏ');
      return;
    }

    try {
      setSendingCode(true);
      await apiFetch('/auth/register/send-code', {
        method: 'POST',
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      setCodeSent(true);
      alert('РљРѕРґ РїРѕРґС‚РІРµСЂР¶РґРµРЅРёСЏ РѕС‚РїСЂР°РІР»РµРЅ РЅР° РІР°С€ email');
    } catch (err: any) {
      console.error('Send code failed:', err);
      setError(mapRegisterError(String(err?.message || '')));
    } finally {
      setSendingCode(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center">
      <form onSubmit={handleSubmit} className="w-96 space-y-4 rounded border p-6">
        <h1 className="text-xl font-bold">Р РµРіРёСЃС‚СЂР°С†РёСЏ</h1>

        <input
          className="w-full border p-2"
          placeholder="РРјСЏ"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />

        <input
          className="w-full border p-2"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <button
          type="button"
          onClick={handleSendCode}
          disabled={sendingCode || !email.trim()}
          className="w-full rounded bg-blue-600 p-2 text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          {sendingCode ? 'РћС‚РїСЂР°РІРєР°...' : codeSent ? 'РћС‚РїСЂР°РІРёС‚СЊ РєРѕРґ РїРѕРІС‚РѕСЂРЅРѕ' : 'РћС‚РїСЂР°РІРёС‚СЊ РєРѕРґ РїРѕРґС‚РІРµСЂР¶РґРµРЅРёСЏ'}
        </button>

        <input
          className="w-full border p-2"
          placeholder="РљРѕРґ РїРѕРґС‚РІРµСЂР¶РґРµРЅРёСЏ РёР· email"
          value={verificationCode}
          onChange={(e) => setVerificationCode(e.target.value)}
        />

        <input
          type="password"
          className="w-full border p-2"
          placeholder="РџР°СЂРѕР»СЊ"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        <input
          type="password"
          className="w-full border p-2"
          placeholder="РџРѕРІС‚РѕСЂРёС‚Рµ РїР°СЂРѕР»СЊ"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
        />

        <p className="text-xs text-gray-500">
          РџР°СЂРѕР»СЊ: РјРёРЅРёРјСѓРј 6 СЃРёРјРІРѕР»РѕРІ, Р±СѓРєРІС‹, С†РёС„СЂС‹ Рё СЃРїРµС†РёР°Р»СЊРЅС‹Р№ СЃРёРјРІРѕР».
        </p>

        {error && <p className="text-red-500">{error}</p>}

        <button className="w-full bg-black p-2 text-white">Р—Р°СЂРµРіРёСЃС‚СЂРёСЂРѕРІР°С‚СЊСЃСЏ</button>

        <p className="text-center text-sm text-gray-600">
          РЈР¶Рµ РµСЃС‚СЊ Р°РєРєР°СѓРЅС‚?{' '}
          <Link href="/login" className="text-blue-600 hover:underline">
            Р’РѕР№С‚Рё
          </Link>
        </p>
      </form>
    </div>
  );
}

