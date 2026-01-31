import { useState } from 'react';
import { EditPavilionModal } from './EditPavilionModal';

export function PavilionList({
  storeId,
  pavilions,
  permissions,
  refresh,
}: {
  storeId: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  pavilions: any[];
  permissions: string[];
  refresh: () => void;
}) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [editing, setEditing] = useState<any>(null);

  const canEdit = permissions.includes('EDIT_PAVILIONS');

  return (
    <div>
      {pavilions.map((p: any) => (
        <div key={p.id} className="border p-3 mb-2 flex justify-between">
          <div>
            <div>Pavilion #{p.number}</div>
            <div>Status: {p.status}</div>
          </div>

          {canEdit && (
            <button
              onClick={() => setEditing(p)}
              className="btn-secondary"
            >
              Edit
            </button>
          )}
        </div>
      ))}

      {editing && (
        <EditPavilionModal
            storeId={storeId}
            pavilion={editing}
            onClose={() => setEditing(null)}
            onSaved={refresh}
        />
      )}
    </div>
  );
}
