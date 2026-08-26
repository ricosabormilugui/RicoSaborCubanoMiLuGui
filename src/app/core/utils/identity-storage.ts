export type StorageIdentity = { type: 'guest' } | { type: 'user'; userId: string };
export type IdentityResource = 'cart' | 'activity' | 'shipping' | 'order-intent' | 'favorites';

export const GUEST_IDENTITY: StorageIdentity = { type: 'guest' };
export const LEGACY_LOCAL_KEYS = ['ricosabor-cart', 'mixsabor.notifications', 'ricosabor-local-orders', 'mixsabor.cart'] as const;
export const LEGACY_SESSION_KEYS = ['mixsabor-order-intent-v1'] as const;

export function getStorageKey(resource: IdentityResource, identity: StorageIdentity): string {
  return identity.type === 'guest'
    ? `mixsabor.guest.${resource}`
    : `mixsabor.user.${encodeURIComponent(identity.userId)}.${resource}`;
}

export function canonicalUserId(userId: unknown): string {
  return String(userId ?? '').trim();
}
