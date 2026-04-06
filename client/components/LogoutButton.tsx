'use client';

import { useRouter } from 'next/navigation';
import { useDialog } from '@/components/dialog/DialogProvider';
import { logoutSession } from '@/lib/session';

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
    await logoutSession();
    onLoggedOut?.();
    router.replace('/login');
  };

  return (
    <button type="button" onClick={handleLogout} className={className}>
      {children}
    </button>
  );
}
