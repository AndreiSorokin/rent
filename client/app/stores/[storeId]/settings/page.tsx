'use client';

import { useEffect, useMemo, useState, type ChangeEvent } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
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
  const t = useTranslations('StoreSettingsPage');
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
      setError(t('errors.loadFailed'));
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

  if (loading) return <FullScreenLoader label={t('loading')} />;
  if (error) return <div className="p-6 text-center text-red-600">{error}</div>;
  if (!store) return <div className="p-6 text-center text-red-600">{t('notFound')}</div>;

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
    subscriptionBilling?.status === 'PAID' ? t('subscription.statusPaid') : t('subscription.statusUnpaid');
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
      toast.success(t('subscription.invoiceOpened'));
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || t('subscription.invoiceOpenFailed'));
    } finally {
      setSubscriptionActionLoading(null);
    }
  };

  const handleStartSubscriptionPayment = async () => {
    const paymentWindow = window.open('about:blank', '_blank');
    if (!paymentWindow) {
      toast.error(t('subscription.popupBlocked'));
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
      toast.error(err?.message || t('subscription.paymentPrepareFailed'));
    } finally {
      setSubscriptionActionLoading(null);
    }
  };

  const handleUpdateStoreName = async () => {
    const name = nameDraft.trim();
    if (!name) {
      setSettingsError(t('errors.enterStoreName'));
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
      setSettingsSuccess(t('success.nameUpdated'));
    } catch (err: any) {
      console.error(err);
      setSettingsError(err?.message || t('errors.nameUpdateFailed'));
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
      setSettingsSuccess(t('success.currencyUpdated'));
    } catch (err: any) {
      console.error(err);
      setSettingsError(err?.message || t('errors.currencyUpdateFailed'));
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
        addressDraft.trim() ? t('success.addressUpdated') : t('success.addressRemoved'),
      );
    } catch (err: any) {
      console.error(err);
      setSettingsError(err?.message || t('errors.addressUpdateFailed'));
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
          ? t('success.billingUpdated')
          : t('success.billingRemoved'),
      );
    } catch (err: any) {
      console.error(err);
      setSettingsError(err?.message || t('errors.billingUpdateFailed'));
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
      setSettingsSuccess(t('success.contactUpdated'));
    } catch (err: any) {
      console.error(err);
      setSettingsError(err?.message || t('errors.contactUpdateFailed'));
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
      setSettingsSuccess(t('success.timeZoneUpdated'));
    } catch (err: any) {
      console.error(err);
      setSettingsError(err?.message || t('errors.timeZoneUpdateFailed'));
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
          ? t('success.descriptionUpdated')
          : t('success.descriptionRemoved'),
      );
    } catch (err: any) {
      console.error(err);
      setSettingsError(err?.message || t('errors.descriptionUpdateFailed'));
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
          ? t('success.photoAdded')
          : t('success.photosAdded', { count: selectedFiles.length }),
      );
    } catch (err: any) {
      console.error(err);
      setSettingsError(err?.message || t('errors.photoUploadFailed'));
    } finally {
      setImageUploading(false);
      event.target.value = '';
    }
  };

  const handleDeleteStore = async () => {
    if (deleteStoreInput.trim().toUpperCase() !== t('deleteStore.confirmWord')) {
      setSettingsError(t('errors.enterConfirmWord'));
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
      setSettingsError(err?.message || t('errors.storeDeleteFailed'));
    } finally {
      setDeletingStore(false);
    }
  };

  const handleCreateCategory = async () => {
    const name = newCategoryName.trim();
    if (!name) {
      setSettingsError(t('errors.enterCategoryName'));
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
      setSettingsSuccess(t('success.categoryAdded'));
    } catch (err: any) {
      console.error(err);
      setSettingsError(err?.message || t('errors.categoryAddFailed'));
    } finally {
      setCategorySaving(false);
    }
  };

  const handleRenameCategory = async (oldName: string) => {
    const newName = (categoryRenameByName[oldName] ?? '').trim();
    if (!newName) {
      setSettingsError(t('errors.enterNewCategoryName'));
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
      setSettingsSuccess(t('success.categoryRenamed'));
    } catch (err: any) {
      console.error(err);
      setSettingsError(err?.message || t('errors.categoryRenameFailed'));
    } finally {
      setCategoryRenameLoadingByName((prev) => ({ ...prev, [oldName]: false }));
    }
  };

  const handleDeleteCategory = async (name: string) => {
    const confirmed = await dialog.confirm({
      title: t('categories.deleteDialogTitle'),
      message: t('categories.deleteDialogMessage', { name }),
      tone: 'danger',
      confirmText: t('categories.deleteDialogConfirm'),
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
      setSettingsSuccess(t('success.categoryDeleted'));
    } catch (err: any) {
      console.error(err);
      setSettingsError(err?.message || t('errors.categoryDeleteFailed'));
    } finally {
      setCategoryDeletingName(null);
    }
  };

  const handleCreatePavilionGroup = async () => {
    const name = newGroupName.trim();
    if (!name) {
      setSettingsError(t('errors.enterGroupName'));
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
      setSettingsSuccess(t('success.groupCreated'));
    } catch (err: any) {
      console.error(err);
      setSettingsError(err?.message || t('errors.groupCreateFailed'));
    } finally {
      setGroupSaving(false);
    }
  };

  const handleRenamePavilionGroup = async (groupId: number) => {
    const name = (groupRenameById[groupId] ?? '').trim();
    if (!name) {
      setSettingsError(t('errors.enterGroupName'));
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
      setSettingsSuccess(t('success.groupRenamed'));
    } catch (err: any) {
      console.error(err);
      setSettingsError(err?.message || t('errors.groupRenameFailed'));
    } finally {
      setGroupRenameLoadingById((prev) => ({ ...prev, [groupId]: false }));
    }
  };

  const handleDeletePavilionGroup = async (groupId: number) => {
    const confirmed = await dialog.confirm({
      title: t('groups.deleteDialogTitle'),
      message: t('groups.deleteDialogMessage'),
      tone: 'danger',
      confirmText: t('groups.deleteDialogConfirm'),
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
      setSettingsSuccess(t('success.groupDeleted'));
    } catch (err: any) {
      console.error(err);
      setSettingsError(err?.message || t('errors.groupDeleteFailed'));
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
      setSettingsSuccess(t('success.groupPavilionsSaved'));
    } catch (err: any) {
      console.error(err);
      setSettingsError(err?.message || t('errors.groupPavilionsSaveFailed'));
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
        pavilions: t('export.sheets.pavilions'),
        householdExpenses: t('export.sheets.householdExpenses'),
        otherExpenses: t('export.sheets.otherExpenses'),
        adminExpenses: t('export.sheets.adminExpenses'),
        accounting: t('export.sheets.accounting'),
        staff: t('export.sheets.staff'),
      } as const;

      const pavilionNumberHeader = t('export.pavilionsHeaders.number');
      const categoryHeader = t('export.pavilionsHeaders.category');
      const areaHeader = t('export.pavilionsHeaders.area');
      const pricePerSqMHeader = t('export.pavilionsHeaders.pricePerSqM');
      const utilitiesHeader = t('export.pavilionsHeaders.utilities');
      const statusHeader = t('export.pavilionsHeaders.status');
      const tenantNameHeader = t('export.pavilionsHeaders.tenantName');
      const advertisingHeader = t('export.pavilionsHeaders.advertising');
      const nameHeader = t('export.nameAmountStatusHeaders.name');
      const amountHeader = t('export.nameAmountStatusHeaders.amount');
      const dateHeader = t('export.accountingHeaders.date');
      const bankTransferHeader = t('export.accountingHeaders.bankTransfer');
      const cashbox1Header = t('export.accountingHeaders.cashbox1');
      const cashbox2Header = t('export.accountingHeaders.cashbox2');
      const positionHeader = t('export.staffHeaders.position');
      const fullNameHeader = t('export.staffHeaders.fullName');
      const salaryHeader = t('export.staffHeaders.salary');
      const paymentStatusHeader = t('export.staffHeaders.paymentStatus');
      const paidLabel = t('export.statusValues.paid');
      const unpaidLabel = t('export.statusValues.unpaid');

      const pavilionsRows = (payload.pavilions || []).map((item) => ({
        [pavilionNumberHeader]: item.number,
        [categoryHeader]: item.category ?? '',
        [areaHeader]: Number(item.squareMeters ?? 0),
        [pricePerSqMHeader]: Number(item.pricePerSqM ?? 0),
        [utilitiesHeader]: item.utilitiesAmount ?? '',
        [statusHeader]:
          item.status === 'RENTED'
            ? t('export.statusValues.rented')
            : item.status === 'PREPAID'
              ? t('export.statusValues.prepaid')
              : t('export.statusValues.available'),
        [tenantNameHeader]: item.tenantName ?? '',
        [advertisingHeader]: item.advertisingAmount ?? '',
      }));
      const householdRows = (payload.householdExpenses || []).map((item) => ({
        [nameHeader]: item.name ?? '',
        [amountHeader]: Number(item.amount ?? 0),
        [statusHeader]: item.status === 'PAID' ? paidLabel : unpaidLabel,
      }));
      const adminTypeLabelByType: Record<string, string> = {
        PAYROLL_TAX: t('export.adminTypeLabels.PAYROLL_TAX'),
        PROFIT_TAX: t('export.adminTypeLabels.PROFIT_TAX'),
        DIVIDENDS: t('export.adminTypeLabels.DIVIDENDS'),
        BANK_SERVICES: t('export.adminTypeLabels.BANK_SERVICES'),
        VAT: t('export.adminTypeLabels.VAT'),
        LAND_RENT: t('export.adminTypeLabels.LAND_RENT'),
      };
      const otherRows = (payload.expenses || [])
        .filter((item) => item.type === 'OTHER')
        .map((item) => ({
          [nameHeader]: item.note?.trim() || t('export.otherExpenseFallbackName'),
          [amountHeader]: Number(item.amount ?? 0),
          [statusHeader]: item.status === 'PAID' ? paidLabel : unpaidLabel,
        }));
      const adminRows = (payload.expenses || [])
        .filter((item) => item.type !== 'OTHER')
        .map((item) => ({
          [nameHeader]: item.note?.trim() || adminTypeLabelByType[item.type] || item.type,
          [amountHeader]: Number(item.amount ?? 0),
          [statusHeader]: item.status === 'PAID' ? paidLabel : unpaidLabel,
        }));
      const accountingRows = (payload.accounting || []).map((item) => ({
        [dateHeader]: item.recordDate,
        [bankTransferHeader]: Number(item.bankTransferPaid ?? 0),
        [cashbox1Header]: Number(item.cashbox1Paid ?? 0),
        [cashbox2Header]: Number(item.cashbox2Paid ?? 0),
      }));
      const staffRows = (payload.staff || []).map((item) => ({
        [positionHeader]: item.position ?? '',
        [fullNameHeader]: item.fullName ?? '',
        [salaryHeader]: Number(item.salary ?? 0),
        [paymentStatusHeader]:
          item.salaryStatus === 'PAID' ? paidLabel : unpaidLabel,
      }));

      const pavilionsSheet =
        pavilionsRows.length > 0
          ? XLSX.utils.json_to_sheet(pavilionsRows)
          : XLSX.utils.aoa_to_sheet([
              [
                pavilionNumberHeader,
                categoryHeader,
                areaHeader,
                pricePerSqMHeader,
                utilitiesHeader,
                statusHeader,
                tenantNameHeader,
                advertisingHeader,
              ],
            ]);
      const householdSheet =
        householdRows.length > 0
          ? XLSX.utils.json_to_sheet(householdRows)
          : XLSX.utils.aoa_to_sheet([[nameHeader, amountHeader, statusHeader]]);
      const otherSheet =
        otherRows.length > 0
          ? XLSX.utils.json_to_sheet(otherRows)
          : XLSX.utils.aoa_to_sheet([[nameHeader, amountHeader, statusHeader]]);
      const adminSheet =
        adminRows.length > 0
          ? XLSX.utils.json_to_sheet(adminRows)
          : XLSX.utils.aoa_to_sheet([[nameHeader, amountHeader, statusHeader]]);
      const accountingSheet =
        accountingRows.length > 0
          ? XLSX.utils.json_to_sheet(accountingRows)
          : XLSX.utils.aoa_to_sheet([
              [dateHeader, bankTransferHeader, cashbox1Header, cashbox2Header],
            ]);
      const staffSheet =
        staffRows.length > 0
          ? XLSX.utils.json_to_sheet(staffRows)
          : XLSX.utils.aoa_to_sheet([
              [positionHeader, fullNameHeader, salaryHeader, paymentStatusHeader],
            ]);

      XLSX.utils.book_append_sheet(wb, pavilionsSheet, SHEETS.pavilions);
      XLSX.utils.book_append_sheet(wb, householdSheet, SHEETS.householdExpenses);
      XLSX.utils.book_append_sheet(wb, otherSheet, SHEETS.otherExpenses);
      XLSX.utils.book_append_sheet(wb, adminSheet, SHEETS.adminExpenses);
      XLSX.utils.book_append_sheet(wb, accountingSheet, SHEETS.accounting);
      XLSX.utils.book_append_sheet(wb, staffSheet, SHEETS.staff);

      XLSX.writeFile(wb, `store-export-${storeId}.xlsx`);
      setSettingsSuccess(t('success.dataExported'));
    } catch (err: any) {
      console.error(err);
      setSettingsError(err?.message || t('errors.dataExportFailed'));
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
              {t('header.title', { name: store.name })}
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {canViewActivity && (
              <Link
                href={`/stores/${storeId}/activity`}
                className="inline-flex items-center rounded-xl bg-[#ff6a13] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#e85a0c]"

              >
                {t('header.activityLog')}
              </Link>
            )}
            {(createPavilions || canExportData) && (
              <div className="inline-flex items-center gap-2">
                {createPavilions && (
                <button
                  onClick={() => setShowImportModal(true)}
                  className="inline-flex items-center rounded-xl border border-[#d8d1cb] bg-white px-4 py-2 text-sm font-semibold text-[#111111] transition hover:bg-[#f4efeb]"
                >
                  {t('header.importData')}
                </button>
                )}
                {canExportData && (
                <button
                  onClick={handleExportData}
                  disabled={exportingData}
                  className="inline-flex items-center rounded-xl border border-[#d8d1cb] bg-white px-4 py-2 text-sm font-semibold text-[#111111] transition hover:bg-[#f4efeb] disabled:opacity-60"
                >
                  {exportingData ? t('header.exporting') : t('header.exportData')}
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
                    {t('subscription.title')}
                  </h2>
                  <span
                    className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${subscriptionStatusClasses}`}
                  >
                    {subscriptionStatusLabel}
                  </span>
                </div>
                <p className="text-sm text-[#6b6b6b]">
                  {subscriptionPeriodLabel
                    ? t('subscription.statusForPeriod', { period: subscriptionPeriodLabel })
                    : t('subscription.statusForCurrentMonth')}
                </p>
                <p className="text-sm text-[#111111]">
                  {t('subscription.monthlyCost')} <span className="font-semibold">{subscriptionAmountLabel}</span>
                </p>
                {subscriptionBilling.isFirstMonthFree ? (
                  <p className="text-sm text-emerald-700">
                    {t('subscription.firstMonthFree')}
                  </p>
                ) : !subscriptionBilling.hasChargeForCurrentMonth ? (
                  <p className="text-sm text-[#6b6b6b]">
                    {t('subscription.noOccupiedPavilions')}
                  </p>
                ) : !subscriptionBilling.hasBillingDetails ? (
                  <p className="text-sm text-[#c2410c]">
                    {t('subscription.fillBillingDetails')}
                  </p>
                ) : subscriptionBilling.status === 'PAID' ? (
                  <p className="text-sm text-emerald-700">
                    {t('subscription.paymentConfirmed')}
                  </p>
                ) : (
                  <p className="text-sm text-[#c2410c]">
                    {t('subscription.paymentPendingConfirmation')}
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
                  {subscriptionActionLoading === 'view' ? t('subscription.opening') : t('subscription.viewInvoice')}
                </button>
                <button
                  type="button"
                  onClick={() => void handleStartSubscriptionPayment()}
                  disabled={!canStartSubscriptionPayment || subscriptionActionLoading !== null}
                  className="inline-flex items-center justify-center rounded-xl bg-[#ff6a13] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#e85a0c] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {subscriptionActionLoading === 'pay' ? t('subscription.preparing') : t('subscription.pay')}
                </button>
              </div>
            </div>
          </div>
        )}

        {canManageStore && (
          <div className="rounded-2xl border border-[#d8d1cb] bg-white p-6 shadow-[0_12px_36px_-20px_rgba(17,17,17,0.2)] md:p-8">
            <h2 className="mb-4 text-xl font-semibold md:text-2xl">{t('basicSettings.title')}</h2>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <div className="rounded-xl border border-[#d8d1cb] bg-[#f8f4ef] p-4">
                <h3 className="mb-2 font-medium">{t('basicSettings.storeName')}</h3>
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
                    {nameSaving ? t('common.savingEllipsis') : t('common.save')}
                  </button>
                </div>
              </div>

              <div className="rounded-xl border border-[#d8d1cb] bg-[#f8f4ef] p-4">
                <h3 className="mb-2 font-medium">{t('basicSettings.storeAddress')}</h3>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={addressDraft}
                    onChange={(e) => setAddressDraft(e.target.value)}
                    className="w-full rounded-xl border border-[#d8d1cb] bg-white px-3 py-2 text-[#111111] outline-none transition focus:border-[#ff6a13] focus:ring-2 focus:ring-[#ff6a13]/20"
                    placeholder={t('basicSettings.optionalPlaceholder')}
                  />
                  <button
                    onClick={handleUpdateStoreAddress}
                    disabled={addressSaving || addressDraft.trim() === String(store.address ?? '').trim()}
                    className="rounded-xl bg-[#ff6a13] px-4 py-2 font-semibold text-white transition hover:bg-[#e85a0c] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {addressSaving ? t('common.savingEllipsis') : t('common.save')}
                  </button>
                </div>
                <p className="mt-2 text-sm text-[#6b6b6b]">
                  {t('basicSettings.addressClearHint')}
                </p>
              </div>

              <div className="rounded-xl border border-[#d8d1cb] bg-[#f8f4ef] p-4">
                <h3 className="mb-2 font-medium">{t('basicSettings.billingDetails')}</h3>
                <div className="space-y-3">
                  <input
                    type="text"
                    value={billingCompanyNameDraft}
                    onChange={(e) => setBillingCompanyNameDraft(e.target.value)}
                    className="w-full rounded-xl border border-[#d8d1cb] bg-white px-3 py-2 text-[#111111] outline-none transition focus:border-[#ff6a13] focus:ring-2 focus:ring-[#ff6a13]/20"
                    placeholder={t('basicSettings.companyNamePlaceholder')}
                  />
                  <textarea
                    value={billingLegalAddressDraft}
                    onChange={(e) => setBillingLegalAddressDraft(e.target.value)}
                    rows={3}
                    className="w-full rounded-xl border border-[#d8d1cb] bg-white px-3 py-2 text-[#111111] outline-none transition focus:border-[#ff6a13] focus:ring-2 focus:ring-[#ff6a13]/20"
                    placeholder={t('basicSettings.legalAddressPlaceholder')}
                  />
                  <input
                    type="text"
                    value={billingInnDraft}
                    onChange={(e) => setBillingInnDraft(e.target.value)}
                    className="w-full rounded-xl border border-[#d8d1cb] bg-white px-3 py-2 text-[#111111] outline-none transition focus:border-[#ff6a13] focus:ring-2 focus:ring-[#ff6a13]/20"
                    placeholder={t('basicSettings.innPlaceholder')}
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
                      {billingSaving ? t('common.savingEllipsis') : t('common.save')}
                    </button>
                  </div>
                </div>
                <p className="mt-2 text-sm text-[#6b6b6b]">
                  {t('basicSettings.billingHint')}
                </p>
              </div>

              <div className="rounded-xl border border-[#d8d1cb] bg-[#f8f4ef] p-4">
                <h3 className="mb-2 font-medium">{t('basicSettings.currency')}</h3>
                <p className="mb-2 text-sm text-[#6b6b6b]">
                  {t('basicSettings.currentCurrency', { currency: store.currency, symbol: getCurrencySymbol(store.currency) })}
                </p>
                <select
                  value={currencyDraft}
                  onChange={(e) => setCurrencyDraft(e.target.value as 'RUB' | 'KZT')}
                  disabled={currencySaving}
                  className="w-full rounded-xl border border-[#d8d1cb] bg-white px-3 py-2 text-[#111111] outline-none transition focus:border-[#ff6a13] focus:ring-2 focus:ring-[#ff6a13]/20"
                >
                  <option value="RUB">{t('basicSettings.currencyRub')}</option>
                  <option value="KZT">{t('basicSettings.currencyKzt')}</option>
                </select>
                <div className="mt-3 flex justify-end">
                  <button
                    type="button"
                    onClick={() => void handleCurrencyChange()}
                    disabled={currencySaving || currencyDraft === (store.currency ?? 'RUB')}
                    className="rounded-xl bg-[#ff6a13] px-4 py-2 font-semibold text-white transition hover:bg-[#e85a0c] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {currencySaving ? t('common.savingEllipsis') : t('common.save')}
                  </button>
                </div>
              </div>

              <div className="rounded-xl border border-[#d8d1cb] bg-[#f8f4ef] p-4">
                <h3 className="mb-2 font-medium">{t('basicSettings.timeZone')}</h3>
                <p className="mb-2 text-sm text-[#6b6b6b]">
                  {t('basicSettings.currentTimeZone', { timeZone: store.timeZone || 'UTC' })}
                </p>
                <TimeZoneAutocomplete
                  value={timeZoneQuery}
                  onChange={setTimeZoneQuery}
                  disabled={timeZoneSaving}
                  inputClassName="w-full rounded-xl border border-[#d8d1cb] bg-white px-3 py-2 text-[#111111] outline-none transition focus:border-[#ff6a13] focus:ring-2 focus:ring-[#ff6a13]/20"
                  placeholder={t('basicSettings.timeZonePlaceholder')}
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
                    {timeZoneSaving ? t('common.savingEllipsis') : t('common.save')}
                  </button>
                </div>
              </div>

              <div className="rounded-xl border border-[#d8d1cb] bg-[#f8f4ef] p-4">
                <h3 className="mb-2 font-medium">{t('basicSettings.contactDetails')}</h3>
                <div className="space-y-3">
                  <input
                    type="text"
                    value={contactPhoneDraft}
                    onChange={(e) => setContactPhoneDraft(e.target.value)}
                    className="w-full rounded-xl border border-[#d8d1cb] bg-white px-3 py-2 text-[#111111] outline-none transition focus:border-[#ff6a13] focus:ring-2 focus:ring-[#ff6a13]/20"
                    placeholder={t('basicSettings.phonePlaceholder')}
                  />
                  <input
                    type="email"
                    value={contactEmailDraft}
                    onChange={(e) => setContactEmailDraft(e.target.value)}
                    className="w-full rounded-xl border border-[#d8d1cb] bg-white px-3 py-2 text-[#111111] outline-none transition focus:border-[#ff6a13] focus:ring-2 focus:ring-[#ff6a13]/20"
                    placeholder={t('basicSettings.emailPlaceholder')}
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
                      {contactSaving ? t('common.savingEllipsis') : t('common.save')}
                    </button>
                  </div>
                </div>
                <p className="mt-2 text-sm text-[#6b6b6b]">
                  {t('basicSettings.contactClearHint')}
                </p>
              </div>
            </div>
          </div>
        )}

        {canManageMedia && (
          <div className="rounded-2xl border border-[#d8d1cb] bg-white p-6 shadow-[0_12px_36px_-20px_rgba(17,17,17,0.2)] md:p-8">
            <h2 className="mb-4 text-xl font-semibold md:text-2xl">
              {t('media.title')}
            </h2>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.2fr_0.8fr]">
              <div className="rounded-xl border border-[#d8d1cb] bg-[#f8f4ef] p-4">
                <h3 className="mb-2 font-medium">{t('media.descriptionLabel')}</h3>
                <textarea
                  value={descriptionDraft}
                  onChange={(e) => setDescriptionDraft(e.target.value)}
                  rows={6}
                  className="w-full rounded-xl border border-[#d8d1cb] bg-white px-3 py-2 text-[#111111] outline-none transition focus:border-[#ff6a13] focus:ring-2 focus:ring-[#ff6a13]/20"
                  placeholder={t('media.descriptionPlaceholder')}
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
                    {descriptionSaving ? t('common.savingEllipsis') : t('common.save')}
                  </button>
                </div>
                <p className="mt-2 text-sm text-[#6b6b6b]">
                  {t('media.descriptionClearHint')}
                </p>
              </div>

              <div className="rounded-xl border border-[#d8d1cb] bg-[#f8f4ef] p-4">
                <h3 className="mb-3 font-medium">{t('media.photoLabel')}</h3>
                {storeImages[0] ? (
                  <img
                    src={resolveApiMediaUrl(storeImages[0].filePath) || undefined}
                    alt={t('media.photoAlt', { name: store.name })}
                    className="mb-4 h-56 w-full rounded-2xl border border-[#d8d1cb] object-cover"
                  />
                ) : (
                  <div className="mb-4 flex h-56 items-center justify-center rounded-2xl border border-dashed border-[#d8d1cb] bg-white text-sm text-[#6b6b6b]">
                    {t('media.noPhotoYet')}
                  </div>
                )}
                <div className="flex flex-wrap gap-2">
                  <label className="inline-flex cursor-pointer items-center rounded-xl bg-[#ff6a13] px-4 py-2 font-semibold text-white transition hover:bg-[#e85a0c]">
                    {imageUploading ? t('media.uploading') : t('media.addPhoto')}
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
                    {storeImages.length > 0
                      ? t('media.allPhotosWithCount', { count: storeImages.length })
                      : t('media.allPhotos')}
                  </Link>
                </div>
                <p className="mt-2 text-sm text-[#6b6b6b]">
                  {t('media.formatsHint')}
                </p>
              </div>
            </div>
          </div>
        )}

        {canEditPavilions && (
          <div className="rounded-2xl border border-[#d8d1cb] bg-white p-6 shadow-[0_12px_36px_-20px_rgba(17,17,17,0.2)] md:p-8">
            <h2 className="mb-4 text-xl font-semibold md:text-2xl">{t('categories.title')}</h2>
            <div className="mb-4 flex gap-2">
              <input
                type="text"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                className="w-full rounded-xl border border-[#d8d1cb] bg-[#f8f4ef] px-3 py-2 text-[#111111] outline-none transition focus:border-[#ff6a13] focus:bg-white focus:ring-2 focus:ring-[#ff6a13]/20"
                placeholder={t('categories.newCategoryPlaceholder')}
              />
              <button
                onClick={handleCreateCategory}
                disabled={categorySaving}
                className="rounded-xl bg-[#ff6a13] px-4 py-2 font-semibold text-white transition hover:bg-[#e85a0c] disabled:opacity-60"
              >
                {categorySaving ? t('categories.adding') : t('common.add')}
              </button>
            </div>

            {categoryList.length === 0 ? (
              <p className="text-sm text-[#6b6b6b]">{t('categories.empty')}</p>
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
                            ? t('common.savingInProgress')
                            : t('common.rename')}
                        </button>
                        <button
                          onClick={() => handleDeleteCategory(category)}
                          disabled={categoryDeletingName === category}
                          className="rounded-xl bg-[#ef4444] px-3 py-2 text-xs font-semibold text-white transition hover:bg-[#dc2626] disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {categoryDeletingName === category ? t('common.deletingEllipsis') : t('common.delete')}
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
            <h2 className="mb-4 text-xl font-semibold md:text-2xl">{t('groups.title')}</h2>
            <div className="mb-4 flex gap-2">
              <input
                type="text"
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                className="w-full rounded-xl border border-[#d8d1cb] bg-[#f8f4ef] px-3 py-2 text-[#111111] outline-none transition focus:border-[#ff6a13] focus:bg-white focus:ring-2 focus:ring-[#ff6a13]/20"
                placeholder={t('groups.newGroupPlaceholder')}
              />
              <button
                onClick={handleCreatePavilionGroup}
                disabled={groupSaving}
                className="rounded-xl bg-[#ff6a13] px-4 py-2 font-semibold text-white transition hover:bg-[#e85a0c] disabled:opacity-60"
              >
                {groupSaving ? t('groups.creating') : t('common.create')}
              </button>
            </div>

            {(store.pavilionGroups || []).length === 0 ? (
              <p className="text-sm text-[#6b6b6b]">{t('groups.empty')}</p>
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
                              ? t('groups.hideList')
                              : t('groups.addPavilions')}
                          </button>
                          <button
                            onClick={() => handleRenamePavilionGroup(group.id)}
                            disabled={Boolean(groupRenameLoadingById[group.id]) || !changed}
                            className="rounded-xl border border-[#d8d1cb] bg-white px-3 py-2 text-xs font-semibold text-[#111111] transition hover:bg-[#f4efeb] disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {groupRenameLoadingById[group.id]
                              ? t('common.savingInProgress')
                              : t('common.rename')}
                          </button>
                          <button
                            onClick={() => handleDeletePavilionGroup(group.id)}
                            disabled={groupDeletingId === group.id}
                            className="rounded-xl bg-[#ef4444] px-3 py-2 text-xs font-semibold text-white transition hover:bg-[#dc2626] disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {groupDeletingId === group.id ? t('common.deletingEllipsis') : t('common.delete')}
                          </button>
                        </div>
                      </div>

                      <div className="mt-2 text-xs text-[#6b6b6b]">
                        {t('groups.currentComposition', { count: (group.pavilions || []).length })}
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
                            placeholder={t('groups.searchPavilionPlaceholder')}
                          />
                          <div className="max-h-56 space-y-2 overflow-y-auto rounded-xl border border-[#d8d1cb] bg-[#f8f4ef] p-2">
                            {filteredPavilions.length === 0 ? (
                              <p className="text-xs text-[#6b6b6b]">{t('groups.noPavilionsFound')}</p>
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
                              {t('groups.selectedCount', { count: selectedIds.size })}
                            </span>
                            <button
                              onClick={() => handleSaveGroupPavilions(group)}
                              disabled={Boolean(groupPavilionSavingById[group.id])}
                              className="rounded-xl bg-[#22c55e] px-3 py-2 text-xs font-semibold text-white transition hover:bg-[#16a34a] disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {groupPavilionSavingById[group.id]
                                ? t('common.savingInProgress')
                                : t('groups.saveSelection')}
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
            <h2 className="mb-6 text-xl font-semibold md:text-2xl">{t('users.title')}</h2>
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
              {t('dangerZone.title')}
            </h2>
            <button
              onClick={() => setShowDeleteStoreModal(true)}
              disabled={deletingStore}
              className="rounded-xl bg-[#ef4444] px-5 py-2.5 font-semibold text-white shadow-sm transition hover:bg-[#dc2626] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {deletingStore ? t('common.deletingEllipsis') : t('dangerZone.deleteStore')}
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
            <h3 className="text-lg font-semibold text-[#111111]">{t('deleteStore.modalTitle')}</h3>
            <p className="mt-3 text-sm text-[#6b6b6b]">
              {t.rich('deleteStore.instruction', {
                word: t('deleteStore.confirmWord'),
                strong: (chunks) => <span className="font-semibold">{chunks}</span>,
              })}
            </p>
            <input
              type="text"
              value={deleteStoreInput}
              onChange={(e) => setDeleteStoreInput(e.target.value)}
              className="mt-4 w-full rounded-xl border border-[#d8d1cb] bg-[#f8f4ef] px-3 py-2 text-[#111111] outline-none transition focus:border-[#ef4444] focus:bg-white focus:ring-2 focus:ring-[#ef4444]/20"
              placeholder={t('deleteStore.confirmWord')}
            />
            <div className="mt-5 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowDeleteStoreModal(false);
                  setDeleteStoreInput('');
                }}
                className="rounded-xl border border-[#d8d1cb] px-4 py-2 font-semibold text-[#111111] transition hover:bg-[#f4efeb]"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={handleDeleteStore}
                disabled={deletingStore || deleteStoreInput.trim().toUpperCase() !== t('deleteStore.confirmWord')}
                className="rounded-xl bg-[#ef4444] px-4 py-2 font-semibold text-white transition hover:bg-[#dc2626] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {deletingStore ? t('common.deletingEllipsis') : t('dangerZone.deleteStore')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
