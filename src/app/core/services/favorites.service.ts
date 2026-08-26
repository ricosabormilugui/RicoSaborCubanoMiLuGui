import { Injectable, Injector, OnDestroy, computed, linkedSignal } from '@angular/core';
import { MAX_FAVORITES, uniqueFavoriteIds } from '../config/favorites.config';
import { resolveApiBaseUrl } from '../config/api.config';
import { ActiveIdentityService, GUEST_IDENTITY, StorageIdentity, getStorageKey } from './active-identity.service';
import { ApiRequestError, requestJson } from '../utils/api-client';
import { getUserFriendlyError } from '../utils/user-friendly-error';

export type FavoritesRemote = {
  get(): Promise<string[]>;
  put(ids: string[]): Promise<string[]>;
};

@Injectable({ providedIn: 'root' })
export class FavoritesService implements OnDestroy {
  private readonly storedIds = linkedSignal<string[]>(() => {
    this.identity.session();
    return this.readCurrent();
  });
  private readonly onStorage = (event: StorageEvent): void => {
    if (event.key === this.identity.storageKey('favorites') || event.key === null) this.storedIds.set(this.readCurrent());
  };

  private token = '';
  private onAuthExpired?: () => void;
  private remoteAdapter: FavoritesRemote | null = null;
  private syncGeneration = 0;
  private persistGeneration = 0;
  private readonly endpoint = `${resolveApiBaseUrl()}/customer/favorites`;

  readonly ids = computed(() => this.storedIds());
  readonly count = computed(() => this.storedIds().length);
  readonly set = computed(() => new Set(this.storedIds()));

  constructor(
    private readonly identity: ActiveIdentityService,
    private readonly injector?: Injector
  ) {
    this.discardGuestFavorites();
    globalThis.addEventListener?.('storage', this.onStorage);
  }

  ngOnDestroy(): void {
    globalThis.removeEventListener?.('storage', this.onStorage);
  }

  useRemoteAdapter(adapter: FavoritesRemote | null): void {
    this.remoteAdapter = adapter;
  }

  bindSession(token: string, onAuthExpired?: () => void): void {
    this.discardGuestFavorites();
    this.token = String(token ?? '');
    this.onAuthExpired = this.token ? onAuthExpired : undefined;
    this.syncGeneration += 1;
    this.persistGeneration += 1;
  }

  isFavorite(productId: string): boolean {
    return this.set().has(productId);
  }

  toggle(productId: string): boolean {
    const id = String(productId ?? '').trim();
    if (!id) return false;
    if (!this.canUseRemote()) {
      this.requireAuthentication();
      return false;
    }

    const current = this.storedIds();
    const removing = current.includes(id);
    const next = removing ? current.filter((item) => item !== id) : uniqueFavoriteIds([current, [id]]);
    if (!removing && next.length > MAX_FAVORITES) {
      this.notify('warning', 'Favoritos', `Puedes guardar hasta ${MAX_FAVORITES} productos. Quita alguno para añadir otro.`, 'favorites-limit');
      return false;
    }

    const previous = current;
    this.applyIds(next);
    void this.persistRemote(next, previous);
    return next.includes(id);
  }

  readIdentityFavorites(identity: StorageIdentity): string[] {
    if (identity.type !== 'user') return [];
    return this.readKey(getStorageKey('favorites', identity));
  }

  async syncAuthenticatedFavorites(): Promise<boolean> {
    if (this.identity.identity()?.type !== 'user' || !this.canUseRemote()) return false;

    const generation = this.syncGeneration;
    let remoteIds: string[];
    try {
      remoteIds = await this.getRemote();
    } catch (error) {
      if (!this.isCurrentGeneration(generation)) return false;
      if (this.consumeAuthExpiry(error)) return false;
      return false;
    }
    if (!this.isCurrentGeneration(generation)) return false;
    this.applyIds(remoteIds);
    return true;
  }

  pruneMissing(knownIds: readonly string[]): void {
    if (!this.canUseRemote()) return;
    const known = new Set(knownIds.map((item) => String(item ?? '').trim()).filter(Boolean));
    if (!known.size) return;

    const current = this.storedIds();
    const next = current.filter((id) => known.has(id));
    if (next.length === current.length) return;
    this.applyIds(next);
  }

  private canUseRemote(): boolean {
    return this.identity.identity()?.type === 'user' && this.token.length > 0;
  }

  private isCurrentGeneration(generation: number): boolean {
    return generation === this.syncGeneration && this.canUseRemote();
  }

