'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { hasPermission } from '@/lib/permissions';
import { CreatePavilionPaymentModal } from '@/app/dashboard/components/CreatePavilionPaymentModal';
import { AddAdditionalChargeModal } from '@/app/dashboard/components/AddAdditionalChargeModal';
import { EditPavilionModal } from '@/app/dashboard/components/EditPavilionModal';
import { PayAdditionalChargeModal } from '@/app/dashboard/components/PayAdditionalChargeModal';
import { deleteAdditionalCharge } from '@/lib/additionalCharges';

interface Pavilion {
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
  // add more fields as needed
}

export default function PavilionPage() {
  const { storeId, pavilionId } = useParams();
  const storeIdNum = Number(storeId);
  const pavilionIdNum = Number(pavilionId);
  const router = useRouter();

  const [pavilion, setPavilion] = useState<Pavilion | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modals state
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showAddChargeModal, setShowAddChargeModal] = useState(false);
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
  'DELETE_PAVILIONS'
];

  const fetchPavilion = async () => {
    try {
      const data = await apiFetch<Pavilion>(`/stores/${storeIdNum}/pavilions/${pavilionIdNum}`);
      setPavilion(data);
    } catch (err) {
      setError('Не удалось загрузить данные павильона');
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
    fetchPavilion(); // refresh after add/edit/delete
  };

  const handleDeletePavilion = async () => {
    if (!confirm('Вы уверены, что хотите удалить павильон? Это действие нельзя отменить.')) {
      return;
    }

    try {
      await apiFetch(`/stores/${storeIdNum}/pavilions/${pavilionIdNum}`, {
        method: 'DELETE',
      });
      // Redirect to store page after deletion
      router.push(`/stores/${storeIdNum}`);
    } catch (err: any) {
      setError(err.message || 'Ошибка удаления павильона');
    }
  };

  const handleDeleteCharge = async (chargeId: number) => {
  if (!confirm('Удалить это начисление?')) return;

  try {
    await deleteAdditionalCharge(pavilionIdNum, chargeId);
    handleActionSuccess(); // refresh pavilion data
  } catch (err: any) {
    console.error(err);
    alert('Ошибка удаления начисления');
  }
};

  if (loading) return <div className="p-6 text-center text-lg">Загрузка...</div>;
  if (error) return <div className="p-6 text-center text-red-600 text-lg">{error}</div>;
  if (!pavilion) return <div className="p-6 text-center text-red-600">Павильон не найден</div>;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto p-4 md:p-8 space-y-6">
        {/* Header with back link */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <Link
              href={`/stores/${storeId}`}
              className="text-blue-600 hover:underline mb-2 inline-block"
            >
              ← Назад к магазину
            </Link>
            <h1 className="text-2xl md:text-3xl font-bold">
              Павильон {pavilion.number}
            </h1>
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap gap-3">
            {hasPermission(permissions, 'DELETE_PAVILIONS') && (
              <button
                onClick={handleDeletePavilion}
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
              >
                Удалить павильон
              </button>
            )}
          </div>
        </div>

        {/* Main info */}
        <div className="bg-white rounded-xl shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Основная информация</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            <div>
              <p className="text-gray-600">Площадь</p>
              <p className="text-lg font-medium">{pavilion.squareMeters} м²</p>
            </div>
            <div>
              <p className="text-gray-600">Цена за м²</p>
              <p className="text-lg font-medium">{pavilion.pricePerSqM}$</p>
            </div>
            <div>
              <p className="text-gray-600">Статус</p>
              <p className="text-lg font-medium">{pavilion.status}</p>
            </div>
            <div>
              <p className="text-gray-600">Арендатор</p>
              <p className="text-lg font-medium">{pavilion.tenantName || 'Свободен'}</p>
            </div>
            <div>
              <p className="text-gray-600">Арендная плата</p>
              <p className="text-lg font-medium">{pavilion.rentAmount || '—'}$</p>
            </div>
            <div>
              <p className="text-gray-600">Коммунальные услуги</p>
              <p className="text-lg font-medium">{pavilion.utilitiesAmount || '—'}$</p>
            </div>
          </div>
        </div>

        {/* Payments */}
        <div className="bg-white rounded-xl shadow p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">Платежи</h2>
            {hasPermission(permissions, 'CREATE_PAYMENTS') &&
             pavilion.status === 'RENTED' && (
              <button
                onClick={() => setShowPaymentModal(true)}
                className="px-4 py-2 bg-green-600 text-white rounded"
              >
                + Новый платёж
              </button>
            )}
          </div>

          {pavilion.payments.length === 0 ? (
            <p className="text-gray-500">Платежей пока нет</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Период</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Ожидаемо</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Оплачено</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Баланс</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {pavilion.payments.map((pay: any) => {
                    const expected = (pay.expectedRent || 0) + (pay.expectedUtilities || 0);
                    const paid = (pay.rentPaid || 0) + (pay.utilitiesPaid || 0);
                    const balance = paid - expected;
                    return (
                      <tr key={pay.id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">{pay.period}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">{expected.toFixed(2)}$</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">{paid.toFixed(2)}$</td>
                        <td className={`px-6 py-4 whitespace-nowrap text-sm font-medium ${
                          balance > 0 ? 'text-green-600' : balance < 0 ? 'text-red-600' : 'text-gray-600'
                        }`}>
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

        {/* Additional Charges */}
        <div className="bg-white rounded-xl shadow p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">Дополнительные начисления</h2>
            {hasPermission(permissions, 'CREATE_CHARGES') && (
              <button
                onClick={() => setShowAddChargeModal(true)}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
              >
                + Новое начисление
              </button>
            )}
          </div>

          {pavilion.additionalCharges.length === 0 ? (
            <p className="text-gray-500">Нет дополнительных начислений</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Название</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Сумма</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Действия</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {pavilion.additionalCharges.map((charge: any) => (
                    <tr key={charge.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">{charge.name}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">{charge.amount.toFixed(2)}$</td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
  {hasPermission(permissions, 'CREATE_PAYMENTS') && (
    <button
      onClick={() =>
        setPayingCharge({
          pavilionId: pavilionIdNum,
          chargeId: charge.id,
          name: charge.name,
          amount: charge.amount,
        })
      }
      className="text-green-600 hover:underline mr-3"
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
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Modals */}
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
            storeId={storeIdNum}
            pavilionId={pavilionIdNum}
            onClose={() => setShowAddChargeModal(false)}
            onSaved={handleActionSuccess}
          />
        )}
        {editingPavilion && (
                <EditPavilionModal
                  storeId={storeId}
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

                    {hasPermission(permissions, 'EDIT_PAVILIONS') && (
  <button
    onClick={() => setEditingPavilion(pavilion)}
    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
  >
    Редактировать
  </button>
)}

      </div>
    </div>
  );
}