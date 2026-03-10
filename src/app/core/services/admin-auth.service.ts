import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class AdminAuthService {
  private readonly tokenKey = 'ricosabor-admin-token';
  readonly token = signal<string>(this.readStoredToken());

  private readStoredToken(): string {
    try {
      return globalThis?.localStorage?.getItem(this.tokenKey) ?? '';
    } catch {
      return '';
    }
  }

  setToken(token: string): void {
    this.token.set(token);
    try {
      if (token) {
        globalThis?.localStorage?.setItem(this.tokenKey, token);
      } else {
        globalThis?.localStorage?.removeItem(this.tokenKey);
      }
    } catch {
      // ignore storage issues
    }
  }

  logout(): void {
    this.setToken('');
  }

  isAuthenticated(): boolean {
    return this.token().length > 0;
  }
}
