'use client';

import { useState } from 'react';
import { apiFetch } from '@/lib/api';
import { createPavilionPayment } from '@/lib/payments';
import { getCurrentMonthKeyInTimeZone } from '@/lib/dateTime';
import { useToast } from '@/components/toast/ToastProvider';

type CreatePavilionModalProps = {
  storeId: number;
  timeZone?: string;
  existingCategories: string[];
  onClose: () => void;
  onSaved: () => void;
};

const monthKeyToFirstDayIso = (monthKey: string) => `${monthKey}-01T00:00:00.000Z`;

export function CreatePavilionModal({
  storeId,
  timeZone = 'UTC',
  existingCategories,
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
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    const category = newCategory.trim() || selectedCategory.trim();
    const needsTenant = status === 'RENTED' || status === 'PREPAID';

    if (!number || !squareMeters || !pricePerSqM || !category) {
      toast.error('Заполните все обязательные поля, включая категорию');
      return;
    }

    if (needsTenant && !tenantName.trim()) {
      toast.error('Для статуса "ЗАНЯТ" или "ПРЕДОПЛАТА" укажите наименование организации');
      return;
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
          toast.error('Сумма по каналам оплаты должна совпадать с суммой предоплаты');
          setLoading(false);
          return;
        }
      }

      const pavilion = await apiFetch<{ id: number }>(`/stores/${storeId}/pavilions`, {
        method: 'POST',
        body: JSON.stringify({
          number,
          category,
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
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-[#d8d1cb] bg-white p-6 shadow-[0_20px_60px_-30px_rgba(17,17,17,0.45)]"
      >
        <div className="top-0 z-10 -mx-6 -mt-6 mb-6 flex items-center justify-between border-b border-[#e8e1da] bg-white/95 px-6 py-4 backdrop-blur">
          <h2 className="text-xl font-extrabold text-[#111111]">Создать новый павильон</h2>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            aria-label="Закрыть"
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#d8d1cb] bg-white text-xl leading-none text-[#6b6b6b] transition hover:bg-[#f4efeb] hover:text-[#111111] disabled:opacity-50"
          >
            ×
          </button>
        </div>

        <div className="space-y-5">
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
            <label className={labelClass}>Категория (из существующих)</label>
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
                Введите новую категорию: выбор из существующих скрыт.
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
                Выбрана существующая категория: поле новой категории скрыто.
              </p>
            )}
          </div>

          <div>
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
                placeholder="Например: Иван Петров"
              />
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
                  Сумма предоплаты (если пусто - полная аренда)
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
