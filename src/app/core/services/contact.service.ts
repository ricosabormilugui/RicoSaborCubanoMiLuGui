import { Injectable } from '@angular/core';
import { resolveApiBaseUrl } from '../config/api.config';
import { requestJson } from '../utils/api-client';

export interface ContactFormPayload {
  name: string;
  phone?: string;
  email?: string;
  message: string;
  requestId: string;
  bypassContentDedup?: boolean;
}

export interface ContactSubmitResult {
  ok: boolean;
  duplicated?: boolean;
  contactId?: string;
  notifications: {
    email: { sent: boolean; warning: string | null };
  };
}

@Injectable({ providedIn: 'root' })
export class ContactService {
  private readonly apiBase = resolveApiBaseUrl();

  async submit(payload: ContactFormPayload): Promise<ContactSubmitResult> {
    const data = await requestJson<{
      ok?: boolean;
      duplicated?: boolean;
      contactId?: string;
      notifications?: ContactSubmitResult['notifications'];
    }>(`${this.apiBase}/contact`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }, 'No se pudo enviar la solicitud de contacto.');

    return {
      ok: Boolean(data.ok),
      duplicated: data.duplicated,
      contactId: data.contactId,
      notifications: {
        email: data.notifications?.email ?? { sent: false, warning: 'unknown' }
      }
    };
  }
}
