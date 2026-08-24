export type ApiErrorKind = 'http' | 'network' | 'timeout';

export class ApiRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly requestId?: string,
    readonly kind: ApiErrorKind = 'http'
  ) {
    super(message);
    this.name = 'ApiRequestError';
  }
}

function createRequestId(): string {
  try {
    return globalThis.crypto?.randomUUID?.() ?? `web-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  } catch {
    return `web-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
}

function messageForStatus(status: number, detail: string, fallback: string): string {
  if (status === 401) return 'Tu sesión ha caducado. Inicia sesión de nuevo.';
  if (status === 403) return 'No tienes permisos para realizar esta acción.';
  if (status === 404) return detail || 'No se encontró el recurso solicitado.';
  if (status === 409) return detail || 'La operación entra en conflicto con datos existentes.';
  if (status === 429) return 'Has realizado demasiados intentos. Inténtalo de nuevo más tarde.';
  if (status >= 500) return 'El servicio no está disponible temporalmente. Inténtalo de nuevo.';
  return detail || fallback;
}

export async function apiFetch(input: RequestInfo | URL, init: RequestInit = {}, timeoutMs = 12_000): Promise<Response> {
  const controller = new AbortController();
  const timeout = globalThis.setTimeout(() => controller.abort(), timeoutMs);
  const headers = new Headers(init.headers);
  if (!headers.has('X-Request-Id')) headers.set('X-Request-Id', createRequestId());
  try {
    return await fetch(input, { ...init, headers, signal: controller.signal });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new ApiRequestError('La operación superó el tiempo de espera. Inténtalo de nuevo.', 0, undefined, 'timeout');
    }
    throw new ApiRequestError('No podemos conectar con el servicio. Comprueba tu conexión e inténtalo de nuevo.', 0, undefined, 'network');
  } finally {
    globalThis.clearTimeout(timeout);
  }
}

export async function requestJson<T>(input: RequestInfo | URL, init: RequestInit = {}, fallback = 'No se pudo completar la operación.', timeoutMs = 12_000): Promise<T> {
  const response = await apiFetch(input, init, timeoutMs);
  let data: Record<string, unknown> = {};
  try {
    data = await response.json() as Record<string, unknown>;
  } catch {
    data = {};
  }
  if (!response.ok) {
    const detail = String(data['message'] ?? data['error'] ?? '');
    const requestId = response.headers.get('x-request-id') ?? (String(data['requestId'] ?? '') || undefined);
    throw new ApiRequestError(messageForStatus(response.status, detail, fallback), response.status, requestId);
  }
  return data as T;
}
