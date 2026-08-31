import { Injectable, OnDestroy, computed, linkedSignal } from '@angular/core';
import { ActiveIdentityService, GUEST_IDENTITY, StorageIdentity, getStorageKey } from './active-identity.service';

export function evaluateCouponCode(raw: string): { code: string; valid: boolean; message: string } {
  const code = String(raw ?? '').trim().toUpperCase().replace(/\s+/g, '');
  if (!code) return { code: '', valid: false, message: '' };
  if (code !== 'PRIMER10') {
    return { code, valid: false, message: 'Cupón no válido. Usa PRIMER10 si es tu primer pedido.' };
  }
  return { code, valid: true, message: '' };
}

interface CouponDraft {
  code: string;
  applied: boolean;
}

const EMPTY: CouponDraft = { code: '', applied: false };

@Injectable({ providedIn: 'root' })
export class CouponDraftService implements OnDestroy {
  private readonly state = linkedSignal<CouponDraft>(() => {
    this.identity.session();
    return this.restore();
  });
  private readonly onStorage = (event: StorageEvent): void => {
    if (event.key === this.identity.storageKey('coupon') || event.key === null) this.state.set(this.restore());
  };

  readonly code = computed(() => this.state().code);
  readonly applied = computed(() => this.state().applied);

  constructor(private readonly identity: ActiveIdentityService) {
    globalThis.addEventListener?.('storage', this.onStorage);
  }

  ngOnDestroy(): void {
    globalThis.removeEventListener?.('storage', this.onStorage);
  }

  setCode(value: string): void {
    const code = String(value ?? '').toUpperCase().replace(/\s+/g, '');
    this.commit({ code, applied: false });
  }

  apply(): { valid: boolean; message: string } {
    const result = evaluateCouponCode(this.state().code);
    this.commit({ code: result.code, applied: result.valid });
    return { valid: result.valid, message: result.message };
  }

  clear(): void {
    this.commit(EMPTY);
  }

  discount(subtotal: number): number {
    return this.applied() ? Number((Number(subtotal) * 0.10).toFixed(2)) : 0;
  }

  adoptGuestCoupon(): boolean {
    const identity = this.identity.identity();
    if (identity?.type !== 'user') return true;
    const guest = this.read(getStorageKey('coupon', GUEST_IDENTITY));
    if (!guest || (!guest.code && !guest.applied)) return true;
    if (!this.write(getStorageKey('coupon', identity), guest)) return false;
    this.state.set(guest);
    this.clearIdentity(GUEST_IDENTITY);
    return true;
  }

  private commit(next: CouponDraft): void {
    if (!this.identity.storageKey('coupon')) return;
    this.state.set(next);
    this.persist(next);
  }

  private restore(): CouponDraft {
    const key = this.identity.storageKey('coupon');
    return key ? this.read(key) ?? EMPTY : EMPTY;
  }

  private persist(draft: CouponDraft): boolean {
    const key = this.identity.storageKey('coupon');
    return key ? this.write(key, draft) : false;
  }

  private read(key: string): CouponDraft | null {
    try {
      const raw = globalThis.localStorage?.getItem(key);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as Partial<CouponDraft>;
      const code = String(parsed.code ?? '').trim().toUpperCase().replace(/\s+/g, '');
      return { code, applied: Boolean(parsed.applied) && code === 'PRIMER10' };
    } catch {
      return null;
    }
  }

  private write(key: string, draft: CouponDraft): boolean {
    try {
      globalThis.localStorage?.setItem(key, JSON.stringify(draft));
      return true;
    } catch {
      return false;
    }
  }

  private clearIdentity(identity: StorageIdentity): void {
    try {
      globalThis.localStorage?.removeItem(getStorageKey('coupon', identity));
    } catch { /* guest leftovers only after destination persist */ }
  }
}
