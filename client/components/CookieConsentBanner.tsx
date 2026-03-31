'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

const STORAGE_KEY = 'palaci-cookie-consent-v1';

export function CookieConsentBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const storedValue = localStorage.getItem(STORAGE_KEY);
    if (!storedValue) {
      setVisible(true);
    }
  }, []);

  const saveDecision = (value: 'accepted' | 'essential-only') => {
    localStorage.setItem(STORAGE_KEY, value);
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed inset-x-0 bottom-4 z-[120] px-4">
      <div className="mx-auto max-w-5xl rounded-2xl border border-[#d8d1cb] bg-white/95 p-4 shadow-[0_20px_60px_-30px_rgba(17,17,17,0.45)] backdrop-blur">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold text-[#111111]">Файлы cookie</p>
            <p className="mt-1 text-sm leading-6 text-[#4B5563]">
              Мы используем cookie для корректной работы сайта и улучшения пользовательского
              опыта. Продолжая пользоваться Palaci, вы можете согласиться на использование
              cookie или оставить только необходимые.
            </p>
            <div className="mt-2 flex flex-wrap gap-3 text-sm text-[#6B6B6B]">
              <Link href="/cookies" className="font-semibold text-[#111111] hover:text-[#ff6a13]">
                Подробнее о cookie
              </Link>
              <Link href="/privacy" className="font-semibold text-[#111111] hover:text-[#ff6a13]">
                Политика конфиденциальности
              </Link>
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => saveDecision('essential-only')}
              className="rounded-xl border border-[#d8d1cb] bg-white px-4 py-2 text-sm font-semibold text-[#111111] transition hover:bg-[#f4efeb]"
            >
              Только необходимые
            </button>
            <button
              type="button"
              onClick={() => saveDecision('accepted')}
              className="rounded-xl bg-[#ff6a13] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#e85a0c]"
            >
              Согласиться
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
