'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { LogoutButton } from '@/components/LogoutButton';

const ANON_ONLY_PATHS = new Set(['/login', '/register']);

function isPublicPath(pathname: string | null) {
  if (!pathname) return false;
  if (pathname === '/') return true;
  if (pathname === '/privacy') return true;
  if (ANON_ONLY_PATHS.has(pathname)) return true;
  return pathname.startsWith('/forgot-password');
}

function isAnonOnlyPath(pathname: string | null) {
  if (!pathname) return false;
  return ANON_ONLY_PATHS.has(pathname);
}

function isTokenExpired(token: string) {
  try {
    const payload = JSON.parse(atob(token.split('.')[1])) as { exp?: number };
    if (!payload.exp) return false;
    return payload.exp * 1000 <= Date.now();
  } catch {
    return true;
  }
}

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const isPublic = isPublicPath(pathname);
  const isAnonOnly = isAnonOnlyPath(pathname);
  const isStorePage = Boolean(pathname && /^\/stores\/\d+(?:\/.*)?$/.test(pathname));

  useEffect(() => {
    const token = localStorage.getItem('token');

    if (!token || isTokenExpired(token)) {
      localStorage.removeItem('token');
      if (!isPublic) {
        router.replace('/login');
      }
      return;
    }

    if (isAnonOnly) {
      router.replace('/dashboard');
    }
  }, [pathname, router, isAnonOnly, isPublic]);

  return (
    <>
      {!isPublic && !isStorePage && (
        <div className="fixed right-8 top-8 z-50 hidden lg:block">
          <LogoutButton className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700 shadow-sm hover:bg-red-100" />
        </div>
      )}
      {children}
    </>
  );
}
