import { useState } from 'react';
import { EditPavilionModal } from './EditPavilionModal';
import { Pavilion } from '@/types/store';
import { hasPermission } from '@/lib/permissions';

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

  const canEdit = hasPermission(permissions, 'EDIT_PAVILIONS');
  const canDelete = hasPermission(permissions, 'DELETE_PAVILIONS');

  console.log('permissions:', permissions);
console.log('canDelete:', canDelete);

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
        </div>
      ))}

      {editingPavilion !== null && (
        <EditPavilionModal
          storeId={storeId}
          pavilion={editingPavilion}
          onClose={() => setEditingPavilion(null)}
          onSaved={refresh}
        />
      )}
    </div>
  );
}
