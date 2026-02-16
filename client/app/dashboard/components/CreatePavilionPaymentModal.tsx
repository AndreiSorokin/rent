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
  const [rentBankTransferPaid, setRentBankTransferPaid] = useState('');
  const [rentCashbox1Paid, setRentCashbox1Paid] = useState('');
  const [rentCashbox2Paid, setRentCashbox2Paid] = useState('');
  const [utilitiesBankTransferPaid, setUtilitiesBankTransferPaid] = useState('');
  const [utilitiesCashbox1Paid, setUtilitiesCashbox1Paid] = useState('');
  const [utilitiesCashbox2Paid, setUtilitiesCashbox2Paid] = useState('');
  const [advertisingBankTransferPaid, setAdvertisingBankTransferPaid] = useState('');
  const [advertisingCashbox1Paid, setAdvertisingCashbox1Paid] = useState('');
  const [advertisingCashbox2Paid, setAdvertisingCashbox2Paid] = useState('');
  const [currentRentPaid, setCurrentRentPaid] = useState(0);
  const [currentUtilitiesPaid, setCurrentUtilitiesPaid] = useState(0);
  const [currentAdvertisingPaid, setCurrentAdvertisingPaid] = useState(0);
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
          setCurrentAdvertisingPaid(matchingPayment.advertisingPaid || 0);
        } else {
          setCurrentRentPaid(0);
          setCurrentUtilitiesPaid(0);
          setCurrentAdvertisingPaid(0);
        }
      } catch (err) {
        console.error('Ошибка загрузки текущих платежей', err);
        setCurrentRentPaid(0);
        setCurrentUtilitiesPaid(0);
        setCurrentAdvertisingPaid(0);
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
    const rentBank = rentBankTransferPaid ? Number(rentBankTransferPaid) : 0;
    const rentCash1 = rentCashbox1Paid ? Number(rentCashbox1Paid) : 0;
    const rentCash2 = rentCashbox2Paid ? Number(rentCashbox2Paid) : 0;
    const utilitiesBank = utilitiesBankTransferPaid ? Number(utilitiesBankTransferPaid) : 0;
    const utilitiesCash1 = utilitiesCashbox1Paid ? Number(utilitiesCashbox1Paid) : 0;
    const utilitiesCash2 = utilitiesCashbox2Paid ? Number(utilitiesCashbox2Paid) : 0;
    const advertisingBank = advertisingBankTransferPaid ? Number(advertisingBankTransferPaid) : 0;
    const advertisingCash1 = advertisingCashbox1Paid ? Number(advertisingCashbox1Paid) : 0;
    const advertisingCash2 = advertisingCashbox2Paid ? Number(advertisingCashbox2Paid) : 0;
    const rentTotal = rentBank + rentCash1 + rentCash2;
    const utilitiesTotal = utilitiesBank + utilitiesCash1 + utilitiesCash2;
    const advertisingTotal = advertisingBank + advertisingCash1 + advertisingCash2;

    if (rentTotal <= 0 && utilitiesTotal <= 0 && advertisingTotal <= 0) {
      alert('Введите сумму хотя бы в один канал оплаты, коммунальные или рекламу');
      return;
    }

    try {
      await createPavilionPayment(storeId, pavilionId, {
        period: periodDate.toISOString(),
        rentPaid: rentTotal > 0 ? rentTotal : undefined,
        rentBankTransferPaid: rentBank > 0 ? rentBank : undefined,
        rentCashbox1Paid: rentCash1 > 0 ? rentCash1 : undefined,
        rentCashbox2Paid: rentCash2 > 0 ? rentCash2 : undefined,
        utilitiesPaid:
          pavilionStatus === 'PREPAID'
            ? 0
            : (utilitiesTotal > 0 ? utilitiesTotal : undefined),
        utilitiesBankTransferPaid:
          pavilionStatus === 'PREPAID'
            ? undefined
            : (utilitiesBank > 0 ? utilitiesBank : undefined),
        utilitiesCashbox1Paid:
          pavilionStatus === 'PREPAID'
            ? undefined
            : (utilitiesCash1 > 0 ? utilitiesCash1 : undefined),
        utilitiesCashbox2Paid:
          pavilionStatus === 'PREPAID'
            ? undefined
            : (utilitiesCash2 > 0 ? utilitiesCash2 : undefined),
        advertisingPaid:
          pavilionStatus === 'PREPAID'
            ? 0
            : (advertisingTotal > 0 ? advertisingTotal : undefined),
        advertisingBankTransferPaid:
          pavilionStatus === 'PREPAID'
            ? undefined
            : (advertisingBank > 0 ? advertisingBank : undefined),
        advertisingCashbox1Paid:
          pavilionStatus === 'PREPAID'
            ? undefined
            : (advertisingCash1 > 0 ? advertisingCash1 : undefined),
        advertisingCashbox2Paid:
          pavilionStatus === 'PREPAID'
            ? undefined
            : (advertisingCash2 > 0 ? advertisingCash2 : undefined),
      });
      onSaved();
      onClose();
    } catch (err) {
      alert('Ошибка записи платежа');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-4xl overflow-hidden rounded-lg bg-white shadow-xl">
        <div className="border-b p-4 md:p-6">
          <h2 className="text-xl font-bold">Записать платеж</h2>
        </div>

        <div className="max-h-[72vh] space-y-4 overflow-y-auto p-4 md:p-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium">Период (месяц/год)</label>
              <input
                type="month"
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
                className="w-full rounded-lg border px-3 py-2"
              />
            </div>
            <div className="rounded-lg border bg-gray-50 p-3 text-sm text-gray-600">
              {loadingCurrent ? (
                'Загрузка текущих платежей...'
              ) : (
                <>
                  Текущая оплаченная сумма за месяц:
                  <strong> {currentRentPaid.toFixed(2)}</strong> (аренда) +
                  <strong> {currentUtilitiesPaid.toFixed(2)}</strong> (коммунальные) +
                  <strong> {currentAdvertisingPaid.toFixed(2)}</strong> (реклама)
                </>
              )}
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <div className="rounded-lg border p-3">
              <h3 className="mb-2 text-sm font-semibold">Аренда</h3>
              <div className="space-y-2">
                <div>
                  <label className="mb-1 block text-xs text-gray-600">Безналичный</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={rentBankTransferPaid}
                    onChange={(e) => setRentBankTransferPaid(e.target.value)}
                    className="w-full rounded-lg border px-3 py-2"
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-gray-600">Наличные - касса 1</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={rentCashbox1Paid}
                    onChange={(e) => setRentCashbox1Paid(e.target.value)}
                    className="w-full rounded-lg border px-3 py-2"
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-gray-600">Наличные - касса 2</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={rentCashbox2Paid}
                    onChange={(e) => setRentCashbox2Paid(e.target.value)}
                    className="w-full rounded-lg border px-3 py-2"
                    placeholder="0.00"
                  />
                </div>
              </div>
            </div>

            {pavilionStatus === 'PREPAID' ? (
              <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 lg:col-span-2">
                Для статуса ПРЕДОПЛАТА доступна только оплата аренды за первый месяц.
              </div>
            ) : (
              <>
                <div className="rounded-lg border p-3">
                  <h3 className="mb-2 text-sm font-semibold">Коммунальные</h3>
                  <div className="space-y-2">
                    <div>
                      <label className="mb-1 block text-xs text-gray-600">Безналичный</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={utilitiesBankTransferPaid}
                        onChange={(e) => setUtilitiesBankTransferPaid(e.target.value)}
                        className="w-full rounded-lg border px-3 py-2"
                        placeholder="0.00"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-gray-600">Наличные - касса 1</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={utilitiesCashbox1Paid}
                        onChange={(e) => setUtilitiesCashbox1Paid(e.target.value)}
                        className="w-full rounded-lg border px-3 py-2"
                        placeholder="0.00"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-gray-600">Наличные - касса 2</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={utilitiesCashbox2Paid}
                        onChange={(e) => setUtilitiesCashbox2Paid(e.target.value)}
                        className="w-full rounded-lg border px-3 py-2"
                        placeholder="0.00"
                      />
                    </div>
                  </div>
                </div>

                <div className="rounded-lg border p-3">
                  <h3 className="mb-2 text-sm font-semibold">Реклама</h3>
                  <div className="space-y-2">
                    <div>
                      <label className="mb-1 block text-xs text-gray-600">Безналичный</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={advertisingBankTransferPaid}
                        onChange={(e) => setAdvertisingBankTransferPaid(e.target.value)}
                        className="w-full rounded-lg border px-3 py-2"
                        placeholder="0.00"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-gray-600">Наличные - касса 1</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={advertisingCashbox1Paid}
                        onChange={(e) => setAdvertisingCashbox1Paid(e.target.value)}
                        className="w-full rounded-lg border px-3 py-2"
                        placeholder="0.00"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-gray-600">Наличные - касса 2</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={advertisingCashbox2Paid}
                        onChange={(e) => setAdvertisingCashbox2Paid(e.target.value)}
                        className="w-full rounded-lg border px-3 py-2"
                        placeholder="0.00"
                      />
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-3 border-t bg-white p-4 md:p-6">
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

