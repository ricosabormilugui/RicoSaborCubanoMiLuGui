import { Injectable } from '@angular/core';
import { resolveApiBaseUrl } from '../config/api.config';

export interface ContactFormPayload {
  name: string;
  phone?: string;
  email?: string;
  message: string;
}

export interface ContactSubmitResult {
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

    if (!response.ok) {
      let detail = '';
      try {
        const data = (await response.json()) as { error?: string };
        detail = data.error ?? '';
      } catch {
        detail = await response.text();
      }

      throw new Error(detail || 'No se pudo enviar la solicitud de contacto.');
    }

    const data = (await response.json()) as {
      ok?: boolean;
      notifications?: ContactSubmitResult['notifications'];
    };

    if (!data.ok) {
      throw new Error('Respuesta inválida del servidor de contacto.');
    }

    return {
      notifications: {
        email: data.notifications?.email ?? { sent: false, warning: 'unknown' },
        whatsapp: data.notifications?.whatsapp ?? { sent: false, warning: 'unknown' }
      }
    };
  }
}
