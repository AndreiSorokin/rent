'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { getCurrentUserFromToken } from '@/lib/auth';
import Link from 'next/link';

interface StoreSummary {
  id: number;
  name: string;
  permissions?: string[]; // optional
}

export default function StoresPage() {
  const [stores, setStores] = useState<StoreSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Synchronous user data from token (can be outside effect)
  const currentUser = getCurrentUserFromToken();

  useEffect(() => {
    // Only async part here
    apiFetch<StoreSummary[]>('/stores/my')
      .then((data) => {
        setStores(data || []);
      })
      .catch(() => setError('Не удалось загрузить магазины'))
      .finally(() => setLoading(false));
  }, []); // empty deps — runs once

  if (loading) return <div className="p-8 text-center text-lg">Загрузка...</div>;
  if (error) return <div className="p-8 text-center text-red-600 text-lg">{error}</div>;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto p-4 md:p-8">
        <h1 className="text-3xl font-bold text-gray-800 mb-8 text-center md:text-left">
          Мои магазины
        </h1>

        {/* Показываем информацию о пользователе, если есть */}
        {currentUser && (
          <div className="bg-white rounded-xl shadow p-6 mb-8">
            <h2 className="text-xl font-semibold mb-4">Добро пожаловать!</h2>
            <p className="text-lg">
              <strong>{currentUser.name || 'Пользователь'}</strong> ({currentUser.email})
            </p>
          </div>
        )}

        {stores.length === 0 ? (
          <div className="bg-white rounded-xl shadow p-8 text-center">
            <p className="text-gray-600 text-lg mb-6">
              У вас пока нет магазинов
            </p>
            {/* Кнопка создания магазина, если есть такая возможность */}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {stores.map((store) => (
              <Link
                key={store.id}
                href={`/stores/${store.id}`}
                className="bg-white rounded-xl shadow hover:shadow-lg transition-shadow overflow-hidden"
              >
                <div className="p-6">
                  <h3 className="text-xl font-semibold text-gray-800 mb-2 truncate">
                    {store.name}
                  </h3>
                  <p className="text-gray-600 mb-4">
                    {/* Павильонов: {store.pavilions?.length ?? '—'} */}
                  </p>
                  <div className="flex items-center justify-between">
                    <span className="px-3 py-1 bg-indigo-100 text-indigo-800 rounded-full text-sm">
                      {store.permissions?.join(', ') || 'Сотрудник'}
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}