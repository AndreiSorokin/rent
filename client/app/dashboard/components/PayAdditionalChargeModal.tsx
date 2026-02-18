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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-96 max-w-[90vw] rounded-lg bg-white p-6">
        <h2 className="mb-4 text-xl font-bold">Оплата доп. начисления</h2>
        <p className="mb-2 font-medium">{chargeName}</p>
        <p className="mb-4 text-sm text-gray-600">
          Начислено: {expectedAmount.toFixed(2)}
        </p>

        <input
          type="number"
          step="0.01"
          min="0.01"
          placeholder="Сумма оплаты"
          value={amountPaid}
          onChange={(e) => setAmountPaid(e.target.value)}
          className="mb-6 w-full rounded border p-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />

        <div className="mb-3">
          <label className="mb-1 block text-sm font-medium">Безналичные</label>
          <input
            type="number"
            step="0.01"
            min="0"
            value={bankTransferPaid}
            onChange={(e) => setBankTransferPaid(e.target.value)}
            className="w-full rounded border p-2"
            placeholder="0.00"
          />
        </div>

        <div className="mb-3">
          <label className="mb-1 block text-sm font-medium">Наличные - касса 1</label>
          <input
            type="number"
            step="0.01"
            min="0"
            value={cashbox1Paid}
            onChange={(e) => setCashbox1Paid(e.target.value)}
            className="w-full rounded border p-2"
            placeholder="0.00"
          />
        </div>

        <div className="mb-6">
          <label className="mb-1 block text-sm font-medium">Наличные - касса 2</label>
          <input
            type="number"
            step="0.01"
            min="0"
            value={cashbox2Paid}
            onChange={(e) => setCashbox2Paid(e.target.value)}
            className="w-full rounded border p-2"
            placeholder="0.00"
          />
        </div>

        <div className="flex justify-end gap-3">
          <button onClick={onClose} className="rounded border px-4 py-2 hover:bg-gray-100">
            Отмена
          </button>
          <button
            onClick={handleSubmit}
            disabled={!amountPaid || Number(amountPaid) <= 0}
            className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Записать платеж
          </button>
        </div>
      </div>
    </div>
  );
}
