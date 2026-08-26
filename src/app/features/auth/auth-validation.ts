export const AUTH_EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidAuthEmail(value: string): boolean {
  return AUTH_EMAIL_PATTERN.test(value.trim());
}
