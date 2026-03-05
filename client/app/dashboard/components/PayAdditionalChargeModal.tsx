'use client';

import { useState } from 'react';
import { payAdditionalCharge } from '@/lib/additionalCharges';

export function PayAdditionalChargeModal({
  pavilionId,
  chargeId,
  chargeName,
  expectedAmount,
  onClose,
  onSaved,
}: {
  pavilionId: number;
  chargeId: number;
  chargeName: string;
  expectedAmount: number;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [amountPaid, setAmountPaid] = useState('');
  const [bankTransferPaid, setBankTransferPaid] = useState('');
  const [cashbox1Paid, setCashbox1Paid] = useState('');
  const [cashbox2Paid, setCashbox2Paid] = useState('');

  const handleSubmit = async () => {
    const amountValue = Number(amountPaid || 0);
    const bank = Number(bankTransferPaid || 0);
    const cash1 = Number(cashbox1Paid || 0);
    const cash2 = Number(cashbox2Paid || 0);
    const channelsTotal = bank + cash1 + cash2;

    if (!amountPaid || amountValue <= 0) {
      alert('Введите корректную сумму платежа');
      return;
    }

    if (channelsTotal <= 0) {
      alert('Укажите сумму хотя бы в одном канале оплаты');
      return;
    }

    if (Math.abs(channelsTotal - amountValue) > 0.01) {
      alert('Сумма по каналам должна совпадать с суммой платежа');
      return;
    }

    try {
      await payAdditionalCharge(pavilionId, chargeId, amountValue, {
        bankTransferPaid: bank > 0 ? bank : undefined,
        cashbox1Paid: cash1 > 0 ? cash1 : undefined,
        cashbox2Paid: cash2 > 0 ? cash2 : undefined,
      });
      onSaved();
      onClose();
    } catch (err) {
      console.error('Payment failed:', err);
      alert('Не удалось записать платеж');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-[#d8d1cb] bg-white p-6 shadow-[0_20px_60px_-30px_rgba(17,17,17,0.45)]">
        <h2 className="mb-4 text-xl font-extrabold text-[#111111]">Оплата доп. начисления</h2>
        <p className="mb-2 font-semibold text-[#111111]">{chargeName}</p>
        <p className="mb-4 text-sm text-[#6b6b6b]">Начислено: {expectedAmount.toFixed(2)}</p>

        <input
          type="number"
          step="0.01"
          min="0.01"
          placeholder="Сумма оплаты"
          value={amountPaid}
          onChange={(e) => setAmountPaid(e.target.value)}
          className="mb-6 w-full rounded-xl border border-[#d8d1cb] bg-[#f8f4ef] px-3 py-2 text-[#111111] outline-none transition placeholder:text-[#6b6b6b] focus:border-[#ff6a13] focus:bg-white focus:ring-2 focus:ring-[#ff6a13]/20"
        />

        <div className="mb-3">
          <label className="mb-1 block text-sm font-semibold text-[#111111]">Безналичные</label>
          <input
            type="number"
            step="0.01"
            min="0"
            value={bankTransferPaid}
            onChange={(e) => setBankTransferPaid(e.target.value)}
            className="w-full rounded-xl border border-[#d8d1cb] bg-[#f8f4ef] px-3 py-2 text-[#111111] outline-none transition placeholder:text-[#6b6b6b] focus:border-[#ff6a13] focus:bg-white focus:ring-2 focus:ring-[#ff6a13]/20"
            placeholder="0.00"
          />
        </div>

        <div className="mb-3">
          <label className="mb-1 block text-sm font-semibold text-[#111111]">Наличные - касса 1</label>
          <input
            type="number"
            step="0.01"
            min="0"
            value={cashbox1Paid}
            onChange={(e) => setCashbox1Paid(e.target.value)}
            className="w-full rounded-xl border border-[#d8d1cb] bg-[#f8f4ef] px-3 py-2 text-[#111111] outline-none transition placeholder:text-[#6b6b6b] focus:border-[#ff6a13] focus:bg-white focus:ring-2 focus:ring-[#ff6a13]/20"
            placeholder="0.00"
          />
        </div>

        <div className="mb-6">
          <label className="mb-1 block text-sm font-semibold text-[#111111]">Наличные - касса 2</label>
          <input
            type="number"
            step="0.01"
            min="0"
            value={cashbox2Paid}
            onChange={(e) => setCashbox2Paid(e.target.value)}
            className="w-full rounded-xl border border-[#d8d1cb] bg-[#f8f4ef] px-3 py-2 text-[#111111] outline-none transition placeholder:text-[#6b6b6b] focus:border-[#ff6a13] focus:bg-white focus:ring-2 focus:ring-[#ff6a13]/20"
            placeholder="0.00"
          />
        </div>

        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            className="rounded-xl border border-[#d8d1cb] bg-white px-4 py-2 font-semibold text-[#111111] transition hover:bg-[#f8f4ef]"
          >
            Отмена
          </button>
          <button
            onClick={handleSubmit}
            disabled={!amountPaid || Number(amountPaid) <= 0}
            className="rounded-xl bg-[#ff6a13] px-4 py-2 font-semibold text-white transition hover:bg-[#e85a0c] disabled:cursor-not-allowed disabled:opacity-50"
          >
            Записать платеж
          </button>
        </div>
      </div>
    </div>
  );
}
