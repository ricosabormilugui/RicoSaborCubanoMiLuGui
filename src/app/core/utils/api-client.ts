import { getUserFriendlyError } from './user-friendly-error';

export type ApiErrorKind = 'http' | 'network' | 'timeout';

export class ApiRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly requestId?: string,
    readonly kind: ApiErrorKind = 'http',
    readonly body: {
      code?: string;
      productId?: string;
      available?: number;
      productName?: string;
    } = {}
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
  return getUserFriendlyError({ status, message: detail }, fallback);
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
      throw new ApiRequestError('No hemos podido conectar en este momento. Inténtalo de nuevo.', 0, undefined, 'timeout');
    }
    throw new ApiRequestError('No hemos podido conectar en este momento. Inténtalo de nuevo.', 0, undefined, 'network');
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
    const available = Number(data['available']);
    throw new ApiRequestError(messageForStatus(response.status, detail, fallback), response.status, requestId, 'http', {
      code: typeof data['code'] === 'string' ? data['code'] : undefined,
      productId: typeof data['productId'] === 'string' ? data['productId'] : undefined,
      available: Number.isFinite(available) ? available : undefined,
      productName: typeof data['productName'] === 'string' ? data['productName'] : undefined
    });
  }
  return data as T;
}
