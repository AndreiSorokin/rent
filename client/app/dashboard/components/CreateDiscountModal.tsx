'use client';

import { useState } from 'react';
import { createPavilionDiscount } from '@/lib/discounts';

function monthToFirstDayISO(month: string) {
  return `${month}-01T00:00:00.000Z`;
}

function monthToLastDayISO(month: string) {
  const [year, monthValue] = month.split('-').map(Number);
  const lastDay = new Date(Date.UTC(year, monthValue, 0, 23, 59, 59, 999));
  return lastDay.toISOString();
}

export function CreateDiscountModal({
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
  const currentMonth = new Date().toISOString().slice(0, 7);
  const inputClass =
    'w-full rounded-xl border border-[#d8d1cb] bg-[#f8f4ef] px-3 py-2 text-[#111111] outline-none transition placeholder:text-[#6b6b6b] focus:border-[#ff6a13] focus:bg-white focus:ring-2 focus:ring-[#ff6a13]/20';

  const [amount, setAmount] = useState('');
  const [startsAtMonth, setStartsAtMonth] = useState(currentMonth);
  const [hasEndDate, setHasEndDate] = useState(false);
  const [endsAtMonth, setEndsAtMonth] = useState(currentMonth);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    const amountNumber = Number(amount);
    if (!amount || Number.isNaN(amountNumber) || amountNumber <= 0) {
      setError('Введите корректную сумму скидки за кв. метр');
      return;
    }

    if (!startsAtMonth) {
      setError('Выберите начальный месяц');
      return;
    }

    if (hasEndDate && !endsAtMonth) {
      setError('Выберите конечный месяц или отключите ограничение по сроку');
      return;
    }

    if (hasEndDate && endsAtMonth < startsAtMonth) {
      setError('Конечный месяц не может быть раньше начального');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      await createPavilionDiscount(storeId, pavilionId, {
        amount: amountNumber,
        startsAt: monthToFirstDayISO(startsAtMonth),
        endsAt: hasEndDate ? monthToLastDayISO(endsAtMonth) : undefined,
        note: note.trim() ? note.trim() : undefined,
      });
      onSaved();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Не удалось создать скидку');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void handleSave();
        }}
        className="w-full max-w-md rounded-2xl border border-[#d8d1cb] bg-white p-6 shadow-[0_20px_60px_-30px_rgba(17,17,17,0.45)]"
      >
        <h2 className="mb-4 text-xl font-extrabold text-[#111111]">Добавить скидку</h2>

        {error && (
          <p className="mb-4 rounded-xl border border-[#ef4444]/30 bg-[#ef4444]/10 px-3 py-2 text-sm font-medium text-[#b91c1c]">
            {error}
          </p>
        )}

        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-semibold text-[#111111]">
              Скидка за кв. метр (₽)
            </label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className={inputClass}
              placeholder="1"
            />
            <p className="mt-1 text-xs text-[#6b6b6b]">
              Пример: при 100 м² и скидке 1 ₽/м² ежемесячная скидка составит 100 ₽.
            </p>
          </div>

          <div>
            <label className="mb-1 block text-sm font-semibold text-[#111111]">Начальный месяц</label>
            <input
              type="month"
              value={startsAtMonth}
              onChange={(e) => setStartsAtMonth(e.target.value)}
              className={inputClass}
            />
          </div>

          <label className="flex items-center gap-2 text-sm font-medium text-[#111111]">
            <input
              type="checkbox"
              checked={hasEndDate}
              onChange={(e) => setHasEndDate(e.target.checked)}
              className="h-4 w-4 rounded border-[#d8d1cb] text-[#ff6a13] focus:ring-[#ff6a13]/30"
            />
            Указать конечный месяц
          </label>

          {hasEndDate && (
            <div>
              <label className="mb-1 block text-sm font-semibold text-[#111111]">Конечный месяц</label>
              <input
                type="month"
                value={endsAtMonth}
                onChange={(e) => setEndsAtMonth(e.target.value)}
                className={inputClass}
              />
            </div>
          )}

          <div>
            <label className="mb-1 block text-sm font-semibold text-[#111111]">Примечание (опционально)</label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className={inputClass}
              placeholder="Например: сезонная акция"
            />
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-xl border border-[#d8d1cb] bg-white px-4 py-2 font-semibold text-[#111111] transition hover:bg-[#f8f4ef] disabled:cursor-not-allowed disabled:opacity-60"
          >
            Отмена
          </button>
          <button
            type="submit"
            disabled={saving}
            className="rounded-xl bg-[#ff6a13] px-4 py-2 font-semibold text-white transition hover:bg-[#e85a0c] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? 'Сохранение...' : 'Сохранить'}
          </button>
        </div>
      </form>
    </div>
  );
}
