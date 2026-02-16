export const PASSWORD_POLICY_MESSAGE =
  'Password must be at least 6 characters and contain letters, numbers and a special symbol';

export function isPasswordStrong(password: string) {
  if (typeof password !== 'string') return false;
  // At least 6 chars, at least one letter, one digit and one non-alphanumeric symbol.
  return /^(?=.*\p{L})(?=.*\d)(?=.*[^\p{L}\d]).{6,}$/u.test(password);
}

