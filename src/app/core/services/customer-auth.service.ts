import { NotificationService } from './notification.service';
import { Injectable, WritableSignal, signal, inject } from '@angular/core';
import { resolveApiBaseUrl } from '../config/api.config';
import { AdminAuthService } from './admin-auth.service';
import { ApiRequestError, requestJson } from '../utils/api-client';
import { ActiveIdentityService, StaleIdentityError, canonicalUserId } from './active-identity.service';
import { CartService } from './cart.service';
import { ConfirmDialogService } from './confirm-dialog.service';
import { DeliveryStateService } from './delivery-state.service';
import { FavoritesService } from './favorites.service';
import { CouponDraftService } from './coupon.service';
import { CheckoutDraftService } from './checkout-draft.service';
import { transferGuestOrderIntent } from '../utils/order-idempotency';

export interface CustomerProfile {
  userId: string;
  email: string;
  role: 'customer' | 'admin';
}

@Injectable({ providedIn: 'root' })
export class CustomerAuthService {
  private readonly notifications = inject(NotificationService);
  private readonly cart = inject(CartService);
  private readonly delivery = inject(DeliveryStateService);
  private readonly favorites = inject(FavoritesService);
  private readonly coupon = inject(CouponDraftService);
  private readonly checkoutDraft = inject(CheckoutDraftService);
  private readonly confirm = inject(ConfirmDialogService);
  private readonly apiBase = `${resolveApiBaseUrl()}/auth`;
  private readonly tokenKey = 'ricosabor-customer-token';
  private readonly profileKey = 'ricosabor-customer-profile';

  readonly token = signal<string>(this.readStorage(this.tokenKey));
  readonly profile = signal<CustomerProfile | null>(this.readProfile());
  readonly sessionVersion: WritableSignal<number>;

  constructor(private readonly adminAuth: AdminAuthService, private readonly identity: ActiveIdentityService) {
    this.sessionVersion = this.identity.version;
    this.publishIdentity();
    this.syncAdminSession();
    if (this.token()) this.favorites.bindSession(this.token(), () => this.logout());
  }

  private publishIdentity(): void {
    this.identity.activate(!this.token() ? { type: 'guest' } : this.profile()?.userId ? { type: 'user', userId: this.profile()!.userId } : null);
  }

  private invalidatePersonalMemory(): void {
    this.notifications.dismissAll();
    this.confirm.close(false);
    this.identity.beginTransition();
  }

  private async becomeUser(profile: CustomerProfile, token: string, adoptGuest: boolean): Promise<void> {
    this.invalidatePersonalMemory();
    this.token.set(token);
    this.profile.set(profile);
    this.identity.activate({ type: 'user', userId: profile.userId });
    this.persist();
    this.syncAdminSession();
    this.favorites.bindSession(token, () => this.logout());
    if (!adoptGuest) return;
    this.cart.adoptGuestCart();
    this.delivery.adoptGuestShipping();
    this.coupon.adoptGuestCoupon();
    this.checkoutDraft.adoptGuestDraft();
    await this.favorites.syncAuthenticatedFavorites();
    transferGuestOrderIntent(profile.userId);
  }

  private readStorage(key: string): string {
    try {
      return globalThis?.localStorage?.getItem(key) ?? '';
    } catch {
      return '';
    }
  }

  private readProfile(): CustomerProfile | null {
    try {
      const raw = globalThis?.localStorage?.getItem(this.profileKey);
      if (!raw) return null;

      const parsed = JSON.parse(raw) as Partial<CustomerProfile>;
      const userId = canonicalUserId(parsed.userId);
      if (!userId || !parsed.email) return null;

      return {
        userId,
        email: String(parsed.email),
        role: parsed.role === 'admin' ? 'admin' : 'customer'
      };
    } catch {
      return null;
    }
  }

  private persist(): void {
    try {
      if (this.token()) {
        globalThis?.localStorage?.setItem(this.tokenKey, this.token());
      } else {
        globalThis?.localStorage?.removeItem(this.tokenKey);
      }

      if (this.profile()) {
        globalThis?.localStorage?.setItem(this.profileKey, JSON.stringify(this.profile()));
      } else {
        globalThis?.localStorage?.removeItem(this.profileKey);
      }
    } catch {
      // ignore
    }
  }

  private syncAdminSession(): void {
    const role = this.profile()?.role;
    if (role === 'admin' && this.token()) {
      this.adminAuth.setToken(this.token());
      return;
    }

    this.adminAuth.logout();
  }

  isAuthenticated(): boolean {
    return this.token().length > 0;
  }

  async restoreSession(): Promise<void> {
    const token = this.token();
    const version = this.sessionVersion();
    if (!token) return;

    try {
      const data = await requestJson<CustomerProfile>(`${this.apiBase}/me`, {
        headers: { Authorization: `Bearer ${token}` }
      }, 'No se pudo restaurar la sesión.');
      if (token !== this.token() || version !== this.sessionVersion()) return;
      const userId = canonicalUserId(data.userId);
      if (!userId) return;
      this.profile.set({
        userId,
        email: data.email,
        role: data.role === 'admin' ? 'admin' : 'customer'
      });
      if (this.identity.key() !== `user:${userId}`) this.publishIdentity();
      this.persist();
      this.syncAdminSession();
      this.favorites.bindSession(token, () => this.logout());
      await this.favorites.syncAuthenticatedFavorites();
    } catch (error) {
      if (token !== this.token() || version !== this.sessionVersion()) return;
      if (error instanceof ApiRequestError && (error.status === 401 || error.status === 403)) {
        this.logout();
        this.notifications.warning('Sesión caducada', 'Inicia sesión nuevamente.', { key: 'session-expired' });
      }
      // Network and 5xx errors keep the local session; they are not proof that it expired.
    }
  }

  logout(): void {
    this.favorites.bindSession('');
    this.invalidatePersonalMemory();
    this.token.set('');
    this.profile.set(null);
    this.publishIdentity();
    this.persist();
    this.syncAdminSession();
  }

  async register(fullName: string, email: string, password: string): Promise<{ linkedOrders: number }> {
    const version = this.sessionVersion();
    const normalizedEmail = email.trim().toLowerCase();
    const data = await requestJson<{ linkedOrders?: number }>(`${this.apiBase}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fullName, email: normalizedEmail, password })
    }, 'No se pudo registrar la cuenta.');
    if (version !== this.sessionVersion()) throw new StaleIdentityError();
    await this.login(normalizedEmail, password);
    return { linkedOrders: data.linkedOrders ?? 0 };
  }

  async login(email: string, password: string): Promise<void> {
    const version = this.sessionVersion();
    const normalizedEmail = email.trim().toLowerCase();
    let data: { token: string; userId: string; role: 'customer' | 'admin' };
    try {
      data = await requestJson<typeof data>(`${this.apiBase}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: normalizedEmail, password })
      }, 'No se pudo iniciar sesión.');
    } catch (error) {
      if (version !== this.sessionVersion()) throw new StaleIdentityError();
      if (error instanceof ApiRequestError && error.status === 401) throw new Error('Credenciales inválidas.');
      throw error;
    }
    if (version !== this.sessionVersion()) throw new StaleIdentityError();
    const userId = canonicalUserId(data.userId);
    if (!userId || !data.token) throw new Error('No se pudo iniciar sesión.');
    await this.becomeUser({
      userId,
      email: normalizedEmail,
      role: data.role === 'admin' ? 'admin' : 'customer'
    }, data.token, true);
  }
}
