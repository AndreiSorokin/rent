'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { getCurrencySymbol } from '@/lib/currency';
import { hasPermission } from '@/lib/permissions';
import { StoreUsersSection } from '@/app/dashboard/components/StoreUsersSection';
import { ImportStoreDataModal } from '@/app/dashboard/components/ImportStoreDataModal';

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
  const [showImportModal, setShowImportModal] = useState(false);
  const [exportingData, setExportingData] = useState(false);

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
  const [groupPavilionEditorGroupId, setGroupPavilionEditorGroupId] = useState<
    number | null
  >(null);
  const [groupPavilionSearchById, setGroupPavilionSearchById] = useState<
    Record<number, string>
  >({});
  const [groupPavilionSelectionById, setGroupPavilionSelectionById] = useState<
    Record<number, number[]>
  >({});
  const [groupPavilionSavingById, setGroupPavilionSavingById] = useState<
    Record<number, boolean>
  >({});

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
  const createPavilions = hasPermission(permissions, 'CREATE_PAVILIONS');
  const canExportData = hasPermission(permissions, 'EXPORT_STORE_DATA');
  const canManageUsers =
    hasPermission(permissions, 'INVITE_USERS') ||
    hasPermission(permissions, 'ASSIGN_PERMISSIONS') ||
    hasPermission(permissions, 'REMOVE_USERS');
  const canViewActivity = hasPermission(permissions, 'VIEW_ACTIVITY');

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

  const handleOpenGroupPavilionEditor = (group: any) => {
    const currentIds: number[] = (group.pavilions || []).map((item: any) =>
      Number(item.pavilionId),
    );
    setGroupPavilionSelectionById((prev) => ({
      ...prev,
      [group.id]: currentIds,
    }));
    setGroupPavilionEditorGroupId((prev) => (prev === group.id ? null : group.id));
  };

  const handleToggleGroupPavilionSelection = (groupId: number, pavilionId: number) => {
    setGroupPavilionSelectionById((prev) => {
      const current = prev[groupId] || [];
      const exists = current.includes(pavilionId);
      return {
        ...prev,
        [groupId]: exists
          ? current.filter((id) => id !== pavilionId)
          : [...current, pavilionId],
      };
    });
  };

  const handleSaveGroupPavilions = async (group: any) => {
    const groupId = Number(group.id);
    const currentIds = new Set<number>(
      (group.pavilions || []).map((item: any) => Number(item.pavilionId)),
    );
    const selectedIds = new Set<number>(groupPavilionSelectionById[groupId] || []);

    const toAdd = Array.from(selectedIds).filter((id) => !currentIds.has(id));
    const toRemove = Array.from(currentIds).filter((id) => !selectedIds.has(id));

    try {
      setGroupPavilionSavingById((prev) => ({ ...prev, [groupId]: true }));

      await Promise.all([
        ...toAdd.map((pavilionId) =>
          apiFetch(`/stores/${storeId}/pavilions/${pavilionId}/pavilion-groups/${groupId}`, {
            method: 'POST',
          }),
        ),
        ...toRemove.map((pavilionId) =>
          apiFetch(`/stores/${storeId}/pavilions/${pavilionId}/pavilion-groups/${groupId}`, {
            method: 'DELETE',
          }),
        ),
      ]);

      await fetchStore(false);
    } catch (err: any) {
      console.error(err);
      alert(err?.message || 'Не удалось сохранить состав группы');
    } finally {
      setGroupPavilionSavingById((prev) => ({ ...prev, [groupId]: false }));
    }
  };

  const handleExportData = async () => {
    try {
      setExportingData(true);
      const payload = await apiFetch<{
        pavilions: Array<{
          number: string;
          category?: string | null;
          squareMeters: number;
          pricePerSqM: number;
          utilitiesAmount?: number | null;
          status?: 'AVAILABLE' | 'RENTED' | 'PREPAID';
          tenantName?: string | null;
          advertisingAmount?: number | null;
        }>;
        householdExpenses: Array<{
          name: string;
          amount: number;
          status?: 'UNPAID' | 'PAID';
        }>;
        expenses: Array<{
          type:
            | 'PAYROLL_TAX'
            | 'PROFIT_TAX'
            | 'DIVIDENDS'
            | 'BANK_SERVICES'
            | 'VAT'
            | 'LAND_RENT'
            | 'OTHER';
          amount: number;
          status?: 'UNPAID' | 'PAID';
          note?: string | null;
        }>;
        accounting: Array<{
          recordDate: string;
          bankTransferPaid?: number;
          cashbox1Paid?: number;
          cashbox2Paid?: number;
        }>;
        staff: Array<{
          fullName: string;
          position: string;
          salary?: number;
          salaryStatus?: 'UNPAID' | 'PAID';
        }>;
      }>(`/stores/${storeId}/export-data`);

      const XLSX = await import('xlsx');
      const wb = XLSX.utils.book_new();

      const SHEETS = {
        pavilions: 'Павильоны',
        householdExpenses: 'ХозяйственныеРасходы',
        otherExpenses: 'ПрочиеРасходы',
        adminExpenses: 'АдминистративныеРасходы',
        accounting: 'БухТаблица',
        staff: 'Сотрудники',
      } as const;

      const pavilionsRows = (payload.pavilions || []).map((item) => ({
        'Номер павильона': item.number,
        Категория: item.category ?? '',
        Площадь: Number(item.squareMeters ?? 0),
        'Цена за м2': Number(item.pricePerSqM ?? 0),
        Коммунальные: item.utilitiesAmount ?? '',
        Статус:
          item.status === 'RENTED'
            ? 'ЗАНЯТ'
            : item.status === 'PREPAID'
              ? 'ПРЕДОПЛАТА'
              : 'СВОБОДЕН',
        'Наименование организации': item.tenantName ?? '',
        Реклама: item.advertisingAmount ?? '',
      }));
      const householdRows = (payload.householdExpenses || []).map((item) => ({
        Название: item.name ?? '',
        Сумма: Number(item.amount ?? 0),
        Статус: item.status === 'PAID' ? 'Оплачено' : 'Не оплачено',
      }));
      const adminTypeLabelByType: Record<string, string> = {
        PAYROLL_TAX: 'Налоги с зарплаты',
        PROFIT_TAX: 'Налог на прибыль',
        DIVIDENDS: 'Дивиденды',
        BANK_SERVICES: 'Банковские услуги',
        VAT: 'НДС',
        LAND_RENT: 'Аренда земли',
      };
      const otherRows = (payload.expenses || [])
        .filter((item) => item.type === 'OTHER')
        .map((item) => ({
          Название: item.note?.trim() || 'Прочий расход',
          Сумма: Number(item.amount ?? 0),
          Статус: item.status === 'PAID' ? 'Оплачено' : 'Не оплачено',
        }));
      const adminRows = (payload.expenses || [])
        .filter((item) => item.type !== 'OTHER')
        .map((item) => ({
          Название: item.note?.trim() || adminTypeLabelByType[item.type] || item.type,
          Сумма: Number(item.amount ?? 0),
          Статус: item.status === 'PAID' ? 'Оплачено' : 'Не оплачено',
        }));
      const accountingRows = (payload.accounting || []).map((item) => ({
        recordDate: item.recordDate,
        bankTransferPaid: Number(item.bankTransferPaid ?? 0),
        cashbox1Paid: Number(item.cashbox1Paid ?? 0),
        cashbox2Paid: Number(item.cashbox2Paid ?? 0),
      }));
      const staffRows = (payload.staff || []).map((item) => ({
        Должность: item.position ?? '',
        'Имя Фамилия': item.fullName ?? '',
        Зарплата: Number(item.salary ?? 0),
      }));

      const pavilionsSheet =
        pavilionsRows.length > 0
          ? XLSX.utils.json_to_sheet(pavilionsRows)
          : XLSX.utils.aoa_to_sheet([
              [
                'Номер павильона',
                'Категория',
                'Площадь',
                'Цена за м2',
                'Коммунальные',
                'Статус',
                'Наименование организации',
                'Реклама',
              ],
            ]);
      const householdSheet =
        householdRows.length > 0
          ? XLSX.utils.json_to_sheet(householdRows)
          : XLSX.utils.aoa_to_sheet([['Название', 'Сумма', 'Статус']]);
      const otherSheet =
        otherRows.length > 0
          ? XLSX.utils.json_to_sheet(otherRows)
          : XLSX.utils.aoa_to_sheet([['Название', 'Сумма', 'Статус']]);
      const adminSheet =
        adminRows.length > 0
          ? XLSX.utils.json_to_sheet(adminRows)
          : XLSX.utils.aoa_to_sheet([['Название', 'Сумма', 'Статус']]);
      const accountingSheet =
        accountingRows.length > 0
          ? XLSX.utils.json_to_sheet(accountingRows)
          : XLSX.utils.aoa_to_sheet([
              ['recordDate', 'bankTransferPaid', 'cashbox1Paid', 'cashbox2Paid'],
            ]);
      const staffSheet =
        staffRows.length > 0
          ? XLSX.utils.json_to_sheet(staffRows)
          : XLSX.utils.aoa_to_sheet([['Должность', 'Имя Фамилия', 'Зарплата']]);

      XLSX.utils.book_append_sheet(wb, pavilionsSheet, SHEETS.pavilions);
      XLSX.utils.book_append_sheet(wb, householdSheet, SHEETS.householdExpenses);
      XLSX.utils.book_append_sheet(wb, otherSheet, SHEETS.otherExpenses);
      XLSX.utils.book_append_sheet(wb, adminSheet, SHEETS.adminExpenses);
      XLSX.utils.book_append_sheet(wb, accountingSheet, SHEETS.accounting);
      XLSX.utils.book_append_sheet(wb, staffSheet, SHEETS.staff);

      XLSX.writeFile(wb, `store-export-${storeId}.xlsx`);
    } catch (err: any) {
      console.error(err);
      alert(err?.message || 'Не удалось выгрузить данные');
    } finally {
      setExportingData(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f6f1eb]">
      <div className="mx-auto max-w-6xl space-y-6 p-4 md:space-y-8 md:p-8">
        <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
          <div>
            <Link
              href={`/stores/${storeId}`}
              className="inline-flex items-center rounded-xl border border-[#d8d1cb] bg-white px-3 py-1.5 text-sm font-medium text-[#111111] transition hover:bg-[#f4efeb] md:text-base"
            >
              Назад к объекту
            </Link>
            <h1 className="mt-2 text-2xl font-bold text-[#111111] md:text-3xl">
              Управление объектом: {store.name}
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {canViewActivity && (
              <Link
                href={`/stores/${storeId}/activity`}
                className="inline-flex items-center rounded-xl border border-[#d8d1cb] bg-white px-4 py-2 text-sm font-semibold text-[#111111] transition hover:bg-[#f4efeb]"
              >
                Журнал действий
              </Link>
            )}
            {(createPavilions || canExportData) && (
              <div className="inline-flex items-center gap-2">
                {createPavilions && (
                <button
                  onClick={() => setShowImportModal(true)}
                  className="inline-flex items-center rounded-xl bg-[#ff6a13] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#e85a0c]"
                >
                  Загрузить данные
                </button>
                )}
                {canExportData && (
                <button
                  onClick={handleExportData}
                  disabled={exportingData}
                  className="inline-flex items-center rounded-xl border border-[#d8d1cb] bg-white px-4 py-2 text-sm font-semibold text-[#111111] transition hover:bg-[#f4efeb] disabled:opacity-60"
                >
                  {exportingData ? 'Выгрузка...' : 'Выгрузить данные'}
                </button>
                )}
              </div>
            )}
          </div>
        </div>

        {canManageStore && (
          <div className="rounded-2xl border border-[#d8d1cb] bg-white p-6 shadow-[0_12px_36px_-20px_rgba(17,17,17,0.2)] md:p-8">
            <h2 className="mb-4 text-xl font-semibold md:text-2xl">Основные настройки</h2>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <div className="rounded-xl border border-[#d8d1cb] bg-[#f8f4ef] p-4">
                <h3 className="mb-2 font-medium">Название объекта</h3>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={nameDraft}
                    onChange={(e) => setNameDraft(e.target.value)}
                    className="w-full rounded-xl border border-[#d8d1cb] bg-white px-3 py-2 text-[#111111] outline-none transition focus:border-[#ff6a13] focus:ring-2 focus:ring-[#ff6a13]/20"
                  />
                  <button
                    onClick={handleUpdateStoreName}
                    disabled={nameSaving || nameDraft.trim() === String(store.name ?? '').trim()}
                    className="rounded-xl bg-[#ff6a13] px-4 py-2 font-semibold text-white transition hover:bg-[#e85a0c] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {nameSaving ? '...' : 'Сохранить'}
                  </button>
                </div>
              </div>

              <div className="rounded-xl border border-[#d8d1cb] bg-[#f8f4ef] p-4">
                <h3 className="mb-2 font-medium">Валюта</h3>
                <p className="mb-2 text-sm text-[#6b6b6b]">
                  Текущая валюта: {store.currency} ({getCurrencySymbol(store.currency)})
                </p>
                <select
                  value={store.currency ?? 'RUB'}
                  onChange={(e) => handleCurrencyChange(e.target.value as 'RUB' | 'KZT')}
                  disabled={currencySaving}
                  className="w-full rounded-xl border border-[#d8d1cb] bg-white px-3 py-2 text-[#111111] outline-none transition focus:border-[#ff6a13] focus:ring-2 focus:ring-[#ff6a13]/20"
                >
                  <option value="RUB">Российский рубль (₽)</option>
                  <option value="KZT">Казахстанский тенге (₸)</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {canEditPavilions && (
          <div className="rounded-2xl border border-[#d8d1cb] bg-white p-6 shadow-[0_12px_36px_-20px_rgba(17,17,17,0.2)] md:p-8">
            <h2 className="mb-4 text-xl font-semibold md:text-2xl">Категории павильонов</h2>
            <div className="mb-4 flex gap-2">
              <input
                type="text"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                className="w-full rounded-xl border border-[#d8d1cb] bg-[#f8f4ef] px-3 py-2 text-[#111111] outline-none transition focus:border-[#ff6a13] focus:bg-white focus:ring-2 focus:ring-[#ff6a13]/20"
                placeholder="Новая категория"
              />
              <button
                onClick={handleCreateCategory}
                disabled={categorySaving}
                className="rounded-xl bg-[#ff6a13] px-4 py-2 font-semibold text-white transition hover:bg-[#e85a0c] disabled:opacity-60"
              >
                {categorySaving ? 'Добавление...' : 'Добавить'}
              </button>
            </div>

            {categoryList.length === 0 ? (
              <p className="text-sm text-[#6b6b6b]">Категорий пока нет</p>
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
                        className="w-full rounded-xl border border-[#d8d1cb] bg-[#f8f4ef] px-3 py-2 text-[#111111] outline-none transition focus:border-[#ff6a13] focus:bg-white focus:ring-2 focus:ring-[#ff6a13]/20"
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleRenameCategory(category)}
                          disabled={Boolean(categoryRenameLoadingByName[category]) || !changed}
                          className="rounded-xl border border-[#d8d1cb] bg-white px-3 py-2 text-xs font-semibold text-[#111111] transition hover:bg-[#f4efeb] disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {categoryRenameLoadingByName[category]
                            ? 'Сохранение...'
                            : 'Переименовать'}
                        </button>
                        <button
                          onClick={() => handleDeleteCategory(category)}
                          disabled={categoryDeletingName === category}
                          className="rounded-xl bg-[#ef4444] px-3 py-2 text-xs font-semibold text-white transition hover:bg-[#dc2626] disabled:cursor-not-allowed disabled:opacity-60"
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
          <div className="rounded-2xl border border-[#d8d1cb] bg-white p-6 shadow-[0_12px_36px_-20px_rgba(17,17,17,0.2)] md:p-8">
            <h2 className="mb-4 text-xl font-semibold md:text-2xl">Группы павильонов</h2>
            <div className="mb-4 flex gap-2">
              <input
                type="text"
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                className="w-full rounded-xl border border-[#d8d1cb] bg-[#f8f4ef] px-3 py-2 text-[#111111] outline-none transition focus:border-[#ff6a13] focus:bg-white focus:ring-2 focus:ring-[#ff6a13]/20"
                placeholder="Название новой группы"
              />
              <button
                onClick={handleCreatePavilionGroup}
                disabled={groupSaving}
                className="rounded-xl bg-[#ff6a13] px-4 py-2 font-semibold text-white transition hover:bg-[#e85a0c] disabled:opacity-60"
              >
                {groupSaving ? 'Создание...' : 'Создать'}
              </button>
            </div>

            {(store.pavilionGroups || []).length === 0 ? (
              <p className="text-sm text-[#6b6b6b]">Групп пока нет</p>
            ) : (
              <div className="space-y-2">
                {(store.pavilionGroups || []).map((group: any) => {
                  const rawDraft = groupRenameById[group.id] ?? '';
                  const draftName = rawDraft.trim();
                  const currentName = String(group.name ?? '').trim();
                  const changed = draftName.length > 0 && draftName !== currentName;
                  const allPavilions: any[] = store.pavilions || [];
                  const search = (groupPavilionSearchById[group.id] || '').trim().toLowerCase();
                  const filteredPavilions = allPavilions.filter((p) =>
                    String(p.number || '').toLowerCase().includes(search),
                  );
                  const selectedIds = new Set<number>(groupPavilionSelectionById[group.id] || []);

                  return (
                    <div key={group.id} className="rounded-xl border border-[#d8d1cb] bg-[#f8f4ef] p-3">
                      <div className="flex flex-col gap-2 md:flex-row">
                        <input
                          type="text"
                          value={rawDraft}
                          onChange={(e) =>
                            setGroupRenameById((prev) => ({
                              ...prev,
                              [group.id]: e.target.value,
                            }))
                          }
                          className="w-full rounded-xl border border-[#d8d1cb] bg-white px-3 py-2 text-[#111111] outline-none transition focus:border-[#ff6a13] focus:ring-2 focus:ring-[#ff6a13]/20"
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleOpenGroupPavilionEditor(group)}
                            className="rounded-xl border border-[#d8d1cb] bg-white px-3 py-2 text-xs font-semibold text-[#111111] transition hover:bg-[#f4efeb]"
                          >
                            {groupPavilionEditorGroupId === group.id
                              ? 'Скрыть список'
                              : 'Добавить павильоны'}
                          </button>
                          <button
                            onClick={() => handleRenamePavilionGroup(group.id)}
                            disabled={Boolean(groupRenameLoadingById[group.id]) || !changed}
                            className="rounded-xl border border-[#d8d1cb] bg-white px-3 py-2 text-xs font-semibold text-[#111111] transition hover:bg-[#f4efeb] disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {groupRenameLoadingById[group.id]
                              ? 'Сохранение...'
                              : 'Переименовать'}
                          </button>
                          <button
                            onClick={() => handleDeletePavilionGroup(group.id)}
                            disabled={groupDeletingId === group.id}
                            className="rounded-xl bg-[#ef4444] px-3 py-2 text-xs font-semibold text-white transition hover:bg-[#dc2626] disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {groupDeletingId === group.id ? 'Удаление...' : 'Удалить'}
                          </button>
                        </div>
                      </div>

                      <div className="mt-2 text-xs text-[#6b6b6b]">
                        Текущий состав: {(group.pavilions || []).length} павильонов
                      </div>

                      {groupPavilionEditorGroupId === group.id && (
                        <div className="mt-3 rounded-xl border border-[#d8d1cb] bg-white p-3">
                          <input
                            type="text"
                            value={groupPavilionSearchById[group.id] || ''}
                            onChange={(e) =>
                              setGroupPavilionSearchById((prev) => ({
                                ...prev,
                                [group.id]: e.target.value,
                              }))
                            }
                            className="mb-3 w-full rounded-xl border border-[#d8d1cb] bg-[#f8f4ef] px-3 py-2 text-sm text-[#111111] outline-none transition focus:border-[#ff6a13] focus:bg-white focus:ring-2 focus:ring-[#ff6a13]/20"
                            placeholder="Поиск павильона по номеру"
                          />
                          <div className="max-h-56 space-y-2 overflow-y-auto rounded-xl border border-[#d8d1cb] bg-[#f8f4ef] p-2">
                            {filteredPavilions.length === 0 ? (
                              <p className="text-xs text-[#6b6b6b]">Павильоны не найдены</p>
                            ) : (
                              filteredPavilions.map((p: any) => (
                                <label
                                  key={`${group.id}-${p.id}`}
                                  className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1 transition hover:bg-white"
                                >
                                  <input
                                    type="checkbox"
                                    checked={selectedIds.has(Number(p.id))}
                                    onChange={() =>
                                      handleToggleGroupPavilionSelection(group.id, Number(p.id))
                                    }
                                  />
                                  <span className="text-sm">
                                    {p.number} {p.category ? `(${p.category})` : ''}
                                  </span>
                                </label>
                              ))
                            )}
                          </div>

                          <div className="mt-3 flex items-center justify-between">
                            <span className="text-xs text-[#6b6b6b]">
                              Выбрано: {selectedIds.size}
                            </span>
                            <button
                              onClick={() => handleSaveGroupPavilions(group)}
                              disabled={Boolean(groupPavilionSavingById[group.id])}
                              className="rounded-xl bg-[#22c55e] px-3 py-2 text-xs font-semibold text-white transition hover:bg-[#16a34a] disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {groupPavilionSavingById[group.id]
                                ? 'Сохранение...'
                                : 'Сохранить выбор'}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {canManageUsers && (
          <div className="rounded-2xl border border-[#d8d1cb] bg-white p-6 shadow-[0_12px_36px_-20px_rgba(17,17,17,0.2)] md:p-8">
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
          <div className="rounded-2xl border border-[#ef4444]/30 bg-white p-6 shadow-[0_12px_36px_-20px_rgba(17,17,17,0.2)] md:p-8">
            <h2 className="mb-4 text-xl font-semibold text-red-700 md:text-2xl">
              Опасная зона
            </h2>
            <button
              onClick={() => setShowDeleteStoreModal(true)}
              disabled={deletingStore}
              className="rounded-xl bg-[#ef4444] px-5 py-2.5 font-semibold text-white shadow-sm transition hover:bg-[#dc2626] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {deletingStore ? 'Удаление...' : 'Удалить объект'}
            </button>
          </div>
        )}
      </div>

      {showImportModal && (
        <ImportStoreDataModal
          storeId={storeId}
          onClose={() => setShowImportModal(false)}
          onImported={() => {
            setShowImportModal(false);
            void fetchStore(false);
          }}
        />
      )}

      {showDeleteStoreModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-[#ef4444]/30 bg-white p-6 shadow-[0_20px_60px_-30px_rgba(17,17,17,0.45)]">
            <h3 className="text-lg font-semibold text-[#111111]">Удаление объекта</h3>
            <p className="mt-3 text-sm text-[#6b6b6b]">
              Чтобы удалить, напишите слово <span className="font-semibold">УДАЛИТЬ</span>.
            </p>
            <input
              type="text"
              value={deleteStoreInput}
              onChange={(e) => setDeleteStoreInput(e.target.value)}
              className="mt-4 w-full rounded-xl border border-[#d8d1cb] bg-[#f8f4ef] px-3 py-2 text-[#111111] outline-none transition focus:border-[#ef4444] focus:bg-white focus:ring-2 focus:ring-[#ef4444]/20"
              placeholder="УДАЛИТЬ"
            />
            <div className="mt-5 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowDeleteStoreModal(false);
                  setDeleteStoreInput('');
                }}
                className="rounded-xl border border-[#d8d1cb] px-4 py-2 font-semibold text-[#111111] transition hover:bg-[#f4efeb]"
              >
                Отмена
              </button>
              <button
                onClick={handleDeleteStore}
                disabled={deletingStore || deleteStoreInput.trim().toUpperCase() !== 'УДАЛИТЬ'}
                className="rounded-xl bg-[#ef4444] px-4 py-2 font-semibold text-white transition hover:bg-[#dc2626] disabled:cursor-not-allowed disabled:opacity-60"
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



