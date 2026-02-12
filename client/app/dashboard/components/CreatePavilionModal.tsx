'use client';

import { useState } from 'react';
import { apiFetch } from '@/lib/api';
import { createPavilionPayment } from '@/lib/payments';

type CreatePavilionModalProps = {
  storeId: number;
  existingCategories: string[];
  onClose: () => void;
  onSaved: () => void;
};

export function CreatePavilionModal({
  storeId,
  existingCategories,
  onClose,
  onSaved,
}: CreatePavilionModalProps) {
  const [number, setNumber] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [newCategory, setNewCategory] = useState('');
  const [squareMeters, setSquareMeters] = useState('');
  const [pricePerSqM, setPricePerSqM] = useState('');
  const [status, setStatus] = useState('AVAILABLE');
  const [prepaymentMonth, setPrepaymentMonth] = useState(
    new Date().toISOString().slice(0, 7),
  );
  const [prepaymentAmount, setPrepaymentAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    const category = newCategory.trim() || selectedCategory.trim();

    if (!number || !squareMeters || !pricePerSqM || !category) {
      setError('Заполните все обязательные поля, включая категорию');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const square = Number(squareMeters);
      const price = Number(pricePerSqM);
      const autoRent = square * price;
      const prepaidPeriodIso = new Date(`${prepaymentMonth}-01`).toISOString();

      const pavilion = await apiFetch<{ id: number }>(`/stores/${storeId}/pavilions`, {
        method: 'POST',
        body: JSON.stringify({
          number,
          category,
          squareMeters: square,
          pricePerSqM: price,
          status,
          prepaidUntil: status === 'PREPAID' ? prepaidPeriodIso : undefined,
        }),
      });

      if (status === 'PREPAID') {
        await createPavilionPayment(storeId, pavilion.id, {
          period: prepaidPeriodIso,
          rentPaid: prepaymentAmount ? Number(prepaymentAmount) : autoRent,
          utilitiesPaid: 0,
        });
      }

      onSaved();
    } catch (err: any) {
      setError(err.message || 'Ошибка создания павильона');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-lg bg-white p-6">
        <h2 className="mb-6 text-xl font-bold">Создать новый павильон</h2>

        {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

        <div className="space-y-5">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Номер павильона</label>
            <input
              type="text"
              value={number}
              onChange={(e) => setNumber(e.target.value)}
              className="w-full rounded-lg border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Например: A-12"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Категория (из существующих)
            </label>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full rounded-lg border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Не выбрано</option>
              {existingCategories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Или введите новую категорию
            </label>
            <input
              type="text"
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              className="w-full rounded-lg border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Например: Одежда"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Площадь (м2)</label>
            <input
              type="number"
              step="0.01"
              value={squareMeters}
              onChange={(e) => setSquareMeters(e.target.value)}
              className="w-full rounded-lg border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="25.5"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Цена за м2</label>
            <input
              type="number"
              step="0.01"
              value={pricePerSqM}
              onChange={(e) => setPricePerSqM(e.target.value)}
              className="w-full rounded-lg border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="120.00"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Статус</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full rounded-lg border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="AVAILABLE">СВОБОДЕН</option>
              <option value="RENTED">ЗАНЯТ</option>
              <option value="PREPAID">ПРЕДОПЛАТА</option>
            </select>
          </div>

          {status === 'PREPAID' && (
            <>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Месяц предоплаты
                </label>
                <input
                  type="month"
                  value={prepaymentMonth}
                  onChange={(e) => setPrepaymentMonth(e.target.value)}
                  className="w-full rounded-lg border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Сумма предоплаты (если пусто - полная аренда)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={prepaymentAmount}
                  onChange={(e) => setPrepaymentAmount(e.target.value)}
                  className="w-full rounded-lg border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Например: 1200"
                />
              </div>
            </>
          )}
        </div>

        <div className="mt-8 flex justify-end gap-3">
          <button
            onClick={onClose}
            disabled={loading}
            className="rounded-lg border px-5 py-2.5 hover:bg-gray-100 disabled:opacity-50"
          >
            Отмена
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="rounded-lg bg-blue-600 px-5 py-2.5 text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Создание...' : 'Создать павильон'}
          </button>
        </div>
      </div>
    </div>
  );
}
