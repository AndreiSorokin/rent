'use client';

import { useRef, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { createAdditionalCharge, deleteAdditionalCharge } from '@/lib/additionalCharges';
import { createPavilionPayment } from '@/lib/payments';
import { updatePavilion } from '@/lib/pavilions';

const getCurrentMonthLocal = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
};

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
  additionalCharges?: Array<{
    id: number;
    name: string;
    amount: number;
  }>;
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
  canManageAdditionalCharges = false,
  onClose,
  onSaved,
}: {
  storeId: number;
  pavilion: PavilionLike;
  existingCategories?: string[];
  canManageAdditionalCharges?: boolean;
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
    getCurrentMonthLocal(),
  );
  const [prepaymentAmount, setPrepaymentAmount] = useState('');
  const [prepaymentBankTransferPaid, setPrepaymentBankTransferPaid] =
    useState('');
  const [prepaymentCashbox1Paid, setPrepaymentCashbox1Paid] = useState('');
  const [prepaymentCashbox2Paid, setPrepaymentCashbox2Paid] = useState('');
  const [additionalCharges, setAdditionalCharges] = useState<
    Array<{ id: number; name: string; amount: number }>
  >(() => [...(pavilion.additionalCharges || [])]);
  const [newChargeName, setNewChargeName] = useState('');
  const [newChargeAmount, setNewChargeAmount] = useState('');
  const [chargeSaving, setChargeSaving] = useState(false);
  const modalBodyRef = useRef<HTMLDivElement | null>(null);

  const setErrorAndScrollTop = (message: string) => {
    setError(message);
    requestAnimationFrame(() => {
      modalBodyRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
    });
  };

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
      setErrorAndScrollTop('Укажите номер павильона');
      return;
    }
    if (!Number.isFinite(parsedSquareMeters) || parsedSquareMeters <= 0) {
      setErrorAndScrollTop('Площадь должна быть больше 0');
      return;
    }
    if (!Number.isFinite(parsedPricePerSqM) || parsedPricePerSqM < 0) {
      setErrorAndScrollTop('Цена за м² должна быть неотрицательной');
      return;
    }
    if (form.status !== 'AVAILABLE' && !form.tenantName.trim()) {
      setErrorAndScrollTop('Укажите арендатора для занятых/предоплаченных павильонов');
      return;
    }
    if (
      !Number.isFinite(parsedUtilities) ||
      !Number.isFinite(parsedAdvertising) ||
      parsedUtilities < 0 ||
      parsedAdvertising < 0
    ) {
      setErrorAndScrollTop('Коммунальные и реклама должны быть неотрицательными');
      return;
    }

    const periodIso = prepaymentMonth;
    const targetPrepayment = prepaymentAmount ? Number(prepaymentAmount) : rentAmount;
    const prepayBank = prepaymentBankTransferPaid
      ? Number(prepaymentBankTransferPaid)
      : 0;
    const prepayCash1 = prepaymentCashbox1Paid ? Number(prepaymentCashbox1Paid) : 0;
    const prepayCash2 = prepaymentCashbox2Paid ? Number(prepaymentCashbox2Paid) : 0;
    const prepayChannelsTotal = prepayBank + prepayCash1 + prepayCash2;

    if (form.status === 'PREPAID') {
      if (targetPrepayment <= 0) {
        setErrorAndScrollTop('Сумма предоплаты должна быть больше 0');
        return;
      }
      if (Math.abs(prepayChannelsTotal - targetPrepayment) > 0.01) {
        setErrorAndScrollTop('Сумма по каналам оплаты должна совпадать с суммой предоплаты');
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
          `/stores/${storeId}/pavilions/${pavilion.id}/payments?period=${encodeURIComponent(
            periodIso,
          )}`,
        );
        const existingForPeriod = payments[0];
        const currentRentPaid = Number(existingForPeriod?.rentPaid ?? 0);
        const currentRentBank = Number(existingForPeriod?.rentBankTransferPaid ?? 0);
        const currentRentCash1 = Number(existingForPeriod?.rentCashbox1Paid ?? 0);
        const currentRentCash2 = Number(existingForPeriod?.rentCashbox2Paid ?? 0);
                let rentDelta = targetPrepayment - currentRentPaid;
        let rentBankDelta = prepayBank - currentRentBank;
        let rentCash1Delta = prepayCash1 - currentRentCash1;
        let rentCash2Delta = prepayCash2 - currentRentCash2;

        if (
          rentDelta < -0.01 ||
          rentBankDelta < -0.01 ||
          rentCash1Delta < -0.01 ||
          rentCash2Delta < -0.01
        ) {
          if (existingForPeriod?.id) {
            await apiFetch(
              `/stores/${storeId}/pavilions/${pavilion.id}/payments/entries/${existingForPeriod.id}`,
              { method: 'DELETE' },
            );
          }
          rentDelta = targetPrepayment;
          rentBankDelta = prepayBank;
          rentCash1Delta = prepayCash1;
          rentCash2Delta = prepayCash2;
        }

        if (Math.abs(rentDelta) > 0.0001) {
          await createPavilionPayment(storeId, pavilion.id, {
            period: periodIso,
            rentPaid: rentDelta,
            rentBankTransferPaid: rentBankDelta > 0 ? rentBankDelta : undefined,
            rentCashbox1Paid: rentCash1Delta > 0 ? rentCash1Delta : undefined,
            rentCashbox2Paid: rentCash2Delta > 0 ? rentCash2Delta : undefined,
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
      setErrorAndScrollTop(message);
    } finally {
      setSaving(false);
    }
  };

  const handleAddAdditionalCharge = async () => {
    const name = newChargeName.trim();
    const amount = Number(newChargeAmount);

    if (!name || !newChargeAmount) {
      setErrorAndScrollTop('Введите название и сумму дополнительного начисления');
      return;
    }
    if (!Number.isFinite(amount) || amount < 0) {
      setErrorAndScrollTop('Сумма дополнительного начисления должна быть неотрицательной');
      return;
    }

    try {
      setChargeSaving(true);
      setError(null);
      const created = await createAdditionalCharge(pavilion.id, { name, amount });
      setAdditionalCharges((prev) => [...prev, created as any]);
      setNewChargeName('');
      setNewChargeAmount('');
      onSaved();
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : 'Не удалось добавить дополнительное начисление';
      setErrorAndScrollTop(message);
    } finally {
      setChargeSaving(false);
    }
  };

  const handleDeleteAdditionalCharge = async (chargeId: number) => {
    if (!confirm('Удалить это дополнительное начисление?')) return;

    try {
      setChargeSaving(true);
      setError(null);
      await deleteAdditionalCharge(pavilion.id, chargeId);
      setAdditionalCharges((prev) => prev.filter((item) => item.id !== chargeId));
      onSaved();
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : 'Не удалось удалить дополнительное начисление';
      setErrorAndScrollTop(message);
    } finally {
      setChargeSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div
        ref={modalBodyRef}
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded bg-white"
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white px-6 py-4">
          <h2 className="text-lg font-bold">Редактировать павильон</h2>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
            aria-label="Закрыть"
          >
            <span aria-hidden>✕</span>
          </button>
        </div>
        <div className="p-6">

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
            Площадь (м²)
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
            Цена за м²
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
                <div className="mb-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <p className="mb-2 text-sm font-medium text-gray-700">
                    Дополнительные начисления
                  </p>
                  {additionalCharges.length === 0 ? (
                    <p className="mb-2 text-xs text-gray-500">Начислений пока нет</p>
                  ) : (
                    <div className="mb-3 space-y-2">
                      {additionalCharges.map((charge) => (
                        <div
                          key={charge.id}
                          className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm sm:flex-row sm:items-center sm:justify-between"
                        >
                          <div className="min-w-0">
                            <span className="font-medium">{charge.name}: </span>
                            <span className="ml-2 text-gray-600">{charge.amount.toFixed(2)}</span>
                          </div>
                          {canManageAdditionalCharges && (
                            <button
                              type="button"
                              onClick={() => handleDeleteAdditionalCharge(charge.id)}
                              disabled={chargeSaving}
                              className="self-start rounded border border-rose-200 bg-rose-50 px-2 py-1 text-xs font-medium text-rose-700 hover:bg-rose-100 disabled:opacity-60 sm:self-auto"
                            >
                              Удалить
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {canManageAdditionalCharges && (
                    <div>
                      <div>Новое начисление:</div>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_140px]">
                      <input
                        value={newChargeName}
                        onChange={(e) => setNewChargeName(e.target.value)}
                        className="input"
                        placeholder="Название начисления"
                      />
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        value={newChargeAmount}
                        onChange={(e) => setNewChargeAmount(e.target.value)}
                        className="input"
                        placeholder="Сумма"
                      />
                      <button
                        type="button"
                        onClick={handleAddAdditionalCharge}
                        disabled={chargeSaving}
                        className="w-full rounded bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60 sm:w-auto"
                      >
                        Добавить
                      </button>
                    </div>
                    </div>
                  )}
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
    </div>
  );
}


