'use client';

import { useEffect, useMemo, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { getCurrentUserFromToken } from '@/lib/auth';
import Link from 'next/link';
import { hasPermission } from '@/lib/permissions';

type StoreCurrency = 'RUB' | 'KZT';
type TimeZoneOption = {
  value: string;
  label: string;
  keywords: string[];
};

const TIME_ZONE_ALIASES: Record<string, string[]> = {
  UTC: ['utc', 'гринвич', 'london'],
  'Europe/Moscow': ['москва', 'moscow', 'msk'],
  'Europe/Kiev': ['киев', 'kyiv', 'kiev', 'украина'],
  'Asia/Almaty': [
    'алматы',
    'almaty',
    'астана',
    'astana',
    'nur-sultan',
    'нурсултан',
    'казахстан',
  ],
  'Asia/Tashkent': ['ташкент', 'tashkent', 'узбекистан'],
  'Asia/Bishkek': ['бишкек', 'bishkek', 'кыргызстан'],
  'Asia/Dubai': ['дубай', 'dubai', 'оаэ'],
  'Europe/Istanbul': ['стамбул', 'istanbul', 'турция'],
  'Europe/Berlin': ['берлин', 'berlin', 'германия'],
  'Europe/Paris': ['париж', 'paris', 'франция'],
  'America/New_York': ['нью-йорк', 'new york', 'usa', 'сша', 'восток сша'],
  'America/Chicago': ['чикаго', 'chicago', 'usa', 'сша', 'центр сша'],
  'America/Denver': ['денвер', 'denver', 'usa', 'сша', 'горы сша'],
  'America/Los_Angeles': ['лос-анджелес', 'los angeles', 'la', 'usa', 'сша'],
};

function humanizeTimeZone(timeZone: string) {
  if (timeZone === 'UTC') return 'UTC';
  const city = timeZone.split('/').pop() || timeZone;
  return city.replace(/_/g, ' ');
}

function getUtcOffsetLabel(timeZone: string) {
  try {
    const dtf = new Intl.DateTimeFormat('en-US', {
      timeZone,
      timeZoneName: 'shortOffset',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
    const parts = dtf.formatToParts(new Date());
    const offset = parts.find((part) => part.type === 'timeZoneName')?.value;
    return offset ? offset.replace('GMT', 'UTC') : '';
  } catch {
    return '';
  }
}

function buildTimeZoneOptions(): TimeZoneOption[] {
  const supported =
    typeof Intl !== 'undefined' &&
    typeof (Intl as any).supportedValuesOf === 'function'
      ? ((Intl as any).supportedValuesOf('timeZone') as string[])
      : [];

  const baseSet = new Set<string>(['UTC', ...supported, ...Object.keys(TIME_ZONE_ALIASES)]);

  return Array.from(baseSet)
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b))
    .map((value) => {
      const aliases = TIME_ZONE_ALIASES[value] || [];
      const labelCity = humanizeTimeZone(value);
      const offset = getUtcOffsetLabel(value);
      const label = `${labelCity}${offset ? ` (${offset})` : ''} — ${value}`;
      return {
        value,
        label,
        keywords: [value, labelCity, ...aliases].map((item) => item.toLowerCase()),
      };
    });
}

// Permission enum (add CREATE_STORES if not present)
enum Permission {
  CREATE_STORES = 'CREATE_STORES',
}

interface StoreSummary {
  id: number;
  name: string;
  address?: string | null;
  contactPhone?: string | null;
  contactEmail?: string | null;
  permissions?: string[];
}

// Simple modal component (you can move it to separate file later)
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
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [currency, setCurrency] = useState<'' | StoreCurrency>('');
  const [timeZone, setTimeZone] = useState('');
  const [debouncedTimeZoneQuery, setDebouncedTimeZoneQuery] = useState('');
  const [showTimeZoneSuggestions, setShowTimeZoneSuggestions] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setDebouncedTimeZoneQuery(timeZone.trim().toLowerCase());
    }, 250);
    return () => clearTimeout(timeout);
  }, [timeZone]);

  const timeZoneOptions = useMemo(() => buildTimeZoneOptions(), []);
  const filteredTimeZoneOptions = useMemo(() => {
    if (!debouncedTimeZoneQuery) return timeZoneOptions.slice(0, 30);
    return timeZoneOptions
      .filter((option) =>
        option.keywords.some((keyword) => keyword.includes(debouncedTimeZoneQuery)),
      )
      .slice(0, 30);
  }, [timeZoneOptions, debouncedTimeZoneQuery]);

  const handleSubmit = async () => {
    if (!name.trim()) {
      setError('Введите название магазина');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const newStore = await apiFetch<{ id: number; name: string }>('/stores', {
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

      onSaved(newStore);
    } catch (err: any) {
      setError(err.message || 'Ошибка создания магазина');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <h2 className="text-xl font-bold mb-6">Создать новый объект</h2>

        {error && <p className="text-red-600 mb-4 text-sm">{error}</p>}

        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Название объекта*
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Например: Торговый центр Альфа"
          />
        </div>

        <h2 className="text-l font-bold mb-2">Опционалтные поля</h2>

        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Адрес объекта
          </label>
          <input
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Контактный телефон
          </label>
          <input
            type="text"
            value={contactPhone}
            onChange={(e) => setContactPhone(e.target.value)}
            className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Необязательно"
          />
        </div>

        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Контактная почта
          </label>
          <input
            type="email"
            value={contactEmail}
            onChange={(e) => setContactEmail(e.target.value)}
            className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Необязательно"
          />
        </div>

        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Валюта объекта
          </label>
          <select
            value={currency}
            onChange={(e) => setCurrency(e.target.value as '' | StoreCurrency)}
            className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">По умолчанию: RUB</option>
            <option value="RUB">Российский рубль (₽)</option>
            <option value="KZT">Казахстанский тенге (₸)</option>
          </select>
        </div>

        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Часовой пояс объекта
          </label>
          <div className="relative">
            <input
              type="text"
              value={timeZone}
              onChange={(e) => {
                setTimeZone(e.target.value);
                setShowTimeZoneSuggestions(true);
              }}
              onFocus={() => setShowTimeZoneSuggestions(true)}
              onBlur={() => {
                setTimeout(() => setShowTimeZoneSuggestions(false), 120);
              }}
              className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Введите город или таймзону"
            />
            {showTimeZoneSuggestions && (
              <div className="absolute z-10 mt-2 max-h-64 w-full overflow-auto rounded-lg border bg-white shadow-lg">
                {filteredTimeZoneOptions.length === 0 ? (
                  <p className="px-3 py-2 text-sm text-gray-500">Ничего не найдено</p>
                ) : (
                  filteredTimeZoneOptions.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        setTimeZone(option.value);
                        setShowTimeZoneSuggestions(false);
                      }}
                      className="block w-full border-b px-3 py-2 text-left text-sm text-gray-800 transition last:border-b-0 hover:bg-gray-50"
                    >
                      {option.label}
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
          <p className="mt-1 text-xs text-gray-500">Если не указывать, будет использоваться UTC.</p>
        </div>

        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            disabled={loading}
            className="px-5 py-2.5 border rounded-lg hover:bg-gray-100 disabled:opacity-50"
          >
            Отмена
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Создание...' : 'Создать'}
          </button>
        </div>
      </div>
    </div>
  );
}
