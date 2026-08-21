import { Injectable, signal } from '@angular/core';
import { resolveApiBaseUrl } from '../config/api.config';
import { emptyHomeContent, HomeContent, normalizeHomeContent } from '../models/home-content.model';

@Injectable({ providedIn: 'root' })
export class HomeContentService {
  private readonly endpoint = `${resolveApiBaseUrl()}/home`;
  private loadingRequest: Promise<void> | null = null;

  readonly content = signal<HomeContent>(emptyHomeContent());
  readonly loading = signal(false);

  async load(): Promise<void> {
    if (this.loadingRequest) return this.loadingRequest;

    this.loading.set(true);
    this.loadingRequest = this.fetchContent()
      .catch(() => {
        this.content.set(emptyHomeContent());
      })
      .finally(() => {
        this.loading.set(false);
        this.loadingRequest = null;
      });

    return this.loadingRequest;
  }

  private async fetchContent(): Promise<void> {
    const response = await fetch(this.endpoint);
    if (!response.ok) throw new Error('No se pudo cargar la portada.');

    const data = (await response.json()) as { home?: Partial<HomeContent> };
    this.content.set(normalizeHomeContent(data.home));
  }
}
