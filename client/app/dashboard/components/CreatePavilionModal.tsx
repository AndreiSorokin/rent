'use client';

import { useEffect, useMemo, useState } from 'react';
import { FormattedDateInput } from '@/components/FormattedDateInput';
import { useToast } from '@/components/toast/ToastProvider';
import { apiFetch } from '@/lib/api';
import {
  uploadContract,
  validateContractUploadMeta,
} from '@/lib/contracts';
import {
  getCurrentMonthKeyInTimeZone,
  getTodayDateKeyInTimeZone,
  normalizeDateInputToDateKey,
} from '@/lib/dateTime';
import { createPavilionPayment } from '@/lib/payments';

type CreatePavilionModalProps = {
  storeId: number;
  timeZone?: string;
  existingCategories: string[];
  canUploadContracts?: boolean;
  onClose: () => void;
  onSaved: () => void;
};

const monthKeyToFirstDayIso = (monthKey: string) => `${monthKey}-01T00:00:00.000Z`;

export function CreatePavilionModal({
  storeId,
  timeZone = 'UTC',
  existingCategories,
  canUploadContracts = false,
  onClose,
  onSaved,
}: CreatePavilionModalProps) {
  const toast = useToast();
  const inputClass =
    'w-full rounded-xl border border-[#d8d1cb] bg-[#f8f4ef] px-3 py-2 text-[#111111] outline-none transition placeholder:text-[#6b6b6b] focus:border-[#ff6a13] focus:bg-white focus:ring-2 focus:ring-[#ff6a13]/20';
  const labelClass = 'mb-1 block text-sm font-semibold text-[#111111]';

  const [number, setNumber] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [newCategory, setNewCategory] = useState('');
  const [description, setDescription] = useState('');
  const [squareMeters, setSquareMeters] = useState('');
  const [pricePerSqM, setPricePerSqM] = useState('');
  const [status, setStatus] = useState('AVAILABLE');
  const [tenantName, setTenantName] = useState('');
  const [advertisingAmount, setAdvertisingAmount] = useState('');
  const [prepaymentMonth, setPrepaymentMonth] = useState(
    getCurrentMonthKeyInTimeZone(timeZone),
  );
  const [prepaymentAmount, setPrepaymentAmount] = useState('');
  const [prepaymentBankTransferPaid, setPrepaymentBankTransferPaid] = useState('');
  const [prepaymentCashbox1Paid, setPrepaymentCashbox1Paid] = useState('');
  const [prepaymentCashbox2Paid, setPrepaymentCashbox2Paid] = useState('');
  const [photos, setPhotos] = useState<File[]>([]);
  const [contractFile, setContractFile] = useState<File | null>(null);
  const [contractNumber, setContractNumber] = useState('');
  const [contractExpiresOn, setContractExpiresOn] = useState('');
  const [contractExpiresOnTouched, setContractExpiresOnTouched] = useState(false);
  const [loading, setLoading] = useState(false);

  const contractExpiresOnInvalid =
    contractExpiresOnTouched &&
    contractExpiresOn.trim().length > 0 &&
    !normalizeDateInputToDateKey(contractExpiresOn);

  const previewItems = useMemo(
    () =>
      photos.map((file) => ({
        file,
        url: URL.createObjectURL(file),
      })),
    [photos],
  );

  useEffect(() => {
    return () => {
      previewItems.forEach((item) => URL.revokeObjectURL(item.url));
    };
  }, [previewItems]);

  const handleSubmit = async () => {
    const category = newCategory.trim() || selectedCategory.trim();
    const needsTenant = status === 'RENTED' || status === 'PREPAID';

    if (!number || !squareMeters || !pricePerSqM || !category) {
      toast.error('Заполните все обязательные поля, включая категорию');
      return;
    }

    if (needsTenant && !tenantName.trim()) {
      toast.error(
        'Для статуса «ЗАНЯТ» или «ПРЕДОПЛАТА» укажите наименование организации',
      );
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
        toast.error(validationMessage);
        return;
      }
    }

    setLoading(true);

    try {
      const square = Number(squareMeters);
      const price = Number(pricePerSqM);
      const autoRent = square * price;
      const prepaidPeriodIso = monthKeyToFirstDayIso(prepaymentMonth);
      const prepaymentTarget = prepaymentAmount ? Number(prepaymentAmount) : autoRent;
      const prepayBank = prepaymentBankTransferPaid ? Number(prepaymentBankTransferPaid) : 0;
      const prepayCash1 = prepaymentCashbox1Paid ? Number(prepaymentCashbox1Paid) : 0;
      const prepayCash2 = prepaymentCashbox2Paid ? Number(prepaymentCashbox2Paid) : 0;
      const prepayChannelsTotal = prepayBank + prepayCash1 + prepayCash2;

      if (status === 'PREPAID') {
        if (prepaymentTarget <= 0) {
          toast.error('Сумма предоплаты должна быть больше 0');
          setLoading(false);
          return;
        }

        if (Math.abs(prepayChannelsTotal - prepaymentTarget) > 0.01) {
          toast.error(
            'Сумма по каналам оплаты должна совпадать с суммой предоплаты',
          );
          setLoading(false);
          return;
        }
      }

      const pavilion = await apiFetch<{ id: number }>(`/stores/${storeId}/pavilions`, {
        method: 'POST',
        body: JSON.stringify({
          number,
          category,
          description: description.trim() || undefined,
          squareMeters: square,
          pricePerSqM: price,
          status,
          tenantName: needsTenant ? tenantName.trim() : undefined,
          advertisingAmount:
            status === 'AVAILABLE'
              ? null
              : status === 'PREPAID'
                ? 0
                : advertisingAmount
                  ? Number(advertisingAmount)
                  : 0,
          prepaidUntil: status === 'PREPAID' ? prepaidPeriodIso : undefined,
        }),
      });

      if (status === 'PREPAID') {
        await createPavilionPayment(storeId, pavilion.id, {
          period: prepaymentMonth,
          rentPaid: prepaymentTarget,
          rentBankTransferPaid: prepayBank > 0 ? prepayBank : undefined,
          rentCashbox1Paid: prepayCash1 > 0 ? prepayCash1 : undefined,
          rentCashbox2Paid: prepayCash2 > 0 ? prepayCash2 : undefined,
          utilitiesPaid: 0,
        });
      }

      if (photos.length > 0) {
        const formData = new FormData();
        photos.forEach((photo) => formData.append('files', photo));
        await apiFetch(`/stores/${storeId}/pavilions/${pavilion.id}/media`, {
          method: 'POST',
          body: formData,
        });
      }

      if (contractFile && needsTenant) {
        await uploadContract(storeId, pavilion.id, contractFile, {
          contractNumber,
          expiresOn: normalizeDateInputToDateKey(contractExpiresOn),
        });
        setContractExpiresOnTouched(false);
      }

      toast.success('Павильон успешно создан');
      onSaved();
    } catch (err: any) {
      toast.error(err.message || 'Ошибка создания павильона');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void handleSubmit();
        }}
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-[#d8d1cb] bg-white shadow-[0_20px_60px_-30px_rgba(17,17,17,0.45)]"
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[#e8e1da] bg-white/95 px-6 py-4 backdrop-blur-sm">
          <h2 className="text-lg font-extrabold text-[#111111]">Создать новый павильон</h2>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-500 transition hover:bg-[#f4efeb] hover:text-[#111111]"
            aria-label="Закрыть"
          >
            <span aria-hidden>×</span>
          </button>
        </div>

        <div className="p-6 space-y-5">
          <div>
            <label className={labelClass}>Номер павильона</label>
            <input
              type="text"
              value={number}
              onChange={(e) => setNumber(e.target.value)}
              className={inputClass}
              placeholder="Например: A-12"
            />
          </div>

          <div>
            <label className={labelClass}>Категория из существующих</label>
            {!newCategory.trim() ? (
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className={inputClass}
              >
                <option value="">Не выбрано</option>
                {existingCategories.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            ) : (
              <p className="text-sm text-gray-500">
                Вы вводите новую категорию, поэтому выбор из списка скрыт.
              </p>
            )}
          </div>

          <div>
            <label className={labelClass}>Или введите новую категорию</label>
            {!selectedCategory ? (
              <input
                type="text"
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                className={inputClass}
                placeholder="Например: Одежда"
              />
            ) : (
              <p className="text-sm text-gray-500">
                Выбрана существующая категория, поле новой категории скрыто.
              </p>
            )}
          </div>

          <div>
            <label className={labelClass}>Описание павильона</label>
            <label className={labelClass}>Площадь (м²)</label>
            <input
              type="number"
              step="0.01"
              value={squareMeters}
              onChange={(e) => setSquareMeters(e.target.value)}
              className={inputClass}
              placeholder="25.5"
            />
          </div>

          <div>
            <label className={labelClass}>Цена за м²</label>
            <input
              type="number"
              step="0.01"
              value={pricePerSqM}
              onChange={(e) => setPricePerSqM(e.target.value)}
              className={inputClass}
              placeholder="120.00"
            />
          </div>

          <div>
            <label className={labelClass}>Статус</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className={inputClass}
            >
              <option value="AVAILABLE">СВОБОДЕН</option>
              <option value="RENTED">ЗАНЯТ</option>
              <option value="PREPAID">ПРЕДОПЛАТА</option>
            </select>
          </div>

          {(status === 'RENTED' || status === 'PREPAID') && (
            <div>
              <label className={labelClass}>Наименование организации</label>
              <input
                type="text"
                value={tenantName}
                onChange={(e) => setTenantName(e.target.value)}
                className={inputClass}
                placeholder="Например: ООО Ромашка"
              />
            </div>
          )}

          {(status === 'RENTED' || status === 'PREPAID') && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
              <p className="text-sm font-semibold text-amber-800">Договор для этого статуса</p>
              <p className="mt-1 text-sm text-amber-700">
                Для статусов «ЗАНЯТ» и «ПРЕДОПЛАТА» рекомендуется загрузить договор сразу.
                Если сохранить без договора, павильон позже будет отмечен как требующий внимания.
              </p>
              {canUploadContracts ? (
                <div className="mt-3 space-y-3">
                  <div className="space-y-3">
                    <div className="flex min-h-[92px] flex-col">
                      <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.08em] text-[#6b6b6b]">
                        Номер договора
                      </label>
                      <input
                        type="text"
                        value={contractNumber}
                        onChange={(e) => setContractNumber(e.target.value)}
                        className={inputClass}
                        placeholder="Например: 12/2026"
                      />
                      <div className="mt-1 min-h-[20px]" aria-hidden="true" />
                    </div>
                    <div className="flex min-h-[92px] flex-col">
                      <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.08em] text-[#6b6b6b]">
                        Дата окончания договора
                      </label>
                      <FormattedDateInput
                        value={contractExpiresOn}
                        onChange={setContractExpiresOn}
                        onTouched={() => setContractExpiresOnTouched(true)}
                        className={`${inputClass} ${
                          contractExpiresOnInvalid
                            ? 'border-[#dc2626] focus:border-[#dc2626] focus:ring-[#dc2626]/20'
                            : ''
                        }`}
                        disabled={loading}
                      />
                      <div className="mt-1 min-h-[20px]">
                        {contractExpiresOnInvalid && (
                          <p className="text-xs text-[#b91c1c]">
                            Введите дату в формате дд.мм.гггг
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                  <div>
                    <label className={labelClass}>Файл договора</label>
                    <input
                      type="file"
                      accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.rtf,.jpg,.jpeg,.png"
                      onChange={(e) => setContractFile(e.target.files?.[0] ?? null)}
                      className={inputClass}
                    />
                    <p className="mt-2 text-xs text-[#6b6b6b]">
                      {contractFile
                        ? `Выбран файл: ${contractFile.name}`
                        : 'Файл можно добавить сейчас или позже на странице павильона'}
                    </p>
                  </div>
                </div>
              ) : (
                <p className="mt-3 text-xs text-amber-700">
                  У вас нет права на загрузку договоров. При необходимости договор можно
                  добавить позже пользователем с правом «Загружать договоры».
                </p>
              )}
            </div>
          )}

          {status === 'RENTED' && (
            <div>
              <label className={labelClass}>Реклама</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={advertisingAmount}
                onChange={(e) => setAdvertisingAmount(e.target.value)}
                className={inputClass}
                placeholder="0.00"
              />
            </div>
          )}

          {status === 'PREPAID' && (
            <>
              <div>
                <label className={labelClass}>Месяц предоплаты</label>
                <input
                  type="month"
                  value={prepaymentMonth}
                  onChange={(e) => setPrepaymentMonth(e.target.value)}
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>
                  Сумма предоплаты (если пусто, будет полная аренда)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={prepaymentAmount}
                  onChange={(e) => setPrepaymentAmount(e.target.value)}
                  className={inputClass}
                  placeholder="Например: 1200"
                />
              </div>
              <div className="rounded-xl border border-[#d8d1cb] bg-[#f8f4ef] p-3">
                <p className="mb-2 text-sm font-semibold text-[#111111]">
                  Каналы оплаты предоплаты
                </p>
                <div className="space-y-2">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={prepaymentBankTransferPaid}
                    onChange={(e) => setPrepaymentBankTransferPaid(e.target.value)}
                    className={inputClass}
                    placeholder="Безналичные"
                  />
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={prepaymentCashbox1Paid}
                    onChange={(e) => setPrepaymentCashbox1Paid(e.target.value)}
                    className={inputClass}
                    placeholder="Наличные - касса 1"
                  />
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={prepaymentCashbox2Paid}
                    onChange={(e) => setPrepaymentCashbox2Paid(e.target.value)}
                    className={inputClass}
                    placeholder="Наличные - касса 2"
                  />
                </div>
              </div>
            </>
          )}

          <div className="rounded-xl border border-[#d8d1cb] bg-[#f8f4ef] p-3">
            <p className="mb-2 text-sm font-semibold text-[#111111]">Описание и фото павильона</p>

            <div className="mb-3">
              <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.08em] text-[#6b6b6b]">
                Описание
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className={inputClass}
                placeholder="Добавьте описание павильона для арендаторов"
              />
              <p className="mt-2 text-xs text-[#6b6b6b]">
                Описание можно оставить пустым и заполнить позже.
              </p>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.08em] text-[#6b6b6b]">
                Фото
              </label>
              <div className="mb-3 flex h-32 items-center justify-center rounded-2xl border border-dashed border-[#d8d1cb] bg-white text-sm text-[#6b6b6b]">
                Фото появятся после сохранения павильона
              </div>

              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                multiple
                onChange={(e) => setPhotos(Array.from(e.target.files || []))}
                className={inputClass}
              />
              {previewItems.length > 0 && (
                <div className="mt-3 grid grid-cols-3 gap-2">
                  {previewItems.map((item, index) => (
                    <div
                      key={`${item.file.name}-${index}`}
                      className="overflow-hidden rounded-xl border border-[#d8d1cb] bg-white"
                    >
                      <img
                        src={item.url}
                        alt={item.file.name}
                        className="h-16 w-full object-cover"
                      />
                      <div className="px-2 py-1.5 text-[10px] text-[#6b6b6b]">
                        <div className="truncate">{item.file.name}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <div className="mt-2 text-xs text-[#6b6b6b]">
                {photos.length > 0
                  ? `Выбрано файлов: ${photos.length}`
                  : 'Можно добавить JPG, PNG и WEBP до 10 МБ.'}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-8 flex justify-end gap-3 border-t border-[#e8e1da] pt-4">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="rounded-xl border border-[#d8d1cb] bg-white px-5 py-2.5 font-semibold text-[#111111] transition hover:bg-[#f4efeb] disabled:opacity-50"
          >
            Отмена
          </button>
          <button
            type="submit"
            disabled={loading}
            className="rounded-xl bg-[#ff6a13] px-5 py-2.5 font-semibold text-white transition hover:bg-[#e85a0c] disabled:opacity-50"
          >
            {loading ? 'Создание...' : 'Создать павильон'}
          </button>
        </div>
      </form>
    </div>
  );
}
