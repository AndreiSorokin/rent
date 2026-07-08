'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { formatMoney } from '@/lib/currency';

type AddExpenseModalProps = {
  isOpen: boolean;
  title: string;
  currency: string;
  defaultName?: string;
  onClose: () => void;
  onSubmit: (payload: {
    name: string;
    amount: number;
    bankTransfer: number;
    cashbox1: number;
    cashbox2: number;
  }) => Promise<void>;
};

export function AddExpenseModal({
  isOpen,
  title,
  currency,
  defaultName = '',
  onClose,
  onSubmit,
}: AddExpenseModalProps) {
  const t = useTranslations('AddExpenseModal');
  const [name, setName] = useState(defaultName);
  const [amount, setAmount] = useState('');
  const [bankTransfer, setBankTransfer] = useState('');
  const [cashbox1, setCashbox1] = useState('');
  const [cashbox2, setCashbox2] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setName(defaultName);
    setAmount('');
    setBankTransfer('');
    setCashbox1('');
    setCashbox2('');
  }, [defaultName, isOpen]);

  const channelsTotal = useMemo(
    () =>
      Number(bankTransfer || 0) + Number(cashbox1 || 0) + Number(cashbox2 || 0),
    [bankTransfer, cashbox1, cashbox2],
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-xl md:p-6">
        <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
        <p className="mt-1 text-sm text-slate-600">
          {t('hint')}
        </p>

        <div className="mt-4 space-y-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              {t('nameLabel')}
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5"
              placeholder={t('namePlaceholder')}
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              {t('amountLabel')}
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5"
              placeholder="0"
            />
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                {t('bankTransferLabel')}
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={bankTransfer}
                onChange={(e) => setBankTransfer(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2.5"
                placeholder="0"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                {t('cashbox1Label')}
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={cashbox1}
                onChange={(e) => setCashbox1(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2.5"
                placeholder="0"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                {t('cashbox2Label')}
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={cashbox2}
                onChange={(e) => setCashbox2(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2.5"
                placeholder="0"
              />
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
            {t('channelsTotal', { amount: formatMoney(channelsTotal, currency) })}
          </div>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
          >
            {t('cancel')}
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={async () => {
              const amountValue = Number(amount);
              const bankValue = Number(bankTransfer || 0);
              const cash1Value = Number(cashbox1 || 0);
              const cash2Value = Number(cashbox2 || 0);

              if (!name.trim()) {
                alert(t('errorNameRequired'));
                return;
              }
              if (Number.isNaN(amountValue) || amountValue < 0) {
                alert(t('errorInvalidAmount'));
                return;
              }
              if (
                Number.isNaN(bankValue) ||
                Number.isNaN(cash1Value) ||
                Number.isNaN(cash2Value) ||
                bankValue < 0 ||
                cash1Value < 0 ||
                cash2Value < 0
              ) {
                alert(t('errorNegativeChannels'));
                return;
              }
              if (
                channelsTotal > 0 &&
                Math.abs(channelsTotal - amountValue) > 0.01
              ) {
                alert(t('errorAmountMismatch'));
                return;
              }

              try {
                setSaving(true);
                await onSubmit({
                  name: name.trim(),
                  amount: amountValue,
                  bankTransfer: bankValue,
                  cashbox1: cash1Value,
                  cashbox2: cash2Value,
                });
              } finally {
                setSaving(false);
              }
            }}
            className="rounded-xl bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-60"
          >
            {saving ? t('saving') : t('submit')}
          </button>
        </div>
      </div>
    </div>
  );
}
