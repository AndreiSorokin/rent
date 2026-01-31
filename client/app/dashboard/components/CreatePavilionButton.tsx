'use client';

import { Permission } from '@/types/store';
import { hasPermission } from '@/lib/permissions';

export function CreatePavilionButton({
  permissions,
  onClick,
}: {
  permissions: Permission[];
  onClick: () => void;
}) {
  if (!hasPermission(permissions, 'CREATE_PAVILIONS')) return null;

  return (
    <button
      onClick={onClick}
      className="mb-4 px-4 py-2 bg-green-600 text-white rounded"
    >
      + Add Pavilion
    </button>
  );
}
