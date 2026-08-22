import { Injectable, signal } from '@angular/core';
import { resolveApiBaseUrl } from '../config/api.config';
import { AdminAuthService } from './admin-auth.service';

export interface CustomerProfile {
  userId: string;
  email: string;
  role: 'customer' | 'admin';
}

@Injectable({ providedIn: 'root' })
export class CustomerAuthService {
  private readonly apiBase = `${resolveApiBaseUrl()}/auth`;
  private readonly tokenKey = 'ricosabor-customer-token';
  private readonly profileKey = 'ricosabor-customer-profile';

  readonly token = signal<string>(this.readStorage(this.tokenKey));
  readonly profile = signal<CustomerProfile | null>(this.readProfile());

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
    if (!this.token()) return;

    try {
      const response = await fetch(`${this.apiBase}/me`, {
        headers: { Authorization: `Bearer ${this.token()}` }
      });

      if (!response.ok) {
        this.logout();
        return;
      }

      const data = (await response.json()) as CustomerProfile;
      this.profile.set({
        userId: data.userId,
        email: data.email,
        role: data.role === 'admin' ? 'admin' : 'customer'
      });
      this.persist();
      this.syncAdminSession();
    } catch {
      // Keep local session if backend isn't reachable from frontend environment
    }
  }

  logout(): void {
    this.token.set('');
    this.profile.set(null);
    this.persist();
    this.syncAdminSession();
  }

  async register(fullName: string, email: string, password: string): Promise<{ linkedOrders: number }> {
    const normalizedEmail = email.trim().toLowerCase();
    const response = await fetch(`${this.apiBase}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fullName, email: normalizedEmail, password })
    });

    if (!response.ok) {
      let detail: { message?: string; error?: string } = {};
      try {
        detail = await response.json() as { message?: string; error?: string };
      } catch {
        // Keep the stable public fallback for non-JSON errors.
      }
      throw new Error(detail.message || detail.error || 'No se pudo registrar la cuenta.');
    }

    const data = (await response.json()) as { linkedOrders?: number };
    await this.login(normalizedEmail, password);
    return { linkedOrders: data.linkedOrders ?? 0 };
  }

  async login(email: string, password: string): Promise<void> {
    const normalizedEmail = email.trim().toLowerCase();
    const response = await fetch(`${this.apiBase}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: normalizedEmail, password })
    });

    if (!response.ok) {
      throw new Error('Credenciales inválidas.');
    }

    const data = (await response.json()) as { token: string; userId: string; role: 'customer' | 'admin' };
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
