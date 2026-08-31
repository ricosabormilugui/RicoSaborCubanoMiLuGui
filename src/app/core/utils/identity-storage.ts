export type StorageIdentity = { type: 'guest' } | { type: 'user'; userId: string };
export type IdentityResource = 'cart' | 'activity' | 'shipping' | 'order-intent' | 'favorites' | 'coupon' | 'checkout-draft';

export const GUEST_IDENTITY: StorageIdentity = { type: 'guest' };
export const LEGACY_LOCAL_KEYS = ['ricosabor-cart', 'mixsabor.notifications', 'ricosabor-local-orders', 'mixsabor.cart', 'mixsabor.guest.favorites'] as const;
export const LEGACY_SESSION_KEYS = ['mixsabor-order-intent-v1'] as const;

export function getStorageKey(resource: IdentityResource, identity: StorageIdentity): string {
  return identity.type === 'guest'
    ? `mixsabor.guest.${resource}`
    : `mixsabor.user.${encodeURIComponent(identity.userId)}.${resource}`;
}

export function canonicalUserId(userId: unknown): string {
  return String(userId ?? '').trim();
}
