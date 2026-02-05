'use client';

import { useState } from 'react';
import { apiFetch } from '@/lib/api';

type CreatePavilionModalProps = {
  storeId: number;
  onClose: () => void;
  onSaved: () => void;
};

export function CreatePavilionModal({ storeId, onClose, onSaved }: CreatePavilionModalProps) {
  const [number, setNumber] = useState('');
  const [squareMeters, setSquareMeters] = useState('');
  const [pricePerSqM, setPricePerSqM] = useState('');
  const [status, setStatus] = useState('AVAILABLE');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!number || !squareMeters || !pricePerSqM) {
      setError('Заполните все обязательные поля');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await apiFetch(`/stores/${storeId}/pavilions`, {
        method: 'POST',
        body: JSON.stringify({
          number,
          squareMeters: Number(squareMeters),
          pricePerSqM: Number(pricePerSqM),
          status,
        }),
      });

      onSaved(); // refresh list
    } catch (err: any) {
      setError(err.message || 'Ошибка создания павильона');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-bold mb-6">Создать новый павильон</h2>

        {error && <p className="text-red-600 mb-4 text-sm">{error}</p>}

        <div className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Номер павильона
            </label>
            <input
              type="text"
              value={number}
              onChange={(e) => setNumber(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Например: A-12"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Площадь (м²)
            </label>
            <input
              type="number"
              step="0.01"
              value={squareMeters}
              onChange={(e) => setSquareMeters(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="25.5"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Цена за м² ($)
            </label>
            <input
              type="number"
              step="0.01"
              value={pricePerSqM}
              onChange={(e) => setPricePerSqM(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="120.00"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Статус
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="AVAILABLE">Свободен</option>
              <option value="RENTED">Арендован</option>
            </select>
          </div>
        </div>

        <div className="mt-8 flex justify-end gap-3">
          <button
            onClick={onClose}
            disabled={loading}
            className="px-5 py-2.5 border rounded-lg hover:bg-gray-100 disabled:opacity-50"
          >
            Отмена
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Создание...' : 'Создать павильон'}
          </button>
        </div>
      </div>
    </div>
  );
}