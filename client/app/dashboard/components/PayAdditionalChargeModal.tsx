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

  const handleSubmit = async () => {
    if (!amountPaid || Number(amountPaid) <= 0) {
      alert('Please enter a valid amount');
      return;
    }

    try {
      await payAdditionalCharge(pavilionId, chargeId, Number(amountPaid));
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