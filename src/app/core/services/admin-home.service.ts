import { Injectable } from '@angular/core';
import { resolveApiBaseUrl } from '../config/api.config';
import { AdminAuthService } from './admin-auth.service';
import { HomeContent, normalizeHomeContent } from '../models/home-content.model';

@Injectable({ providedIn: 'root' })
export class AdminHomeService {
  private readonly apiBase = resolveApiBaseUrl();

  constructor(private readonly auth: AdminAuthService) {}

  async getHomeContent(): Promise<HomeContent> {
    const response = await fetch(`${this.apiBase}/admin/home`, {
      headers: { Authorization: `Bearer ${this.auth.token()}` }
    });

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        this.auth.logout();
      }
      throw new Error('No fue posible cargar las imágenes de la portada.');
    }

    const data = (await response.json()) as { home?: Partial<HomeContent> };
    return normalizeHomeContent(data.home);
  }

  async saveHomeContent(payload: HomeContent): Promise<HomeContent> {
    const response = await fetch(`${this.apiBase}/admin/home`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.auth.token()}`
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        this.auth.logout();
      }
      let detail = '';
      try {
        const data = (await response.json()) as { error?: string };
        detail = data.error ?? '';
      } catch {
        detail = await response.text();
      }

      throw new Error(detail || 'No fue posible guardar las imágenes de la portada.');
    }

    const data = (await response.json()) as { home?: Partial<HomeContent> };
    return normalizeHomeContent(data.home);
  }
}
