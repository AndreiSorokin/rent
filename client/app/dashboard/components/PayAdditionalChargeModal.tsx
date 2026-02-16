'use client';
import { payAdditionalCharge } from '@/lib/additionalCharges';
import { useState } from 'react';

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
      alert('Please enter a valid amount');
      return;
    }

    if (channelsTotal > 0 && Math.abs(channelsTotal - amountValue) > 0.01) {
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
      alert('Failed to record payment. Please try again.');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-96 max-w-[90vw]">
        <h2 className="text-xl font-bold mb-4">Record Payment – Additional Charge</h2>
        <p className="mb-2 font-medium">{chargeName}</p>
        <p className="text-sm text-gray-600 mb-4">
          Expected: ${expectedAmount.toFixed(2)}
        </p>

        <input
          type="number"
          step="0.01"
          min="0.01"
          placeholder="Amount paid"
          value={amountPaid}
          onChange={(e) => setAmountPaid(e.target.value)}
          className="w-full p-2 border rounded mb-6 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <div className="mb-3">
          <label className="mb-1 block text-sm font-medium">Безналичный</label>
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
          <button
            onClick={onClose}
            className="px-4 py-2 border rounded hover:bg-gray-100"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!amountPaid || Number(amountPaid) <= 0}
            className="px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-700"
          >
            Record Payment
          </button>
        </div>
      </div>
    </div>
  );
}
