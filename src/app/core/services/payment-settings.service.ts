import { Injectable } from '@angular/core';
import { resolveApiBaseUrl } from '../config/api.config';
import { emptyPublicPaymentSettings, PublicPaymentSettings } from '../models/payment-settings.model';
import { requestJson } from '../utils/api-client';

@Injectable({ providedIn: 'root' })
export class PaymentSettingsService {
  private readonly endpoint = `${resolveApiBaseUrl()}/payment-settings`;

  async getPublicSettings(): Promise<PublicPaymentSettings> {
    const data = await requestJson<{ payment?: PublicPaymentSettings }>(
      this.endpoint,
      { method: 'GET' },
      'No se pudieron cargar los métodos de pago.'
    );
    return {
      bizum: { enabled: Boolean(data.payment?.bizum?.enabled) },
      bankTransfer: { enabled: Boolean(data.payment?.bankTransfer?.enabled) },
      cash: { enabled: Boolean(data.payment?.cash?.enabled) }
    };
  }

  empty(): PublicPaymentSettings {
    return emptyPublicPaymentSettings();
  }
}
