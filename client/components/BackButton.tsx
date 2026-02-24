'use client';

import { useRouter } from 'next/navigation';

type BackButtonProps = {
  fallbackAuth?: string;
  fallbackGuest?: string;
  label: string;
  className?: string;
};

export function BackButton({
  fallbackAuth = '/dashboard',
  fallbackGuest = '/login',
  label,
  className,
}: BackButtonProps) {
  const router = useRouter();

  const handleBack = () => {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back();
      return;
    }

    const hasToken =
      typeof window !== 'undefined' && Boolean(localStorage.getItem('token'));
    router.replace(hasToken ? fallbackAuth : fallbackGuest);
  };

  return (
    <button type="button" onClick={handleBack} className={className}>
      {label}
    </button>
  );
}
