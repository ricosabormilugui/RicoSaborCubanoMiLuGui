import { Injectable, OnDestroy, computed, linkedSignal } from '@angular/core';
import { DeliveryType } from '../models/order.model';
import { ActiveIdentityService, GUEST_IDENTITY, StorageIdentity, getStorageKey } from './active-identity.service';

export interface ShippingIntent {
  date: string | null;
  slot: string | null;
  type: DeliveryType;
}

const EMPTY_INTENT: ShippingIntent = { date: null, slot: null, type: 'delivery' };

@Injectable({ providedIn: 'root' })
export class DeliveryStateService implements OnDestroy {
  private readonly state = linkedSignal<ShippingIntent>(() => {
    this.identity.session();
    return this.restore();
  });
  private readonly onStorage = (event: StorageEvent): void => {
    if (event.key === this.identity.storageKey('shipping') || event.key === null) this.state.set(this.restore());
  };

  readonly date = computed(() => this.state().date);
  readonly slot = computed(() => this.state().slot);
  readonly type = computed(() => this.state().type);

  constructor(private readonly identity: ActiveIdentityService) {
    globalThis.addEventListener?.('storage', this.onStorage);
  }

  ngOnDestroy(): void {
    globalThis.removeEventListener?.('storage', this.onStorage);
  }

  setDeliveryState({ date, slot, type }: { date: string; slot: string; type: DeliveryType }): void {
    if (!this.identity.storageKey('shipping')) return;
    const next = { date, slot, type };
    this.state.set(next);
    this.persist(next);
  }

  clear(): void {
    if (!this.identity.storageKey('shipping')) return;
    this.state.set(EMPTY_INTENT);
    this.persist(EMPTY_INTENT);
  }

  adoptGuestShipping(): boolean {
    const identity = this.identity.identity();
    if (identity?.type !== 'user') return true;
    const guest = this.read(getStorageKey('shipping', GUEST_IDENTITY));
    if (!guest || this.isEmpty(guest)) return true;
    if (!this.write(getStorageKey('shipping', identity), guest)) return false;
    this.state.set(guest);
    this.clearIdentity(GUEST_IDENTITY);
    return true;
  }

  private restore(): ShippingIntent {
    const key = this.identity.storageKey('shipping');
    return key ? this.read(key) ?? EMPTY_INTENT : EMPTY_INTENT;
  }

  private persist(intent: ShippingIntent): boolean {
    const key = this.identity.storageKey('shipping');
    return key ? this.write(key, intent) : false;
  }

  private read(key: string): ShippingIntent | null {
    try {
      const raw = globalThis.localStorage?.getItem(key);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as Partial<ShippingIntent>;
      const type = parsed.type === 'pickup' ? 'pickup' : parsed.type === 'delivery' ? 'delivery' : null;
      if (!type) return null;
      return {
        date: typeof parsed.date === 'string' && parsed.date.trim() ? parsed.date : null,
        slot: typeof parsed.slot === 'string' && parsed.slot.trim() ? parsed.slot : null,
        type
      };
    } catch {
      return null;
    }
  }

  private write(key: string, intent: ShippingIntent): boolean {
    try {
      const storage = globalThis.localStorage;
      if (!storage) return false;
      if (this.isEmpty(intent)) storage.removeItem(key);
      else storage.setItem(key, JSON.stringify(intent));
      return true;
    } catch {
      return false;
    }
  }

  private clearIdentity(identity: StorageIdentity): void {
    try { globalThis.localStorage?.removeItem(getStorageKey('shipping', identity)); } catch { /* Destination already persisted. */ }
  }

  private isEmpty(intent: ShippingIntent): boolean {
    return !intent.date && !intent.slot && intent.type === 'delivery';
  }
}
