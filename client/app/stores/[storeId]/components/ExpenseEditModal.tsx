'use client';

import { useTranslations } from 'next-intl';

type ExpenseEditModalProps = {
  open: boolean;
  title: string;
  nameLabel?: string;
  namePlaceholder?: string;
  nameValue: string;
  status: 'UNPAID' | 'PAID';
  bankTransferPaid: number;
  cashbox1Paid: number;
  cashbox2Paid: number;
  saving: boolean;
  canDelete?: boolean;
  onNameChange: (value: string) => void;
  onStatusChange: (status: 'UNPAID' | 'PAID') => void;
  onBankTransferPaidChange: (value: number) => void;
  onCashbox1PaidChange: (value: number) => void;
  onCashbox2PaidChange: (value: number) => void;
  onDelete?: () => void;
  onClose: () => void;
  onSubmit: () => void;
};

export function ExpenseEditModal({
  open,
  title,
  nameLabel,
  namePlaceholder,
  nameValue,
  status,
  bankTransferPaid,
  cashbox1Paid,
  cashbox2Paid,
  saving,
  canDelete = false,
  onNameChange,
  onStatusChange,
  onBankTransferPaidChange,
  onCashbox1PaidChange,
  onCashbox2PaidChange,
  onDelete,
  onClose,
  onSubmit,
}: ExpenseEditModalProps) {
  const t = useTranslations('ExpenseEditModal');
  if (!open) return null;

  const resolvedNameLabel = nameLabel ?? t('nameLabelDefault');
  const resolvedNamePlaceholder = namePlaceholder ?? t('namePlaceholderDefault');

  return (
    <div className="fixed inset-0 z-[95] flex items-center justify-center bg-black/50 p-4">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit();
        }}
        className="w-full max-w-[34rem] rounded-xl border border-[#D8D1CB] bg-white p-5 shadow-xl"
      >
        <h3 className="text-lg font-semibold text-slate-900">{title}</h3>

        <div className="mt-4 space-y-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">{resolvedNameLabel}</label>
            <input
              type="text"
              value={nameValue}
              onChange={(e) => onNameChange(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2"
              placeholder={resolvedNamePlaceholder}
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">{t('statusLabel')}</label>
            <select
              value={status}
              onChange={(e) => onStatusChange(e.target.value as 'UNPAID' | 'PAID')}
              className="w-full rounded-lg border border-slate-300 px-3 py-2"
            >
              <option value="UNPAID">{t('statusUnpaid')}</option>
              <option value="PAID">{t('statusPaid')}</option>
            </select>
          </div>

          {status === 'PAID' && (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">{t('bankTransferLabel')}</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={bankTransferPaid}
                  onChange={(e) => onBankTransferPaidChange(e.target.value === '' ? 0 : Number(e.target.value))}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">{t('cashbox1Label')}</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={cashbox1Paid}
                  onChange={(e) => onCashbox1PaidChange(e.target.value === '' ? 0 : Number(e.target.value))}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">{t('cashbox2Label')}</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={cashbox2Paid}
                  onChange={(e) => onCashbox2PaidChange(e.target.value === '' ? 0 : Number(e.target.value))}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2"
                />
              </div>
            </div>
          )}
        </div>

        <div className="mt-5 flex items-center justify-between gap-3">
          <div>
            {canDelete && onDelete && (
              <button
                type="button"
                onClick={onDelete}
                disabled={saving}
                className="rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-60"
              >
                {t('delete')}
              </button>
            )}
          </div>
          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="rounded-lg border px-4 py-2 hover:bg-slate-100 disabled:opacity-60"
            >
              {t('cancel')}
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-[#FF6A13] px-4 py-2 font-medium text-white hover:bg-[#E65C00] disabled:opacity-60"
            >
              {saving ? t('saving') : t('save')}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
