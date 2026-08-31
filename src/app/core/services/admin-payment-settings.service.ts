import { Injectable } from '@angular/core';
import { resolveApiBaseUrl } from '../config/api.config';
import { AdminPaymentSettings, emptyAdminPaymentSettings } from '../models/payment-settings.model';
import { AdminAuthService } from './admin-auth.service';

@Injectable({ providedIn: 'root' })
export class AdminPaymentSettingsService {
  private readonly apiBase = resolveApiBaseUrl();

  constructor(private readonly auth: AdminAuthService) {}

  async getSettings(): Promise<AdminPaymentSettings> {
    const response = await fetch(`${this.apiBase}/admin/payment-settings`, {
      headers: { Authorization: `Bearer ${this.auth.token()}` }
    });

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        this.auth.logout();
      }
      throw new Error('No fue posible cargar la configuración de pagos.');
    }

    const data = (await response.json()) as { payment?: AdminPaymentSettings };
    return this.normalize(data.payment);
  }

  async saveSettings(payload: AdminPaymentSettings): Promise<AdminPaymentSettings> {
    const response = await fetch(`${this.apiBase}/admin/payment-settings`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.auth.token()}`
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        this.auth.logout();
      }
      let detail = '';
      try {
        const data = (await response.json()) as { error?: string };
        detail = data.error ?? '';
      } catch {
        detail = await response.text();
      }
      throw new Error(detail || 'No fue posible guardar la configuración de pagos.');
    }

    const data = (await response.json()) as { payment?: AdminPaymentSettings };
    return this.normalize(data.payment);
  }

  private normalize(value?: Partial<AdminPaymentSettings>): AdminPaymentSettings {
    const empty = emptyAdminPaymentSettings();
    return {
      bizum: { ...empty.bizum, ...value?.bizum },
      bankTransfer: { ...empty.bankTransfer, ...value?.bankTransfer },
      cash: { ...empty.cash, ...value?.cash }
    };
  }
}
