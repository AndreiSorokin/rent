'use client';

import { inviteUserByEmail } from '@/lib/storeUsers';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { ErrorMessage } from '@/components/messages/StatusMessage';

type InviteUserModalProps = {
  storeId: number;
  onClose: () => void;
  onSuccess: () => void;
};

export function InviteUserModal({
  storeId,
  onClose,
  onSuccess,
}: InviteUserModalProps) {
  const t = useTranslations('InviteUserModal');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleInvite = async () => {
    if (!email.trim() || !email.includes('@')) {
      setError(t('invalidEmail'));
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await inviteUserByEmail(storeId, email.trim());
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(
        err?.message || t('inviteFailed'),
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-[#d8d1cb] bg-white shadow-[0_20px_60px_-30px_rgba(17,17,17,0.45)]">
        <div className="flex items-center justify-between border-b border-[#e8e1da] bg-white/95 px-6 py-4 backdrop-blur">
          <div>
            <h2 className="text-xl font-extrabold text-[#111111]">{t('title')}</h2>
            <p className="mt-1 text-sm text-[#6b6b6b]">
              {t('subtitle')}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            aria-label={t('close')}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#d8d1cb] bg-white text-xl leading-none text-[#6b6b6b] transition hover:bg-[#f4efeb] hover:text-[#111111] disabled:opacity-50"
          >
            ×
          </button>
        </div>

        <div className="px-6 py-5">
          {error ? <ErrorMessage className="mb-4">{error}</ErrorMessage> : null}

          <div className="space-y-2">
            <label className="block text-sm font-semibold text-[#111111]">
              {t('emailLabel')}
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="user@example.com"
              className="w-full rounded-xl border border-[#d8d1cb] bg-[#f8f4ef] px-4 py-2.5 text-[#111111] outline-none transition placeholder:text-[#6b6b6b] focus:border-[#ff6a13] focus:bg-white focus:ring-2 focus:ring-[#ff6a13]/20"
              disabled={loading}
            />
            <p className="text-xs text-[#6b6b6b]">
              {t('hint')}
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-3 border-t border-[#e8e1da] px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="rounded-xl border border-[#d8d1cb] bg-white px-4 py-2.5 font-semibold text-[#111111] transition hover:bg-[#f4efeb] disabled:opacity-50"
          >
            {t('cancel')}
          </button>
          <button
            type="button"
            onClick={handleInvite}
            disabled={loading || !email.trim()}
            className="rounded-xl bg-[#ff6a13] px-4 py-2.5 font-semibold text-white transition hover:bg-[#e85a0c] disabled:opacity-50"
          >
            {loading ? t('inviting') : t('invite')}
          </button>
        </div>
      </div>
    </div>
  );
}
