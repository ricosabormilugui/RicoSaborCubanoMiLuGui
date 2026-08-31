import { Injectable, OnDestroy, linkedSignal } from '@angular/core';
import { PaymentMethod } from '../models/order.model';
import { ActiveIdentityService, GUEST_IDENTITY, StorageIdentity, getStorageKey } from './active-identity.service';

export interface CheckoutContactDraft {
  fullName: string;
  phoneCountryCode: string;
  phoneNumber: string;
  email: string;
  address: string;
  postalCode: string;
  reference: string;
  notes: string;
  marketingConsent: boolean;
  legalConsent: boolean;
  paymentMethod: PaymentMethod;
}

const EMPTY: CheckoutContactDraft = {
  fullName: '',
  phoneCountryCode: '34',
  phoneNumber: '',
  email: '',
  address: '',
  postalCode: '',
  reference: '',
  notes: '',
  marketingConsent: false,
  legalConsent: false,
  paymentMethod: 'bizum'
};

@Injectable({ providedIn: 'root' })
export class CheckoutDraftService implements OnDestroy {
  private readonly state = linkedSignal<CheckoutContactDraft>(() => {
    this.identity.session();
    return this.restore();
  });
  private readonly onStorage = (event: StorageEvent): void => {
    if (event.key === this.identity.storageKey('checkout-draft') || event.key === null) this.state.set(this.restore());
  };

  constructor(private readonly identity: ActiveIdentityService) {
    globalThis.addEventListener?.('storage', this.onStorage);
  }

  ngOnDestroy(): void {
    globalThis.removeEventListener?.('storage', this.onStorage);
  }

  snapshot(): CheckoutContactDraft {
    return this.state();
  }

  save(partial: Partial<CheckoutContactDraft>): void {
    if (!this.identity.storageKey('checkout-draft')) return;
    const next = { ...this.state(), ...partial };
    this.state.set(next);
    this.persist(next);
  }

  clear(): void {
    if (!this.identity.storageKey('checkout-draft')) return;
    this.state.set(EMPTY);
    this.persist(EMPTY);
  }

  adoptGuestDraft(): boolean {
    const identity = this.identity.identity();
    if (identity?.type !== 'user') return true;
    const guest = this.read(getStorageKey('checkout-draft', GUEST_IDENTITY));
    if (!guest || this.isEmpty(guest)) return true;
    if (!this.write(getStorageKey('checkout-draft', identity), guest)) return false;
    this.state.set(guest);
    this.clearIdentity(GUEST_IDENTITY);
    return true;
  }

  private restore(): CheckoutContactDraft {
    const key = this.identity.storageKey('checkout-draft');
    return key ? this.read(key) ?? EMPTY : EMPTY;
  }

  private persist(draft: CheckoutContactDraft): boolean {
    const key = this.identity.storageKey('checkout-draft');
    return key ? this.write(key, draft) : false;
  }

  private read(key: string): CheckoutContactDraft | null {
    try {
      const raw = globalThis.localStorage?.getItem(key);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as Partial<CheckoutContactDraft>;
      const paymentMethod = parsed.paymentMethod === 'bank_transfer' || parsed.paymentMethod === 'cash' || parsed.paymentMethod === 'bizum'
        ? parsed.paymentMethod
        : 'bizum';
      return {
        fullName: String(parsed.fullName ?? ''),
        phoneCountryCode: String(parsed.phoneCountryCode ?? '34') || '34',
        phoneNumber: String(parsed.phoneNumber ?? ''),
        email: String(parsed.email ?? ''),
        address: String(parsed.address ?? ''),
        postalCode: String(parsed.postalCode ?? ''),
        reference: String(parsed.reference ?? ''),
        notes: String(parsed.notes ?? ''),
        marketingConsent: Boolean(parsed.marketingConsent),
        legalConsent: Boolean(parsed.legalConsent),
        paymentMethod
      };
    } catch {
      return null;
    }
  }

  private write(key: string, draft: CheckoutContactDraft): boolean {
    try {
      globalThis.localStorage?.setItem(key, JSON.stringify(draft));
      return true;
    } catch {
      return false;
    }
  }

  private isEmpty(draft: CheckoutContactDraft): boolean {
    return !draft.fullName && !draft.phoneNumber && !draft.email && !draft.address && !draft.notes;
  }

  private clearIdentity(identity: StorageIdentity): void {
    try {
      globalThis.localStorage?.removeItem(getStorageKey('checkout-draft', identity));
    } catch { /* guest leftovers only after destination persist */ }
  }
}
