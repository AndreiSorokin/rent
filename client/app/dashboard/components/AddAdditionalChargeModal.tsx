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
      await createAdditionalCharge(pavilionId, {
        name: chargeName,
        amount: chargeAmount,
      });
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
    <div className="fixed inset-0 flex items-center justify-center bg-black/40">
      <div className="w-[360px] rounded bg-white p-6">
        <h2 className="mb-4 font-bold">Добавить дополнительное начисление</h2>

        <input
          className="input"
          placeholder="Название начисления"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />

        <input
          className="input"
          type="number"
          step="0.01"
          min="0"
          placeholder="Сумма начисления"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />

        <div className="mt-4 flex justify-end gap-2">
          <button className="btn-secondary" onClick={onClose} disabled={saving}>
            Отмена
          </button>
          <button className="btn-primary" onClick={save} disabled={saving}>
            {saving ? 'Сохранение...' : 'Сохранить'}
          </button>
        </div>
      </div>
    </div>
  );
}
