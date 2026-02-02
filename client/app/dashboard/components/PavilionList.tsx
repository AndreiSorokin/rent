import { useState } from 'react';
import { EditPavilionModal } from './EditPavilionModal';
import { Pavilion } from '@/types/store';
import { hasPermission } from '@/lib/permissions';
import { AddAdditionalChargeModal } from './AddAdditionalChargeModal';

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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [addingCharge, setAddingCharge] = useState<any | null>(null);

  const canEdit = hasPermission(permissions, 'EDIT_PAVILIONS');
  const canDelete = hasPermission(permissions, 'DELETE_PAVILIONS');

  return (
    <div className="space-y-2">
      {pavilions.map((p) => (
        <div
          key={p.id}
          className="border p-3 rounded flex justify-between items-center"
        >
          <div>
            <div className="font-medium">Pavilion #{p.number}</div>
            <div className="text-sm text-gray-600">
              Status: {p.status}
            </div>
          </div>

          {(canEdit || canDelete) && (
            <div className="flex gap-3">
              {canEdit && (
                <button
                  onClick={() => setEditingPavilion(p)}
                  className="text-blue-600 hover:underline"
                >
                  Edit
                </button>
              )}
          
              {canDelete && (
                <button
                  onClick={() => onDelete(p.id)}
                  className="text-red-600 hover:underline"
                >
                  Delete
                </button>
              )}
            </div>
          )}
          {editingPavilion !== null && (
            <EditPavilionModal
              storeId={storeId}
              pavilion={editingPavilion}
              onClose={() => setEditingPavilion(null)}
              onSaved={refresh}
            />
          )}
          <div className="mt-2 border-t pt-2">
            <div className="font-semibold text-sm mb-1">
              Additional charges
            </div>
            {hasPermission(permissions, 'CREATE_CHARGES') && (
              <button
                onClick={() => setAddingCharge(p)}
                className="text-xs text-blue-600"
              >
                + Add additional charges
              </button>
            )}
          {addingCharge && (
            <AddAdditionalChargeModal
              pavilionId={addingCharge.id}
              onClose={() => setAddingCharge(null)}
              onSaved={refresh}
            />
          )}
{p.additionalCharges?.length === 0 && (
  <div className="text-xs text-gray-500">
    No additional charges
  </div>
)}

{p.additionalCharges?.map((c: any) => (
  <div
    key={c.id}
    className="flex justify-between items-center text-sm"
  >
    <div>
      <span className="font-medium">{c.name}</span>
      <span className="ml-2 text-gray-500">${c.amount}</span>
    </div>

    {hasPermission(permissions, 'DELETE_CHARGES') && (
      <button
        className="text-red-600 text-xs hover:underline"
        onClick={async () => {
          if (!confirm('Delete charge?')) return;
          await deleteAdditionalCharge(p.id, c.id);
          refresh();
        }}
      >
        Delete
      </button>
    )}
  </div>
))}

          </div>
        </div>
      ))}
    </div>
  );
}
