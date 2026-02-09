'use client';

import { useState, useEffect } from 'react';
import { createPavilionPayment } from '@/lib/payments';
import { apiFetch } from '@/lib/api';

export function CreatePavilionPaymentModal({
  storeId,
  pavilionId,
  pavilionStatus,
  onClose,
  onSaved,
}: {
  storeId: number;
  pavilionId: number;
  pavilionStatus?: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const currentMonth = new Date().toISOString().slice(0, 7);
  const [period, setPeriod] = useState(currentMonth);
  const [rentPaid, setRentPaid] = useState('');
  const [utilitiesPaid, setUtilitiesPaid] = useState('');
  const [currentRentPaid, setCurrentRentPaid] = useState(0);
  const [currentUtilitiesPaid, setCurrentUtilitiesPaid] = useState(0);
  const [loadingCurrent, setLoadingCurrent] = useState(false);

  useEffect(() => {
    const fetchCurrentPayment = async () => {
      if (!period) return;

      setLoadingCurrent(true);
      try {
        const periodDate = new Date(`${period}-01`);
        const payments = await apiFetch<any[]>(`/stores/${storeId}/pavilions/${pavilionId}/payments`);

        const matchingPayment = payments.find((p: any) => {
          const pDate = new Date(p.period);
          return pDate.getFullYear() === periodDate.getFullYear() && pDate.getMonth() === periodDate.getMonth();
        });

        if (matchingPayment) {
          setCurrentRentPaid(matchingPayment.rentPaid || 0);
          setCurrentUtilitiesPaid(matchingPayment.utilitiesPaid || 0);
        } else {
          setCurrentRentPaid(0);
          setCurrentUtilitiesPaid(0);
        }
      } catch (err) {
        console.error('Ошибка загрузки текущих платежей', err);
        setCurrentRentPaid(0);
        setCurrentUtilitiesPaid(0);
      } finally {
        setLoadingCurrent(false);
      }
    };

    fetchCurrentPayment();
  }, [period, storeId, pavilionId]);

  const handlePay = async () => {
    if (!period) {
      alert('Выберите период');
      return;
    }

    const periodDate = new Date(`${period}-01`);

    try {
      await createPavilionPayment(storeId, pavilionId, {
        period: periodDate.toISOString(),
        rentPaid: rentPaid ? Number(rentPaid) : undefined,
        utilitiesPaid:
          pavilionStatus === 'PREPAID'
            ? 0
            : (utilitiesPaid ? Number(utilitiesPaid) : undefined),
      });
      onSaved();
      onClose();
    } catch (err) {
      alert('Ошибка записи платежа');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-lg bg-white p-6">
        <h2 className="mb-4 text-xl font-bold">Записать платеж</h2>

        <div className="mb-4">
          <label className="mb-1 block text-sm font-medium">Период (месяц/год)</label>
          <input
            type="month"
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="w-full rounded-lg border px-3 py-2"
          />
        </div>

        {loadingCurrent ? (
          <p className="mb-4 text-sm text-gray-500">Загрузка текущих платежей...</p>
        ) : (
          <p className="mb-4 text-sm text-gray-600">
            Текущая оплаченная сумма за месяц:
            <strong> {currentRentPaid.toFixed(2)} ?</strong> (аренда) +
            <strong> {currentUtilitiesPaid.toFixed(2)} ?</strong> (коммунальные)
          </p>
        )}

        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium">Аренда (добавить)</label>
            <input
              type="number"
              step="0.01"
              value={rentPaid}
              onChange={(e) => setRentPaid(e.target.value)}
              className="w-full rounded-lg border px-3 py-2"
              placeholder="0.00"
            />
          </div>

          {pavilionStatus === 'PREPAID' ? (
            <p className="text-sm text-amber-700">
              Для статуса ПРЕДОПЛАТА доступна только оплата аренды за первый месяц.
            </p>
          ) : (
            <div>
              <label className="mb-1 block text-sm font-medium">Коммунальные услуги (добавить)</label>
              <input
                type="number"
                step="0.01"
                value={utilitiesPaid}
                onChange={(e) => setUtilitiesPaid(e.target.value)}
                className="w-full rounded-lg border px-3 py-2"
                placeholder="0.00"
              />
            </div>
          )}
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button onClick={onClose} className="rounded-lg border px-5 py-2.5 hover:bg-gray-100">
            Отмена
          </button>
          <button
            onClick={handlePay}
            className="rounded-lg bg-blue-600 px-5 py-2.5 text-white hover:bg-blue-700"
          >
            Записать платеж
          </button>
        </div>
      </div>
    </div>
  );
}

