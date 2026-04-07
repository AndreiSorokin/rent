'use client';

import { useRef, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { createAdditionalCharge, deleteAdditionalCharge, payAdditionalCharge } from '@/lib/additionalCharges';
import { uploadContract, validateContractUploadMeta } from '@/lib/contracts';
import { createPavilionPayment } from '@/lib/payments';
import { updatePavilion } from '@/lib/pavilions';
import {
  formatDateInputDisplay,
  formatDateKey,
  getCurrentMonthKeyInTimeZone,
  getTodayDateKeyInTimeZone,
  normalizeDateInputToDateKey,
} from '@/lib/dateTime';

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
  activeLease?: {
    id: number;
    contracts?: Array<{
      id: number;
      fileName: string;
      filePath: string;
      fileType: string;
      contractNumber?: string | null;
      expiresOn?: string | null;
      uploadedAt: string;
    }>;
  } | null;
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
  canUploadContracts = false,
  timeZone = 'UTC',
  onClose,
  onSaved,
}: {
  storeId: number;
  pavilion: PavilionLike;
  existingCategories?: string[];
  canManageAdditionalCharges?: boolean;
  canUploadContracts?: boolean;
  timeZone?: string;
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
    getCurrentMonthKeyInTimeZone(timeZone),
  );
  const [prepaymentAmount, setPrepaymentAmount] = useState('');
  const [prepaymentBankTransferPaid, setPrepaymentBankTransferPaid] =
    useState('');
  const [prepaymentCashbox1Paid, setPrepaymentCashbox1Paid] = useState('');
  const [prepaymentCashbox2Paid, setPrepaymentCashbox2Paid] = useState('');
  const [contractFile, setContractFile] = useState<File | null>(null);
  const [contractNumber, setContractNumber] = useState('');
  const [contractExpiresOn, setContractExpiresOn] = useState('');
  const [contractExpiresOnTouched, setContractExpiresOnTouched] = useState(false);
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

    if (contractFile) {
      const normalizedExpiresOn = normalizeDateInputToDateKey(contractExpiresOn);
      const validationMessage = validateContractUploadMeta(
        {
          contractNumber,
          expiresOn: normalizedExpiresOn,
        },
        getTodayDateKeyInTimeZone(timeZone),
      );
      if (validationMessage) {
        setErrorAndScrollTop(validationMessage);
        return;
      }
    }

    const periodKey = prepaymentMonth;
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
      prepaidUntil: form.status === 'PREPAID' ? `${periodKey}-01T00:00:00.000Z` : null,
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
      if (contractFile && form.status !== 'AVAILABLE') {
        await uploadContract(storeId, pavilion.id, contractFile, {
          contractNumber,
          expiresOn: normalizeDateInputToDateKey(contractExpiresOn),
        });
        setContractExpiresOnTouched(false);
      }
      if (form.status === 'PREPAID') {
        const payments = await apiFetch<any[]>(
          `/stores/${storeId}/pavilions/${pavilion.id}/payments?period=${encodeURIComponent(
            periodKey,
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
            period: periodKey,
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
      await payAdditionalCharge(
        pavilion.id,
        Number((created as any).id),
        amount,
        { bankTransferPaid: amount, cashbox1Paid: 0, cashbox2Paid: 0 },
      );
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

  const inputClass =
    'w-full rounded-xl border border-[#d8d1cb] bg-[#f8f4ef] px-3 py-2 text-[#111111] outline-none transition placeholder:text-[#6b6b6b] focus:border-[#ff6a13] focus:bg-white focus:ring-2 focus:ring-[#ff6a13]/20';
  const labelClass = 'mb-1 block text-sm font-semibold text-[#111111]';
  const contractExpiresOnInvalid =
    contractExpiresOnTouched &&
    contractExpiresOn.trim().length > 0 &&
    !normalizeDateInputToDateKey(contractExpiresOn);
  const currentContracts = Array.isArray(pavilion.activeLease?.contracts)
    ? pavilion.activeLease?.contracts
    : [];

  const handleModalKeyDown = (
    e: React.KeyboardEvent<HTMLDivElement>,
  ) => {
    if (e.key !== 'Enter' || e.shiftKey || e.nativeEvent.isComposing) return;

    const target = e.target as HTMLElement | null;
    if (!target) return;
    if (target.tagName === 'TEXTAREA' || target.tagName === 'BUTTON') return;

    const action = target.getAttribute('data-enter-action');
    e.preventDefault();

    if (action === 'add-charge') {
      if (!chargeSaving && !saving && canManageAdditionalCharges) {
        void handleAddAdditionalCharge();
      }
      return;
    }

    if (!saving && !chargeSaving) {
      void handleSave();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm">
      <div
        ref={modalBodyRef}
        onKeyDown={handleModalKeyDown}
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-[#d8d1cb] bg-white shadow-[0_20px_60px_-30px_rgba(17,17,17,0.45)]"
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[#e8e1da] bg-white/95 px-6 py-4 backdrop-blur-sm">
          <h2 className="text-lg font-extrabold text-[#111111]">Редактировать павильон</h2>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-500 transition hover:bg-[#f4efeb] hover:text-[#111111]"
            aria-label="Закрыть"
          >
            <span aria-hidden>✕</span>
          </button>
        </div>
        <div className="p-6">

        {error && (
          <div className="mb-3 rounded-xl border border-[#ef4444]/30 bg-[#ef4444]/10 px-3 py-2 text-sm font-medium text-[#b91c1c]">
            {error}
          </div>
        )}

        <div className="mb-3">
          <label className={labelClass}>
            Номер павильона
          </label>
          <input
            name="number"
            value={form.number}
            onChange={handleChange}
            className={inputClass}
          />
        </div>

        <div className="mb-3">
          <label className={labelClass}>
            Категория
          </label>
          <input value={resolvedCategory} readOnly className={`${inputClass} bg-[#ece4dd]`} />
        </div>

        {!newCategory.trim() ? (
          <div className="mb-3">
            <label className={labelClass}>
              Выбор из существующих категорий
            </label>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className={inputClass}
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
            <label className={labelClass}>
              Новая категория
            </label>
            <input
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              className={inputClass}
            />
          </div>
        ) : (
          <p className="mb-3 text-xs text-gray-500">
            Выбрана существующая категория: поле новой категории скрыто.
          </p>
        )}

        <div className="mb-3">
          <label className={labelClass}>
            Площадь (м²)
          </label>
          <input
            name="squareMeters"
            type="number"
            min={0}
            step="0.01"
            value={form.squareMeters}
            onChange={handleChange}
            className={inputClass}
          />
        </div>

        <div className="mb-3">
          <label className={labelClass}>
            Цена за м²
          </label>
          <input
            name="pricePerSqM"
            type="number"
            min={0}
            step="0.01"
            value={form.pricePerSqM}
            onChange={handleChange}
            className={inputClass}
          />
        </div>

        <div className="mb-3">
          <label className={labelClass}>
            Аренда (авторасчет)
          </label>
          <input
            type="number"
            value={Number.isFinite(rentAmount) ? rentAmount : 0}
            readOnly
            className={`${inputClass} bg-[#ece4dd]`}
          />
        </div>

        <div className="mb-3">
          <label className={labelClass}>
            Статус
          </label>
          <select
            name="status"
            value={form.status}
            onChange={handleChange}
            className={inputClass}
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
              <label className={labelClass}>
                Наименование организации
              </label>
              <input
                name="tenantName"
                value={form.tenantName}
                onChange={handleChange}
                className={inputClass}
              />
            </div>

            <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
              <p className="text-sm font-semibold text-amber-800">Договор для этого статуса</p>
              <p className="mt-1 text-sm text-amber-700">
                Для статусов «ЗАНЯТ» и «ПРЕДОПЛАТА» рекомендуется держать загруженный договор.
              </p>
              {currentContracts.length === 0 ? (
                <p className="mt-2 text-xs font-medium text-amber-800">
                  Сейчас договор не загружен.
                </p>
              ) : (
                <p className="mt-2 text-xs text-amber-700">
                  Уже загружено договоров: {currentContracts.length}
                </p>
              )}
              {canUploadContracts ? (
                <div className="mt-3 space-y-3">
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <div>
                      <label className={labelClass}>Номер договора</label>
                      <input
                        type="text"
                        value={contractNumber}
                        onChange={(e) => setContractNumber(e.target.value)}
                        className={inputClass}
                        placeholder="Например: 12/2026"
                      />
                    </div>
                    <div>
                      <label className={labelClass}>Дата окончания договора</label>
                      <input
                        type="text"
                        value={contractExpiresOn}
                        onChange={(e) =>
                          setContractExpiresOn(formatDateInputDisplay(e.target.value))
                        }
                        onBlur={() => {
                          setContractExpiresOnTouched(true);
                          const normalized = normalizeDateInputToDateKey(contractExpiresOn);
                          if (normalized) {
                            setContractExpiresOn(formatDateKey(normalized));
                          }
                        }}
                        className={`${inputClass} ${
                          contractExpiresOnInvalid
                            ? 'border-[#dc2626] focus:border-[#dc2626] focus:ring-[#dc2626]/20'
                            : ''
                        }`}
                        placeholder="дд.мм.гггг"
                        inputMode="numeric"
                      />
                      {contractExpiresOnInvalid && (
                        <p className="mt-1 text-xs text-[#b91c1c]">
                          Введите дату в формате дд.мм.гггг
                        </p>
                      )}
                    </div>
                  </div>
                  <label className={labelClass}>Добавить договор</label>
                  <input
                    type="file"
                    accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.rtf,.jpg,.jpeg,.png"
                    onChange={(e) => setContractFile(e.target.files?.[0] ?? null)}
                    className={inputClass}
                  />
                  <p className="mt-2 text-xs text-[#6b6b6b]">
                    {contractFile
                      ? `Выбран файл: ${contractFile.name}`
                      : 'Можно добавить новый договор сейчас или позже на странице павильона'}
                  </p>
                </div>
              ) : (
                <p className="mt-3 text-xs text-amber-700">
                  У вас нет права на загрузку договоров. При необходимости договор можно добавить позже пользователем с нужным доступом.
                </p>
              )}
            </div>

            {form.status === 'RENTED' && (
              <>
                <div className="mb-3">
                  <label className={labelClass}>
                    Коммунальные
                  </label>
                  <input
                    name="utilitiesAmount"
                    type="number"
                    min={0}
                    step="0.01"
                    value={form.utilitiesAmount}
                    onChange={handleChange}
                    className={inputClass}
                  />
                </div>
                <div className="mb-3">
                  <label className={labelClass}>
                    Реклама
                  </label>
                  <input
                    name="advertisingAmount"
                    type="number"
                    min={0}
                    step="0.01"
                    value={form.advertisingAmount}
                    onChange={handleChange}
                    className={inputClass}
                  />
                </div>
                <div className="mb-3 rounded-xl border border-[#d8d1cb] bg-[#f8f4ef] p-4">
                  <p className="mb-2 text-sm font-semibold text-[#111111]">
                    Дополнительные начисления
                  </p>
                  {additionalCharges.length === 0 ? (
                    <p className="mb-2 text-xs text-gray-500">Начислений пока нет</p>
                  ) : (
                    <div className="mb-3 space-y-2">
                      {additionalCharges.map((charge) => (
                        <div
                          key={charge.id}
                          className="flex flex-col gap-2 rounded-lg border border-[#e8e1da] bg-white px-3 py-2 text-sm sm:flex-row sm:items-center sm:justify-between"
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
                              className="self-start rounded-lg border border-[#ef4444]/40 bg-[#ef4444]/10 px-2 py-1 text-xs font-semibold text-[#b91c1c] transition hover:bg-[#ef4444]/20 disabled:opacity-60 sm:self-auto"
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
                      <div className="mb-1 text-sm font-semibold text-[#111111]">Новое начисление</div>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_140px]">
                      <input
                        value={newChargeName}
                        onChange={(e) => setNewChargeName(e.target.value)}
                        data-enter-action="add-charge"
                        className={inputClass}
                        placeholder="Название начисления"
                      />
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        value={newChargeAmount}
                        onChange={(e) => setNewChargeAmount(e.target.value)}
                        data-enter-action="add-charge"
                        className={inputClass}
                        placeholder="Сумма"
                      />
                      <button
                        type="button"
                        onClick={handleAddAdditionalCharge}
                        disabled={chargeSaving}
                        className="w-full rounded-xl bg-[#ff6a13] px-3 py-2 text-sm font-semibold text-white transition hover:bg-[#e85a0c] disabled:opacity-60 sm:w-auto"
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
                <div className="mb-3 rounded-xl border border-[#ff6a13]/30 bg-[#ff6a13]/10 px-3 py-2 text-xs font-medium text-[#c2410c]">
                  Для статуса ПРЕДОПЛАТА коммунальные и реклама автоматически равны 0.
                </div>
                <div className="mb-3">
                  <label className={labelClass}>
                    Месяц предоплаты
                  </label>
                  <input
                    type="month"
                    value={prepaymentMonth}
                    onChange={(e) => setPrepaymentMonth(e.target.value)}
                    className={inputClass}
                  />
                </div>
                <div className="mb-3">
                  <label className={labelClass}>
                    Сумма предоплаты (если пусто - полная аренда)
                  </label>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={prepaymentAmount}
                    onChange={(e) => setPrepaymentAmount(e.target.value)}
                    className={inputClass}
                    placeholder={rentAmount.toFixed(2)}
                  />
                </div>
                <div className="mb-3 rounded-xl border border-[#d8d1cb] bg-[#f8f4ef] p-3">
                  <p className="mb-2 text-sm font-semibold text-[#111111]">
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
                      className={inputClass}
                      placeholder="Безналичные"
                    />
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      value={prepaymentCashbox1Paid}
                      onChange={(e) => setPrepaymentCashbox1Paid(e.target.value)}
                      className={inputClass}
                      placeholder="Наличные - касса 1"
                    />
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      value={prepaymentCashbox2Paid}
                      onChange={(e) => setPrepaymentCashbox2Paid(e.target.value)}
                      className={inputClass}
                      placeholder="Наличные - касса 2"
                    />
                  </div>
                </div>
              </>
            )}
          </>
        )}

        <div className="mt-4 flex justify-end gap-3 border-t border-[#e8e1da] pt-4">
          <button
            onClick={onClose}
            className="rounded-xl border border-[#d8d1cb] bg-white px-4 py-2 font-semibold text-[#111111] transition hover:bg-[#f8f4ef] disabled:cursor-not-allowed disabled:opacity-60"
            disabled={saving}
          >
            Отмена
          </button>
          <button
            onClick={handleSave}
            className="rounded-xl bg-[#ff6a13] px-4 py-2 font-semibold text-white transition hover:bg-[#e85a0c] disabled:cursor-not-allowed disabled:opacity-60"
            disabled={saving}
          >
            {saving ? 'Сохранение...' : 'Сохранить'}
          </button>
        </div>
        </div>
      </div>
    </div>
  );
}


