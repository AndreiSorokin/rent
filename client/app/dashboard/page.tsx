'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import Link from 'next/link';
import { CreateStoreModal } from './components/CreateStoreModal';

// This function must be defined ONLY ONCE
export function getCurrentUserFromToken() {
  const token = localStorage.getItem('token');
  if (!token) return null;

  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return {
      id: payload.id,
      email: payload.email,
      name: payload.name || null,
      // permissions: payload.permissions || [],
    };
  } catch (e) {
    console.error('Invalid token');
    return null;
  }
}

interface StoreSummary {
  id: number;
  name: string;
  permissions?: string[];
}

export default function StoresPage() {
  const [stores, setStores] = useState<StoreSummary[]>([]);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  useEffect(() => {
    // Safe: localStorage only in browser
    const user = getCurrentUserFromToken();
    setCurrentUser(user);

    apiFetch<StoreSummary[]>('/stores/my')
      .then((data) => {
        setStores(data || []);
      })
      .catch(() => setError('Не удалось загрузить магазины'))
      .finally(() => setLoading(false));
  }, []);

  const handleStoreCreated = (newStore: StoreSummary) => {
    setStores((prev) => [...prev, newStore]);
    setShowCreateModal(false);
  };

  if (loading) return <div className="p-8 text-center text-lg">Загрузка...</div>;
  if (error) return <div className="p-8 text-center text-red-600 text-lg">{error}</div>;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto p-4 md:p-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <h1 className="text-3xl font-bold text-gray-800 text-center md:text-left">
            Мои магазины
          </h1>

          {/* Button to create store */}
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-6 py-3 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 transition shadow-sm"
          >
            + Создать новый магазин
          </button>
        </div>

        {/* User info */}
        {currentUser ? (
          <div className="bg-white rounded-xl shadow p-6 mb-8">
            <h2 className="text-xl font-semibold mb-4">Добро пожаловать!</h2>
            <p className="text-lg">
              <strong>{currentUser.name || 'Пользователь'}</strong> ({currentUser.email})
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow p-6 mb-8 animate-pulse">
            <h2 className="text-xl font-semibold mb-4">Загрузка пользователя...</h2>
          </div>
        )}

        {stores.length === 0 ? (
          <div className="bg-white rounded-xl shadow p-8 text-center">
            <p className="text-gray-600 text-lg mb-6">
              У вас пока нет магазинов
            </p>
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

      {/* Create Store Modal */}
      {showCreateModal && (
        <CreateStoreModal
          onClose={() => setShowCreateModal(false)}
          onSaved={handleStoreCreated}
        />
      )}
    </div>
  );
}