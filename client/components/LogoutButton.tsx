'use client';

import { useRouter } from 'next/navigation';
import { useDialog } from '@/components/dialog/DialogProvider';

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
  const dialog = useDialog();

  const handleLogout = async () => {
    const confirmed = await dialog.confirm({
      title: 'Выход из аккаунта',
      message: confirmMessage,
      tone: 'warning',
      confirmText: 'Выйти',
    });
    if (!confirmed) return;
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
