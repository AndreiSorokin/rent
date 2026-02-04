import { Permission } from '@prisma/client';

const ALL_PERMISSIONS = Object.values(Permission);

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