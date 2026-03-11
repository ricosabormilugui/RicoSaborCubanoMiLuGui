function isLocalHost(hostname: string): boolean {
  return hostname === 'localhost' || hostname === '127.0.0.1';
}

export function resolveApiBaseUrl(): string {
  const hostname = globalThis?.location?.hostname ?? '';
  return isLocalHost(hostname) ? 'http://localhost:3001/api' : '/api';
}
