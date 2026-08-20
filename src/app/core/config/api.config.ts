import { environment } from '../../../environments/environment';

function stripTrailingSlash(value: string): string {
  return value.endsWith('/') ? value.slice(0, -1) : value;
}

export function resolveApiBaseUrl(): string {
  const apiUrl = stripTrailingSlash(environment.apiUrl || '');
  return apiUrl ? `${apiUrl}/api` : '/api';
}
