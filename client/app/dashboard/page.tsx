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
import { EditPavilionModal } from './components/EditPavilionModal';
import { StoreUsersSection } from './components/StoreUsersSection';

export default function DashboardPage() {
  const [store, setStore] = useState<Store | null>(null);
  const [loading, setLoading] = useState(true);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [editingPavilion, setEditingPavilion] = useState<any | undefined>(
    undefined
  );
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [analytics, setAnalytics] = useState<any>(null);

//TODO: make ID to be dynamic
  useEffect(() => {
    // Example: later you can fetch user's default store
    apiFetch<Store>('/stores/2')
      .then(setStore)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  //TODO: transfer analytics to lib
  useEffect(() => {
    apiFetch(`/stores/2/analytics`)
      .then(setAnalytics)
      .catch(console.error);
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


  const handleCreate = () => {
    setEditingPavilion(null);
  };

  return (
  <div className="p-6 space-y-6">
    <h1 className="text-2xl font-bold">{store.name} Dashboard</h1>

    {hasPermission(permissions, 'VIEW_PAVILIONS') && (
      <PavilionStats pavilions={store.pavilions} />
    )}

    {hasPermission(permissions, 'VIEW_PAYMENTS') && analytics && (
      <PaymentSummary analytics={analytics} />
    )}

    <StoreUsersSection
      storeId={store.id}
      permissions={store.permissions}
      onUsersChanged={refreshStore}
    />

    {editingPavilion !== undefined && (
      <EditPavilionModal
        storeId={store.id}
        pavilion={editingPavilion}
        onClose={() => setEditingPavilion(undefined)}
        onSaved={refreshStore}
      />
    )}

    {!hasPermission(permissions, 'VIEW_PAVILIONS') && (
      <div className="text-gray-500">
        You have limited access to this store.
      </div>
    )}

    <CreatePavilionButton permissions={store.permissions} onClick={handleCreate} />

    <PavilionList
      storeId={store.id}
      pavilions={store.pavilions}
      permissions={store.permissions}
      refresh={refreshStore}
      onDelete={handleDelete}
    />
  </div>
);
}
