'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { resolveApiMediaUrl } from '@/lib/media';
import { hasPermission } from '@/lib/permissions';
import { StoreSidebar } from '../components/StoreSidebar';
import { useToast } from '@/components/toast/ToastProvider';
import { useDialog } from '@/components/dialog/DialogProvider';

type StoreMediaResponse = {
  id: number;
  name: string;
  images: Array<{ id: number; filePath: string; createdAt: string }>;
};

export default function StoreMediaPage() {
  const params = useParams();
  const storeId = Number(params.storeId);
  const toast = useToast();
  const dialog = useDialog();

  const [store, setStore] = useState<any>(null);
  const [media, setMedia] = useState<StoreMediaResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const fetchData = async () => {
    try {
      const [storeData, mediaData] = await Promise.all([
        apiFetch(`/stores/${storeId}?lite=1`),
        apiFetch<StoreMediaResponse>(`/stores/${storeId}/media`),
      ]);
      setStore(storeData);
      setMedia(mediaData);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (storeId) {
      void fetchData();
    }
  }, [storeId]);

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;

    const formData = new FormData();
    files.forEach((file) => formData.append('files', file));

    try {
      setUploading(true);
      await apiFetch(`/stores/${storeId}/media`, {
        method: 'POST',
        body: formData,
      });
      toast.success(files.length === 1 ? 'Фото добавлено' : `Добавлено фотографий: ${files.length}`);
      await fetchData();
    } catch (err: any) {
      toast.error(err?.message || 'Не удалось загрузить фотографии');
    } finally {
      setUploading(false);
      event.target.value = '';
    }
  };

  const handleDelete = async (imageId: number) => {
    const confirmed = await dialog.confirm({
      title: 'Удаление фотографии',
      message: 'Удалить эту фотографию объекта?',
      tone: 'danger',
      confirmText: 'Удалить',
    });
    if (!confirmed) return;

    try {
      setDeletingId(imageId);
      await apiFetch(`/stores/${storeId}/media/${imageId}`, { method: 'DELETE' });
      toast.success('Фотография удалена');
      await fetchData();
    } catch (err: any) {
      toast.error(err?.message || 'Не удалось удалить фотографию');
    } finally {
      setDeletingId(null);
    }
  };

  if (loading) {
    return <div className="p-6 text-center text-lg">Загрузка...</div>;
  }

  const permissions = store?.permissions || [];
  if (!hasPermission(permissions, 'MANAGE_MEDIA')) {
    return <div className="p-6 text-center text-red-600">Недостаточно прав для управления фотографиями</div>;
  }

  return (
    <div className="min-h-screen bg-[#f6f1eb]">
      <div className="mx-auto flex max-w-[1600px] gap-6 px-3 py-1 md:px-6 md:py-6">
        <StoreSidebar storeId={storeId} store={store} />
        <main className="min-w-0 flex-1">
          <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-2">
            <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
              <div>
                <p className="text-sm uppercase tracking-[0.12em] text-[#6b6b6b]">Медиа объекта</p>
                <h1 className="mt-2 text-2xl font-bold text-[#111111] md:text-3xl">
                  Фото объекта: {store.name}
                </h1>
              </div>
              <div className="flex items-center gap-2">
                <Link
                  href={`/stores/${storeId}/settings`}
                  className="rounded-xl border border-[#d8d1cb] bg-white px-4 py-2 font-semibold text-[#111111] transition hover:bg-[#f4efeb]"
                >
                  Назад к управлению объектом
                </Link>
                <label className="inline-flex cursor-pointer items-center rounded-xl bg-[#ff6a13] px-4 py-2 font-semibold text-white transition hover:bg-[#e85a0c]">
                  {uploading ? 'Загрузка...' : 'Добавить фото'}
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    multiple
                    className="hidden"
                    onChange={(e) => void handleUpload(e)}
                    disabled={uploading}
                  />
                </label>
              </div>
            </div>

            <div className="rounded-2xl border border-[#d8d1cb] bg-white p-6 shadow-[0_12px_36px_-20px_rgba(17,17,17,0.2)]">
              {!media || media.images.length === 0 ? (
                <div className="flex min-h-[260px] items-center justify-center rounded-2xl border border-dashed border-[#d8d1cb] bg-[#f8f4ef] text-sm text-[#6b6b6b]">
                  Фотографий пока нет
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {media.images.map((image) => (
                    <article
                      key={image.id}
                      className="overflow-hidden rounded-2xl border border-[#d8d1cb] bg-[#f8f4ef]"
                    >
                      <img
                        src={resolveApiMediaUrl(image.filePath) || undefined}
                        alt={`Фото объекта ${store.name}`}
                        className="h-64 w-full object-cover"
                      />
                      <div className="flex items-center justify-between gap-3 p-4">
                        <p className="text-sm text-[#6b6b6b]">
                          {new Date(image.createdAt).toLocaleString('ru-RU')}
                        </p>
                        <button
                          type="button"
                          onClick={() => void handleDelete(image.id)}
                          disabled={deletingId === image.id}
                          className="rounded-xl border border-[#d8d1cb] bg-white px-3 py-2 text-sm font-semibold text-[#111111] transition hover:bg-[#f4efeb] disabled:opacity-60"
                        >
                          {deletingId === image.id ? 'Удаление...' : 'Удалить'}
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
