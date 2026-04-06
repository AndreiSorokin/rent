'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ensureAccessToken } from '@/lib/session';

export function useAuth() {
  const router = useRouter();

  useEffect(() => {
    let isCancelled = false;

    const syncAuth = async () => {
      const token = await ensureAccessToken();
      if (!token && !isCancelled) {
        router.replace('/login');
      }
    };

    void syncAuth();

    return () => {
      isCancelled = true;
    };
  }, [router]);
}
