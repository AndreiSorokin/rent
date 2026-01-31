import { Permission } from '@/types/store';

export function hasPermission(
  permissions: Permission[],
  permission: Permission,
) {
  return permissions.includes(permission);
}
