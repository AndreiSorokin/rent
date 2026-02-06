'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { getCurrentUserFromToken } from '@/lib/auth';
import Link from 'next/link';
import { hasPermission } from '@/lib/permissions';

// Permission enum (add CREATE_STORES if not present)
enum Permission {
  // ... your existing permissions ...
  CREATE_STORES = 'CREATE_STORES',
}

interface StoreSummary {
  id: number;
  name: string;
  permissions?: string[];
}

// Simple modal component (you can move it to separate file later)
export function CreateStoreModal({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: (newStore: { id: number; name: string }) => void;
}) {
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!name.trim()) {
      setError('Введите название магазина');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const newStore = await apiFetch<{ id: number; name: string }>('/stores', {
        method: 'POST',
        body: JSON.stringify({ name: name.trim() }),
      });

      onSaved(newStore);
    } catch (err: any) {
      setError(err.message || 'Ошибка создания магазина');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <h2 className="text-xl font-bold mb-6">Создать новый магазин</h2>

        {error && <p className="text-red-600 mb-4 text-sm">{error}</p>}

        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Название магазина
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Например: Торговый центр Альфа"
          />
        </div>

        <div className="flex justify-end gap-3">
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
            {loading ? 'Создание...' : 'Создать'}
          </button>
        </div>
      </div>
    </div>
  );
}