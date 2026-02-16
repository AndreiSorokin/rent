'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import Link from 'next/link';
import { CreateStoreModal } from './components/CreateStoreModal';
import { getCurrentUserFromToken } from '@/lib/auth';

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
    const user = getCurrentUserFromToken();
    setCurrentUser(user);

    apiFetch<StoreSummary[]>('/stores/my')
      .then((data) => {
        setStores(data || []);
      })
      .catch(() => setError('Не удалось загрузить объекты'))
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
      <div className="mx-auto max-w-6xl p-4 md:p-8">
        <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <h1 className="text-center text-3xl font-bold text-gray-800 md:text-left">
            Мои объекты
          </h1>

          <button
            onClick={() => setShowCreateModal(true)}
            className="rounded-lg bg-green-600 px-6 py-3 font-medium text-white shadow-sm transition hover:bg-green-700"
          >
            + Добавить объект
          </button>
        </div>

        {currentUser ? (
          <div className="mb-8 rounded-xl bg-white p-6 shadow">
            <h2 className="mb-4 text-xl font-semibold">Добро пожаловать!</h2>
            <p className="text-lg">
              <strong>{currentUser.name || 'Пользователь'}</strong> ({currentUser.email})
            </p>
            <div className="mt-6 border-t pt-4">
              <Link
                href="/reset-password"
                className="inline-flex rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
              >
                Сменить пароль
              </Link>
            </div>
          </div>
        ) : (
          <div className="mb-8 animate-pulse rounded-xl bg-white p-6 shadow">
            <h2 className="mb-4 text-xl font-semibold">Загрузка пользователя...</h2>
          </div>
        )}

        {stores.length === 0 ? (
          <div className="rounded-xl bg-white p-8 text-center shadow">
            <p className="mb-6 text-lg text-gray-600">У вас пока нет объектов</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {stores.map((store) => (
              <Link
                key={store.id}
                href={`/stores/${store.id}`}
                className="overflow-hidden rounded-xl bg-white shadow transition-shadow hover:shadow-lg"
              >
                <div className="p-6">
                  <h3 className="mb-2 truncate text-xl font-semibold text-gray-800">
                    {store.name}
                  </h3>
                  <div className="flex items-center justify-between">
                    <span className="rounded-full bg-indigo-100 px-3 py-1 text-sm text-indigo-800">
                      {store.permissions?.join(', ') || 'Сотрудник'}
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {showCreateModal && (
        <CreateStoreModal
          onClose={() => setShowCreateModal(false)}
          onSaved={handleStoreCreated}
        />
      )}
    </div>
  );
}
