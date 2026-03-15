'use client';

import { useState } from 'react';
import { apiFetch } from '@/lib/api';
import { TimeZoneAutocomplete } from '@/components/TimeZoneAutocomplete';
import { useToast } from '@/components/toast/ToastProvider';

type StoreCurrency = 'RUB' | 'KZT';

export function CreateStoreModal({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: (newStore: {
    id: number;
    name: string;
    address?: string | null;
    contactPhone?: string | null;
    contactEmail?: string | null;
  }) => void;
}) {
  const toast = useToast();
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [currency, setCurrency] = useState<'' | StoreCurrency>('');
  const [timeZone, setTimeZone] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!name.trim()) {
      toast.error('Введите название объекта');
      return;
    }

    setLoading(true);

    try {
      const newStore = await apiFetch<{
        id: number;
        name: string;
        address?: string | null;
        contactPhone?: string | null;
        contactEmail?: string | null;
      }>('/stores', {
        method: 'POST',
        body: JSON.stringify({
          name: name.trim(),
          address: address.trim() || null,
          contactPhone: contactPhone.trim() || null,
          contactEmail: contactEmail.trim() || null,
          currency: currency || undefined,
          timeZone: timeZone.trim() || null,
        }),
      });

      toast.success('Объект успешно создан');
      onSaved(newStore);
    } catch (err: any) {
      toast.error(err.message || 'Ошибка создания объекта');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="flex max-h-[90vh] w-full max-w-md flex-col rounded-lg bg-white shadow-xl">
        <div className="overflow-y-auto p-6">
          <h2 className="mb-6 text-xl font-bold">Создать новый объект</h2>

          <div className="mb-6">
            <label className="mb-2 block text-sm font-medium text-gray-700">
              Название объекта*
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Например: Торговый центр Альфа"
            />
          </div>

          <h3 className="mb-2 text-base font-bold">Опциональные поля</h3>

          <div className="mb-6">
            <label className="mb-2 block text-sm font-medium text-gray-700">
              Адрес объекта
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
              Контактный телефон
            </label>
            <input
              type="text"
              value={contactPhone}
              onChange={(e) => setContactPhone(e.target.value)}
              className="w-full rounded-lg border px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Необязательно"
            />
          </div>

          <div className="mb-6">
            <label className="mb-2 block text-sm font-medium text-gray-700">
              Контактная почта
            </label>
            <input
              type="email"
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
              className="w-full rounded-lg border px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Необязательно"
            />
          </div>

          <div className="mb-6">
            <label className="mb-2 block text-sm font-medium text-gray-700">
              Валюта объекта
            </label>
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value as '' | StoreCurrency)}
              className="w-full rounded-lg border px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">По умолчанию: RUB</option>
              <option value="RUB">Российский рубль (₽)</option>
              <option value="KZT">Казахстанский тенге (₸)</option>
            </select>
          </div>

          <div className="mb-2">
            <label className="mb-2 block text-sm font-medium text-gray-700">
              Часовой пояс объекта
            </label>
            <TimeZoneAutocomplete
              value={timeZone}
              onChange={setTimeZone}
              placeholder="Например: Москва, Астана, Новосибирск"
              inputClassName="w-full rounded-lg border px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              dropdownClassName="absolute z-10 mt-2 max-h-64 w-full overflow-auto rounded-lg border bg-white shadow-lg"
              itemClassName="block w-full border-b px-3 py-2 text-left text-sm text-gray-800 transition last:border-b-0 hover:bg-gray-50"
              emptyTextClassName="px-3 py-2 text-sm text-gray-500"
              fallbackTextClassName="border-b px-3 py-2 text-xs text-gray-500"
            />
            <p className="mt-1 text-xs text-gray-500">
              Доступны крупные города России и Казахстана. Если не указывать,
              будет использоваться UTC.
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-3 border-t px-6 py-4">
          <button
            onClick={onClose}
            disabled={loading}
            className="rounded-lg border px-5 py-2.5 hover:bg-gray-100 disabled:opacity-50"
          >
            Отмена
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="rounded-lg bg-blue-600 px-5 py-2.5 text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Создание...' : 'Создать'}
          </button>
        </div>
      </div>
    </div>
  );
}
