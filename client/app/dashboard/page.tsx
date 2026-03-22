'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import Link from 'next/link';
import { CreateStoreModal } from './components/CreateStoreModal';
import { getCurrentUserFromToken } from '@/lib/auth';
import { Store } from 'lucide-react';

interface StoreSummary {
  id: number;
  name: string;
  permissions?: string[];
  address?: string | null;
  billingCompanyName?: string | null;
  billingLegalAddress?: string | null;
  billingInn?: string | null;
  contactPhone?: string | null;
  contactEmail?: string | null;
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

  if (loading) return <div className="p-8 text-center text-lg text-[#111111]">Загрузка...</div>;
  if (error) return <div className="p-8 text-center text-lg text-[#EF4444]">{error}</div>;

  return (
    <div className="min-h-screen bg-[#f9f5f0] text-[#111111]">
      <div className="mx-auto max-w-7xl px-5 pb-14 pt-10 md:px-8 md:pt-14">
        <div className="mb-12 flex flex-col gap-7 md:mb-16 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="mb-3 text-sm font-medium tracking-wide text-[#6B6B6B]">
              {currentUser ? (
                <>
                  Добро пожаловать, <span className="font-semibold text-[#111111]">{currentUser.name || 'Пользователь'}</span> ({currentUser.email})
                </>
              ) : (
                'Панель управления объектами'
              )}
            </p>
            <h1 className="text-5xl font-extrabold leading-none tracking-tight md:text-4xl">
              Мои объекты
            </h1>
          </div>

          <button
            onClick={() => setShowCreateModal(true)}
            className="group relative inline-flex items-center gap-2 self-start rounded-full bg-[#FF6A13] px-7 py-3.5 text-sm font-bold uppercase tracking-wider text-white transition hover:-translate-y-0.5 hover:bg-[#E65C00]"
          >
            <span className="text-lg leading-none">+</span>
            <span>Добавить объект</span>
            <span className="pointer-events-none absolute -inset-1 -z-10 rounded-full bg-[#FF6A13]/30 blur-xl transition group-hover:opacity-80" />
          </button>
        </div>

        {currentUser ? (
          <div className="mb-10 rounded-[1.75rem] border border-[#D8D1CB] bg-[#F4EFEB] p-6 shadow-[0_8px_30px_rgba(0,0,0,0.04)] md:p-7">
            <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="mb-1 text-2xl font-bold">Профиль</h2>
                <p className="text-[15px] text-[#6B6B6B]">
                  <span className="font-semibold text-[#111111]">{currentUser.name || 'Пользователь'}</span> ({currentUser.email})
                </p>
              </div>
              <Link
                href="/reset-password"
                className="inline-flex items-center justify-center rounded-full bg-[#22C55E] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#16a34a]"
              >
                Изменить пароль
              </Link>
            </div>
          </div>
        ) : (
          <div className="mb-10 animate-pulse rounded-[1.75rem] border border-[#D8D1CB] bg-[#F4EFEB] p-6 shadow-[0_8px_30px_rgba(0,0,0,0.04)]">
            <h2 className="mb-4 text-xl font-semibold">Загрузка пользователя...</h2>
          </div>
        )}

        {stores.length === 0 ? (
          <div className="rounded-[2rem] border border-dashed border-[#D8D1CB] bg-[#F4EFEB] p-10 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-white text-2xl text-[#6B6B6B]">
              +
            </div>
            <p className="mb-2 text-lg font-semibold text-[#111111]">У вас пока нет объектов</p>
            <p className="text-sm text-[#6B6B6B]">Нажмите «Добавить объект», чтобы создать первый объект.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
            {stores.map((store, index) => (
              <Link
                key={store.id}
                href={`/stores/${store.id}`}
                className="group relative overflow-hidden rounded-[2rem] border border-[#D8D1CB] bg-white p-7 shadow-[0_6px_28px_rgba(0,0,0,0.04)] transition duration-300 hover:-translate-y-1 hover:border-[#FF6A13]/40 hover:shadow-[0_16px_34px_rgba(0,0,0,0.08)]"
              >
                <span className="pointer-events-none absolute -right-12 -top-12 h-36 w-36 rounded-full bg-[#FF6A13]/8 blur-2xl transition duration-300 group-hover:bg-[#FF6A13]/18" />
                <div className="relative z-10">
                  <div className="mb-5 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-[#F4EFEB] text-lg font-bold text-[#FF6A13] transition group-hover:scale-105">
                    <Store />
                  </div>
                  <h3 className="mb-3 truncate text-2xl font-bold text-[#111111]">{store.name}</h3>
                  <div className="mb-8">
                    <div className="inline-flex rounded-full bg-[#F4EFEB] px-3 py-1 text-sm text-[#6B6B6B]">
                      Адрес: {store.address || 'Не указан'}
                    </div>
                  </div>
                  <div className="flex items-center justify-between border-t border-[#ECE6E0] pt-4">
                    <span className="rounded-full bg-[#dcfce7] px-3 py-1 text-xs font-bold uppercase tracking-wide text-[#15803d]">
                      Активен
                    </span>
                    <span className="text-sm font-bold text-[#111111] transition group-hover:text-[#FF6A13]">
                      Управление →
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      <div className='justify-center items-center flex mt-10 wodth-full'>
        <tr className='border border-black'>
          <td className='border border-black'>
            <tr className='border border-black'></tr>
            <tr className='border border-black'>
              <td className='border border-black'>1</td>
              <td className='border border-black'>2</td>
            </tr>
            <tr className='border border-black'></tr>
          </td>
          <td className='border border-black'></td>
          <td className='border border-black'></td>
        </tr>
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

