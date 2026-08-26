import { Injectable, OnDestroy, computed, linkedSignal } from '@angular/core';
import { ActiveIdentityService } from './active-identity.service';

const MAX_FAVORITES = 80;

@Injectable({ providedIn: 'root' })
export class FavoritesService implements OnDestroy {
  private readonly ids = linkedSignal<string[]>(() => {
    this.identity.session();
    return this.read();
  });
  private readonly onStorage = (event: StorageEvent): void => {
    if (event.key === this.identity.storageKey('favorites') || event.key === null) this.ids.set(this.read());
  };

  readonly set = computed(() => new Set(this.ids()));

  constructor(private readonly identity: ActiveIdentityService) {
    globalThis.addEventListener?.('storage', this.onStorage);
  }

  ngOnDestroy(): void {
    globalThis.removeEventListener?.('storage', this.onStorage);
  }

  isFavorite(productId: string): boolean {
    return this.set().has(productId);
  }

  toggle(productId: string): boolean {
    const id = String(productId ?? '').trim();
    if (!id || !this.identity.storageKey('favorites')) return false;

    const current = this.ids();
    const next = current.includes(id)
      ? current.filter((item) => item !== id)
      : [...current, id].slice(-MAX_FAVORITES);
    this.ids.set(next);
    this.write(next);
    return next.includes(id);
  }

  private read(): string[] {
    try {
      const key = this.identity.storageKey('favorites');
      if (!key) return [];
      const raw = globalThis.localStorage?.getItem(key);
      if (!raw) return [];
      const parsed = JSON.parse(raw) as { ids?: unknown };
      if (!Array.isArray(parsed?.ids)) return [];
      return parsed.ids.map((item) => String(item ?? '').trim()).filter(Boolean).slice(0, MAX_FAVORITES);
    } catch {
      return [];
    }
  }

  private write(ids: string[]): void {
    try {
      const key = this.identity.storageKey('favorites');
      if (!key) return;
      globalThis.localStorage?.setItem(key, JSON.stringify({ version: 1, ids }));
    } catch {
      // Keep the in-memory selection if storage is blocked.
    }
  }
}
