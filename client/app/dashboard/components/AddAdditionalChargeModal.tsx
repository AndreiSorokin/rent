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
  const [bankTransferPaid, setBankTransferPaid] = useState('');
  const [cashbox1Paid, setCashbox1Paid] = useState('');
  const [cashbox2Paid, setCashbox2Paid] = useState('');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const chargeName = name.trim();
    const chargeAmount = Number(amount);
    const bank = Number(bankTransferPaid || 0);
    const cash1 = Number(cashbox1Paid || 0);
    const cash2 = Number(cashbox2Paid || 0);
    const paidNowTotal = bank + cash1 + cash2;

    if (!chargeName) {
      alert('Введите название начисления');
      return;
    }
    if (Number.isNaN(chargeAmount) || chargeAmount <= 0) {
      alert('Введите корректную сумму начисления');
      return;
    }
    if (bank < 0 || cash1 < 0 || cash2 < 0) {
      alert('Суммы по каналам не могут быть отрицательными');
      return;
    }
    if (paidNowTotal > chargeAmount) {
      alert('Оплата не может быть больше суммы начисления');
      return;
    }

    try {
      setSaving(true);
      const created = await createAdditionalCharge(pavilionId, {
        name: chargeName,
        amount: chargeAmount,
      });

      if (paidNowTotal > 0) {
        await payAdditionalCharge(pavilionId, created.id, paidNowTotal, {
          bankTransferPaid: bank > 0 ? bank : undefined,
          cashbox1Paid: cash1 > 0 ? cash1 : undefined,
          cashbox2Paid: cash2 > 0 ? cash2 : undefined,
        });
      }

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
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center">
      <div className="bg-white rounded p-6 w-[360px]">
        <h2 className="font-bold mb-4">
          Добавить дополнительное начисление
        </h2>

        <input
          className="input"
          placeholder="Название начисления"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />

        <input
          className="input"
          type="number"
          placeholder="Сумма начисления"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />

        <div className="mt-3 rounded border p-3">
          <p className="mb-2 text-sm font-medium">Оплата сейчас (необязательно)</p>
          <div className="space-y-2">
            <input
              className="input"
              type="number"
              step="0.01"
              min="0"
              placeholder="Безналичные"
              value={bankTransferPaid}
              onChange={(e) => setBankTransferPaid(e.target.value)}
            />
            <input
              className="input"
              type="number"
              step="0.01"
              min="0"
              placeholder="Наличные - касса 1"
              value={cashbox1Paid}
              onChange={(e) => setCashbox1Paid(e.target.value)}
            />
            <input
              className="input"
              type="number"
              step="0.01"
              min="0"
              placeholder="Наличные - касса 2"
              value={cashbox2Paid}
              onChange={(e) => setCashbox2Paid(e.target.value)}
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-4">
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
