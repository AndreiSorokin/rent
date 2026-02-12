'use client';

import { useState } from 'react';
import { EditPavilionModal } from './EditPavilionModal';
import { AddAdditionalChargeModal } from './AddAdditionalChargeModal';
import { PayAdditionalChargeModal } from './PayAdditionalChargeModal';
import { CreatePavilionPaymentModal } from './CreatePavilionPaymentModal';
import { Pavilion } from '@/types/store';
import { hasPermission } from '@/lib/permissions';
import { deleteAdditionalCharge } from '@/lib/additionalCharges';

export function PavilionList({
  storeId,
  pavilions,
  permissions,
  refresh,
  onDelete,
}: {
  storeId: number;
  pavilions: Pavilion[];
  permissions: string[];
  refresh: () => void;
  onDelete: (id: number) => void;
}) {
  const [editingPavilion, setEditingPavilion] = useState<Pavilion | null>(null);
  const [addingChargeForPavilion, setAddingChargeForPavilion] = useState<Pavilion | null>(null);
  const [payingMonthlyPavilion, setPayingMonthlyPavilion] = useState<Pavilion | null>(null);
  const [payingCharge, setPayingCharge] = useState<{
    pavilionId: number;
    chargeId: number;
    name: string;
    amount: number;
  } | null>(null);

  const canEdit = hasPermission(permissions, 'EDIT_PAVILIONS');
  const canDelete = hasPermission(permissions, 'DELETE_PAVILIONS');
  const canManageCharges =
    hasPermission(permissions, 'CREATE_CHARGES') ||
    hasPermission(permissions, 'EDIT_CHARGES') ||
    hasPermission(permissions, 'DELETE_CHARGES');
  const canPay = hasPermission(permissions, 'CREATE_PAYMENTS');

  return (
    <div className="space-y-3">
      {pavilions.map((p) => (
        <div key={p.id} className="border rounded-lg p-4 bg-white shadow-sm">
          <div className="flex justify-between items-start mb-3">
            <div>
              <div className="font-semibold text-lg">Pavilion {p.number}</div>
              <div className="text-sm text-gray-600">
                Status:{' '}
                <span
                  className={
                    p.status === 'RENTED'
                      ? 'text-green-600'
                      : p.status === 'PREPAID'
                        ? 'text-blue-600'
                        : 'text-amber-600'
                  }
                >
                  {p.status === 'RENTED'
                    ? 'ЗАНЯТ'
                    : p.status === 'AVAILABLE'
                      ? 'СВОБОДЕН'
                      : 'ПРЕДОПЛАТА'}
                </span>
              </div>
              {p.tenantName && (
                <div className="text-sm text-gray-700 mt-1">Tenant: {p.tenantName}</div>
              )}
            </div>

            <div className="flex gap-3">
              {canEdit && (
                <button
                  onClick={() => setEditingPavilion(p)}
                  className="text-blue-600 hover:underline text-sm"
                >
                  Edit
                </button>
              )}
              {canDelete && (
                <button
                  onClick={() => onDelete(p.id)}
                  className="text-red-600 hover:underline text-sm"
                >
                  Delete
                </button>
              )}
            </div>
          </div>

          {canPay && (p.status === 'RENTED' || p.status === 'PREPAID') && (
            <button
              onClick={() => setPayingMonthlyPavilion(p)}
              className="text-green-600 hover:underline text-sm mb-3 block"
            >
              Record monthly rent & utilities →
            </button>
          )}

          <div className="mt-3 pt-3 border-t">
            <div className="flex justify-between items-center mb-2">
              <div className="font-medium text-sm">Additional charges</div>
              {canManageCharges && p.status === 'RENTED' && (
                <button
                  onClick={() => setAddingChargeForPavilion(p)}
                  className="text-xs text-blue-600 hover:underline"
                >
                  + Add charge
                </button>
              )}
            </div>

            {(!p.additionalCharges || p.additionalCharges.length === 0) && (
              <div className="text-xs text-gray-500 py-1">No additional charges</div>
            )}

            {p.additionalCharges?.map((charge) => (
              <div
                key={charge.id}
                className="flex justify-between items-center py-1.5 text-sm border-b last:border-b-0"
              >
                <div>
                  <span className="font-medium">{charge.name}</span>
                  <span className="ml-2 text-gray-600">${charge.amount.toFixed(2)}</span>
                </div>

                <div className="flex gap-3">
                  {canPay && (
                    <button
                      onClick={() =>
                        setPayingCharge({
                          pavilionId: p.id,
                          chargeId: charge.id,
                          name: charge.name,
                          amount: charge.amount,
                        })
                      }
                      className="text-green-600 hover:underline text-xs"
                    >
                      Pay
                    </button>
                  )}
                  {hasPermission(permissions, 'DELETE_CHARGES') && (
                    <button
                      onClick={async () => {
                        if (!confirm(`Delete "${charge.name}"?`)) return;
                        try {
                          await deleteAdditionalCharge(p.id, charge.id);
                          refresh();
                        } catch (err) {
                          console.error('Delete failed:', err);
                          alert('Failed to delete charge. Please try again.');
                        }
                      }}
                      className="text-red-600 hover:underline text-xs"
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* Modals */}
      {editingPavilion && (
        <EditPavilionModal
          storeId={storeId}
          pavilion={editingPavilion}
          onClose={() => setEditingPavilion(null)}
          onSaved={refresh}
        />
      )}

      {addingChargeForPavilion && (
        <AddAdditionalChargeModal
          pavilionId={addingChargeForPavilion.id}
          onClose={() => setAddingChargeForPavilion(null)}
          onSaved={refresh}
        />
      )}

      {payingMonthlyPavilion && (
        <CreatePavilionPaymentModal
          storeId={storeId}
          pavilionId={payingMonthlyPavilion.id}
          pavilionStatus={payingMonthlyPavilion.status}
          onClose={() => setPayingMonthlyPavilion(null)}
          onSaved={refresh}
        />
      )}

      {payingCharge && (
        <PayAdditionalChargeModal
          pavilionId={payingCharge.pavilionId}
          chargeId={payingCharge.chargeId}
          chargeName={payingCharge.name}
          expectedAmount={payingCharge.amount}
          onClose={() => setPayingCharge(null)}
          onSaved={refresh}
        />
      )}
    </div>
  );
}
