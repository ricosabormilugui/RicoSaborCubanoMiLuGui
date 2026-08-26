import { Injectable, computed, signal } from '@angular/core';
import {
  GUEST_IDENTITY,
  IdentityResource,
  LEGACY_LOCAL_KEYS,
  LEGACY_SESSION_KEYS,
  StorageIdentity,
  canonicalUserId,
  getStorageKey
} from '../utils/identity-storage';

export {
  GUEST_IDENTITY,
  canonicalUserId,
  getStorageKey
};
export type { IdentityResource, StorageIdentity };

export class StaleIdentityError extends Error {
  constructor() {
    super('La sesión ha cambiado.');
    this.name = 'StaleIdentityError';
  }
}

function discardLegacyStorage(): void {
  // Ambiguous legacy records can contain customization/contact data. Never adopt them.
  for (const key of LEGACY_LOCAL_KEYS) {
    try { globalThis.localStorage?.removeItem(key); } catch { /* Never read legacy data, even if removal is blocked. */ }
  }
  for (const key of LEGACY_SESSION_KEYS) {
    try { globalThis.sessionStorage?.removeItem(key); } catch { /* Same conservative policy for session leftovers. */ }
  }
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
    discardLegacyStorage();
  }

  activate(identity: StorageIdentity | null): void {
    this.version.update(value => value + 1);
    this.state.set(identity);
  }

  beginTransition(): void {
    this.activate(null);
  }

  storageKey(resource: IdentityResource): string | null {
    const identity = this.identity();
    return identity ? getStorageKey(resource, identity) : null;
  }

  isCurrent(session: string): boolean {
    return session === this.session();
  }

  assertCurrent(session: string): void {
    if (!this.isCurrent(session)) throw new StaleIdentityError();
  }
}
