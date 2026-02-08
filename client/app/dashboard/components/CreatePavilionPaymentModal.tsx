'use client';

import { useState, useEffect } from 'react';
import { createPavilionPayment } from '@/lib/payments';
import { apiFetch } from '@/lib/api';

export function CreatePavilionPaymentModal({
  storeId,
  pavilionId,
  onClose,
  onSaved,
}: {
  storeId: number;
  pavilionId: number;
  onClose: () => void;
  onSaved: () => void;
}) {
  const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
  const [period, setPeriod] = useState(currentMonth);
  const [rentPaid, setRentPaid] = useState('');
  const [utilitiesPaid, setUtilitiesPaid] = useState('');
  const [currentRentPaid, setCurrentRentPaid] = useState(0);
  const [currentUtilitiesPaid, setCurrentUtilitiesPaid] = useState(0);
  const [loadingCurrent, setLoadingCurrent] = useState(false);

  // Fetch current payment for selected period
  useEffect(() => {
    const fetchCurrentPayment = async () => {
      if (!period) return;

      setLoadingCurrent(true);
      try {
        const periodDate = new Date(`${period}-01`);
        // Предполагаем, что у вас есть эндпоинт для получения платежа за период
        // Если нет — можно использовать /stores/:storeId/pavilions/:pavilionId/payments
        // и фильтровать по периоду на фронте, или добавить новый эндпоинт
        const payments = await apiFetch<any[]>(`/stores/${storeId}/pavilions/${pavilionId}/payments`);

        // Найти платеж за выбранный месяц
        const matchingPayment = payments.find((p: any) => {
          const pDate = new Date(p.period);
          return pDate.getFullYear() === periodDate.getFullYear() &&
                 pDate.getMonth() === periodDate.getMonth();
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
        utilitiesPaid: utilitiesPaid ? Number(utilitiesPaid) : undefined,
      });
      onSaved();
      onClose();
    } catch (err) {
      alert('Ошибка записи платежа');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <h2 className="text-xl font-bold mb-4">Записать платёж</h2>

        <div className="mb-4">
          <label className="block text-sm font-medium mb-1">Период (месяц/год)</label>
          <input
            type="month"
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="w-full px-3 py-2 border rounded-lg"
          />
        </div>

        {loadingCurrent ? (
          <p className="text-sm text-gray-500 mb-4">Загрузка текущих платежей...</p>
        ) : (
          <p className="text-sm text-gray-600 mb-4">
            Текущая оплаченная сумма за месяц: 
            <strong> {currentRentPaid.toFixed(2)}</strong> (аренда) + 
            <strong> {currentUtilitiesPaid.toFixed(2)}</strong> (коммунальные)
          </p>
        )}

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Аренда (добавить)</label>
            <input
              type="number"
              step="0.01"
              value={rentPaid}
              onChange={(e) => setRentPaid(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg"
              placeholder="0.00"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Коммунальные услуги (добавить)</label>
            <input
              type="number"
              step="0.01"
              value={utilitiesPaid}
              onChange={(e) => setUtilitiesPaid(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg"
              placeholder="0.00"
            />
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-5 py-2.5 border rounded-lg hover:bg-gray-100 disabled:opacity-50"
          >
            Отмена
          </button>
          <button
            onClick={handlePay}
            className="px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            Записать платёж
          </button>
        </div>
      </div>
    </div>
  );
}