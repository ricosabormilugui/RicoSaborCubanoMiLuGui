function getEnv(name: string): string | undefined {
  const value = process.env[name];
  return value && value.trim().length > 0 ? value : undefined;
}

function resolveBackendBase(): string | undefined {
  const direct = getEnv('BACKEND_API_URL');
  if (!direct) return undefined;
  return direct.replace(/\/$/, '');
}

function pickForwardHeaders(request: Request): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': request.headers.get('content-type') ?? 'application/json'
  };

  const authorization = request.headers.get('authorization');
  if (authorization) {
    headers.Authorization = authorization;
  }

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
  const backendBase = resolveBackendBase();
  if (!backendBase) {
    return new Response(JSON.stringify({ error: 'Missing BACKEND_API_URL' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const url = new URL(request.url);
  const splat = resolveSplat(url.pathname);
  if (!splat) {
    return new Response(JSON.stringify({ error: 'Missing API route' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const target = `${backendBase}/api/${splat}${url.search}`;

  try {
    const response = await fetch(target, {
      method: request.method,
      headers: pickForwardHeaders(request),
      body: request.method === 'GET' || request.method === 'HEAD' ? undefined : await request.text()
    });

    return new Response(await response.text(), {
      status: response.status,
      headers: { 'Content-Type': response.headers.get('content-type') ?? 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Proxy error' }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
