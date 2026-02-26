'use client';

import { useRouter } from 'next/navigation';

type LogoutButtonProps = {
  className?: string;
  children?: React.ReactNode;
  confirmMessage?: string;
  onLoggedOut?: () => void;
};

export function LogoutButton({
  className,
  children = 'Выйти',
  confirmMessage = 'Вы уверены, что хотите выйти из аккаунта?',
  onLoggedOut,
}: LogoutButtonProps) {
  const router = useRouter();

  const handleLogout = () => {
    if (!confirm(confirmMessage)) return;
    localStorage.removeItem('token');
    onLoggedOut?.();
    router.replace('/login');
  };

  return (
    <button type="button" onClick={handleLogout} className={className}>
      {children}
    </button>
  );
}
