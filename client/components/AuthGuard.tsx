'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { LogoutButton } from '@/components/LogoutButton';
import { clearStoredAccessToken, ensureAccessToken } from '@/lib/session';

const ANON_ONLY_PATHS = new Set(['/login', '/register']);

function isPublicPath(pathname: string | null) {
  if (!pathname) return false;
  if (pathname === '/') return true;
  if (pathname === '/privacy') return true;
  if (pathname === '/offer') return true;
  if (pathname === '/tariffs') return true;
  if (pathname === '/content-rules') return true;
  if (pathname === '/operator') return true;
  if (pathname === '/cookies') return true;
  if (pathname === '/site-consent') return true;
  if (pathname === '/user-agreement') return true;
  if (ANON_ONLY_PATHS.has(pathname)) return true;
  return pathname.startsWith('/forgot-password');
}

function isAnonOnlyPath(pathname: string | null) {
  if (!pathname) return false;
  return ANON_ONLY_PATHS.has(pathname);
}

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const isPublic = isPublicPath(pathname);
  const isAnonOnly = isAnonOnlyPath(pathname);
  const isStorePage = Boolean(pathname && /^\/stores\/\d+(?:\/.*)?$/.test(pathname));

  useEffect(() => {
    let isCancelled = false;

    const syncAuth = async () => {
      const token = await ensureAccessToken();

      if (isCancelled) return;

      if (!token) {
        clearStoredAccessToken();
        if (!isPublic) {
          router.replace('/login');
        }
        return;
      }

      if (isAnonOnly) {
        router.replace('/dashboard');
      }
    };

    void syncAuth();

    return () => {
      isCancelled = true;
    };
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
