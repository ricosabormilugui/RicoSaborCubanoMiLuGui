import { Injectable, Injector, OnDestroy, computed, linkedSignal } from '@angular/core';
import { Router } from '@angular/router';
import { FAVORITES_LIMIT_MESSAGE, MAX_FAVORITES, uniqueFavoriteIds } from '../config/favorites.config';
import { resolveApiBaseUrl } from '../config/api.config';
import { ActiveIdentityService, GUEST_IDENTITY, StorageIdentity, getStorageKey } from './active-identity.service';
import { ApiRequestError, requestJson } from '../utils/api-client';
import { getUserFriendlyError } from '../utils/user-friendly-error';
import { safeReturnUrl } from '../utils/safe-return-url';

export type FavoritesRemote = {
  get(): Promise<string[]>;
  add(id: string): Promise<string[]>;
  remove(id: string): Promise<string[]>;
  removeMany(ids: string[]): Promise<string[]>;
};

function decodeJwtPayload(token: string): { role?: unknown; exp?: unknown } | null {
  const parts = String(token ?? '').split('.');
  if (parts.length !== 3 || !parts[1]) return null;
  try {
    const normalized = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
    return JSON.parse(globalThis.atob(padded)) as { role?: unknown; exp?: unknown };
  } catch {
    return null;
  }
}

function isCustomerAccessToken(token: string): boolean {
  const raw = String(token ?? '').trim();
  if (!raw) return false;
  const payload = decodeJwtPayload(raw);
  if (!payload) return raw.split('.').length !== 3;
  if (payload.role !== 'customer') return false;
  if (typeof payload.exp === 'number' && Number.isFinite(payload.exp) && payload.exp < Math.floor(Date.now() / 1000)) {
    return false;
  }
  return true;
}

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
    const raw = String(token ?? '').trim();
    this.token = isCustomerAccessToken(raw) ? raw : '';
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
      this.notify('warning', 'Favoritos', FAVORITES_LIMIT_MESSAGE, 'favorites-limit');
      return false;
    }

    const previous = current;
    this.applyIds(next);
    void this.persistMutation(removing ? 'remove' : 'add', id, previous);
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

  async pruneMissing(knownIds: readonly string[]): Promise<boolean> {
    if (!this.canUseRemote()) return false;
    const known = new Set(knownIds.map((item) => String(item ?? '').trim()).filter(Boolean));
    if (!known.size) return false;

    const current = this.storedIds();
    const orphans = current.filter((id) => !known.has(id));
    if (!orphans.length) return false;

    const previous = current;
    const next = current.filter((id) => known.has(id));
    this.applyIds(next);

    const generation = ++this.persistGeneration;
    try {
      const saved = await this.removeManyRemote(orphans);
      if (generation !== this.persistGeneration || !this.canUseRemote()) return false;
      this.applyIds(saved);
      return true;
    } catch (error) {
      if (generation !== this.persistGeneration || !this.canUseRemote()) return false;
      if (this.consumeAuthExpiry(error)) return false;
      const recovered = await this.recoverAfterFailure(previous);
      if (!recovered) {
        this.notify('error', 'Favoritos', getUserFriendlyError(error, 'No se pudo actualizar tu lista de favoritos.'), 'favorites-sync');
      }
      return false;
    }
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

  private async persistMutation(operation: 'add' | 'remove', id: string, previous: string[]): Promise<void> {
    const generation = ++this.persistGeneration;
    try {
      const saved = operation === 'add' ? await this.addRemote(id) : await this.removeRemote(id);
      if (generation !== this.persistGeneration || !this.canUseRemote()) return;
      this.applyIds(saved);
    } catch (error) {
      if (generation !== this.persistGeneration || !this.canUseRemote()) return;
      if (this.consumeAuthExpiry(error)) return;
      this.applyIds(previous);
      const limitReached = error instanceof ApiRequestError && error.status === 409;
      this.notify(
        limitReached ? 'warning' : 'error',
        'Favoritos',
        getUserFriendlyError(error, limitReached ? FAVORITES_LIMIT_MESSAGE : 'No se pudo actualizar tu lista de favoritos.'),
        limitReached ? 'favorites-limit' : 'favorites-sync'
      );
    }
  }

  private async recoverAfterFailure(previous: string[]): Promise<boolean> {
    const synced = await this.syncAuthenticatedFavorites();
    if (synced) return true;
    this.applyIds(previous);
    return false;
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

  private openLogin(): void {
    const injector = this.injector;
    if (!injector) return;
    try {
      const router = injector.get(Router);
      const current = router.url && !router.url.startsWith('/login') ? router.url : '/favoritos';
      void router.navigate(['/login'], { queryParams: { returnUrl: safeReturnUrl(current, '/favoritos') } });
    } catch {
      // Navigation is optional feedback; blocking the click is enough.
    }
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
    if (!(error instanceof ApiRequestError) || error.status !== 401) return false;
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

  private async addRemote(id: string): Promise<string[]> {
    if (this.remoteAdapter) return uniqueFavoriteIds([await this.remoteAdapter.add(id)]);
    const data = await requestJson<{ favorites?: unknown }>(`${this.endpoint}/${encodeURIComponent(id)}`, {
      method: 'POST',
      cache: 'no-store',
      headers: { Authorization: `Bearer ${this.token}` }
    }, 'No se pudieron guardar tus favoritos.');
    return uniqueFavoriteIds([Array.isArray(data.favorites) ? data.favorites : [id]]);
  }

  private async removeRemote(id: string): Promise<string[]> {
    if (this.remoteAdapter) return uniqueFavoriteIds([await this.remoteAdapter.remove(id)]);
    const data = await requestJson<{ favorites?: unknown }>(`${this.endpoint}/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      cache: 'no-store',
      headers: { Authorization: `Bearer ${this.token}` }
    }, 'No se pudieron guardar tus favoritos.');
    return uniqueFavoriteIds([Array.isArray(data.favorites) ? data.favorites : []]);
  }

  private async removeManyRemote(ids: string[]): Promise<string[]> {
    if (this.remoteAdapter) return uniqueFavoriteIds([await this.remoteAdapter.removeMany(ids)]);
    const data = await requestJson<{ favorites?: unknown }>(this.endpoint, {
      method: 'DELETE',
      cache: 'no-store',
      headers: {
        Authorization: `Bearer ${this.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ ids })
    }, 'No se pudieron guardar tus favoritos.');
    return uniqueFavoriteIds([Array.isArray(data.favorites) ? data.favorites : []]);
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
