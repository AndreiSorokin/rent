'use client';

import { Pavilion, Permission } from '@/types/store';
import { hasPermission } from '@/lib/permissions';

interface Props {
  pavilions: Pavilion[];
  permissions: Permission[];
  onEdit: (pavilion: Pavilion) => void;
  onDelete: (id: number) => void;
}

export function PavilionList({
  pavilions,
  permissions,
  onEdit,
  onDelete,
}: Props) {
  return (
    <div className="bg-white shadow rounded p-4">
      <h2 className="text-lg font-semibold mb-4">Pavilions</h2>

      <table className="w-full border">
        <thead>
          <tr className="border-b">
            <th className="text-left p-2">Number</th>
            <th className="text-left p-2">Status</th>
            <th className="text-right p-2">Actions</th>
          </tr>
        </thead>
        <tbody>
          {pavilions.map((p) => (
            <tr key={p.id} className="border-b">
              <td className="p-2">{p.number}</td>
              <td className="p-2">{p.status}</td>
              <td className="p-2 text-right space-x-2">
                {hasPermission(permissions, 'EDIT_PAVILIONS') && (
                  <button
                    onClick={() => onEdit(p)}
                    className="text-blue-600 hover:underline"
                  >
                    Edit
                  </button>
                )}
                {hasPermission(permissions, 'DELETE_PAVILIONS') && (
                  <button
                    onClick={() => onDelete(p.id)}
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

      {pavilions.length === 0 && (
        <div className="text-gray-500 text-sm">No pavilions yet</div>
      )}
    </div>
  );
}
