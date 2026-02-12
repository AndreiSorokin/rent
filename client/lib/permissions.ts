import { Permission } from '@/types/store';

export function hasPermission(
  permissions: readonly string[],
  permission: Permission,
) {
  return permissions.includes(permission);
}
