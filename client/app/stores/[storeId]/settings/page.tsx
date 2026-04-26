'use client';

import { useEffect, useMemo, useState, type ChangeEvent } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { getCurrencySymbol } from '@/lib/currency';
import { resolveApiMediaUrl } from '@/lib/media';
import { hasPermission } from '@/lib/permissions';
import { openStoreInvoiceView, startStoreSubscriptionCheckout } from '@/lib/invoices';
import { TimeZoneAutocomplete } from '@/components/TimeZoneAutocomplete';
import { useDialog } from '@/components/dialog/DialogProvider';
import { useToast } from '@/components/toast/ToastProvider';
import { StoreUsersSection } from '@/app/dashboard/components/StoreUsersSection';
import { ImportStoreDataModal } from '@/app/dashboard/components/ImportStoreDataModal';
import { StoreSidebar } from '../components/StoreSidebar';
import { FullScreenLoader } from '@/components/AppLoader';

export default function StoreSettingsPage() {
  const params = useParams();
  const router = useRouter();
  const storeId = Number(params.storeId);
  const dialog = useDialog();
  const toast = useToast();

  const [store, setStore] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [nameDraft, setNameDraft] = useState('');
  const [nameSaving, setNameSaving] = useState(false);
  const [addressDraft, setAddressDraft] = useState('');
  const [addressSaving, setAddressSaving] = useState(false);
  const [billingCompanyNameDraft, setBillingCompanyNameDraft] = useState('');
  const [billingLegalAddressDraft, setBillingLegalAddressDraft] = useState('');
  const [billingInnDraft, setBillingInnDraft] = useState('');
  const [billingSaving, setBillingSaving] = useState(false);
  const [subscriptionActionLoading, setSubscriptionActionLoading] = useState<
    'view' | 'pay' | null
  >(null);
  const [contactPhoneDraft, setContactPhoneDraft] = useState('');
  const [contactEmailDraft, setContactEmailDraft] = useState('');
  const [contactSaving, setContactSaving] = useState(false);
  const [descriptionDraft, setDescriptionDraft] = useState('');
  const [descriptionSaving, setDescriptionSaving] = useState(false);
  const [imageUploading, setImageUploading] = useState(false);
  const [currencyDraft, setCurrencyDraft] = useState<'RUB' | 'KZT'>('RUB');
  const [currencySaving, setCurrencySaving] = useState(false);
  const [timeZoneSaving, setTimeZoneSaving] = useState(false);
  const [timeZoneQuery, setTimeZoneQuery] = useState('');
  const [settingsError, setSettingsError] = useState('');
  const [settingsSuccess, setSettingsSuccess] = useState('');

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
      setAddressDraft(data.address ?? '');
      setBillingCompanyNameDraft(data.billingCompanyName ?? '');
      setBillingLegalAddressDraft(data.billingLegalAddress ?? '');
      setBillingInnDraft(data.billingInn ?? '');
      setDescriptionDraft(data.description ?? '');
      setContactPhoneDraft(data.contactPhone ?? '');
      setContactEmailDraft(data.contactEmail ?? '');
      setCurrencyDraft(data.currency ?? 'RUB');
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

  useEffect(() => {
    setTimeZoneQuery(store?.timeZone || 'UTC');
  }, [store?.timeZone]);

  useEffect(() => {
    if (!settingsError) return;
    toast.error(settingsError);
    setSettingsError('');
  }, [settingsError, toast]);

  useEffect(() => {
    if (!settingsSuccess) return;
    toast.success(settingsSuccess);
    setSettingsSuccess('');
  }, [settingsSuccess, toast]);

  if (loading) return <FullScreenLoader label="Открываем настройки объекта..." />;
  if (error) return <div className="p-6 text-center text-red-600">{error}</div>;
  if (!store) return <div className="p-6 text-center text-red-600">Объект не найден</div>;

  const permissions = store.permissions || [];
  const canManageStore = hasPermission(permissions, 'ASSIGN_PERMISSIONS');
  const canEditPavilions = hasPermission(permissions, 'EDIT_PAVILIONS');
  const canManageMedia = hasPermission(permissions, 'MANAGE_MEDIA');
  const createPavilions = hasPermission(permissions, 'CREATE_PAVILIONS');
  const canExportData = hasPermission(permissions, 'EXPORT_STORE_DATA');
  const canManageUsers =
    hasPermission(permissions, 'INVITE_USERS') ||
    hasPermission(permissions, 'ASSIGN_PERMISSIONS') ||
    hasPermission(permissions, 'REMOVE_USERS');
  const canViewActivity = hasPermission(permissions, 'VIEW_ACTIVITY');
  const storeImages: Array<{ id: number; filePath: string; createdAt: string }> =
    store.images && store.images.length > 0
      ? store.images
      : store.imagePath
        ? [{ id: -1, filePath: store.imagePath, createdAt: new Date(0).toISOString() }]
        : [];
  const subscriptionBilling = store.subscriptionBilling ?? null;
  const subscriptionPeriodLabel = subscriptionBilling?.currentPeriod
    ? new Date(subscriptionBilling.currentPeriod).toLocaleDateString('ru-RU', {
        month: 'long',
        year: 'numeric',
      })
    : null;
  const subscriptionStatusLabel =
    subscriptionBilling?.status === 'PAID' ? 'Оплачено' : 'Не оплачено';
  const subscriptionStatusClasses =
    subscriptionBilling?.status === 'PAID'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
      : 'border-[#f3c6a8] bg-[#fff1e8] text-[#c2410c]';
  const subscriptionAmountLabel = `${Number(
    subscriptionBilling?.amountRub ?? 0,
  ).toLocaleString('ru-RU')} ${getCurrencySymbol(store.currency ?? 'RUB')}`;
  const canViewSubscriptionInvoice =
    canManageStore &&
    Boolean(subscriptionBilling?.hasChargeForCurrentMonth) &&
    !Boolean(subscriptionBilling?.isFirstMonthFree) &&
    Boolean(subscriptionBilling?.hasBillingDetails);
  const canStartSubscriptionPayment =
    canManageStore &&
    Boolean(subscriptionBilling?.hasChargeForCurrentMonth) &&
    !Boolean(subscriptionBilling?.isFirstMonthFree) &&
    Boolean(subscriptionBilling?.hasBillingDetails) &&
    subscriptionBilling?.status !== 'PAID';

  const handleOpenSubscriptionInvoice = async () => {
    try {
      setSubscriptionActionLoading('view');
      await openStoreInvoiceView(storeId);
      await fetchStore(false);
      toast.success('Счет открыт в новой вкладке');
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || 'Не удалось открыть счет');
    } finally {
      setSubscriptionActionLoading(null);
    }
  };

  const handleStartSubscriptionPayment = async () => {
    const paymentWindow = window.open('about:blank', '_blank');
    if (!paymentWindow) {
      toast.error('Браузер заблокировал новую вкладку для оплаты');
      return;
    }

    try {
      paymentWindow.opener = null;
    } catch {
      
    }

    try {
      setSubscriptionActionLoading('pay');
      const result = await startStoreSubscriptionCheckout(storeId);
      if (result.mode === 'REDIRECT' && result.paymentUrl) {
        paymentWindow.location.href = result.paymentUrl;
        return;
      }

      paymentWindow.close();
      await fetchStore(false);
      toast.success(result.message);
    } catch (err: any) {
      paymentWindow.close();
      console.error(err);
      toast.error(err?.message || 'Не удалось подготовить оплату');
    } finally {
      setSubscriptionActionLoading(null);
    }
  };

  const handleUpdateStoreName = async () => {
    const name = nameDraft.trim();
    if (!name) {
      setSettingsError('Введите название объекта');
      setSettingsSuccess('');
      return;
    }
    try {
      setSettingsError('');
      setSettingsSuccess('');
      setNameSaving(true);
      await apiFetch(`/stores/${storeId}/name`, {
        method: 'PATCH',
        body: JSON.stringify({ name }),
      });
      await fetchStore(false);
      setSettingsSuccess('Название объекта обновлено');
    } catch (err: any) {
      console.error(err);
      setSettingsError(err?.message || 'Не удалось изменить название');
    } finally {
      setNameSaving(false);
    }
  };

  const handleCurrencyChange = async () => {
    try {
      setSettingsError('');
      setSettingsSuccess('');
      setCurrencySaving(true);
      await apiFetch(`/stores/${storeId}/currency`, {
        method: 'PATCH',
        body: JSON.stringify({ currency: currencyDraft }),
      });
      await fetchStore(false);
      setSettingsSuccess('Валюта объекта обновлена');
    } catch (err: any) {
      console.error(err);
      setSettingsError(err?.message || 'Не удалось изменить валюту');
    } finally {
      setCurrencySaving(false);
    }
  };

  const handleUpdateStoreAddress = async () => {
    try {
      setSettingsError('');
      setSettingsSuccess('');
      setAddressSaving(true);
      await apiFetch(`/stores/${storeId}/address`, {
        method: 'PATCH',
        body: JSON.stringify({ address: addressDraft.trim() || null }),
      });
      await fetchStore(false);
      setSettingsSuccess(
        addressDraft.trim() ? 'Адрес объекта обновлен' : 'Адрес объекта удален',
      );
    } catch (err: any) {
      console.error(err);
      setSettingsError(err?.message || 'Не удалось изменить адрес');
    } finally {
      setAddressSaving(false);
    }
  };

  const handleUpdateBillingDetails = async () => {
    try {
      setSettingsError('');
      setSettingsSuccess('');
      setBillingSaving(true);
      await apiFetch(`/stores/${storeId}/billing`, {
        method: 'PATCH',
        body: JSON.stringify({
          billingCompanyName: billingCompanyNameDraft.trim() || null,
          billingLegalAddress: billingLegalAddressDraft.trim() || null,
          billingInn: billingInnDraft.trim() || null,
        }),
      });
      await fetchStore(false);
      setSettingsSuccess(
        billingCompanyNameDraft.trim() ||
          billingLegalAddressDraft.trim() ||
          billingInnDraft.trim()
          ? 'Реквизиты организации обновлены'
          : 'Реквизиты организации удалены',
      );
    } catch (err: any) {
      console.error(err);
      setSettingsError(err?.message || 'Не удалось обновить реквизиты');
    } finally {
      setBillingSaving(false);
    }
  };

  const handleUpdateStoreContact = async () => {
    try {
      setSettingsError('');
      setSettingsSuccess('');
      setContactSaving(true);
      await apiFetch(`/stores/${storeId}/contact`, {
        method: 'PATCH',
        body: JSON.stringify({
          contactPhone: contactPhoneDraft.trim() || null,
          contactEmail: contactEmailDraft.trim() || null,
        }),
      });
      await fetchStore(false);
      setSettingsSuccess('Контактные данные объекта обновлены');
    } catch (err: any) {
      console.error(err);
      setSettingsError(err?.message || 'Не удалось изменить контактные данные');
    } finally {
      setContactSaving(false);
    }
  };

  const handleTimeZoneChange = async (timeZone: string) => {
    try {
      setSettingsError('');
      setSettingsSuccess('');
      setTimeZoneSaving(true);
      await apiFetch(`/stores/${storeId}/timezone`, {
        method: 'PATCH',
        body: JSON.stringify({ timeZone }),
      });
      setTimeZoneQuery(timeZone);
      await fetchStore(false);
      setSettingsSuccess('Часовой пояс объекта обновлен');
    } catch (err: any) {
      console.error(err);
      setSettingsError(err?.message || 'Не удалось изменить часовой пояс');
    } finally {
      setTimeZoneSaving(false);
    }
  };

  const handleUpdateStoreDescription = async () => {
    try {
      setSettingsError('');
      setSettingsSuccess('');
      setDescriptionSaving(true);
      await apiFetch(`/stores/${storeId}/description`, {
        method: 'PATCH',
        body: JSON.stringify({ description: descriptionDraft.trim() || null }),
      });
      await fetchStore(false);
      setSettingsSuccess(
        descriptionDraft.trim()
          ? 'Описание объекта обновлено'
          : 'Описание объекта удалено',
      );
    } catch (err: any) {
      console.error(err);
      setSettingsError(err?.message || 'Не удалось сохранить описание объекта');
    } finally {
      setDescriptionSaving(false);
    }
  };

  const handleStoreImageUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(event.target.files || []);
    if (selectedFiles.length === 0) return;

    const formData = new FormData();
    selectedFiles.forEach((file) => formData.append('files', file));

    try {
      setSettingsError('');
      setSettingsSuccess('');
      setImageUploading(true);
      await apiFetch(`/stores/${storeId}/media`, {
        method: 'POST',
        body: formData,
      });
      await fetchStore(false);
      setSettingsSuccess(
        selectedFiles.length === 1
          ? 'Фото объекта добавлено'
          : `Добавлено фотографий: ${selectedFiles.length}`,
      );
    } catch (err: any) {
      console.error(err);
      setSettingsError(err?.message || 'Не удалось загрузить фото объекта');
    } finally {
      setImageUploading(false);
      event.target.value = '';
    }
  };

  const handleDeleteStore = async () => {
    if (deleteStoreInput.trim().toUpperCase() !== 'УДАЛИТЬ') {
      setSettingsError('Введите слово "УДАЛИТЬ" для подтверждения');
      setSettingsSuccess('');
      return;
    }

    try {
      setSettingsError('');
      setSettingsSuccess('');
      setDeletingStore(true);
      await apiFetch(`/stores/${storeId}`, { method: 'DELETE' });
      setShowDeleteStoreModal(false);
      setDeleteStoreInput('');
      router.push('/dashboard');
    } catch (err: any) {
      console.error(err);
      setSettingsError(err?.message || 'Не удалось удалить объект');
    } finally {
      setDeletingStore(false);
    }
  };

  const handleCreateCategory = async () => {
    const name = newCategoryName.trim();
    if (!name) {
      setSettingsError('Введите название категории');
      setSettingsSuccess('');
      return;
    }

    try {
      setSettingsError('');
      setSettingsSuccess('');
      setCategorySaving(true);
      await apiFetch(`/stores/${storeId}/pavilion-categories`, {
        method: 'POST',
        body: JSON.stringify({ name }),
      });
      setNewCategoryName('');
      await fetchStore(false);
      setSettingsSuccess('Категория добавлена');
    } catch (err: any) {
      console.error(err);
      setSettingsError(err?.message || 'Не удалось добавить категорию');
    } finally {
      setCategorySaving(false);
    }
  };

  const handleRenameCategory = async (oldName: string) => {
    const newName = (categoryRenameByName[oldName] ?? '').trim();
    if (!newName) {
      setSettingsError('Введите новое название категории');
      setSettingsSuccess('');
      return;
    }

    try {
      setSettingsError('');
      setSettingsSuccess('');
      setCategoryRenameLoadingByName((prev) => ({ ...prev, [oldName]: true }));
      await apiFetch(
        `/stores/${storeId}/pavilion-categories/${encodeURIComponent(oldName)}`,
        {
          method: 'PATCH',
          body: JSON.stringify({ newName }),
        },
      );
      await fetchStore(false);
      setSettingsSuccess('Категория переименована');
    } catch (err: any) {
      console.error(err);
      setSettingsError(err?.message || 'Не удалось переименовать категорию');
    } finally {
      setCategoryRenameLoadingByName((prev) => ({ ...prev, [oldName]: false }));
    }
  };

  const handleDeleteCategory = async (name: string) => {
    const confirmed = await dialog.confirm({
      title: 'Удаление категории',
      message: `Удалить категорию "${name}"?`,
      tone: 'danger',
      confirmText: 'Удалить',
    });
    if (!confirmed) return;

    try {
      setSettingsError('');
      setSettingsSuccess('');
      setCategoryDeletingName(name);
      await apiFetch(
        `/stores/${storeId}/pavilion-categories/${encodeURIComponent(name)}`,
        {
          method: 'DELETE',
        },
      );
      await fetchStore(false);
      setSettingsSuccess('Категория удалена');
    } catch (err: any) {
      console.error(err);
      setSettingsError(err?.message || 'Не удалось удалить категорию');
    } finally {
      setCategoryDeletingName(null);
    }
  };

  const handleCreatePavilionGroup = async () => {
    const name = newGroupName.trim();
    if (!name) {
      setSettingsError('Введите название группы');
      setSettingsSuccess('');
      return;
    }

    try {
      setSettingsError('');
      setSettingsSuccess('');
      setGroupSaving(true);
      await apiFetch(`/stores/${storeId}/pavilion-groups`, {
        method: 'POST',
        body: JSON.stringify({ name }),
      });
      setNewGroupName('');
      await fetchStore(false);
      setSettingsSuccess('Группа создана');
    } catch (err: any) {
      console.error(err);
      setSettingsError(err?.message || 'Не удалось создать группу');
    } finally {
      setGroupSaving(false);
    }
  };

  const handleRenamePavilionGroup = async (groupId: number) => {
    const name = (groupRenameById[groupId] ?? '').trim();
    if (!name) {
      setSettingsError('Введите название группы');
      setSettingsSuccess('');
      return;
    }

    try {
      setSettingsError('');
      setSettingsSuccess('');
      setGroupRenameLoadingById((prev) => ({ ...prev, [groupId]: true }));
      await apiFetch(`/stores/${storeId}/pavilion-groups/${groupId}`, {
        method: 'PATCH',
        body: JSON.stringify({ name }),
      });
      await fetchStore(false);
      setSettingsSuccess('Группа переименована');
    } catch (err: any) {
      console.error(err);
      setSettingsError(err?.message || 'Не удалось переименовать группу');
    } finally {
      setGroupRenameLoadingById((prev) => ({ ...prev, [groupId]: false }));
    }
  };

  const handleDeletePavilionGroup = async (groupId: number) => {
    const confirmed = await dialog.confirm({
      title: 'Удаление группы',
      message: 'Удалить эту группу?',
      tone: 'danger',
      confirmText: 'Удалить',
    });
    if (!confirmed) return;

    try {
      setSettingsError('');
      setSettingsSuccess('');
      setGroupDeletingId(groupId);
      await apiFetch(`/stores/${storeId}/pavilion-groups/${groupId}`, {
        method: 'DELETE',
      });
      await fetchStore(false);
      setSettingsSuccess('Группа удалена');
    } catch (err: any) {
      console.error(err);
      setSettingsError(err?.message || 'Не удалось удалить группу');
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
      setSettingsError('');
      setSettingsSuccess('');
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
      setSettingsSuccess('Состав группы сохранен');
    } catch (err: any) {
      console.error(err);
      setSettingsError(err?.message || 'Не удалось сохранить состав группы');
    } finally {
      setGroupPavilionSavingById((prev) => ({ ...prev, [groupId]: false }));
    }
  };

  const handleExportData = async () => {
    try {
      setSettingsError('');
      setSettingsSuccess('');
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
        accounting: 'Закрытие дня',
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
        Дата: item.recordDate,
        Безналичные: Number(item.bankTransferPaid ?? 0),
        'Наличные касса 1': Number(item.cashbox1Paid ?? 0),
        'Наличные касса 2': Number(item.cashbox2Paid ?? 0),
      }));
      const staffRows = (payload.staff || []).map((item) => ({
        Должность: item.position ?? '',
        'Имя Фамилия': item.fullName ?? '',
        Зарплата: Number(item.salary ?? 0),
        'Статус оплаты':
          item.salaryStatus === 'PAID' ? 'Оплачено' : 'Не оплачено',
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
              ['Дата', 'Безналичные', 'Наличные касса 1', 'Наличные касса 2'],
            ]);
      const staffSheet =
        staffRows.length > 0
          ? XLSX.utils.json_to_sheet(staffRows)
          : XLSX.utils.aoa_to_sheet([
              ['Должность', 'Имя Фамилия', 'Зарплата', 'Статус оплаты'],
            ]);

      XLSX.utils.book_append_sheet(wb, pavilionsSheet, SHEETS.pavilions);
      XLSX.utils.book_append_sheet(wb, householdSheet, SHEETS.householdExpenses);
      XLSX.utils.book_append_sheet(wb, otherSheet, SHEETS.otherExpenses);
      XLSX.utils.book_append_sheet(wb, adminSheet, SHEETS.adminExpenses);
      XLSX.utils.book_append_sheet(wb, accountingSheet, SHEETS.accounting);
      XLSX.utils.book_append_sheet(wb, staffSheet, SHEETS.staff);

      XLSX.writeFile(wb, `store-export-${storeId}.xlsx`);
      setSettingsSuccess('Данные объекта выгружены');
    } catch (err: any) {
      console.error(err);
      setSettingsError(err?.message || 'Не удалось выгрузить данные');
    } finally {
      setExportingData(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f6f1eb]">
      <div className="mx-auto flex max-w-[1600px] gap-6 px-3 py-1 md:px-6 md:py-6">
        <StoreSidebar storeId={storeId} store={store} />
        <main className="min-w-0 flex-1">
      <div className="mx-auto max-w-6xl space-y-6 p-4 md:space-y-8 md:p-2">
        <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
          <div>
            <h1 className="mt-2 text-2xl font-bold text-[#111111] md:text-3xl">
              Управление объектом: {store.name}
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {canViewActivity && (
              <Link
                href={`/stores/${storeId}/activity`}
                className="inline-flex items-center rounded-xl bg-[#ff6a13] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#e85a0c]"

              >
                Журнал действий
              </Link>
            )}
            {(createPavilions || canExportData) && (
              <div className="inline-flex items-center gap-2">
                {createPavilions && (
                <button
                  onClick={() => setShowImportModal(true)}
                  className="inline-flex items-center rounded-xl border border-[#d8d1cb] bg-white px-4 py-2 text-sm font-semibold text-[#111111] transition hover:bg-[#f4efeb]"
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

        {canManageStore && subscriptionBilling && (
          <div className="rounded-2xl border border-[#d8d1cb] bg-white p-5 shadow-[0_12px_36px_-20px_rgba(17,17,17,0.2)] md:p-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-3">
                  <h2 className="text-lg font-semibold text-[#111111] md:text-xl">
                    Подписка на Rendlify
                  </h2>
                  <span
                    className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${subscriptionStatusClasses}`}
                  >
                    {subscriptionStatusLabel}
                  </span>
                </div>
                <p className="text-sm text-[#6b6b6b]">
                  {subscriptionPeriodLabel
                    ? `Статус за ${subscriptionPeriodLabel}`
                    : 'Статус текущего календарного месяца'}
                </p>
                <p className="text-sm text-[#111111]">
                  Стоимость за месяц: <span className="font-semibold">{subscriptionAmountLabel}</span>
                </p>
                {subscriptionBilling.isFirstMonthFree ? (
                  <p className="text-sm text-emerald-700">
                    Первый месяц бесплатный.
                  </p>
                ) : !subscriptionBilling.hasChargeForCurrentMonth ? (
                  <p className="text-sm text-[#6b6b6b]">
                    В этом месяце нет занятых павильонов, поэтому счет не требуется.
                  </p>
                ) : !subscriptionBilling.hasBillingDetails ? (
                  <p className="text-sm text-[#c2410c]">
                    Чтобы открыть счет и перейти к оплате, заполните реквизиты организации ниже.
                  </p>
                ) : subscriptionBilling.status === 'PAID' ? (
                  <p className="text-sm text-emerald-700">
                    Оплата за текущий календарный месяц подтверждена.
                  </p>
                ) : (
                  <p className="text-sm text-[#c2410c]">
                    Оплата отправлена, ожидается подтверждение.
                  </p>
                )}
              </div>
              <div className="grid gap-2 sm:min-w-[250px]">
                <button
                  type="button"
                  onClick={() => void handleOpenSubscriptionInvoice()}
                  disabled={!canViewSubscriptionInvoice || subscriptionActionLoading !== null}
                  className="inline-flex items-center justify-center rounded-xl border border-[#d8d1cb] bg-white px-4 py-2 text-sm font-semibold text-[#111111] transition hover:bg-[#f4efeb] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {subscriptionActionLoading === 'view' ? 'Открываем...' : 'Посмотреть счет'}
                </button>
                <button
                  type="button"
                  onClick={() => void handleStartSubscriptionPayment()}
                  disabled={!canStartSubscriptionPayment || subscriptionActionLoading !== null}
                  className="inline-flex items-center justify-center rounded-xl bg-[#ff6a13] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#e85a0c] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {subscriptionActionLoading === 'pay' ? 'Подготавливаем...' : 'Оплатить'}
                </button>
              </div>
            </div>
          </div>
        )}

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
                <h3 className="mb-2 font-medium">Адрес объекта</h3>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={addressDraft}
                    onChange={(e) => setAddressDraft(e.target.value)}
                    className="w-full rounded-xl border border-[#d8d1cb] bg-white px-3 py-2 text-[#111111] outline-none transition focus:border-[#ff6a13] focus:ring-2 focus:ring-[#ff6a13]/20"
                    placeholder="Необязательно"
                  />
                  <button
                    onClick={handleUpdateStoreAddress}
                    disabled={addressSaving || addressDraft.trim() === String(store.address ?? '').trim()}
                    className="rounded-xl bg-[#ff6a13] px-4 py-2 font-semibold text-white transition hover:bg-[#e85a0c] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {addressSaving ? '...' : 'Сохранить'}
                  </button>
                </div>
                <p className="mt-2 text-sm text-[#6b6b6b]">
                  Оставьте поле пустым, чтобы удалить адрес.
                </p>
              </div>

              <div className="rounded-xl border border-[#d8d1cb] bg-[#f8f4ef] p-4">
                <h3 className="mb-2 font-medium">Реквизиты организации</h3>
                <div className="space-y-3">
                  <input
                    type="text"
                    value={billingCompanyNameDraft}
                    onChange={(e) => setBillingCompanyNameDraft(e.target.value)}
                    className="w-full rounded-xl border border-[#d8d1cb] bg-white px-3 py-2 text-[#111111] outline-none transition focus:border-[#ff6a13] focus:ring-2 focus:ring-[#ff6a13]/20"
                    placeholder="Название организации"
                  />
                  <textarea
                    value={billingLegalAddressDraft}
                    onChange={(e) => setBillingLegalAddressDraft(e.target.value)}
                    rows={3}
                    className="w-full rounded-xl border border-[#d8d1cb] bg-white px-3 py-2 text-[#111111] outline-none transition focus:border-[#ff6a13] focus:ring-2 focus:ring-[#ff6a13]/20"
                    placeholder="Юридический адрес организации"
                  />
                  <input
                    type="text"
                    value={billingInnDraft}
                    onChange={(e) => setBillingInnDraft(e.target.value)}
                    className="w-full rounded-xl border border-[#d8d1cb] bg-white px-3 py-2 text-[#111111] outline-none transition focus:border-[#ff6a13] focus:ring-2 focus:ring-[#ff6a13]/20"
                    placeholder="ИНН организации"
                  />
                  <div className="flex justify-end">
                    <button
                      onClick={handleUpdateBillingDetails}
                      disabled={
                        billingSaving ||
                        (billingCompanyNameDraft.trim() === String(store.billingCompanyName ?? '').trim() &&
                          billingLegalAddressDraft.trim() === String(store.billingLegalAddress ?? '').trim() &&
                          billingInnDraft.trim() === String(store.billingInn ?? '').trim())
                      }
                      className="rounded-xl bg-[#ff6a13] px-4 py-2 font-semibold text-white transition hover:bg-[#e85a0c] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {billingSaving ? '...' : 'Сохранить'}
                    </button>
                  </div>
                </div>
                <p className="mt-2 text-sm text-[#6b6b6b]">
                  Эти данные используются для автоматического выставления счета на оплату сервиса.
                </p>
              </div>

              <div className="rounded-xl border border-[#d8d1cb] bg-[#f8f4ef] p-4">
                <h3 className="mb-2 font-medium">Валюта</h3>
                <p className="mb-2 text-sm text-[#6b6b6b]">
                  Текущая валюта: {store.currency} ({getCurrencySymbol(store.currency)})
                </p>
                <select
                  value={currencyDraft}
                  onChange={(e) => setCurrencyDraft(e.target.value as 'RUB' | 'KZT')}
                  disabled={currencySaving}
                  className="w-full rounded-xl border border-[#d8d1cb] bg-white px-3 py-2 text-[#111111] outline-none transition focus:border-[#ff6a13] focus:ring-2 focus:ring-[#ff6a13]/20"
                >
                  <option value="RUB">Российский рубль (₽)</option>
                  <option value="KZT">Казахстанский тенге (₸)</option>
                </select>
                <div className="mt-3 flex justify-end">
                  <button
                    type="button"
                    onClick={() => void handleCurrencyChange()}
                    disabled={currencySaving || currencyDraft === (store.currency ?? 'RUB')}
                    className="rounded-xl bg-[#ff6a13] px-4 py-2 font-semibold text-white transition hover:bg-[#e85a0c] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {currencySaving ? '...' : 'Сохранить'}
                  </button>
                </div>
              </div>

              <div className="rounded-xl border border-[#d8d1cb] bg-[#f8f4ef] p-4">
                <h3 className="mb-2 font-medium">Часовой пояс объекта</h3>
                <p className="mb-2 text-sm text-[#6b6b6b]">
                  Текущий часовой пояс: {store.timeZone || 'UTC'}
                </p>
                <TimeZoneAutocomplete
                  value={timeZoneQuery}
                  onChange={setTimeZoneQuery}
                  disabled={timeZoneSaving}
                  inputClassName="w-full rounded-xl border border-[#d8d1cb] bg-white px-3 py-2 text-[#111111] outline-none transition focus:border-[#ff6a13] focus:ring-2 focus:ring-[#ff6a13]/20"
                  placeholder="Введите город или таймзону (например: Москва, Almaty, Europe/Moscow)"
                  dropdownClassName="mt-2 max-h-64 overflow-auto rounded-xl border border-[#d8d1cb] bg-white"
                  itemClassName="block w-full border-b border-[#f4efeb] px-3 py-2 text-left text-sm text-[#111111] transition last:border-b-0 hover:bg-[#f8f4ef] disabled:opacity-60"
                  emptyTextClassName="px-3 py-2 text-sm text-[#6b6b6b]"
                  fallbackTextClassName="border-b border-[#f4efeb] px-3 py-2 text-xs text-[#6b6b6b]"
                />
                <div className="mt-3 flex justify-end">
                  <button
                    type="button"
                    onClick={() => void handleTimeZoneChange(timeZoneQuery)}
                    disabled={timeZoneSaving || timeZoneQuery.trim() === String(store.timeZone || 'UTC').trim()}
                    className="rounded-xl bg-[#ff6a13] px-4 py-2 font-semibold text-white transition hover:bg-[#e85a0c] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {timeZoneSaving ? '...' : 'Сохранить'}
                  </button>
                </div>
              </div>

              <div className="rounded-xl border border-[#d8d1cb] bg-[#f8f4ef] p-4">
                <h3 className="mb-2 font-medium">Контактные данные объекта</h3>
                <div className="space-y-3">
                  <input
                    type="text"
                    value={contactPhoneDraft}
                    onChange={(e) => setContactPhoneDraft(e.target.value)}
                    className="w-full rounded-xl border border-[#d8d1cb] bg-white px-3 py-2 text-[#111111] outline-none transition focus:border-[#ff6a13] focus:ring-2 focus:ring-[#ff6a13]/20"
                    placeholder="Телефон объекта"
                  />
                  <input
                    type="email"
                    value={contactEmailDraft}
                    onChange={(e) => setContactEmailDraft(e.target.value)}
                    className="w-full rounded-xl border border-[#d8d1cb] bg-white px-3 py-2 text-[#111111] outline-none transition focus:border-[#ff6a13] focus:ring-2 focus:ring-[#ff6a13]/20"
                    placeholder="Почта объекта"
                  />
                  <div className="flex justify-end">
                    <button
                      onClick={handleUpdateStoreContact}
                      disabled={
                        contactSaving ||
                        (contactPhoneDraft.trim() === String(store.contactPhone ?? '').trim() &&
                          contactEmailDraft.trim() === String(store.contactEmail ?? '').trim())
                      }
                      className="rounded-xl bg-[#ff6a13] px-4 py-2 font-semibold text-white transition hover:bg-[#e85a0c] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {contactSaving ? '...' : 'Сохранить'}
                    </button>
                  </div>
                </div>
                <p className="mt-2 text-sm text-[#6b6b6b]">
                  Оставьте поля пустыми, чтобы удалить контактные данные.
                </p>
              </div>
            </div>
          </div>
        )}

        {canManageMedia && (
          <div className="rounded-2xl border border-[#d8d1cb] bg-white p-6 shadow-[0_12px_36px_-20px_rgba(17,17,17,0.2)] md:p-8">
            <h2 className="mb-4 text-xl font-semibold md:text-2xl">
              Описание и фото объекта
            </h2>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.2fr_0.8fr]">
              <div className="rounded-xl border border-[#d8d1cb] bg-[#f8f4ef] p-4">
                <h3 className="mb-2 font-medium">Описание объекта</h3>
                <textarea
                  value={descriptionDraft}
                  onChange={(e) => setDescriptionDraft(e.target.value)}
                  rows={6}
                  className="w-full rounded-xl border border-[#d8d1cb] bg-white px-3 py-2 text-[#111111] outline-none transition focus:border-[#ff6a13] focus:ring-2 focus:ring-[#ff6a13]/20"
                  placeholder="Добавьте короткое описание объекта для будущей версии арендатора"
                />
                <div className="mt-3 flex justify-end">
                  <button
                    type="button"
                    onClick={() => void handleUpdateStoreDescription()}
                    disabled={
                      descriptionSaving ||
                      descriptionDraft.trim() === String(store.description ?? '').trim()
                    }
                    className="rounded-xl bg-[#ff6a13] px-4 py-2 font-semibold text-white transition hover:bg-[#e85a0c] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {descriptionSaving ? '...' : 'Сохранить'}
                  </button>
                </div>
                <p className="mt-2 text-sm text-[#6b6b6b]">
                  Оставьте поле пустым, чтобы удалить описание.
                </p>
              </div>

              <div className="rounded-xl border border-[#d8d1cb] bg-[#f8f4ef] p-4">
                <h3 className="mb-3 font-medium">Фото объекта</h3>
                {storeImages[0] ? (
                  <img
                    src={resolveApiMediaUrl(storeImages[0].filePath) || undefined}
                    alt={`Фото объекта ${store.name}`}
                    className="mb-4 h-56 w-full rounded-2xl border border-[#d8d1cb] object-cover"
                  />
                ) : (
                  <div className="mb-4 flex h-56 items-center justify-center rounded-2xl border border-dashed border-[#d8d1cb] bg-white text-sm text-[#6b6b6b]">
                    Фото объекта пока не загружено
                  </div>
                )}
                <div className="flex flex-wrap gap-2">
                  <label className="inline-flex cursor-pointer items-center rounded-xl bg-[#ff6a13] px-4 py-2 font-semibold text-white transition hover:bg-[#e85a0c]">
                    {imageUploading ? 'Загрузка...' : 'Добавить фото'}
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      multiple
                      className="hidden"
                      onChange={(e) => void handleStoreImageUpload(e)}
                      disabled={imageUploading}
                    />
                  </label>
                  <Link
                    href={`/stores/${storeId}/media`}
                    className="rounded-xl border border-[#d8d1cb] bg-white px-4 py-2 font-semibold text-[#111111] transition hover:bg-[#f4efeb]"
                  >
                    Все фото{storeImages.length > 0 ? ` (${storeImages.length})` : ''}
                  </Link>
                </div>
                <p className="mt-2 text-sm text-[#6b6b6b]">
                  Поддерживаются JPG, PNG и WEBP до 10 МБ.
                </p>
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
        </main>
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
