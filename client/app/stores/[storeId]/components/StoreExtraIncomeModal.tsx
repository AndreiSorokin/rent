'use client';

import { useEffect, useMemo, useState } from 'react';
import { formatMoney } from '@/lib/currency';
import {
  createStoreExtraIncome,
  deleteStoreExtraIncome,
  listStoreExtraIncome,
} from '@/lib/storeExtraIncome';

type Props = {
  storeId: number;
  currency: 'RUB' | 'KZT';
  isOpen: boolean;
  canCreate: boolean;
  canDelete: boolean;
  defaultPaidAtDate?: string;
  onClose: () => void;
  onChanged?: () => Promise<void> | void;
};

function getCurrentMonthValue() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

export function StoreExtraIncomeModal({
  storeId,
  currency,
  isOpen,
  canCreate,
  canDelete,
  defaultPaidAtDate,
  onClose,
  onChanged,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [items, setItems] = useState<any[]>([]);
  const [period, setPeriod] = useState(getCurrentMonthValue());
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [bank, setBank] = useState('');
  const [cash1, setCash1] = useState('');
  const [cash2, setCash2] = useState('');
  const [paidAtDate, setPaidAtDate] = useState(
    new Date().toISOString().slice(0, 10),
  );

  const total = useMemo(
    () => items.reduce((sum, item) => sum + Number(item.amount ?? 0), 0),
    [items],
  );

  const load = async () => {
    if (!storeId) return;
    try {
      setLoading(true);
      const data = await listStoreExtraIncome(storeId, period);
      setItems(data || []);
    } catch (err) {
      console.error(err);
      alert('Не удалось загрузить доп. приход');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    if (defaultPaidAtDate) {
      setPaidAtDate(defaultPaidAtDate);
    }
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, period, storeId, defaultPaidAtDate]);

  const handleCreate = async () => {
    const cleanName = name.trim();
    const parsedAmount = Number(amount || 0);
    const parsedBank = Number(bank || 0);
    const parsedCash1 = Number(cash1 || 0);
    const parsedCash2 = Number(cash2 || 0);

    if (!cleanName) {
      alert('Введите название доп. прихода');
      return;
    }
    if (
      [parsedAmount, parsedBank, parsedCash1, parsedCash2].some(
        (value) => Number.isNaN(value) || value < 0,
      )
    ) {
      alert('Суммы должны быть неотрицательными');
      return;
    }
    if (Math.abs(parsedAmount - (parsedBank + parsedCash1 + parsedCash2)) > 0.01) {
      alert('Сумма должна быть равна сумме по каналам оплаты');
      return;
    }

    try {
      setSaving(true);
      await createStoreExtraIncome(storeId, {
        name: cleanName,
        amount: parsedAmount,
        bankTransferPaid: parsedBank,
        cashbox1Paid: parsedCash1,
        cashbox2Paid: parsedCash2,
        period,
        paidAt: paidAtDate,
      });
      setName('');
      setAmount('');
      setBank('');
      setCash1('');
      setCash2('');
      await load();
      if (onChanged) await onChanged();
    } catch (err) {
      console.error(err);
      alert('Не удалось добавить доп. приход');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (incomeId: number) => {
    if (!confirm('Удалить этот доп. приход?')) return;
    try {
      await deleteStoreExtraIncome(storeId, incomeId);
      await load();
      if (onChanged) await onChanged();
    } catch (err) {
      console.error(err);
      alert('Не удалось удалить доп. приход');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-xl bg-white p-5 shadow-xl">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Доп приход (объект)</h2>
            <p className="text-sm text-slate-600">
              Уровень объекта. Учитывается в СВОДКЕ и бух. таблице.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50"
          >
            Закрыть
          </button>
        </div>

        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
          <label className="text-sm text-slate-600" htmlFor="extra-income-period">
            Месяц:
          </label>
          <input
            id="extra-income-period"
            type="month"
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="rounded border border-slate-300 px-2 py-1.5 text-sm"
          />
          <div className="text-sm font-medium text-slate-800">
            Итого за месяц: {formatMoney(total, currency)}
          </div>
        </div>

        {canCreate && (
          <div className="mb-4 rounded-lg border border-indigo-100 bg-indigo-50/50 p-3">
            <p className="mb-2 text-sm font-semibold text-indigo-900">Новый доп. приход</p>
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="rounded border border-indigo-200 px-2 py-1.5 text-sm"
                placeholder="Название"
              />
              <input
                type="date"
                value={paidAtDate}
                onChange={(e) => setPaidAtDate(e.target.value)}
                className="rounded border border-indigo-200 px-2 py-1.5 text-sm"
              />
              <input
                type="number"
                step="0.01"
                min="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="rounded border border-indigo-200 px-2 py-1.5 text-sm"
                placeholder="Сумма"
              />
              <input
                type="number"
                step="0.01"
                min="0"
                value={bank}
                onChange={(e) => setBank(e.target.value)}
                className="rounded border border-indigo-200 px-2 py-1.5 text-sm"
                placeholder="Безналичные"
              />
              <input
                type="number"
                step="0.01"
                min="0"
                value={cash1}
                onChange={(e) => setCash1(e.target.value)}
                className="rounded border border-indigo-200 px-2 py-1.5 text-sm"
                placeholder="Наличные касса 1"
              />
              <input
                type="number"
                step="0.01"
                min="0"
                value={cash2}
                onChange={(e) => setCash2(e.target.value)}
                className="rounded border border-indigo-200 px-2 py-1.5 text-sm md:col-span-2"
                placeholder="Наличные касса 2"
              />
            </div>
            <button
              type="button"
              onClick={handleCreate}
              disabled={saving}
              className="mt-2 rounded bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
            >
              Добавить
            </button>
          </div>
        )}

        <div>
          <p className="mb-2 text-sm font-semibold text-slate-800">История</p>
          {loading ? (
            <p className="text-sm text-slate-600">Загрузка...</p>
          ) : items.length === 0 ? (
            <p className="text-sm text-slate-600">Записей нет</p>
          ) : (
            <div className="space-y-2">
              {items.map((item) => (
                <div key={item.id} className="rounded border border-slate-200 bg-white p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <div className="font-medium text-slate-900">{item.name}</div>
                      <div className="text-xs text-slate-500">
                        {new Date(item.paidAt).toLocaleDateString('ru-RU')}
                      </div>
                    </div>
                    <div className="text-sm font-semibold text-slate-900">
                      {formatMoney(Number(item.amount ?? 0), currency)}
                    </div>
                  </div>
                  <div className="mt-1 text-xs text-slate-600">
                    Безнал: {formatMoney(Number(item.bankTransferPaid ?? 0), currency)} | Касса 1:{' '}
                    {formatMoney(Number(item.cashbox1Paid ?? 0), currency)} | Касса 2:{' '}
                    {formatMoney(Number(item.cashbox2Paid ?? 0), currency)}
                  </div>
                  {canDelete && (
                    <div className="mt-2 text-right">
                      <button
                        type="button"
                        onClick={() => handleDelete(item.id)}
                        className="text-sm text-red-600 hover:underline"
                      >
                        Удалить
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