  private applyIds(ids: string[]): void {
    this.storedIds.set(ids);
    this.writeCurrent(ids);
  }

  private async persistRemote(next: string[], previous: string[]): Promise<void> {
    const generation = ++this.persistGeneration;
    try {
      const saved = await this.putRemote(next);
      if (generation !== this.persistGeneration || !this.canUseRemote()) return;
      this.applyIds(saved);
    } catch (error) {
      if (generation !== this.persistGeneration || !this.canUseRemote()) return;
      if (this.consumeAuthExpiry(error)) return;
      this.applyIds(previous);
      this.notify('error', 'Favoritos', getUserFriendlyError(error, 'No se pudo actualizar tu lista de favoritos.'), 'favorites-sync');
    }
  }

  private requireAuthentication(): void {
    this.notify(
      'warning',
      'Favoritos',
      'Inicia sesión para guardar productos en favoritos.',
      'favorites-login',
      {
        label: 'Iniciar sesión',
        handler: () => this.openLogin()
      }
    );
  }

  private async openLogin(): Promise<void> {
    const injector = this.injector;
    if (!injector) return;
    const { Router } = await import('@angular/router');
    const router = injector.get(Router);
    const current = router.url && router.url !== '/login' ? router.url : '/favoritos';
    await router.navigate(['/login'], { queryParams: { returnUrl: current } });
  }

  private notify(
    type: 'warning' | 'error',
    title: string,
    message: string,
    key: string,
    action?: { label: string; handler: () => void | Promise<unknown> }
  ): void {
    const injector = this.injector;
    if (!injector) return;
    void import('./notification.service').then(({ NotificationService }) => {
      injector.get(NotificationService)[type](title, message, { key, action });
    }).catch(() => { /* Feedback must never break favorites persistence. */ });
  }

  private consumeAuthExpiry(error: unknown): boolean {
    if (!(error instanceof ApiRequestError) || ![401, 403].includes(error.status)) return false;
    const expire = this.onAuthExpired;
    this.onAuthExpired = undefined;
    this.token = '';
    this.syncGeneration += 1;
    this.persistGeneration += 1;
    expire?.();
    return true;
  }

  private async getRemote(): Promise<string[]> {
    if (this.remoteAdapter) return uniqueFavoriteIds([await this.remoteAdapter.get()]);
    const data = await requestJson<{ favorites?: unknown }>(this.endpoint, {
      cache: 'no-store',
      headers: { Authorization: `Bearer ${this.token}` }
    }, 'No se pudieron cargar tus favoritos.');
    return uniqueFavoriteIds([Array.isArray(data.favorites) ? data.favorites : []]);
  }

  private async putRemote(ids: string[]): Promise<string[]> {
    if (this.remoteAdapter) return uniqueFavoriteIds([await this.remoteAdapter.put(ids)]);
    const data = await requestJson<{ favorites?: unknown }>(this.endpoint, {
      method: 'PUT',
      cache: 'no-store',
      headers: {
        Authorization: `Bearer ${this.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ favorites: ids })
    }, 'No se pudieron guardar tus favoritos.');
    return uniqueFavoriteIds([Array.isArray(data.favorites) ? data.favorites : ids]);
  }

  private discardGuestFavorites(): void {
    try {
      globalThis.localStorage?.removeItem(getStorageKey('favorites', GUEST_IDENTITY));
    } catch {
      // Leftover guest keys must never block the authenticated favorites flow.
    }
  }

  private readCurrent(): string[] {
    const identity = this.identity.identity();
    if (identity?.type !== 'user') return [];
    const key = this.identity.storageKey('favorites');
    return key ? this.readKey(key) : [];
  }

  private writeCurrent(ids: string[]): boolean {
    const identity = this.identity.identity();
    if (identity?.type !== 'user') return false;
    const key = this.identity.storageKey('favorites');
    return key ? this.writeKey(key, ids) : false;
  }

  private readKey(key: string): string[] {
    try {
      const raw = globalThis.localStorage?.getItem(key);
      if (!raw) return [];
      const parsed = JSON.parse(raw) as { ids?: unknown };
      if (!Array.isArray(parsed?.ids)) return [];
      return uniqueFavoriteIds([parsed.ids]);
    } catch {
      return [];
    }
  }

  private writeKey(key: string, ids: string[]): boolean {
    try {
      globalThis.localStorage?.setItem(key, JSON.stringify({ version: 1, ids }));
      return true;
    } catch {
      return false;
    }
  }
}
