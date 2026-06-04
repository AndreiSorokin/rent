'use client';

import { useState } from 'react';
import {
  createAdditionalCharge,
  deleteAdditionalChargePayment,
  payAdditionalCharge,
  updateAdditionalCharge,
  updateAdditionalChargePayment,
} from '@/lib/additionalCharges';

type AdditionalChargePaymentDraft = {
  id: number;
  amountPaid: number;
  bankTransferPaid?: number | null;
  cashbox1Paid?: number | null;
  cashbox2Paid?: number | null;
};

type EditableAdditionalCharge = {
  id: number;
  name: string;
  amount: number;
  currentMonthPayments?: AdditionalChargePaymentDraft[];
};

export function AddAdditionalChargeModal({
  pavilionId,
  charge,
  onClose,
  onSaved,
  onDelete,
}: {
  pavilionId: number;
  charge?: EditableAdditionalCharge;
  onClose: () => void;
  onSaved: () => void;
  onDelete?: () => Promise<void> | void;
}) {
  const currentMonthPayments = charge?.currentMonthPayments ?? [];
  const currentMonthPaidTotal = currentMonthPayments.reduce(
    (sum, payment) => sum + Number(payment.amountPaid ?? 0),
    0,
  );
  const [name, setName] = useState(charge?.name ?? '');
  const [amount, setAmount] = useState(
    charge ? Number(charge.amount ?? 0).toFixed(2) : '',
  );
  const [paymentStatus, setPaymentStatus] = useState<'PAID' | 'UNPAID'>(
    currentMonthPaidTotal > 0 ? 'PAID' : 'UNPAID',
  );
  const [bankTransferPaid, setBankTransferPaid] = useState(
    currentMonthPaidTotal > 0
      ? Number(
          currentMonthPayments.reduce(
            (sum, payment) => sum + Number(payment.bankTransferPaid ?? 0),
            0,
          ),
        ).toFixed(2)
      : '',
  );
  const [cashbox1Paid, setCashbox1Paid] = useState(
    currentMonthPaidTotal > 0
      ? Number(
          currentMonthPayments.reduce(
            (sum, payment) => sum + Number(payment.cashbox1Paid ?? 0),
            0,
          ),
        ).toFixed(2)
      : '',
  );
  const [cashbox2Paid, setCashbox2Paid] = useState(
    currentMonthPaidTotal > 0
      ? Number(
          currentMonthPayments.reduce(
            (sum, payment) => sum + Number(payment.cashbox2Paid ?? 0),
            0,
          ),
        ).toFixed(2)
      : '',
  );
  const [saving, setSaving] = useState(false);
  const isEditing = Boolean(charge);

  const save = async () => {
    const chargeName = name.trim();
    const chargeAmount = Number(amount);
    const bank = Number(bankTransferPaid || 0);
    const cash1 = Number(cashbox1Paid || 0);
    const cash2 = Number(cashbox2Paid || 0);
    const channelsTotal = bank + cash1 + cash2;

    if (!chargeName) {
      alert('Введите название начисления');
      return;
    }
    if (Number.isNaN(chargeAmount) || chargeAmount <= 0) {
      alert('Введите корректную сумму начисления');
      return;
    }
    if (paymentStatus === 'PAID') {
      if (channelsTotal <= 0) {
        alert('Укажите сумму хотя бы в одном канале оплаты');
        return;
      }
      if (Math.abs(channelsTotal - chargeAmount) > 0.01) {
        alert('Сумма по каналам должна совпадать с суммой начисления');
        return;
      }
    }

    try {
      setSaving(true);
      let chargeId = Number(charge?.id);

      if (isEditing && charge) {
        await updateAdditionalCharge(pavilionId, charge.id, {
          name: chargeName,
          amount: chargeAmount,
        });
      } else {
        const created = await createAdditionalCharge(pavilionId, {
          name: chargeName,
          amount: chargeAmount,
        });
        chargeId = Number((created as any).id);
      }

      if (isEditing && currentMonthPayments.length > 0) {
        if (paymentStatus === 'PAID' && currentMonthPayments.length === 1) {
          await updateAdditionalChargePayment(
            pavilionId,
            chargeId,
            currentMonthPayments[0].id,
            {
              amountPaid: chargeAmount,
              bankTransferPaid: bank > 0 ? bank : 0,
              cashbox1Paid: cash1 > 0 ? cash1 : 0,
              cashbox2Paid: cash2 > 0 ? cash2 : 0,
            },
          );
        } else {
          await Promise.all(
            currentMonthPayments.map((payment) =>
              deleteAdditionalChargePayment(pavilionId, chargeId, payment.id),
            ),
          );

          if (paymentStatus === 'PAID') {
            await payAdditionalCharge(pavilionId, chargeId, chargeAmount, {
              bankTransferPaid: bank > 0 ? bank : undefined,
              cashbox1Paid: cash1 > 0 ? cash1 : undefined,
              cashbox2Paid: cash2 > 0 ? cash2 : undefined,
            });
          }
        }
      } else if (paymentStatus === 'PAID') {
        await payAdditionalCharge(pavilionId, chargeId, chargeAmount, {
          bankTransferPaid: bank > 0 ? bank : undefined,
          cashbox1Paid: cash1 > 0 ? cash1 : undefined,
          cashbox2Paid: cash2 > 0 ? cash2 : undefined,
        });
      }

      onSaved();
      onClose();
    } catch (err) {
      console.error(err);
      alert(
        isEditing
          ? 'Не удалось изменить начисление'
          : 'Не удалось создать начисление',
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!onDelete || !charge) return;
    try {
      setSaving(true);
      await onDelete();
      onClose();
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
        <h2 className="mb-4 text-xl font-extrabold text-[#111111]">
          {isEditing ? 'Изменить дополнительное начисление' : 'Добавить дополнительное начисление'}
        </h2>

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

        <div className="mt-4 rounded-xl border border-[#d8d1cb] bg-[#f8f4ef] p-3">
          <p className="mb-2 text-sm font-semibold text-[#111111]">Статус</p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <label className="flex items-center gap-2 text-sm text-[#111111]">
              <input
                type="radio"
                name="additional-charge-status"
                value="UNPAID"
                checked={paymentStatus === 'UNPAID'}
                onChange={() => setPaymentStatus('UNPAID')}
              />
              <span>Не оплачено</span>
            </label>
            <label className="flex items-center gap-2 text-sm text-[#111111]">
              <input
                type="radio"
                name="additional-charge-status"
                value="PAID"
                checked={paymentStatus === 'PAID'}
                onChange={() => setPaymentStatus('PAID')}
              />
              <span>Оплачено</span>
            </label>
          </div>
        </div>

        {paymentStatus === 'PAID' && (
          <div className="mt-4 rounded-xl border border-[#d8d1cb] bg-[#f8f4ef] p-3">
            <p className="mb-2 text-sm font-semibold text-[#111111]">Каналы оплаты</p>
            <div className="space-y-2">
              <input
                type="number"
                step="0.01"
                min="0"
                value={bankTransferPaid}
                onChange={(e) => setBankTransferPaid(e.target.value)}
                className="w-full rounded-xl border border-[#d8d1cb] bg-white px-3 py-2 text-[#111111] outline-none transition placeholder:text-[#6b6b6b] focus:border-[#ff6a13] focus:ring-2 focus:ring-[#ff6a13]/20"
                placeholder="Безналичные"
              />
              <input
                type="number"
                step="0.01"
                min="0"
                value={cashbox1Paid}
                onChange={(e) => setCashbox1Paid(e.target.value)}
                className="w-full rounded-xl border border-[#d8d1cb] bg-white px-3 py-2 text-[#111111] outline-none transition placeholder:text-[#6b6b6b] focus:border-[#ff6a13] focus:ring-2 focus:ring-[#ff6a13]/20"
                placeholder="Наличные - касса 1"
              />
              <input
                type="number"
                step="0.01"
                min="0"
                value={cashbox2Paid}
                onChange={(e) => setCashbox2Paid(e.target.value)}
                className="w-full rounded-xl border border-[#d8d1cb] bg-white px-3 py-2 text-[#111111] outline-none transition placeholder:text-[#6b6b6b] focus:border-[#ff6a13] focus:ring-2 focus:ring-[#ff6a13]/20"
                placeholder="Наличные - касса 2"
              />
            </div>
            {isEditing && currentMonthPayments.length > 0 && (
              <p className="mt-2 text-xs text-[#6b6b6b]">
                При сохранении текущая оплата за этот месяц будет перезаписана по указанным каналам.
              </p>
            )}
          </div>
        )}

        <div className="mt-6 flex flex-wrap justify-between gap-3">
          <div>
            {isEditing && onDelete && (
              <button
                type="button"
                className="rounded-xl border border-[#ef4444]/40 bg-[#ef4444]/10 px-4 py-2 font-semibold text-[#b91c1c] transition hover:bg-[#ef4444]/20 disabled:cursor-not-allowed disabled:opacity-60"
                onClick={() => {
                  void handleDelete();
                }}
                disabled={saving}
              >
                Удалить начисление
              </button>
            )}
          </div>
          <div className="flex gap-3">
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
              {saving ? 'Сохранение...' : isEditing ? 'Сохранить изменения' : 'Сохранить'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
