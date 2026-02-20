'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { getCurrencySymbol } from '@/lib/currency';
import { hasPermission } from '@/lib/permissions';
import { StoreUsersSection } from '@/app/dashboard/components/StoreUsersSection';

export default function StoreSettingsPage() {
  const params = useParams();
  const router = useRouter();
  const storeId = Number(params.storeId);

  const [store, setStore] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [nameDraft, setNameDraft] = useState('');
  const [nameSaving, setNameSaving] = useState(false);
  const [currencySaving, setCurrencySaving] = useState(false);

  const [showDeleteStoreModal, setShowDeleteStoreModal] = useState(false);
  const [deleteStoreInput, setDeleteStoreInput] = useState('');
  const [deletingStore, setDeletingStore] = useState(false);

  const [newCategoryName, setNewCategoryName] = useState('');
  const [categorySaving, setCategorySaving] = useState(false);
  const [categoryRenameByName, setCategoryRenameByName] = useState<
    Record<string, string>
  >({});
  const [categoryRenameLoadingByName, setCategoryRenameLoadingByName] = useState<
    Record<string, boolean>
  >({});
  const [categoryDeletingName, setCategoryDeletingName] = useState<string | null>(
    null,
  );

  const [newGroupName, setNewGroupName] = useState('');
  const [groupSaving, setGroupSaving] = useState(false);
  const [groupRenameById, setGroupRenameById] = useState<Record<number, string>>({});
  const [groupRenameLoadingById, setGroupRenameLoadingById] = useState<
    Record<number, boolean>
  >({});
  const [groupDeletingId, setGroupDeletingId] = useState<number | null>(null);

  const fetchStore = async (withLoader = true) => {
    if (withLoader) setLoading(true);
    try {
      const data = await apiFetch(`/stores/${storeId}`);
      setStore(data);
      setNameDraft(data.name ?? '');
    } catch (err) {
      console.error(err);
      setError('Не удалось загрузить настройки');
    } finally {
      if (withLoader) setLoading(false);
    }
  };

  useEffect(() => {
    if (storeId) {
      void fetchStore(true);
    }
  }, [storeId]);

  useEffect(() => {
    const nextDrafts: Record<number, string> = {};
    for (const group of store?.pavilionGroups || []) {
      nextDrafts[group.id] = String(group.name ?? '');
    }
    setGroupRenameById(nextDrafts);
  }, [store?.pavilionGroups]);

  const categoryList = useMemo(() => {
    const fromPavilions = (store?.pavilions || [])
      .map((p: any) => String(p.category || '').trim())
      .filter((category: string) => category.length > 0);
    const fromPresets = (store?.pavilionCategoryPresets || [])
      .map((category: string) => String(category || '').trim())
      .filter((category: string) => category.length > 0);
    return Array.from(new Set([...fromPavilions, ...fromPresets])).sort((a, b) =>
      a.localeCompare(b),
    );
  }, [store?.pavilions, store?.pavilionCategoryPresets]);

  useEffect(() => {
    const nextDrafts: Record<string, string> = {};
    for (const category of categoryList) {
      nextDrafts[category] = category;
    }
    setCategoryRenameByName(nextDrafts);
  }, [categoryList]);

  if (loading) return <div className="p-6 text-center text-lg">Загрузка...</div>;
  if (error) return <div className="p-6 text-center text-red-600">{error}</div>;
  if (!store) return <div className="p-6 text-center text-red-600">Объект не найден</div>;

  const permissions = store.permissions || [];
  const canManageStore = hasPermission(permissions, 'ASSIGN_PERMISSIONS');
  const canEditPavilions = hasPermission(permissions, 'EDIT_PAVILIONS');
  const canManageUsers =
    hasPermission(permissions, 'INVITE_USERS') ||
    hasPermission(permissions, 'ASSIGN_PERMISSIONS');

  const handleUpdateStoreName = async () => {
    const name = nameDraft.trim();
    if (!name) {
      alert('Введите название объекта');
      return;
    }
    try {
      setNameSaving(true);
      await apiFetch(`/stores/${storeId}/name`, {
        method: 'PATCH',
        body: JSON.stringify({ name }),
      });
      await fetchStore(false);
    } catch (err: any) {
      console.error(err);
      alert(err?.message || 'Не удалось изменить название');
    } finally {
      setNameSaving(false);
    }
  };

  const handleCurrencyChange = async (currency: 'RUB' | 'KZT') => {
    try {
      setCurrencySaving(true);
      await apiFetch(`/stores/${storeId}/currency`, {
        method: 'PATCH',
        body: JSON.stringify({ currency }),
      });
      await fetchStore(false);
    } catch (err: any) {
      console.error(err);
      alert(err?.message || 'Не удалось изменить валюту');
    } finally {
      setCurrencySaving(false);
    }
  };

  const handleDeleteStore = async () => {
    if (deleteStoreInput.trim().toUpperCase() !== 'УДАЛИТЬ') {
      alert('Введите слово "УДАЛИТЬ" для подтверждения');
      return;
    }

    try {
      setDeletingStore(true);
      await apiFetch(`/stores/${storeId}`, { method: 'DELETE' });
      setShowDeleteStoreModal(false);
      setDeleteStoreInput('');
      router.push('/dashboard');
    } catch (err: any) {
      console.error(err);
      alert(err?.message || 'Не удалось удалить объект');
    } finally {
      setDeletingStore(false);
    }
  };

  const handleCreateCategory = async () => {
    const name = newCategoryName.trim();
    if (!name) {
      alert('Введите название категории');
      return;
    }

    try {
      setCategorySaving(true);
      await apiFetch(`/stores/${storeId}/pavilion-categories`, {
        method: 'POST',
        body: JSON.stringify({ name }),
      });
      setNewCategoryName('');
      await fetchStore(false);
    } catch (err: any) {
      console.error(err);
      alert(err?.message || 'Не удалось добавить категорию');
    } finally {
      setCategorySaving(false);
    }
  };

  const handleRenameCategory = async (oldName: string) => {
    const newName = (categoryRenameByName[oldName] ?? '').trim();
    if (!newName) {
      alert('Введите новое название категории');
      return;
    }

    try {
      setCategoryRenameLoadingByName((prev) => ({ ...prev, [oldName]: true }));
      await apiFetch(
        `/stores/${storeId}/pavilion-categories/${encodeURIComponent(oldName)}`,
        {
          method: 'PATCH',
          body: JSON.stringify({ newName }),
        },
      );
      await fetchStore(false);
    } catch (err: any) {
      console.error(err);
      alert(err?.message || 'Не удалось переименовать категорию');
    } finally {
      setCategoryRenameLoadingByName((prev) => ({ ...prev, [oldName]: false }));
    }
  };

  const handleDeleteCategory = async (name: string) => {
    if (!confirm(`Удалить категорию "${name}"?`)) return;

    try {
      setCategoryDeletingName(name);
      await apiFetch(
        `/stores/${storeId}/pavilion-categories/${encodeURIComponent(name)}`,
        {
          method: 'DELETE',
        },
      );
      await fetchStore(false);
    } catch (err: any) {
      console.error(err);
      alert(err?.message || 'Не удалось удалить категорию');
    } finally {
      setCategoryDeletingName(null);
    }
  };

  const handleCreatePavilionGroup = async () => {
    const name = newGroupName.trim();
    if (!name) {
      alert('Введите название группы');
      return;
    }

    try {
      setGroupSaving(true);
      await apiFetch(`/stores/${storeId}/pavilion-groups`, {
        method: 'POST',
        body: JSON.stringify({ name }),
      });
      setNewGroupName('');
      await fetchStore(false);
    } catch (err: any) {
      console.error(err);
      alert(err?.message || 'Не удалось создать группу');
    } finally {
      setGroupSaving(false);
    }
  };

  const handleRenamePavilionGroup = async (groupId: number) => {
    const name = (groupRenameById[groupId] ?? '').trim();
    if (!name) {
      alert('Введите название группы');
      return;
    }

    try {
      setGroupRenameLoadingById((prev) => ({ ...prev, [groupId]: true }));
      await apiFetch(`/stores/${storeId}/pavilion-groups/${groupId}`, {
        method: 'PATCH',
        body: JSON.stringify({ name }),
      });
      await fetchStore(false);
    } catch (err: any) {
      console.error(err);
      alert(err?.message || 'Не удалось переименовать группу');
    } finally {
      setGroupRenameLoadingById((prev) => ({ ...prev, [groupId]: false }));
    }
  };

  const handleDeletePavilionGroup = async (groupId: number) => {
    if (!confirm('Удалить эту группу?')) return;

    try {
      setGroupDeletingId(groupId);
      await apiFetch(`/stores/${storeId}/pavilion-groups/${groupId}`, {
        method: 'DELETE',
      });
      await fetchStore(false);
    } catch (err: any) {
      console.error(err);
      alert(err?.message || 'Не удалось удалить группу');
    } finally {
      setGroupDeletingId(null);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-6xl space-y-6 p-4 md:space-y-8 md:p-8">
        <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
          <div>
            <Link
              href={`/stores/${storeId}`}
              className="text-sm text-blue-600 hover:underline md:text-base"
            >
              Назад к объекту
            </Link>
            <h1 className="mt-2 text-2xl font-bold text-gray-900 md:text-3xl">
              Настройки: {store.name}
            </h1>
          </div>
        </div>

        {canManageStore && (
          <div className="rounded-xl bg-white p-6 shadow md:p-8">
            <h2 className="mb-4 text-xl font-semibold md:text-2xl">Основные настройки</h2>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <div className="rounded-lg border p-4">
                <h3 className="mb-2 font-medium">Название объекта</h3>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={nameDraft}
                    onChange={(e) => setNameDraft(e.target.value)}
                    className="w-full rounded border border-gray-300 px-3 py-2"
                  />
                  <button
                    onClick={handleUpdateStoreName}
                    disabled={nameSaving || nameDraft.trim() === String(store.name ?? '').trim()}
                    className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {nameSaving ? '...' : 'Сохранить'}
                  </button>
                </div>
              </div>

              <div className="rounded-lg border p-4">
                <h3 className="mb-2 font-medium">Валюта</h3>
                <p className="mb-2 text-sm text-gray-600">
                  Текущая валюта: {store.currency} ({getCurrencySymbol(store.currency)})
                </p>
                <select
                  value={store.currency ?? 'RUB'}
                  onChange={(e) => handleCurrencyChange(e.target.value as 'RUB' | 'KZT')}
                  disabled={currencySaving}
                  className="w-full rounded border border-gray-300 px-3 py-2"
                >
                  <option value="RUB">Российский рубль (₽)</option>
                  <option value="KZT">Казахстанский тенге (₸)</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {canEditPavilions && (
          <div className="rounded-xl bg-white p-6 shadow md:p-8">
            <h2 className="mb-4 text-xl font-semibold md:text-2xl">Категории павильонов</h2>
            <div className="mb-4 flex gap-2">
              <input
                type="text"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                className="w-full rounded border border-gray-300 px-3 py-2"
                placeholder="Новая категория"
              />
              <button
                onClick={handleCreateCategory}
                disabled={categorySaving}
                className="rounded bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-700 disabled:opacity-60"
              >
                {categorySaving ? 'Добавление...' : 'Добавить'}
              </button>
            </div>

            {categoryList.length === 0 ? (
              <p className="text-sm text-gray-600">Категорий пока нет</p>
            ) : (
              <div className="space-y-2">
                {categoryList.map((category) => {
                  const rawDraft = categoryRenameByName[category] ?? category;
                  const draftName = rawDraft.trim();
                  const changed = draftName.length > 0 && draftName !== category;
                  return (
                    <div key={category} className="flex flex-col gap-2 md:flex-row">
                      <input
                        type="text"
                        value={rawDraft}
                        onChange={(e) =>
                          setCategoryRenameByName((prev) => ({
                            ...prev,
                            [category]: e.target.value,
                          }))
                        }
                        className="w-full rounded border border-gray-300 px-3 py-2"
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleRenameCategory(category)}
                          disabled={Boolean(categoryRenameLoadingByName[category]) || !changed}
                          className="rounded bg-blue-600 px-3 py-2 text-xs text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {categoryRenameLoadingByName[category]
                            ? 'Сохранение...'
                            : 'Переименовать'}
                        </button>
                        <button
                          onClick={() => handleDeleteCategory(category)}
                          disabled={categoryDeletingName === category}
                          className="rounded bg-red-600 px-3 py-2 text-xs text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {categoryDeletingName === category ? 'Удаление...' : 'Удалить'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {canEditPavilions && (
          <div className="rounded-xl bg-white p-6 shadow md:p-8">
            <h2 className="mb-4 text-xl font-semibold md:text-2xl">Группы павильонов</h2>
            <div className="mb-4 flex gap-2">
              <input
                type="text"
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                className="w-full rounded border border-gray-300 px-3 py-2"
                placeholder="Название новой группы"
              />
              <button
                onClick={handleCreatePavilionGroup}
                disabled={groupSaving}
                className="rounded bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-700 disabled:opacity-60"
              >
                {groupSaving ? 'Создание...' : 'Создать'}
              </button>
            </div>

            {(store.pavilionGroups || []).length === 0 ? (
              <p className="text-sm text-gray-600">Групп пока нет</p>
            ) : (
              <div className="space-y-2">
                {(store.pavilionGroups || []).map((group: any) => {
                  const rawDraft = groupRenameById[group.id] ?? '';
                  const draftName = rawDraft.trim();
                  const currentName = String(group.name ?? '').trim();
                  const changed = draftName.length > 0 && draftName !== currentName;

                  return (
                    <div key={group.id} className="flex flex-col gap-2 md:flex-row">
                      <input
                        type="text"
                        value={rawDraft}
                        onChange={(e) =>
                          setGroupRenameById((prev) => ({
                            ...prev,
                            [group.id]: e.target.value,
                          }))
                        }
                        className="w-full rounded border border-gray-300 px-3 py-2"
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleRenamePavilionGroup(group.id)}
                          disabled={Boolean(groupRenameLoadingById[group.id]) || !changed}
                          className="rounded bg-blue-600 px-3 py-2 text-xs text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {groupRenameLoadingById[group.id]
                            ? 'Сохранение...'
                            : 'Переименовать'}
                        </button>
                        <button
                          onClick={() => handleDeletePavilionGroup(group.id)}
                          disabled={groupDeletingId === group.id}
                          className="rounded bg-red-600 px-3 py-2 text-xs text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {groupDeletingId === group.id ? 'Удаление...' : 'Удалить'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {canManageUsers && (
          <div className="rounded-xl bg-white p-6 shadow md:p-8">
            <h2 className="mb-6 text-xl font-semibold md:text-2xl">Пользователи и права</h2>
            <StoreUsersSection
              storeId={storeId}
              permissions={permissions}
              onUsersChanged={() => {
                // no-op
              }}
            />
          </div>
        )}

        {canManageStore && (
          <div className="rounded-xl bg-white p-6 shadow md:p-8">
            <h2 className="mb-4 text-xl font-semibold text-red-700 md:text-2xl">
              Опасная зона
            </h2>
            <button
              onClick={() => setShowDeleteStoreModal(true)}
              disabled={deletingStore}
              className="rounded-lg bg-red-600 px-5 py-2.5 font-medium text-white shadow-sm transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {deletingStore ? 'Удаление...' : 'Удалить объект'}
            </button>
          </div>
        )}
      </div>

      {showDeleteStoreModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-gray-900">Удаление объекта</h3>
            <p className="mt-3 text-sm text-gray-600">
              Чтобы удалить, напишите слово <span className="font-semibold">УДАЛИТЬ</span>.
            </p>
            <input
              type="text"
              value={deleteStoreInput}
              onChange={(e) => setDeleteStoreInput(e.target.value)}
              className="mt-4 w-full rounded-lg border border-gray-300 px-3 py-2"
              placeholder="УДАЛИТЬ"
            />
            <div className="mt-5 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowDeleteStoreModal(false);
                  setDeleteStoreInput('');
                }}
                className="rounded-lg border px-4 py-2 hover:bg-gray-100"
              >
                Отмена
              </button>
              <button
                onClick={handleDeleteStore}
                disabled={deletingStore || deleteStoreInput.trim().toUpperCase() !== 'УДАЛИТЬ'}
                className="rounded-lg bg-red-600 px-4 py-2 text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {deletingStore ? 'Удаление...' : 'Удалить объект'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
