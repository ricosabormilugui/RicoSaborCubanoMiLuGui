import { NotificationService } from './notification.service';
import { Injectable, signal, inject } from '@angular/core';
import { resolveApiBaseUrl } from '../config/api.config';
import { AdminAuthService } from './admin-auth.service';
import { ApiRequestError, requestJson } from '../utils/api-client';

export interface CustomerProfile {
  userId: string;
  email: string;
  role: 'customer' | 'admin';
}

@Injectable({ providedIn: 'root' })
export class CustomerAuthService {
  private readonly notifications = inject(NotificationService);
  private readonly apiBase = `${resolveApiBaseUrl()}/auth`;
  private readonly tokenKey = 'ricosabor-customer-token';
  private readonly profileKey = 'ricosabor-customer-profile';

  readonly token = signal<string>(this.readStorage(this.tokenKey));
  readonly profile = signal<CustomerProfile | null>(this.readProfile());
  readonly sessionVersion = signal(0);

  constructor(private readonly adminAuth: AdminAuthService) {
    this.syncAdminSession();
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
      if (!parsed.userId || !parsed.email) return null;

      return {
        userId: String(parsed.userId),
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
      this.profile.set({
        userId: data.userId,
        email: data.email,
        role: data.role === 'admin' ? 'admin' : 'customer'
      });
      this.persist();
      this.syncAdminSession();
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
    this.sessionVersion.update(version => version + 1);
    this.token.set('');
    this.profile.set(null);
    this.persist();
    this.syncAdminSession();
  }

  async register(fullName: string, email: string, password: string): Promise<{ linkedOrders: number }> {
    const normalizedEmail = email.trim().toLowerCase();
    const data = await requestJson<{ linkedOrders?: number }>(`${this.apiBase}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fullName, email: normalizedEmail, password })
    }, 'No se pudo registrar la cuenta.');
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
      if (error instanceof ApiRequestError && error.status === 401) throw new Error('Credenciales inválidas.');
      throw error;
    }
    if (version !== this.sessionVersion()) return;
    this.sessionVersion.update(value => value + 1);
    this.token.set(data.token ?? '');
    this.profile.set({
      userId: data.userId,
      email: normalizedEmail,
      role: data.role === 'admin' ? 'admin' : 'customer'
    });
    this.persist();
    this.syncAdminSession();
  }
}
