'use server';

import { cookies } from 'next/headers';
import { locales, localeCookieName, type Locale } from '@/i18n/request';

export async function setLocale(locale: Locale) {
  if (!locales.includes(locale)) return;

  const cookieStore = await cookies();
  cookieStore.set(localeCookieName, locale, {
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
    sameSite: 'lax',
  });
}
