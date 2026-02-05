'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import Link from 'next/link';
import { Store } from '@/types/store';

export default function StoresPage() {
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<Store[]>('/stores/my')
      .then(setStores)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="p-6 text-center">Загрузка...</div>;

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-center md:text-left">Мои магазины</h1>

      {stores.length === 0 ? (
        <p className="text-gray-500 text-center">У вас нет магазинов. Создайте новый или попросите приглашение.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {stores.map((store) => (
            console.log(store),
            <Link key={store.id} href={`/stores/${store.id}`} className="border rounded-lg p-4 bg-white shadow-sm hover:shadow-md transition-shadow">
              <h2 className="text-lg font-semibold">{store.name}</h2>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}