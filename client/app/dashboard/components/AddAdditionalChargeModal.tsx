'use client';

import { useState } from 'react';
import { createAdditionalCharge, payAdditionalCharge } from '@/lib/additionalCharges';

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
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const chargeName = name.trim();
    const chargeAmount = Number(amount);

    if (!chargeName) {
      alert('Введите название начисления');
      return;
    }
    if (Number.isNaN(chargeAmount) || chargeAmount <= 0) {
      alert('Введите корректную сумму начисления');
      return;
    }

    try {
      setSaving(true);
      const created = await createAdditionalCharge(pavilionId, {
        name: chargeName,
        amount: chargeAmount,
      });
      await payAdditionalCharge(
        pavilionId,
        Number((created as any).id),
        chargeAmount,
        { bankTransferPaid: chargeAmount, cashbox1Paid: 0, cashbox2Paid: 0 },
      );
      onSaved();
      onClose();
    } catch (err) {
      console.error(err);
      alert('Не удалось создать начисление');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
        className="w-full max-w-md rounded-2xl border border-[#d8d1cb] bg-white p-6 shadow-[0_20px_60px_-30px_rgba(17,17,17,0.45)]"
      >
        <h2 className="mb-4 text-xl font-extrabold text-[#111111]">Добавить дополнительное начисление</h2>

        <input
          className="w-full rounded-xl border border-[#d8d1cb] bg-[#f8f4ef] px-3 py-2 text-[#111111] outline-none transition placeholder:text-[#6b6b6b] focus:border-[#ff6a13] focus:bg-white focus:ring-2 focus:ring-[#ff6a13]/20"
          placeholder="Название начисления"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />

        <input
          className="mt-3 w-full rounded-xl border border-[#d8d1cb] bg-[#f8f4ef] px-3 py-2 text-[#111111] outline-none transition placeholder:text-[#6b6b6b] focus:border-[#ff6a13] focus:bg-white focus:ring-2 focus:ring-[#ff6a13]/20"
          type="number"
          step="0.01"
          min="0"
          placeholder="Сумма начисления"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            className="rounded-xl border border-[#d8d1cb] bg-white px-4 py-2 font-semibold text-[#111111] transition hover:bg-[#f8f4ef] disabled:cursor-not-allowed disabled:opacity-60"
            onClick={onClose}
            disabled={saving}
          >
            Отмена
          </button>
          <button
            type="submit"
            className="rounded-xl bg-[#ff6a13] px-4 py-2 font-semibold text-white transition hover:bg-[#e85a0c] disabled:cursor-not-allowed disabled:opacity-60"
            disabled={saving}
          >
            {saving ? 'Сохранение...' : 'Сохранить'}
          </button>
        </div>
      </form>
    </div>
  );
}
