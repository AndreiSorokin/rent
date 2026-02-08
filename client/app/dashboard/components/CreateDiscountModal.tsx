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
      setError('Выберите конечный месяц или установите бесконечную длительность');
      return;
    }

    if (hasEndDate && endsAtMonth < startsAtMonth) {
      setError('Конечный месяц не может быть раньше начального месяца');
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
      setError(err.message || 'Failed to create discount');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-lg bg-white p-6">
        <h2 className="mb-4 text-xl font-bold">Добавить скидку</h2>

        {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium">Скидка за кв. метер (Рублей)</label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full rounded border px-3 py-2"
              placeholder="1"
            />
            <p className="mt-1 text-xs text-gray-500">
              Пример: для 100 м2 павильона и скидки 1Р/м2, ежемесячная скидка составляет 100Р.
            </p>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Начало месяца</label>
            <input
              type="month"
              value={startsAtMonth}
              onChange={(e) => setStartsAtMonth(e.target.value)}
              className="w-full rounded border px-3 py-2"
            />
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={hasEndDate}
              onChange={(e) => setHasEndDate(e.target.checked)}
            />
            Установить конечный месяц
          </label>

          {hasEndDate && (
            <div>
              <label className="mb-1 block text-sm font-medium">Конечный месяц</label>
              <input
                type="month"
                value={endsAtMonth}
                onChange={(e) => setEndsAtMonth(e.target.value)}
                className="w-full rounded border px-3 py-2"
              />
            </div>
          )}

          <div>
            <label className="mb-1 block text-sm font-medium">Примечание (опционально)</label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full rounded border px-3 py-2"
            />
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={onClose}
            disabled={saving}
            className="rounded border px-4 py-2 hover:bg-gray-100 disabled:opacity-50"
          >
            Отмена
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
