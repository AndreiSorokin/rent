export function hasPermission(
  userPermissions: string[],
  required: string
) {
  return userPermissions.includes(required);
}