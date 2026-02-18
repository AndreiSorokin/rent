'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { AddAdditionalChargeModal } from '@/app/dashboard/components/AddAdditionalChargeModal';
import { CreateDiscountModal } from '@/app/dashboard/components/CreateDiscountModal';
import { CreatePavilionPaymentModal } from '@/app/dashboard/components/CreatePavilionPaymentModal';
import { EditPavilionModal } from '@/app/dashboard/components/EditPavilionModal';
import { PayAdditionalChargeModal } from '@/app/dashboard/components/PayAdditionalChargeModal';
import { apiFetch } from '@/lib/api';
import { deleteAdditionalCharge } from '@/lib/additionalCharges';
import { deletePavilionDiscount } from '@/lib/discounts';
import { hasPermission } from '@/lib/permissions';
import { getPavilion, updatePavilion } from '@/lib/pavilions';
import { createPavilionPayment, deletePavilionPaymentEntry } from '@/lib/payments';
import { formatMoney, getCurrencySymbol } from '@/lib/currency';
import { deleteContract, uploadContract } from '@/lib/contracts';
import { Discount, Pavilion } from './pavilion.types';

export default function PavilionPage() {
  const { storeId, pavilionId } = useParams();
  const storeIdNum = Number(storeId);
  const pavilionIdNum = Number(pavilionId);
  const router = useRouter();

  const [pavilion, setPavilion] = useState<Pavilion | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [existingCategories, setExistingCategories] = useState<string[]>([]);
  const [expandedCharges, setExpandedCharges] = useState<Set<number>>(new Set());

  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showAddChargeModal, setShowAddChargeModal] = useState(false);
  const [showDiscountModal, setShowDiscountModal] = useState(false);
  const [showPrepaymentModal, setShowPrepaymentModal] = useState(false);
  const [editingPavilion, setEditingPavilion] = useState<Pavilion | null>(null);
  const [payingCharge, setPayingCharge] = useState<{
    pavilionId: number;
    chargeId: number;
    name: string;
    amount: number;
  } | null>(null);
  const [prepaymentMonth, setPrepaymentMonth] = useState(
    new Date().toISOString().slice(0, 7),
  );
  const [prepaymentAmount, setPrepaymentAmount] = useState('');
  const [prepaymentBankTransferPaid, setPrepaymentBankTransferPaid] = useState('');
  const [prepaymentCashbox1Paid, setPrepaymentCashbox1Paid] = useState('');
  const [prepaymentCashbox2Paid, setPrepaymentCashbox2Paid] = useState('');
  const [uploadingContract, setUploadingContract] = useState(false);
  const [permissions, setPermissions] = useState<string[]>([]);

  const statusLabel: Record<string, string> = {
    AVAILABLE: 'СВОБОДЕН',
    RENTED: 'ЗАНЯТ',
    PREPAID: 'ПРЕДОПЛАТА',
  };

  const fetchPavilion = async () => {
    try {
      const [data, storeData] = await Promise.all([
        getPavilion<Pavilion>(storeIdNum, pavilionIdNum),
        apiFetch<{ permissions?: string[]; pavilions?: Array<{ category?: string | null }> }>(
          `/stores/${storeIdNum}`,
        ),
      ]);
      setPavilion(data);
      setPermissions(storeData.permissions || []);
      const categories = Array.from(
        new Set(
          (storeData.pavilions || [])
            .map((p) => (p.category || '').trim())
            .filter((c) => c.length > 0),
        ),
      ).sort((a, b) => a.localeCompare(b));
      setExistingCategories(categories);
    } catch (err) {
      setError('Не удалось загрузить павильон');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (storeIdNum && pavilionIdNum) {
      fetchPavilion();
    }
  }, [storeIdNum, pavilionIdNum]);

  const handleActionSuccess = () => {
    fetchPavilion();
  };

  const handleDeletePavilion = async () => {
    if (!confirm('Удалить этот павильон?')) return;

    try {
      await apiFetch(`/stores/${storeIdNum}/pavilions/${pavilionIdNum}`, {
        method: 'DELETE',
      });
      router.push(`/stores/${storeIdNum}`);
    } catch (err: any) {
      setError(err.message || 'Не удалось удалить павильон');
    }
  };

  const handleDeleteCharge = async (chargeId: number) => {
    if (!confirm('Удалить это начисление?')) return;

    try {
      await deleteAdditionalCharge(pavilionIdNum, chargeId);
      handleActionSuccess();
    } catch (err) {
      console.error(err);
      alert('Не удалось удалить начисление');
    }
  };

  const handleDeleteChargePayment = async (chargeId: number, paymentId: number) => {
    if (!confirm('Удалить этот платеж начисления?')) return;

    await apiFetch(
      `/pavilions/${pavilionIdNum}/additional-charges/${chargeId}/payments/${paymentId}`,
      { method: 'DELETE' },
    );
    handleActionSuccess();
  };

  const handleDeleteDiscount = async (discountId: number) => {
    if (!confirm('Удалить эту скидку?')) return;

    try {
      await deletePavilionDiscount(storeIdNum, pavilionIdNum, discountId);
      handleActionSuccess();
    } catch (err) {
      console.error(err);
      alert('Не удалось удалить скидку');
    }
  };

  const handleContractUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploadingContract(true);
      await uploadContract(storeIdNum, pavilionIdNum, file);
      handleActionSuccess();
    } catch (err) {
      console.error(err);
      alert('Не удалось загрузить документ');
    } finally {
      setUploadingContract(false);
      e.target.value = '';
    }
  };

  const handleDeleteContract = async (contractId: number) => {
    if (!confirm('Удалить этот документ?')) return;

    try {
      await deleteContract(storeIdNum, pavilionIdNum, contractId);
      handleActionSuccess();
    } catch (err) {
      console.error(err);
      alert('Не удалось удалить документ');
    }
  };


  const handleDeletePaymentEntry = async (entryId: number) => {
    if (!confirm('Удалить этот платеж?')) return;

    try {
      await deletePavilionPaymentEntry(storeIdNum, pavilionIdNum, entryId);
      handleActionSuccess();
    } catch (err) {
      console.error(err);
      alert('Не удалось удалить платеж');
    }
  };


  const handleSetPrepayment = async () => {
    if (!pavilion) return;

    const periodIso = new Date(`${prepaymentMonth}-01`).toISOString();
    const defaultAmount = pavilion.squareMeters * pavilion.pricePerSqM;
    const targetRentPaid = prepaymentAmount ? Number(prepaymentAmount) : defaultAmount;
    const bank = prepaymentBankTransferPaid ? Number(prepaymentBankTransferPaid) : 0;
    const cash1 = prepaymentCashbox1Paid ? Number(prepaymentCashbox1Paid) : 0;
    const cash2 = prepaymentCashbox2Paid ? Number(prepaymentCashbox2Paid) : 0;
    const channelsTotal = bank + cash1 + cash2;

    if (targetRentPaid <= 0) {
      alert('Сумма предоплаты должна быть больше 0');
      return;
    }
    if (Math.abs(channelsTotal - targetRentPaid) > 0.01) {
      alert('Сумма по каналам оплаты должна совпадать с суммой предоплаты');
      return;
    }

    try {
      const payments = await apiFetch<any[]>(
        `/stores/${storeIdNum}/pavilions/${pavilionIdNum}/payments`,
      );
      const periodDate = new Date(periodIso);
      const existingForPeriod = payments.find((p: any) => {
        const pDate = new Date(p.period);
        return (
          pDate.getFullYear() === periodDate.getFullYear() &&
          pDate.getMonth() === periodDate.getMonth()
        );
      });

      const currentRentPaid = Number(existingForPeriod?.rentPaid ?? 0);
      const rentDelta = targetRentPaid - currentRentPaid;

      await updatePavilion(storeIdNum, pavilionIdNum, {
        status: 'PREPAID',
        prepaidUntil: periodIso,
      });

      if (rentDelta !== 0) {
        await createPavilionPayment(storeIdNum, pavilionIdNum, {
          period: periodIso,
          rentPaid: rentDelta,
          rentBankTransferPaid: bank > 0 ? bank : undefined,
          rentCashbox1Paid: cash1 > 0 ? cash1 : undefined,
          rentCashbox2Paid: cash2 > 0 ? cash2 : undefined,
          utilitiesPaid: 0,
          advertisingPaid: 0,
        });
      }

      setShowPrepaymentModal(false);
      setPrepaymentAmount('');
      setPrepaymentBankTransferPaid('');
      setPrepaymentCashbox1Paid('');
      setPrepaymentCashbox2Paid('');
      handleActionSuccess();
    } catch (err) {
      console.error(err);
      alert('Не удалось установить предоплату');
    }
  };

  const handleDeletePrepayment = async () => {
    if (!pavilion) return;

    if (!confirm('Удалить предоплату? Статус будет изменен на ЗАНЯТ.')) return;

    try {
      if (pavilion.prepaidUntil) {
        const payments = await apiFetch<any[]>(
          `/stores/${storeIdNum}/pavilions/${pavilionIdNum}/payments`,
        );
        const prepaidPeriod = new Date(pavilion.prepaidUntil);
        const existingForPeriod = payments.find((p: any) => {
          const pDate = new Date(p.period);
          return (
            pDate.getFullYear() === prepaidPeriod.getFullYear() &&
            pDate.getMonth() === prepaidPeriod.getMonth()
          );
        });

        const currentRentPaid = Number(existingForPeriod?.rentPaid ?? 0);
        const currentRentBank = Number(existingForPeriod?.rentBankTransferPaid ?? 0);
        const currentRentCash1 = Number(existingForPeriod?.rentCashbox1Paid ?? 0);
        const currentRentCash2 = Number(existingForPeriod?.rentCashbox2Paid ?? 0);
        if (currentRentPaid > 0) {
          await createPavilionPayment(storeIdNum, pavilionIdNum, {
            period: new Date(
              prepaidPeriod.getFullYear(),
              prepaidPeriod.getMonth(),
              1,
            ).toISOString(),
            rentPaid: -currentRentPaid,
            rentBankTransferPaid: currentRentBank > 0 ? -currentRentBank : undefined,
            rentCashbox1Paid: currentRentCash1 > 0 ? -currentRentCash1 : undefined,
            rentCashbox2Paid: currentRentCash2 > 0 ? -currentRentCash2 : undefined,
            utilitiesPaid: 0,
            advertisingPaid: 0,
          });
        }
      }

      await updatePavilion(storeIdNum, pavilionIdNum, {
        status: 'RENTED',
        prepaidUntil: null,
      });
      handleActionSuccess();
    } catch (err) {
      console.error(err);
      alert('Не удалось удалить предоплату');
    }
  };

  const toggleCharge = (chargeId: number) => {
    setExpandedCharges((prev) => {
      const next = new Set(prev);
      if (next.has(chargeId)) next.delete(chargeId);
      else next.add(chargeId);
      return next;
    });
  };

  const getDiscountForPeriod = (period: Date) => {
    if (!pavilion) return 0;

    const monthStart = new Date(period.getFullYear(), period.getMonth(), 1, 0, 0, 0, 0);
    const monthEnd = new Date(period.getFullYear(), period.getMonth() + 1, 0, 23, 59, 59, 999);

    return pavilion.discounts.reduce((sum, discount) => {
      const startsAt = new Date(discount.startsAt);
      const endsAt = discount.endsAt ? new Date(discount.endsAt) : null;
      const startsBeforeMonthEnds = startsAt <= monthEnd;
      const endsAfterMonthStarts = endsAt === null || endsAt >= monthStart;
      return startsBeforeMonthEnds && endsAfterMonthStarts
        ? sum + discount.amount * pavilion.squareMeters
        : sum;
    }, 0);
  };

  const isDiscountActiveNow = (discount: Discount) => {
    const now = new Date();
    const startsAt = new Date(discount.startsAt);
    const endsAt = discount.endsAt ? new Date(discount.endsAt) : null;
    return startsAt <= now && (endsAt === null || endsAt >= now);
  };

  const formatDate = (value: string | null) =>
    value ? new Date(value).toLocaleDateString() : 'Бессрочно';

  if (loading) return <div className="p-6 text-center text-lg">Загрузка...</div>;
  if (error) return <div className="p-6 text-center text-lg text-red-600">{error}</div>;
  if (!pavilion) return <div className="p-6 text-center text-red-600">Павильон не найден</div>;

  const currency = pavilion.store?.currency ?? 'RUB';
  const currencySymbol = getCurrencySymbol(currency);
  const currentMonthDiscount = getDiscountForPeriod(new Date());
  const baseRentAmount = pavilion.rentAmount ?? pavilion.squareMeters * pavilion.pricePerSqM;
  const discountedRentAmount = Math.max(baseRentAmount - currentMonthDiscount, 0);
  const prepaidAmount = (() => {
    if (!pavilion.prepaidUntil) return null;

    const prepaidPeriod = new Date(pavilion.prepaidUntil);
    const paymentForPrepaidMonth = (pavilion.payments || []).find((pay) => {
      const payPeriod = new Date(pay.period);
      return (
        payPeriod.getFullYear() === prepaidPeriod.getFullYear() &&
        payPeriod.getMonth() === prepaidPeriod.getMonth()
      );
    });

    return Number(paymentForPrepaidMonth?.rentPaid ?? 0);
  })();

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-8">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div>
            <Link href={`/stores/${storeId}`} className="mb-2 inline-block text-blue-600 hover:underline">
              Назад к магазину
            </Link>
            <h1 className="text-2xl font-bold md:text-3xl">Павильон {pavilion.number}</h1>
          </div>
          <div>
            <button
              className="rounded bg-green-600 px-4 py-2 text-white hover:bg-green-700"
            >
              Разделить павильон
            </button>
          </div>
        </div>

        <div className="rounded-xl bg-white p-6 shadow">
          <h2 className="mb-4 text-xl font-semibold">Основная информация</h2>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <p className="text-gray-600">Наименование организации</p>
              <p className="text-lg font-medium">{pavilion.tenantName || '-'}</p>
            </div>
            <div>
              <p className="text-gray-600">Статус</p>
              <p className="text-lg font-medium">{statusLabel[pavilion.status] ?? pavilion.status}</p>
            </div>
            <div>
              <p className="text-gray-600">Площадь</p>
              <p className="text-lg font-medium">{pavilion.squareMeters} м2</p>
            </div>
            <div>
              <p className="text-gray-600">Цена за м2</p>
              <p className="text-lg font-medium">{formatMoney(pavilion.pricePerSqM, currency)}</p>
            </div>
            <div>
              <p className="text-gray-600">Аренда</p>
              {pavilion.rentAmount == null ? (
                <p className="text-lg font-medium">-</p>
              ) : currentMonthDiscount > 0 ? (
                <div className="space-y-1">
                  <p className="text-sm text-gray-500 line-through">
                    {formatMoney(baseRentAmount, currency)}
                  </p>
                  <p className="inline-block rounded bg-yellow-200 px-2 py-0.5 text-lg font-semibold text-yellow-900">
                    {formatMoney(discountedRentAmount, currency)}
                  </p>
                </div>
              ) : (
                <p className="text-lg font-medium">{formatMoney(baseRentAmount, currency)}</p>
              )}
            </div>
            <div>
              <p className="text-gray-600">Коммунальные</p>
              <p className="text-lg font-medium">
                {pavilion.utilitiesAmount == null
                  ? '-'
                  : formatMoney(pavilion.utilitiesAmount, currency)}
              </p>
            </div>
            <div>
              <p className="text-gray-600">Реклама</p>
              <p className="text-lg font-medium">
                {pavilion.advertisingAmount == null
                  ? '-'
                  : formatMoney(pavilion.advertisingAmount, currency)}
              </p>
            </div>
            <div>
              <p className="text-gray-600">Сумма предоплаты</p>
              <p className="text-lg font-medium">
                {prepaidAmount == null ? '-' : formatMoney(prepaidAmount, currency)}
              </p>
            </div>
            <div>
              <p className="text-gray-600">Скидка (текущий месяц)</p>
              <p className="text-lg font-medium">{formatMoney(currentMonthDiscount, currency)}</p>
            </div>
          </div>

          {hasPermission(permissions, 'EDIT_PAVILIONS') && (
            <div className="mt-4 flex flex-wrap gap-3">
              <button
                onClick={() => setShowPrepaymentModal(true)}
                className="rounded bg-emerald-600 px-4 py-2 text-sm text-white hover:bg-emerald-700"
              >
                {pavilion.status === 'PREPAID'
                  ? 'Изменить предоплату'
                  : 'Установить предоплату'}
              </button>
              {pavilion.status === 'PREPAID' && (
                <button
                  onClick={handleDeletePrepayment}
                  className="rounded bg-red-600 px-4 py-2 text-sm text-white hover:bg-red-700"
                >
                  Удалить предоплату
                </button>
              )}
              {pavilion.status === 'PREPAID' && pavilion.prepaidUntil && (
                <span className="inline-flex items-center rounded bg-blue-50 px-3 py-2 text-sm text-blue-700">
                  Оплаченный месяц: {new Date(pavilion.prepaidUntil).toLocaleDateString()}
                </span>
              )}
            </div>
          )}
        </div>

        {hasPermission(permissions, 'VIEW_CHARGES') && (
          <div className="rounded-xl bg-white p-6 shadow">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-semibold">Платежи</h2>
            {hasPermission(permissions, 'CREATE_PAYMENTS') &&
              (pavilion.status === 'RENTED' || pavilion.status === 'PREPAID') && (
                <button
                  onClick={() => setShowPaymentModal(true)}
                  className="rounded bg-green-600 px-4 py-2 text-white"
                >
                  + Новый платеж
                </button>
              )}
          </div>

          {pavilion.payments.length === 0 &&
          (pavilion.paymentTransactions?.length ?? 0) === 0 ? (
            <p className="text-gray-500">Платежей пока нет</p>
          ) : (
            <div className="space-y-6">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">Период</th>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">Ожидается</th>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">Оплачено</th>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">Схождение</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {pavilion.payments.map((pay: any) => {
                      const periodDate = new Date(pay.period);
                      const baseRent = pavilion.squareMeters * pavilion.pricePerSqM;
                      const periodDiscount = getDiscountForPeriod(periodDate);
                      const expectedUtilities = pavilion.status === 'PREPAID' ? 0 : (pavilion.utilitiesAmount || 0);
                      const expectedAdvertising = pavilion.status === 'PREPAID' ? 0 : (pavilion.advertisingAmount || 0);
                      const expectedRent =
                        pavilion.status === 'PREPAID'
                          ? baseRent
                          : Math.max(baseRent - periodDiscount, 0);
                      const expected = expectedRent + expectedUtilities + expectedAdvertising;
                      const paid = (pay.rentPaid || 0) + (pay.utilitiesPaid || 0) + (pay.advertisingPaid || 0);
                      const balance = paid - expected;

                      return (
                        <tr key={pay.id}>
                          <td className="whitespace-nowrap px-6 py-4 text-sm">
                            {new Date(pay.period).toLocaleDateString()}
                          </td>
                          <td className="whitespace-nowrap px-6 py-4 text-sm">{formatMoney(expected, currency)}</td>
                          <td className="whitespace-nowrap px-6 py-4 text-sm">{formatMoney(paid, currency)}</td>
                          <td
                            className={`whitespace-nowrap px-6 py-4 text-sm font-medium ${
                              balance > 0
                                ? 'text-green-600'
                                : balance < 0
                                  ? 'text-red-600'
                                  : 'text-gray-600'
                            }`}
                          >
                            {`${balance > 0 ? '+' : balance < 0 ? '-' : ''}${formatMoney(Math.abs(balance), currency)}`}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div>
                <h3 className="mb-3 text-sm font-semibold uppercase text-gray-600">История платежей</h3>
                {(pavilion.paymentTransactions?.length ?? 0) === 0 ? (
                  <p className="text-sm text-gray-500">Записей платежей пока нет</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Дата</th>
                          <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Период</th>
                          <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Аренда</th>
                          <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Коммунальные</th>
                          <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Реклама</th>
                          <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Безналичный</th>
                          <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Касса 1</th>
                          <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Касса 2</th>
                          <th className="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500">Действия</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {(pavilion.paymentTransactions ?? []).map((entry) => (
                          <tr key={entry.id}>
                            <td className="whitespace-nowrap px-4 py-3 text-sm">
                              {new Date(entry.createdAt).toLocaleDateString()}
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 text-sm">
                              {new Date(entry.period).toLocaleDateString()}
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 text-sm">
                              {formatMoney(entry.rentPaid, currency)}
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 text-sm">
                              {formatMoney(entry.utilitiesPaid, currency)}
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 text-sm">
                              {formatMoney(entry.advertisingPaid, currency)}
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 text-sm">
                              {formatMoney(entry.bankTransferPaid, currency)}
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 text-sm">
                              {formatMoney(entry.cashbox1Paid, currency)}
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 text-sm">
                              {formatMoney(entry.cashbox2Paid, currency)}
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 text-right text-sm">
                              {hasPermission(permissions, 'EDIT_PAYMENTS') && (
                                <button
                                  onClick={() => handleDeletePaymentEntry(entry.id)}
                                  className="text-red-600 hover:underline"
                                >
                                  Удалить
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}
          </div>
        )}

        {hasPermission(permissions, 'VIEW_CONTRACTS') && (
          <div className="rounded-xl bg-white p-6 shadow">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold">Договоры</h2>
              {hasPermission(permissions, 'UPLOAD_CONTRACTS') && (
                <label className="cursor-pointer rounded bg-purple-600 px-4 py-2 text-sm text-white hover:bg-purple-700">
                  {uploadingContract ? 'Загрузка...' : '+ Загрузить документ'}
                  <input
                    type="file"
                    className="hidden"
                    onChange={handleContractUpload}
                    accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.rtf,.jpg,.jpeg,.png"
                    disabled={uploadingContract}
                  />
                </label>
              )}
            </div>

            {!pavilion.contracts || pavilion.contracts.length === 0 ? (
              <p className="text-gray-500">Документы не загружены</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">Файл</th>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">Тип</th>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">Загружен</th>
                      <th className="px-6 py-3 text-right text-xs font-medium uppercase text-gray-500">Действия</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {pavilion.contracts.map((contract) => (
                      <tr key={contract.id}>
                        <td className="px-6 py-4 text-sm">
                          <a
                            href={`${process.env.NEXT_PUBLIC_API_URL}${contract.filePath}`}
                            target="_blank"
                            rel="noreferrer"
                            className="text-blue-600 hover:underline"
                          >
                            {contract.fileName}
                          </a>
                        </td>
                        <td className="px-6 py-4 text-sm">{contract.fileType}</td>
                        <td className="px-6 py-4 text-sm">
                          {new Date(contract.uploadedAt).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 text-right text-sm">
                          {hasPermission(permissions, 'DELETE_CONTRACTS') && (
                            <button
                              onClick={() => handleDeleteContract(contract.id)}
                              className="text-red-600 hover:underline"
                            >
                              Удалить
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {hasPermission(permissions, 'VIEW_PAYMENTS') && (
          <div className="rounded-xl bg-white p-6 shadow">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-semibold">Скидки</h2>
            {hasPermission(permissions, 'EDIT_PAVILIONS') && (
              <button
                onClick={() => setShowDiscountModal(true)}
                className="rounded bg-indigo-600 px-4 py-2 text-sm text-white hover:bg-indigo-700"
              >
                + Добавить скидку
              </button>
            )}
          </div>

          {pavilion.discounts.length === 0 ? (
            <p className="text-gray-500">Скидок нет</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">За м2</th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">В месяц</th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">Начало</th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">Конец</th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">Статус</th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">Комментарий</th>
                    <th className="px-6 py-3 text-right text-xs font-medium uppercase text-gray-500">Действия</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {pavilion.discounts.map((discount) => (
                    <tr key={discount.id}>
                      <td className="px-6 py-4 text-sm font-medium">
                        {discount.amount.toFixed(2)} {currencySymbol}/м2
                      </td>
                      <td className="px-6 py-4 text-sm font-medium">
                        {formatMoney(discount.amount * pavilion.squareMeters, currency)}
                      </td>
                      <td className="px-6 py-4 text-sm">{formatDate(discount.startsAt)}</td>
                      <td className="px-6 py-4 text-sm">{formatDate(discount.endsAt)}</td>
                      <td className="px-6 py-4 text-sm">
                        {isDiscountActiveNow(discount) ? (
                          <span className="font-semibold text-green-700">Активна</span>
                        ) : (
                          <span className="font-semibold text-gray-600">Не активна</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm">{discount.note || '-'}</td>
                      <td className="px-6 py-4 text-right text-sm">
                        {hasPermission(permissions, 'EDIT_PAVILIONS') && (
                          <button
                            onClick={() => handleDeleteDiscount(discount.id)}
                            className="text-red-600 hover:underline"
                          >
                            Удалить
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          </div>
        )}

        <div className="rounded-xl bg-white p-6 shadow">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-semibold">Дополнительные начисления</h2>
            {hasPermission(permissions, 'CREATE_CHARGES') && (
              <button
                onClick={() => setShowAddChargeModal(true)}
                className="rounded bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
              >
                + Новое начисление
              </button>
            )}
          </div>

          {pavilion.additionalCharges.length === 0 ? (
            <p className="text-gray-500">Начислений нет</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500"></th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">Название</th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">Сумма</th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">Оплачено</th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">Схождение</th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">Статус</th>
                    <th className="px-6 py-3 text-right text-xs font-medium uppercase text-gray-500">Действия</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {pavilion.additionalCharges.map((charge: any) => {
                    const totalPaid =
                      charge.payments?.reduce((sum: number, p: any) => sum + (p.amountPaid ?? 0), 0) ?? 0;
                    const balance = totalPaid - charge.amount;
                    const isPaid = balance >= 0;
                    const isExpanded = expandedCharges.has(charge.id);
                    const hasPayments = (charge.payments?.length ?? 0) > 0;

                    return (
                      <React.Fragment key={charge.id}>
                        <tr>
                          <td className="px-4 py-4">
                            {hasPayments ? (
                              <button
                                onClick={() => toggleCharge(charge.id)}
                                className="text-gray-600 transition hover:text-gray-900"
                              >
                                {isExpanded ? 'v' : '>'}
                              </button>
                            ) : (
                              <span className="text-gray-300">.</span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-sm font-medium">{charge.name}</td>
                          <td className="px-6 py-4 text-sm">{formatMoney(charge.amount, currency)}</td>
                          <td className="px-6 py-4 text-sm">{formatMoney(totalPaid, currency)}</td>
                          <td
                            className={`px-6 py-4 text-sm font-medium ${
                              balance > 0
                                ? 'text-green-600'
                                : balance < 0
                                  ? 'text-red-600'
                                  : 'text-gray-600'
                            }`}
                          >
                            {balance > 0 ? '+' : balance < 0 ? '-' : ''}
                            {formatMoney(Math.abs(balance), currency)}
                          </td>
                          <td className="px-6 py-4 text-sm">
                            {isPaid ? (
                              <span className="font-semibold text-green-700">Оплачено</span>
                            ) : (
                              <span className="font-semibold text-amber-600">Не оплачено</span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-right text-sm">
                            {!isPaid && hasPermission(permissions, 'CREATE_PAYMENTS') && (
                              <button
                                onClick={() =>
                                  setPayingCharge({
                                    pavilionId: pavilionIdNum,
                                    chargeId: charge.id,
                                    name: charge.name,
                                    amount: charge.amount - totalPaid,
                                  })
                                }
                                className="mr-3 text-green-600 hover:underline"
                              >
                                Оплатить
                              </button>
                            )}
                            {hasPermission(permissions, 'DELETE_CHARGES') && (
                              <button
                                onClick={() => handleDeleteCharge(charge.id)}
                                className="text-red-600 hover:underline"
                              >
                                Удалить
                              </button>
                            )}
                          </td>
                        </tr>

                        {isExpanded && (
                          <tr className="bg-gray-50">
                            <td colSpan={7} className="px-6 py-3 text-sm text-gray-700">
                              {charge.payments?.length ? (
                                <div className="space-y-2">
                                  <div className="text-xs font-semibold text-gray-500">История оплат</div>
                                  <div className="grid grid-cols-[120px_1fr_1fr_1fr_1fr_auto] gap-3 text-xs font-semibold text-gray-500">
                                    <span>Дата</span>
                                    <span>Сумма</span>
                                    <span>Безналичные</span>
                                    <span>Касса 1</span>
                                    <span>Касса 2</span>
                                    <span className="text-right">Действия</span>
                                  </div>
                                  {charge.payments.map((p: any) => (
                                    <div
                                      key={p.id}
                                      className="grid grid-cols-[120px_1fr_1fr_1fr_1fr_auto] items-center gap-3 rounded bg-white px-2 py-1"
                                    >
                                      <span>{new Date(p.paidAt).toLocaleDateString()}</span>
                                      <span className="font-medium">{formatMoney(p.amountPaid, currency)}</span>
                                      <span>{formatMoney(p.bankTransferPaid ?? 0, currency)}</span>
                                      <span>{formatMoney(p.cashbox1Paid ?? 0, currency)}</span>
                                      <span>{formatMoney(p.cashbox2Paid ?? 0, currency)}</span>
                                      <div className="text-right">
                                        <button
                                          onClick={() => handleDeleteChargePayment(charge.id, p.id)}
                                          className="text-xs text-red-600 hover:underline"
                                        >
                                          Удалить
                                        </button>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <div className="text-xs text-gray-500">Оплат пока нет</div>
                              )}
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {hasPermission(permissions, 'EDIT_PAVILIONS') && (
          <button
            onClick={() => setEditingPavilion(pavilion)}
            className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
          >
            Редактировать
          </button>
        )}

        {showPaymentModal && (
          <CreatePavilionPaymentModal
            storeId={storeIdNum}
            pavilionId={pavilionIdNum}
            pavilionStatus={pavilion.status}
            onClose={() => setShowPaymentModal(false)}
            onSaved={handleActionSuccess}
          />
        )}

        {showAddChargeModal && (
          <AddAdditionalChargeModal
            pavilionId={pavilionIdNum}
            onClose={() => setShowAddChargeModal(false)}
            onSaved={handleActionSuccess}
          />
        )}

        {showDiscountModal && (
          <CreateDiscountModal
            storeId={storeIdNum}
            pavilionId={pavilionIdNum}
            onClose={() => setShowDiscountModal(false)}
            onSaved={handleActionSuccess}
          />
        )}

        {showPrepaymentModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="w-full max-w-md rounded-lg bg-white p-6">
              <h2 className="mb-4 text-xl font-bold">Установить предоплату</h2>
              <div className="space-y-4">
                <div>
                  <label className="mb-1 block text-sm font-medium">Месяц предоплаты</label>
                  <input
                    type="month"
                    value={prepaymentMonth}
                    onChange={(e) => setPrepaymentMonth(e.target.value)}
                    className="w-full rounded border px-3 py-2"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">
                    Сумма предоплаты (если пусто - полная аренда)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={prepaymentAmount}
                    onChange={(e) => setPrepaymentAmount(e.target.value)}
                    className="w-full rounded border px-3 py-2"
                    placeholder={(pavilion.squareMeters * pavilion.pricePerSqM).toFixed(2)}
                  />
                </div>
                <div className="rounded border p-3">
                  <p className="mb-2 text-sm font-medium">Каналы оплаты предоплаты</p>
                  <div className="space-y-2">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={prepaymentBankTransferPaid}
                      onChange={(e) => setPrepaymentBankTransferPaid(e.target.value)}
                      className="w-full rounded border px-3 py-2"
                      placeholder="Безналичные"
                    />
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={prepaymentCashbox1Paid}
                      onChange={(e) => setPrepaymentCashbox1Paid(e.target.value)}
                      className="w-full rounded border px-3 py-2"
                      placeholder="Наличные - касса 1"
                    />
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={prepaymentCashbox2Paid}
                      onChange={(e) => setPrepaymentCashbox2Paid(e.target.value)}
                      className="w-full rounded border px-3 py-2"
                      placeholder="Наличные - касса 2"
                    />
                  </div>
                </div>
              </div>
              <div className="mt-6 flex justify-end gap-3">
                <button
                  onClick={() => setShowPrepaymentModal(false)}
                  className="rounded border px-4 py-2 hover:bg-gray-100"
                >
                  Отмена
                </button>
                <button
                  onClick={handleSetPrepayment}
                  className="rounded bg-emerald-600 px-4 py-2 text-white hover:bg-emerald-700"
                >
                  Сохранить
                </button>
              </div>
            </div>
          </div>
        )}

        {editingPavilion && (
          <EditPavilionModal
            storeId={storeIdNum}
            pavilion={editingPavilion}
            existingCategories={existingCategories}
            onClose={() => setEditingPavilion(null)}
            onSaved={handleActionSuccess}
          />
        )}

        {payingCharge && (
          <PayAdditionalChargeModal
            pavilionId={payingCharge.pavilionId}
            chargeId={payingCharge.chargeId}
            chargeName={payingCharge.name}
            expectedAmount={payingCharge.amount}
            onClose={() => setPayingCharge(null)}
            onSaved={handleActionSuccess}
          />
        )}
      </div>
      <div className="mx-auto mt-6 flex w-full max-w-6xl justify-center p-4 md:px-8 md:pb-8">
        {hasPermission(permissions, 'DELETE_PAVILIONS') && (
          <button
            onClick={handleDeletePavilion}
            className="rounded bg-red-600 px-4 py-2 text-white hover:bg-red-700"
          >
            Удалить павильон
          </button>
        )}
      </div>
    </div>
  );
}
