'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { apiFetch } from '@/lib/api';
import { TimeZoneAutocomplete } from '@/components/TimeZoneAutocomplete';
import { useToast } from '@/components/toast/ToastProvider';

type StoreCurrency = 'RUB' | 'KZT';

type StoreSummary = {
  id: number;
  name: string;
  address?: string | null;
  billingCompanyName?: string | null;
  billingLegalAddress?: string | null;
  billingInn?: string | null;
  contactPhone?: string | null;
  contactEmail?: string | null;
};

export function CreateStoreModal({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: (newStore: StoreSummary) => void;
}) {
  const t = useTranslations('CreateStoreModal');
  const toast = useToast();
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [description, setDescription] = useState('');
  const [billingCompanyName, setBillingCompanyName] = useState('');
  const [billingLegalAddress, setBillingLegalAddress] = useState('');
  const [billingInn, setBillingInn] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [currency, setCurrency] = useState<'' | StoreCurrency>('');
  const [timeZone, setTimeZone] = useState('');
  const [photos, setPhotos] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!name.trim()) {
      toast.error(t('nameRequired'));
      return;
    }

    setLoading(true);

    try {
      const newStore = await apiFetch<StoreSummary>('/stores', {
        method: 'POST',
        body: JSON.stringify({
          name: name.trim(),
          address: address.trim() || null,
          description: description.trim() || null,
          billingCompanyName: billingCompanyName.trim() || null,
          billingLegalAddress: billingLegalAddress.trim() || null,
          billingInn: billingInn.trim() || null,
          contactPhone: contactPhone.trim() || null,
          contactEmail: contactEmail.trim() || null,
          currency: currency || undefined,
          timeZone: timeZone.trim() || null,
        }),
      });

      if (photos.length > 0) {
        const formData = new FormData();
        photos.forEach((photo) => formData.append('files', photo));
        await apiFetch(`/stores/${newStore.id}/media`, {
          method: 'POST',
          body: formData,
        });
      }

      toast.success(t('createSuccess'));
      onSaved(newStore);
    } catch (err: any) {
      toast.error(err.message || t('createFailed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="flex max-h-[90vh] w-full max-w-md flex-col rounded-lg bg-white shadow-xl">
        <div className="overflow-y-auto p-6">
          <h2 className="mb-6 text-xl font-bold">{t('title')}</h2>

          <div className="mb-6">
            <label className="mb-2 block text-sm font-medium text-gray-700">
              {t('nameLabel')}
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder={t('namePlaceholder')}
            />
          </div>

          <h3 className="mb-2 text-base font-bold">{t('optionalFieldsTitle')}</h3>

          <div className="mb-6">
            <label className="mb-2 block text-sm font-medium text-gray-700">
              {t('addressLabel')}
            </label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full rounded-lg border px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="mb-6">
            <label className="mb-2 block text-sm font-medium text-gray-700">
              {t('descriptionLabel')}
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              className="w-full rounded-lg border px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder={t('descriptionPlaceholder')}
            />
          </div>

          <div className="mb-6 rounded-xl border border-[#D8D1CB] bg-[#F8F4EF] p-4">
            <h3 className="mb-3 text-sm font-semibold text-[#111111]">
              {t('billingSectionTitle')}
            </h3>

            <div className="mb-3">
              <label className="mb-2 block text-sm font-medium text-gray-700">
                {t('billingCompanyNameLabel')}
              </label>
              <input
                type="text"
                value={billingCompanyName}
                onChange={(e) => setBillingCompanyName(e.target.value)}
                className="w-full rounded-lg border px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder={t('billingPlaceholder')}
              />
            </div>

            <div className="mb-3">
              <label className="mb-2 block text-sm font-medium text-gray-700">
                {t('billingLegalAddressLabel')}
              </label>
              <textarea
                value={billingLegalAddress}
                onChange={(e) => setBillingLegalAddress(e.target.value)}
                rows={3}
                className="w-full rounded-lg border px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder={t('billingPlaceholder')}
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                {t('billingInnLabel')}
              </label>
              <input
                type="text"
                value={billingInn}
                onChange={(e) => setBillingInn(e.target.value)}
                className="w-full rounded-lg border px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder={t('billingInnPlaceholder')}
              />
            </div>
          </div>

          <div className="mb-6">
            <label className="mb-2 block text-sm font-medium text-gray-700">
              {t('contactPhoneLabel')}
            </label>
            <input
              type="text"
              value={contactPhone}
              onChange={(e) => setContactPhone(e.target.value)}
              className="w-full rounded-lg border px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="mb-6">
            <label className="mb-2 block text-sm font-medium text-gray-700">
              {t('contactEmailLabel')}
            </label>
            <input
              type="email"
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
              className="w-full rounded-lg border px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="mb-6">
            <label className="mb-2 block text-sm font-medium text-gray-700">
              {t('currencyLabel')}
            </label>
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value as '' | StoreCurrency)}
              className="w-full rounded-lg border px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">{t('currencyDefault')}</option>
              <option value="RUB">{t('currencyRub')}</option>
              <option value="KZT">{t('currencyKzt')}</option>
            </select>
          </div>

          <div className="mb-6">
            <label className="mb-2 block text-sm font-medium text-gray-700">
              {t('timeZoneLabel')}
            </label>
            <TimeZoneAutocomplete
              value={timeZone}
              onChange={setTimeZone}
              placeholder={t('timeZonePlaceholder')}
              inputClassName="w-full rounded-lg border px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              dropdownClassName="absolute z-10 mt-2 max-h-64 w-full overflow-auto rounded-lg border bg-white shadow-lg"
              itemClassName="block w-full border-b px-3 py-2 text-left text-sm text-gray-800 transition last:border-b-0 hover:bg-gray-50"
              emptyTextClassName="px-3 py-2 text-sm text-gray-500"
              fallbackTextClassName="border-b px-3 py-2 text-xs text-gray-500"
            />
            <p className="mt-1 text-xs text-gray-500">
              {t('timeZoneHint')}
            </p>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">
              {t('photosLabel')}
            </label>
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              multiple
              onChange={(e) => setPhotos(Array.from(e.target.files || []))}
              className="w-full rounded-lg border px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="mt-1 text-xs text-gray-500">
              {photos.length > 0
                ? t('photosSelected', { count: photos.length })
                : t('photosHint')}
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-3 border-t px-6 py-4">
          <button
            onClick={onClose}
            disabled={loading}
            className="rounded-lg border px-5 py-2.5 hover:bg-gray-100 disabled:opacity-50"
          >
            {t('cancel')}
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="rounded-lg bg-blue-600 px-5 py-2.5 text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? t('creating') : t('create')}
          </button>
        </div>
      </div>
    </div>
  );
}
