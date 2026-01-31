'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { Store } from '@/types/store';
import { hasPermission } from '@/lib/permissions';
import { PavilionStats } from './components/PavilionStats';
import { PaymentSummary } from './components/PaymentSummary';
import { PavilionList } from './components/PavilionList';
import { CreatePavilionButton } from './components/CreatePavilionButton';
import {
  createPavilion,
  deletePavilion,
} from '@/lib/pavilions';

export default function DashboardPage() {
  const [store, setStore] = useState<Store | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Example: later you can fetch user's default store
    apiFetch<Store>('/stores/2')
      .then(setStore)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="p-6">Loading…</div>;
  if (!store) return <div className="p-6">No access</div>;

  const { permissions } = store;

  const refreshStore = async () => {
  const updated = await apiFetch(`/stores/${store.id}`);
  setStore(updated);
};

const handleDelete = async (id: number) => {
  if (!confirm('Delete pavilion?')) return;
  await deletePavilion(store.id, id);
  refreshStore();
};


const handleCreate = async () => {
  const number = prompt('Pavilion number');
  if (!number) return;

  await createPavilion(store.id, {
    number,
    squareMeters: 10,
    pricePerSqM: 10,
  });

  refreshStore();
};

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">{store.name} Dashboard</h1>

      {hasPermission(permissions, 'VIEW_PAVILIONS') && (
        <PavilionStats pavilions={store.pavilions} />
      )}

      {hasPermission(permissions, 'VIEW_PAYMENTS') && (
        <PaymentSummary pavilions={store.pavilions} />
      )}

      {!hasPermission(permissions, 'VIEW_PAVILIONS') && (
        <div className="text-gray-500">
          You have limited access to this store.
        </div>
      )}
      <CreatePavilionButton
        permissions={store.permissions}
        onClick={handleCreate}
      />
          
      <PavilionList
        storeId={store.id}
        pavilions={store.pavilions}
        permissions={store.permissions}
        refresh={refreshStore}
      />
    </div>
  );
}
