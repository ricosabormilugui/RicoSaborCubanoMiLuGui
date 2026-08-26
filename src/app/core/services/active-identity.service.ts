import { Injectable, computed, signal } from '@angular/core';

export type StorageIdentity = { type: 'guest' } | { type: 'user'; userId: string };
export type IdentityResource = 'cart' | 'notifications' | 'order-intent';
export function getStorageKey(resource: IdentityResource, identity: StorageIdentity): string {
  return identity.type === 'guest' ? `mixsabor.guest.${resource}` : `mixsabor.user.${encodeURIComponent(identity.userId)}.${resource}`;
}
export class StaleIdentityError extends Error {
  constructor() { super('La sesión ha cambiado.'); this.name = 'StaleIdentityError'; }
}

@Injectable({ providedIn: 'root' })
export class ActiveIdentityService {
  // null means credentials exist but the canonical identity is not yet resolved.
  private readonly state = signal<StorageIdentity | null>(null);
  readonly identity = this.state.asReadonly();
  readonly version = signal(0);
  readonly key = computed(() => {
    const identity = this.identity();
    return !identity ? 'pending' : identity.type === 'guest' ? 'guest' : `user:${identity.userId}`;
  });
  readonly session = computed(() => `${this.version()}:${this.key()}`);

  constructor() {
    // Ambiguous legacy records can contain customization/contact data. Never adopt them.
    for (const key of ['ricosabor-cart', 'mixsabor.notifications', 'ricosabor-local-orders']) {
      try { globalThis.localStorage?.removeItem(key); } catch { /* Never read legacy data, even if removal is blocked. */ }
    }
    try { globalThis.sessionStorage?.removeItem('mixsabor-order-intent-v1'); } catch {}
  }
  activate(identity: StorageIdentity | null): void {
    this.version.update(value => value + 1);
    this.state.set(identity);
  }
  storageKey(resource: IdentityResource): string | null {
    const identity = this.identity();
    return identity ? getStorageKey(resource, identity) : null;
  }
  isCurrent(session: string): boolean { return session === this.session(); }
  assertCurrent(session: string): void { if (!this.isCurrent(session)) throw new StaleIdentityError(); }
}
