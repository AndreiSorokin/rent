'use client';

import { useState } from 'react';
import { apiFetch } from '@/lib/api';
import { createPavilionPayment } from '@/lib/payments';
import { updatePavilion } from '@/lib/pavilions';

type PavilionStatus = 'AVAILABLE' | 'RENTED' | 'PREPAID';

type PavilionLike = {
  id: number;
  number?: string;
  category?: string | null;
  squareMeters?: number | null;
  pricePerSqM?: number | null;
  status?: PavilionStatus | string;
  tenantName?: string | null;
  utilitiesAmount?: number | null;
  advertisingAmount?: number | null;
};

const STATUS_OPTIONS: Array<{ value: PavilionStatus; label: string }> = [
  { value: 'AVAILABLE', label: 'СВОБОДЕН' },
  { value: 'RENTED', label: 'ЗАНЯТ' },
  { value: 'PREPAID', label: 'ПРЕДОПЛАТА' },
];

export function EditPavilionModal({
  storeId,
  pavilion,
  existingCategories,
  onClose,
  onSaved,
}: {
  storeId: number;
  pavilion: PavilionLike;
  existingCategories?: string[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const normalizedCurrentCategory = pavilion?.category ?? '';
  const [form, setForm] = useState<{
    number: string;
    squareMeters: string;
    pricePerSqM: string;
    status: PavilionStatus;
    tenantName: string;
    utilitiesAmount: string;
    advertisingAmount: string;
  }>(() => ({
    number: pavilion?.number ?? '',
    squareMeters:
      pavilion?.squareMeters != null ? String(pavilion.squareMeters) : '',
    pricePerSqM:
      pavilion?.pricePerSqM != null ? String(pavilion.pricePerSqM) : '',
    status:
      pavilion?.status === 'RENTED' || pavilion?.status === 'PREPAID'
        ? pavilion.status
        : 'AVAILABLE',
    tenantName: pavilion?.tenantName ?? '',
    utilitiesAmount:
      pavilion?.utilitiesAmount != null ? String(pavilion.utilitiesAmount) : '',
    advertisingAmount:
      pavilion?.advertisingAmount != null
        ? String(pavilion.advertisingAmount)
        : '',
  }));
  const [selectedCategory, setSelectedCategory] = useState(
    normalizedCurrentCategory,
  );
  const [newCategory, setNewCategory] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [prepaymentMonth, setPrepaymentMonth] = useState(
    new Date().toISOString().slice(0, 7),
  );
  const [prepaymentAmount, setPrepaymentAmount] = useState('');
  const [prepaymentBankTransferPaid, setPrepaymentBankTransferPaid] =
    useState('');
  const [prepaymentCashbox1Paid, setPrepaymentCashbox1Paid] = useState('');
  const [prepaymentCashbox2Paid, setPrepaymentCashbox2Paid] = useState('');

  const resolvedCategory = (newCategory.trim() || selectedCategory || '').trim();
  const squareMeters = Number(form.squareMeters || 0);
  const pricePerSqM = Number(form.pricePerSqM || 0);
  const rentAmount = Math.max(squareMeters, 0) * Math.max(pricePerSqM, 0);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => {
    const { name, value } = e.target;
    setError(null);

    setForm((prev) => {
      const next = { ...prev, [name]: value };

      if (name === 'status' && value === 'AVAILABLE') {
        next.tenantName = '';
      }

      if (name === 'status' && value === 'PREPAID') {
        next.utilitiesAmount = '0';
        next.advertisingAmount = '0';
      }

      if (name === 'status' && value === 'RENTED') {
        if (!next.utilitiesAmount) next.utilitiesAmount = '0';
        if (!next.advertisingAmount) next.advertisingAmount = '0';
      }

      return next;
    });
  };

  const handleSave = async () => {
    const parsedSquareMeters = Number(form.squareMeters);
    const parsedPricePerSqM = Number(form.pricePerSqM);
    const parsedUtilities =
      form.status === 'RENTED' ? Number(form.utilitiesAmount || 0) : 0;
    const parsedAdvertising =
      form.status === 'RENTED' ? Number(form.advertisingAmount || 0) : 0;

    if (!form.number.trim()) {
      setError('Укажите номер павильона');
      return;
    }
    if (!Number.isFinite(parsedSquareMeters) || parsedSquareMeters <= 0) {
      setError('Площадь должна быть больше 0');
      return;
    }
    if (!Number.isFinite(parsedPricePerSqM) || parsedPricePerSqM < 0) {
      setError('Цена за м2 должна быть неотрицательной');
      return;
    }
    if (form.status !== 'AVAILABLE' && !form.tenantName.trim()) {
      setError('Укажите арендатора для занятых/предоплаченных павильонов');
      return;
    }
    if (
      !Number.isFinite(parsedUtilities) ||
      !Number.isFinite(parsedAdvertising) ||
      parsedUtilities < 0 ||
      parsedAdvertising < 0
    ) {
      setError('Коммунальные и реклама должны быть неотрицательными');
      return;
    }

    const periodIso = new Date(`${prepaymentMonth}-01`).toISOString();
    const targetPrepayment = prepaymentAmount ? Number(prepaymentAmount) : rentAmount;
    const prepayBank = prepaymentBankTransferPaid
      ? Number(prepaymentBankTransferPaid)
      : 0;
    const prepayCash1 = prepaymentCashbox1Paid ? Number(prepaymentCashbox1Paid) : 0;
    const prepayCash2 = prepaymentCashbox2Paid ? Number(prepaymentCashbox2Paid) : 0;
    const prepayChannelsTotal = prepayBank + prepayCash1 + prepayCash2;

    if (form.status === 'PREPAID') {
      if (targetPrepayment <= 0) {
        setError('Сумма предоплаты должна быть больше 0');
        return;
      }
      if (Math.abs(prepayChannelsTotal - targetPrepayment) > 0.01) {
        setError('Сумма по каналам оплаты должна совпадать с суммой предоплаты');
        return;
      }
    }

    const payload = {
      number: form.number.trim(),
      category: resolvedCategory || null,
      squareMeters: parsedSquareMeters,
      pricePerSqM: parsedPricePerSqM,
      status: form.status,
      prepaidUntil: form.status === 'PREPAID' ? periodIso : null,
      tenantName: form.status === 'AVAILABLE' ? null : form.tenantName.trim(),
      utilitiesAmount:
        form.status === 'RENTED'
          ? parsedUtilities
          : form.status === 'PREPAID'
            ? 0
            : null,
      advertisingAmount:
        form.status === 'RENTED'
          ? parsedAdvertising
          : form.status === 'PREPAID'
            ? 0
            : null,
    };

    try {
      setSaving(true);
      setError(null);
      await updatePavilion(storeId, pavilion.id, payload);
      if (form.status === 'PREPAID') {
        const payments = await apiFetch<any[]>(
          `/stores/${storeId}/pavilions/${pavilion.id}/payments`,
        );
        const selectedPeriodDate = new Date(periodIso);
        const existingForPeriod = payments.find((p) => {
          const pDate = new Date(p.period);
          return (
            pDate.getFullYear() === selectedPeriodDate.getFullYear() &&
            pDate.getMonth() === selectedPeriodDate.getMonth()
          );
        });
        const currentRentPaid = Number(existingForPeriod?.rentPaid ?? 0);
        const rentDelta = targetPrepayment - currentRentPaid;

        if (Math.abs(rentDelta) > 0.0001) {
          await createPavilionPayment(storeId, pavilion.id, {
            period: periodIso,
            rentPaid: rentDelta,
            rentBankTransferPaid: prepayBank > 0 ? prepayBank : undefined,
            rentCashbox1Paid: prepayCash1 > 0 ? prepayCash1 : undefined,
            rentCashbox2Paid: prepayCash2 > 0 ? prepayCash2 : undefined,
            utilitiesPaid: 0,
            advertisingPaid: 0,
          });
        }
      }
      onSaved();
      onClose();
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Не удалось сохранить изменения';
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded bg-white p-6">
        <h2 className="mb-4 text-lg font-bold">Редактировать павильон</h2>

        {error && (
          <div className="mb-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="mb-3">
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Номер павильона
          </label>
          <input
            name="number"
            value={form.number}
            onChange={handleChange}
            className="input"
          />
        </div>

        <div className="mb-3">
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Категория
          </label>
          <input value={resolvedCategory} readOnly className="input bg-gray-50" />
        </div>

        {!newCategory.trim() ? (
          <div className="mb-3">
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Выбор из существующих категорий
            </label>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="input"
            >
              <option value="">Выберите категорию</option>
              {(existingCategories || []).map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <p className="mb-3 text-xs text-gray-500">
            Введите новую категорию: выбор из существующих скрыт.
          </p>
        )}

        {!selectedCategory ? (
          <div className="mb-3">
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Новая категория
            </label>
            <input
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              className="input"
            />
          </div>
        ) : (
          <p className="mb-3 text-xs text-gray-500">
            Выбрана существующая категория: поле новой категории скрыто.
          </p>
        )}

        <div className="mb-3">
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Площадь (м2)
          </label>
          <input
            name="squareMeters"
            type="number"
            min={0}
            step="0.01"
            value={form.squareMeters}
            onChange={handleChange}
            className="input"
          />
        </div>

        <div className="mb-3">
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Цена за м2
          </label>
          <input
            name="pricePerSqM"
            type="number"
            min={0}
            step="0.01"
            value={form.pricePerSqM}
            onChange={handleChange}
            className="input"
          />
        </div>

        <div className="mb-3">
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Аренда (авторасчет)
          </label>
          <input
            type="number"
            value={Number.isFinite(rentAmount) ? rentAmount : 0}
            readOnly
            className="input bg-gray-50"
          />
        </div>

        <div className="mb-3">
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Статус
          </label>
          <select
            name="status"
            value={form.status}
            onChange={handleChange}
            className="input"
          >
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        {form.status !== 'AVAILABLE' && (
          <>
            <div className="mb-3">
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Наименование организации
              </label>
              <input
                name="tenantName"
                value={form.tenantName}
                onChange={handleChange}
                className="input"
              />
            </div>

            <div className="mb-3">
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Аренда (авторасчет)
              </label>
              <input
                type="number"
                value={Number.isFinite(rentAmount) ? rentAmount : 0}
                readOnly
                className="input bg-gray-50"
              />
            </div>

            {form.status === 'RENTED' && (
              <>
                <div className="mb-3">
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Коммунальные
                  </label>
                  <input
                    name="utilitiesAmount"
                    type="number"
                    min={0}
                    step="0.01"
                    value={form.utilitiesAmount}
                    onChange={handleChange}
                    className="input"
                  />
                </div>
                <div className="mb-3">
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Реклама
                  </label>
                  <input
                    name="advertisingAmount"
                    type="number"
                    min={0}
                    step="0.01"
                    value={form.advertisingAmount}
                    onChange={handleChange}
                    className="input"
                  />
                </div>
              </>
            )}

            {form.status === 'PREPAID' && (
              <>
                <div className="mb-3 rounded bg-blue-50 px-3 py-2 text-xs text-blue-700">
                  Для статуса ПРЕДОПЛАТА коммунальные и реклама автоматически равны 0.
                </div>
                <div className="mb-3">
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Месяц предоплаты
                  </label>
                  <input
                    type="month"
                    value={prepaymentMonth}
                    onChange={(e) => setPrepaymentMonth(e.target.value)}
                    className="input"
                  />
                </div>
                <div className="mb-3">
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Сумма предоплаты (если пусто - полная аренда)
                  </label>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={prepaymentAmount}
                    onChange={(e) => setPrepaymentAmount(e.target.value)}
                    className="input"
                    placeholder={rentAmount.toFixed(2)}
                  />
                </div>
                <div className="mb-3 rounded border p-3">
                  <p className="mb-2 text-sm font-medium text-gray-700">
                    Каналы оплаты предоплаты
                  </p>
                  <div className="space-y-2">
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      value={prepaymentBankTransferPaid}
                      onChange={(e) =>
                        setPrepaymentBankTransferPaid(e.target.value)
                      }
                      className="input"
                      placeholder="Безналичные"
                    />
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      value={prepaymentCashbox1Paid}
                      onChange={(e) => setPrepaymentCashbox1Paid(e.target.value)}
                      className="input"
                      placeholder="Наличные - касса 1"
                    />
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      value={prepaymentCashbox2Paid}
                      onChange={(e) => setPrepaymentCashbox2Paid(e.target.value)}
                      className="input"
                      placeholder="Наличные - касса 2"
                    />
                  </div>
                </div>
              </>
            )}
          </>
        )}

        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onClose} className="btn-secondary" disabled={saving}>
            Отмена
          </button>
          <button onClick={handleSave} className="btn-primary" disabled={saving}>
            {saving ? 'Сохранение...' : 'Сохранить'}
          </button>
        </div>
      </div>
    </div>
  );
}
