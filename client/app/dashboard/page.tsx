'use client';

import { useEffect, useState } from 'react';
import { PaymentSummary } from './components/PaymentSummary';
import { PavilionStats } from './components/PavilionStats';

export default function DashboardPage() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [store, setStore] = useState<any>(null);
  const token = localStorage.getItem('token');

  useEffect(() => {
    fetch('http://localhost:3000/stores/1', {
      headers: {
    Authorization: `Bearer ${token}`,
  },
    })
      .then(res => {
        if (!res.ok) throw new Error('Unauthorized');
        return res.json();
      })
      .then(setStore)
      .catch(console.error);
  }, []);


  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">{store.name} Dashboard</h1>
      <PavilionStats pavilions={store.pavilions} />
      <PaymentSummary pavilions={store.pavilions} />
    </div>
  );
}
