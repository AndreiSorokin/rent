'use client';

import { useTransition } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { setLocale } from '@/app/actions/locale';
import type { Locale } from '@/i18n/request';

const LANGUAGES: { code: Locale; label: string }[] = [
  { code: 'ru', label: 'RU' },
  { code: 'en', label: 'EN' },
];

export function LanguageSwitcher() {
  const locale = useLocale();
  const t = useTranslations('LanguageSwitcher');
  const [isPending, startTransition] = useTransition();

  const handleChange = (next: Locale) => {
    if (next === locale || isPending) return;
    startTransition(async () => {
      await setLocale(next);
      // A full reload (not router.refresh()) is required here: Next.js keeps a
      // client-side router cache of already-visited/prefetched routes, so a
      // soft refresh only updates the current page — other routes (e.g.
      // /dashboard) would keep serving their stale, previously-cached locale
      // until the whole app is reloaded from the server.
      window.location.reload();
    });
  };

  return (
    <div
      className="fixed right-3 top-3 z-[130] flex items-center gap-0.5 rounded-full border border-[#D8D1CB] bg-white/95 p-1 text-xs font-semibold shadow-sm backdrop-blur"
      aria-label={t('ariaLabel')}
    >
      {LANGUAGES.map((lang) => (
        <button
          key={lang.code}
          type="button"
          onClick={() => handleChange(lang.code)}
          disabled={isPending}
          aria-pressed={locale === lang.code}
          className={`rounded-full px-2.5 py-1 transition disabled:opacity-60 ${
            locale === lang.code
              ? 'bg-[#FF6A13] text-white'
              : 'text-[#374151] hover:bg-[#F4EFEB]'
          }`}
        >
          {lang.label}
        </button>
      ))}
    </div>
  );
}
