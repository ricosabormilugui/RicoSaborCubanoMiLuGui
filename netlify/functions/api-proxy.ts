function getEnv(name: string): string | undefined {
  const value = process.env[name];
  return value && value.trim().length > 0 ? value : undefined;
}

const SAFE_REQUEST_ID = /^[A-Za-z0-9._:-]{8,128}$/;

function resolveRequestId(request: Request): string {
  const incoming = request.headers.get('x-request-id')?.trim() ?? '';
  return SAFE_REQUEST_ID.test(incoming) ? incoming : crypto.randomUUID();
}

async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs = Number(getEnv('BACKEND_TIMEOUT_MS') ?? 10_000)): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

function jsonError(message: string, status: number, requestId: string): Response {
  return new Response(JSON.stringify({ message, requestId }), {
    status,
    headers: { 'Content-Type': 'application/json', 'X-Request-Id': requestId }
  });
}

function resolveBackendBase(): string | undefined {
  const direct = getEnv('BACKEND_API_URL');
  if (!direct) return undefined;

  return direct.replace(/\/$/, '');
}

function buildTargetUrl(backendBase: string, splat: string, search: string): string {
  const base = backendBase.replace(/\/$/, '');
  const apiBase = base.endsWith('/api') ? base : `${base}/api`;
  return `${apiBase}/${splat}${search}`;
}

function pickForwardHeaders(request: Request, requestId: string): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': request.headers.get('content-type') ?? 'application/json',
    'X-Request-Id': requestId
  };

  const authorization = request.headers.get('authorization');
  if (authorization) {
    headers['Authorization'] = authorization;
  }
  const idempotencyKey = request.headers.get('idempotency-key');
  if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey;

  return headers;
}

function resolveSplat(pathname: string): string {
  const marker = '/.netlify/functions/api-proxy/';
  const idx = pathname.indexOf(marker);
  if (idx >= 0) {
    return pathname.slice(idx + marker.length);
  }

  if (pathname.startsWith('/api/')) {
    return pathname.slice('/api/'.length);
  }

  return '';
}

export default async (request: Request): Promise<Response> => {
  const requestId = resolveRequestId(request);
  const backendBase = resolveBackendBase();
  if (!backendBase) {
    return jsonError('El proxy no está configurado.', 503, requestId);
  }

  const url = new URL(request.url);
  const splat = resolveSplat(url.pathname);
  if (!splat) {
    return jsonError('Ruta API no válida.', 400, requestId);
  }

  const target = buildTargetUrl(backendBase, splat, url.search);

  try {
    const response = await fetchWithTimeout(target, {
      method: request.method,
      headers: pickForwardHeaders(request, requestId),
      body: request.method === 'GET' || request.method === 'HEAD' ? undefined : await request.text()
    });

    const responseHeaders: Record<string, string> = {
      'Content-Type': response.headers.get('content-type') ?? 'application/json'
    };
    responseHeaders['X-Request-Id'] = response.headers.get('x-request-id') ?? requestId;
    const cacheControl = response.headers.get('cache-control');
    if (cacheControl) responseHeaders['Cache-Control'] = cacheControl;
    const retryAfter = response.headers.get('retry-after');
    if (retryAfter) responseHeaders['Retry-After'] = retryAfter;

    return new Response(await response.text(), {
      status: response.status,
      headers: responseHeaders
    });
  } catch (error) {
    return error instanceof Error && error.name === 'AbortError'
      ? jsonError('El backend superó el tiempo de espera.', 504, requestId)
      : jsonError('El backend no está disponible.', 502, requestId);
  }
};
