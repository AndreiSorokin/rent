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

type Discount = {
  id: number;
  amount: number;
  startsAt: string;
  endsAt: string | null;
  note?: string | null;
};

type Pavilion = {
  id: number;
  number: string;
  squareMeters: number;
  pricePerSqM: number;
  status: string;
  tenantName?: string;
  rentAmount?: number;
  utilitiesAmount?: number;
  payments: any[];
  additionalCharges: any[];
  discounts: Discount[];
};

export default function PavilionPage() {
  const { storeId, pavilionId } = useParams();
  const storeIdNum = Number(storeId);
  const pavilionIdNum = Number(pavilionId);
  const router = useRouter();

  const [pavilion, setPavilion] = useState<Pavilion | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedCharges, setExpandedCharges] = useState<Set<number>>(new Set());

  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showAddChargeModal, setShowAddChargeModal] = useState(false);
  const [showDiscountModal, setShowDiscountModal] = useState(false);
  const [editingPavilion, setEditingPavilion] = useState<Pavilion | null>(null);
  const [payingCharge, setPayingCharge] = useState<{
    pavilionId: number;
    chargeId: number;
    name: string;
    amount: number;
  } | null>(null);

  const permissions = [
    'VIEW_PAVILIONS',
    'EDIT_PAVILIONS',
    'CREATE_PAYMENTS',
    'CREATE_CHARGES',
    'DELETE_CHARGES',
    'DELETE_PAVILIONS',
  ];

  const fetchPavilion = async () => {
    try {
      const data = await apiFetch<Pavilion>(
        `/stores/${storeIdNum}/pavilions/${pavilionIdNum}`,
      );
      setPavilion(data);
    } catch (err) {
      setError('Failed to load pavilion');
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
    if (!confirm('Delete this pavilion?')) return;

    try {
      await apiFetch(`/stores/${storeIdNum}/pavilions/${pavilionIdNum}`, {
        method: 'DELETE',
      });
      router.push(`/stores/${storeIdNum}`);
    } catch (err: any) {
      setError(err.message || 'Failed to delete pavilion');
    }
  };

  const handleDeleteCharge = async (chargeId: number) => {
    if (!confirm('Delete this additional charge?')) return;

    try {
      await deleteAdditionalCharge(pavilionIdNum, chargeId);
      handleActionSuccess();
    } catch (err) {
      console.error(err);
      alert('Failed to delete additional charge');
    }
  };

  const handleDeleteChargePayment = async (chargeId: number, paymentId: number) => {
    if (!confirm('Delete this charge payment?')) return;

    await apiFetch(
      `/pavilions/${pavilionIdNum}/additional-charges/${chargeId}/payments/${paymentId}`,
      { method: 'DELETE' },
    );
    handleActionSuccess();
  };

  const handleDeleteDiscount = async (discountId: number) => {
    if (!confirm('Delete this discount?')) return;

    try {
      await deletePavilionDiscount(storeIdNum, pavilionIdNum, discountId);
      handleActionSuccess();
    } catch (err) {
      console.error(err);
      alert('Failed to delete discount');
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

    const monthStart = new Date(
      period.getFullYear(),
      period.getMonth(),
      1,
      0,
      0,
      0,
      0,
    );
    const monthEnd = new Date(
      period.getFullYear(),
      period.getMonth() + 1,
      0,
      23,
      59,
      59,
      999,
    );

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
    value ? new Date(value).toLocaleDateString() : 'Infinite';

  if (loading) return <div className="p-6 text-center text-lg">Loading...</div>;
  if (error) return <div className="p-6 text-center text-lg text-red-600">{error}</div>;
  if (!pavilion) return <div className="p-6 text-center text-red-600">Pavilion not found</div>;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-8">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div>
            <Link
              href={`/stores/${storeId}`}
              className="mb-2 inline-block text-blue-600 hover:underline"
            >
              Back to store
            </Link>
            <h1 className="text-2xl font-bold md:text-3xl">Pavilion {pavilion.number}</h1>
          </div>
          <div className="flex flex-wrap gap-3">
            {hasPermission(permissions, 'DELETE_PAVILIONS') && (
              <button
                onClick={handleDeletePavilion}
                className="rounded bg-red-600 px-4 py-2 text-white hover:bg-red-700"
              >
                Delete pavilion
              </button>
            )}
          </div>
        </div>

        <div className="rounded-xl bg-white p-6 shadow">
          <h2 className="mb-4 text-xl font-semibold">Main information</h2>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <p className="text-gray-600">Area</p>
              <p className="text-lg font-medium">{pavilion.squareMeters} m2</p>
            </div>
            <div>
              <p className="text-gray-600">Price per m2</p>
              <p className="text-lg font-medium">${pavilion.pricePerSqM}</p>
            </div>
            <div>
              <p className="text-gray-600">Status</p>
              <p className="text-lg font-medium">{pavilion.status}</p>
            </div>
            <div>
              <p className="text-gray-600">Tenant</p>
              <p className="text-lg font-medium">{pavilion.tenantName || 'None'}</p>
            </div>
            <div>
              <p className="text-gray-600">Rent</p>
              <p className="text-lg font-medium">{pavilion.rentAmount ?? '-'}$</p>
            </div>
            <div>
              <p className="text-gray-600">Utilities</p>
              <p className="text-lg font-medium">{pavilion.utilitiesAmount ?? '-'}$</p>
            </div>
          </div>
        </div>

        <div className="rounded-xl bg-white p-6 shadow">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-semibold">Discounts</h2>
            {hasPermission(permissions, 'EDIT_PAVILIONS') && (
              <button
                onClick={() => setShowDiscountModal(true)}
                className="rounded bg-indigo-600 px-4 py-2 text-sm text-white hover:bg-indigo-700"
              >
                + Add discount
              </button>
            )}
          </div>

          {pavilion.discounts.length === 0 ? (
            <p className="text-gray-500">No discounts</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">Per m2</th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">Monthly total</th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">Start</th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">End</th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">Note</th>
                    <th className="px-6 py-3 text-right text-xs font-medium uppercase text-gray-500">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {pavilion.discounts.map((discount) => (
                    <tr key={discount.id}>
                      <td className="px-6 py-4 text-sm font-medium">${discount.amount.toFixed(2)}/m2</td>
                      <td className="px-6 py-4 text-sm font-medium">
                        ${(discount.amount * pavilion.squareMeters).toFixed(2)}
                      </td>
                      <td className="px-6 py-4 text-sm">{formatDate(discount.startsAt)}</td>
                      <td className="px-6 py-4 text-sm">{formatDate(discount.endsAt)}</td>
                      <td className="px-6 py-4 text-sm">
                        {isDiscountActiveNow(discount) ? (
                          <span className="font-semibold text-green-700">Active</span>
                        ) : (
                          <span className="font-semibold text-gray-600">Inactive</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm">{discount.note || '-'}</td>
                      <td className="px-6 py-4 text-right text-sm">
                        {hasPermission(permissions, 'EDIT_PAVILIONS') && (
                          <button
                            onClick={() => handleDeleteDiscount(discount.id)}
                            className="text-red-600 hover:underline"
                          >
                            Delete
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

        <div className="rounded-xl bg-white p-6 shadow">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-semibold">Payments</h2>
            {hasPermission(permissions, 'CREATE_PAYMENTS') && pavilion.status === 'RENTED' && (
              <button
                onClick={() => setShowPaymentModal(true)}
                className="rounded bg-green-600 px-4 py-2 text-white"
              >
                + New payment
              </button>
            )}
          </div>

          {pavilion.payments.length === 0 ? (
            <p className="text-gray-500">No payments yet</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">Period</th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">Expected</th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">Paid</th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {pavilion.payments.map((pay: any) => {
                    const periodDate = new Date(pay.period);
                    const baseRent = pavilion.squareMeters * pavilion.pricePerSqM;
                    const periodDiscount = getDiscountForPeriod(periodDate);
                    const expected =
                      Math.max(baseRent - periodDiscount, 0) + (pavilion.utilitiesAmount || 0);
                    const paid = (pay.rentPaid || 0) + (pay.utilitiesPaid || 0);
                    const balance = paid - expected;

                    return (
                      <tr key={pay.id}>
                        <td className="whitespace-nowrap px-6 py-4 text-sm">{pay.period}</td>
                        <td className="whitespace-nowrap px-6 py-4 text-sm">
                          ${expected.toFixed(2)}
                        </td>
                        <td className="whitespace-nowrap px-6 py-4 text-sm">${paid.toFixed(2)}</td>
                        <td
                          className={`whitespace-nowrap px-6 py-4 text-sm font-medium ${
                            balance > 0
                              ? 'text-green-600'
                              : balance < 0
                                ? 'text-red-600'
                                : 'text-gray-600'
                          }`}
                        >
                          {`${balance > 0 ? '+' : ''}${balance.toFixed(2)}$`}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="rounded-xl bg-white p-6 shadow">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-semibold">Additional charges</h2>
            {hasPermission(permissions, 'CREATE_CHARGES') && (
              <button
                onClick={() => setShowAddChargeModal(true)}
                className="rounded bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
              >
                + New charge
              </button>
            )}
          </div>

          {pavilion.additionalCharges.length === 0 ? (
            <p className="text-gray-500">No additional charges</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500"></th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">Name</th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">Amount</th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">Paid</th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">Difference</th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">Status</th>
                    <th className="px-6 py-3 text-right text-xs font-medium uppercase text-gray-500">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {pavilion.additionalCharges.map((charge: any) => {
                    const totalPaid =
                      charge.payments?.reduce(
                        (sum: number, p: any) => sum + (p.amountPaid ?? 0),
                        0,
                      ) ?? 0;
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
                          <td className="px-6 py-4 text-sm">{charge.amount.toFixed(2)}$</td>
                          <td className="px-6 py-4 text-sm">{totalPaid.toFixed(2)}$</td>
                          <td
                            className={`px-6 py-4 text-sm font-medium ${
                              balance > 0
                                ? 'text-green-600'
                                : balance < 0
                                  ? 'text-red-600'
                                  : 'text-gray-600'
                            }`}
                          >
                            {balance > 0 ? '+' : ''}
                            {balance.toFixed(2)}$
                          </td>
                          <td className="px-6 py-4 text-sm">
                            {isPaid ? (
                              <span className="font-semibold text-green-700">Paid</span>
                            ) : (
                              <span className="font-semibold text-amber-600">Not paid</span>
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
                                Pay
                              </button>
                            )}
                            {hasPermission(permissions, 'DELETE_CHARGES') && (
                              <button
                                onClick={() => handleDeleteCharge(charge.id)}
                                className="text-red-600 hover:underline"
                              >
                                Delete
                              </button>
                            )}
                          </td>
                        </tr>

                        {isExpanded && (
                          <tr className="bg-gray-50">
                            <td colSpan={7} className="px-6 py-3 text-sm text-gray-700">
                              {charge.payments?.length ? (
                                <div className="space-y-2">
                                  <div className="text-xs font-semibold text-gray-500">
                                    Payment history
                                  </div>
                                  {charge.payments.map((p: any) => (
                                    <div
                                      key={p.id}
                                      className="flex items-center justify-between gap-3"
                                    >
                                      <span>{new Date(p.paidAt).toLocaleDateString()}</span>
                                      <span className="font-medium">
                                        {Number(p.amountPaid).toFixed(2)}$
                                      </span>
                                      <button
                                        onClick={() =>
                                          handleDeleteChargePayment(charge.id, p.id)
                                        }
                                        className="text-xs text-red-600 hover:underline"
                                      >
                                        Delete
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <div className="text-xs text-gray-500">No payments</div>
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
            Edit pavilion
          </button>
        )}

        {showPaymentModal && (
          <CreatePavilionPaymentModal
            storeId={storeIdNum}
            pavilionId={pavilionIdNum}
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

        {editingPavilion && (
          <EditPavilionModal
            storeId={storeIdNum}
            pavilion={editingPavilion}
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
    </div>
  );
}
