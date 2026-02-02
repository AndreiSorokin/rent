'use client';

import { useState } from 'react';
import { createAdditionalCharge } from '@/lib/additionalCharges';

export function AddAdditionalChargeModal({
  pavilionId,
  onClose,
  onSaved,
}: {
  pavilionId: number;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');

  const save = async () => {
    await createAdditionalCharge(pavilionId, {
      name,
      amount: Number(amount),
    });

    onSaved();
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center">
      <div className="bg-white rounded p-6 w-[360px]">
        <h2 className="font-bold mb-4">
          Add additional charge
        </h2>

        <input
          className="input"
          placeholder="Name (Ads, Parking, etc.)"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />

        <input
          className="input"
          type="number"
          placeholder="Amount"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />

        <div className="flex justify-end gap-2 mt-4">
          <button className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="btn-primary" onClick={save}>
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
