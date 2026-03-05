import type { ReactNode } from 'react';

type AuthMessageProps = {
  tone?: 'error' | 'success';
  children: ReactNode;
};

export function AuthMessage({ tone = 'error', children }: AuthMessageProps) {
  const styles =
    tone === 'success'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
      : 'border-red-200 bg-red-50 text-red-700';

  return <div className={`rounded-xl border px-3 py-2 text-sm ${styles}`}>{children}</div>;
}
