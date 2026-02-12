import { Permission } from '@/types/store';

const ALL_PERMISSIONS: Permission[] = [
  'VIEW_PAVILIONS',
  'CREATE_PAVILIONS',
  'EDIT_PAVILIONS',
  'DELETE_PAVILIONS',
  'VIEW_PAYMENTS',
  'CREATE_PAYMENTS',
  'EDIT_PAYMENTS',
  'CALCULATE_PAYMENTS',
  'VIEW_CHARGES',
  'CREATE_CHARGES',
  'EDIT_CHARGES',
  'DELETE_CHARGES',
  'VIEW_CONTRACTS',
  'UPLOAD_CONTRACTS',
  'DELETE_CONTRACTS',
  'INVITE_USERS',
  'ASSIGN_PERMISSIONS',
];

export function PermissionEditor({
  current,
  onChange,
}: {
  current: Permission[];
  onChange: (perms: Permission[]) => void;
}) {
  return (
    <select
      multiple
      value={current}
      onChange={(e) => {
        const selected = Array.from(e.target.selectedOptions).map(o => o.value as Permission);
        onChange(selected);
      }}
      className="w-full p-2 border rounded"
    >
      {ALL_PERMISSIONS.map(p => (
        <option key={p} value={p}>
          {p}
        </option>
      ))}
    </select>
  );
}
