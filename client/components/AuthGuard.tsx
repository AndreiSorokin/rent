'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';

const ANON_ONLY_PATHS = new Set(['/login', '/register']);

function isPublicPath(pathname: string | null) {
  if (!pathname) return false;
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
  }, [pathname, router]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    router.replace('/login');
  };

  return (
    <>
      {!isPublic && (
        <div className="fixed right-6 top-6 z-50">
          <button
            onClick={handleLogout}
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-100"
          >
            Выйти
          </button>
        </div>
      )}
      {children}
    </>
  );
}