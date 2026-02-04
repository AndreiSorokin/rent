'use client';
import { useState } from 'react';
import { createPavilionPayment } from '@/lib/payments';

export function CreatePavilionPaymentModal({
  storeId,
  pavilionId,
  onClose,
  onSaved,
}: {
  storeId: number;
  pavilionId: number;
  onClose: () => void;
  onSaved: () => void;
}) {
  const currentMonth = new Date().toISOString().slice(0, 7); // Default to current YYYY-MM
  const [period, setPeriod] = useState(currentMonth);
  const [rentPaid, setRentPaid] = useState('');
  const [utilitiesPaid, setUtilitiesPaid] = useState('');

  const handlePay = async () => {
    if (!period) {
      alert('Please select a period.');
      return;
    }
    const periodDate = new Date(`${period}-01`);
    await createPavilionPayment(storeId, pavilionId, {
      period: periodDate.toISOString(),
      rentPaid: rentPaid ? Number(rentPaid) : undefined,
      utilitiesPaid: utilitiesPaid ? Number(utilitiesPaid) : undefined,
    });
    onSaved();
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded p-6 w-[360px]">
        <h2 className="font-bold mb-4">Add payment</h2>
        <input
          type="month"
          placeholder="Period (Month/Year)"
          value={period}
          onChange={(e) => setPeriod(e.target.value)}
          className="input mb-2"
        />
        <input
          type="number"
          placeholder="Rent paid"
          value={rentPaid}
          onChange={(e) => setRentPaid(e.target.value)}
          className="input mt-2"
        />
        <input
          type="number"
          placeholder="Utilities paid"
          value={utilitiesPaid}
          onChange={(e) => setUtilitiesPaid(e.target.value)}
          className="input mt-2"
        />
        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onClose} className="btn-secondary">
            Cancel
          </button>
          <button onClick={handlePay} className="btn-primary">
            Pay
          </button>
        </div>
      </div>
    </div>
  );
}