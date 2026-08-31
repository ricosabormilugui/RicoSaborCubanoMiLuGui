const DEFAULT_ERROR = 'No hemos podido completar la operación. Inténtalo de nuevo.';
const TECHNICAL_ERROR = /HttpErrorResponse|Http failure response|Mongo\w*Error|ECONN\w*|ENOTFOUND|ETIMEDOUT|E11000|Internal Server Error|Unexpected token|JSON\.parse|SyntaxError|TypeError|Failed to fetch|fetch failed|NetworkError|SQLSTATE|CastError|ValidationError|\bstack\b|\bSMTP\b|https?:\/\/|\[object Object\]|<\/?(?:html|body|script)|\bat\s+\S+\s*\([^)]*:\d+|^unknown$|backendapi|Backend API|BACKEND_API|Netlify Function|submit-order|api-proxy/i;

/** Preserve readable business messages, never expose transport/database details. */
export function getUserFriendlyError(error: unknown, fallback = DEFAULT_ERROR): string {
  const source = error && typeof error === 'object' ? error as { status?: number; kind?: string; message?: unknown; error?: unknown } : {};
  if (source.kind === 'timeout') return 'La operación superó el tiempo de espera. Inténtalo de nuevo.';
  if (source.status === 401) return 'Tu sesión ha caducado. Inicia sesión nuevamente.';
  if (source.status === 403) return 'No tienes permisos para realizar esta acción.';
  if (source.status === 429) return 'Has realizado demasiados intentos. Inténtalo de nuevo más tarde.';
  if (source.status !== undefined && source.status >= 500) return DEFAULT_ERROR;
  if (source.status === 0 || source.kind === 'network') return 'No podemos conectar con el servicio. Comprueba tu conexión e inténtalo de nuevo.';
  const nested = source.error && typeof source.error === 'object' ? (source.error as { message?: unknown }).message : source.error;
  const detail = typeof error === 'string' ? error : nested ?? source.message;
  if (typeof detail === 'string' && detail.trim() && detail.length <= 500 && !TECHNICAL_ERROR.test(detail) && !/^[A-Z][A-Z_\d]{2,}$/.test(detail)) return detail.trim();
  if (source.status === 409) return 'La operación entra en conflicto con los datos actuales.';
  if (source.status === 404) return 'No se encontró el recurso solicitado.';
  return fallback;
}
