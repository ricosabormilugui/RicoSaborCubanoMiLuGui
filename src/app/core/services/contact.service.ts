import { Injectable } from '@angular/core';
import { resolveApiBaseUrl } from '../config/api.config';

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
    whatsapp: { sent: boolean; warning: string | null };
  };
}

@Injectable({ providedIn: 'root' })
export class ContactService {
  private readonly apiBase = resolveApiBaseUrl();

  async submit(payload: ContactFormPayload): Promise<ContactSubmitResult> {
    const response = await fetch(`${this.apiBase}/contact`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    let data: {
      ok?: boolean;
      duplicated?: boolean;
      contactId?: string;
      notifications?: ContactSubmitResult['notifications'];
      error?: string;
    };

    try {
      data = (await response.json()) as typeof data;
    } catch {
      data = {};
    }

    if (response.status >= 400) {
      throw new Error(data.error || 'No se pudo enviar la solicitud de contacto.');
    }

    return {
      ok: Boolean(data.ok),
      duplicated: data.duplicated,
      contactId: data.contactId,
      notifications: {
        email: data.notifications?.email ?? { sent: false, warning: 'unknown' },
        whatsapp: data.notifications?.whatsapp ?? { sent: false, warning: 'unknown' }
      }
    };
  }
}
