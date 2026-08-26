/** Default post-auth destination when no safe `returnUrl` is present. */
export const DEFAULT_AUTH_RETURN_URL = '/checkout';

const AUTH_LOOP_PATHS = new Set(['/login', '/registro', '/recuperar-contrasena', '/reset-password']);

function decodeReturnUrl(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/**
 * Accepts only same-origin path navigation. Rejects protocol-relative URLs,
 * schemes (`https:`, `javascript:`), backslashes and auth-loop routes.
 */
export function isSafeReturnUrl(value: string | null | undefined): boolean {
  const raw = String(value ?? '').trim();
  if (!raw) return false;

  const path = decodeReturnUrl(raw).trim();
  if (!path.startsWith('/') || path.startsWith('//') || path.includes('\\')) return false;
  if (/[\u0000-\u001F\u007F]/.test(path)) return false;
  if (/^[a-z][a-z0-9+.-]*:/i.test(path)) return false;

  const pathname = path.split(/[?#]/, 1)[0] ?? path;
  if (AUTH_LOOP_PATHS.has(pathname)) return false;
  return true;
}

export function safeReturnUrl(value: string | null | undefined, fallback = DEFAULT_AUTH_RETURN_URL): string {
  const path = String(value ?? '').trim();
  return isSafeReturnUrl(path) ? decodeReturnUrl(path).trim() : fallback;
}

export function returnUrlQueryParams(value: string | null | undefined): { returnUrl: string } | Record<string, never> {
  const path = String(value ?? '').trim();
  return isSafeReturnUrl(path) ? { returnUrl: decodeReturnUrl(path).trim() } : {};
}
