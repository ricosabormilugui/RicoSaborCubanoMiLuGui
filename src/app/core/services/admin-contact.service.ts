import { Injectable } from '@angular/core';
import { resolveApiBaseUrl } from '../config/api.config';
import { AdminAuthService } from './admin-auth.service';
import { AdminContact, AdminContactStatus } from '../models/admin-contact.model';

@Injectable({ providedIn: 'root' })
export class AdminContactService {
  private readonly apiBase = resolveApiBaseUrl();

  constructor(private readonly auth: AdminAuthService) {}

  async listContacts(status?: AdminContactStatus, search?: string): Promise<AdminContact[]> {
    const params = new URLSearchParams();
    if (status) params.set('status', status);
    if (search) params.set('search', search);

    const query = params.toString();
    const response = await fetch(`${this.apiBase}/admin/contacts${query ? `?${query}` : ''}`, {
      headers: { Authorization: `Bearer ${this.auth.token()}` }
    });

    if (!response.ok) {
      throw new Error('No fue posible cargar contactos.');
    }

    const data = (await response.json()) as { contacts?: AdminContact[] };
    return data.contacts ?? [];
  }

  async getContact(id: string): Promise<AdminContact> {
    const response = await fetch(`${this.apiBase}/admin/contacts/${encodeURIComponent(id)}`, {
      headers: { Authorization: `Bearer ${this.auth.token()}` }
    });

    if (!response.ok) {
      throw new Error('No fue posible cargar el contacto.');
    }

    const data = (await response.json()) as { contact: AdminContact };
    return data.contact;
  }

  async replyContact(
    id: string,
    message: string,
    sendEmail: boolean,
    sendWhatsApp: boolean
  ): Promise<{ contact: AdminContact; notifications: { email: { sent: boolean; warning: string | null }; whatsapp: { sent: boolean; warning: string | null } } }> {
    const response = await fetch(`${this.apiBase}/admin/contacts/${encodeURIComponent(id)}/reply`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.auth.token()}`
      },
      body: JSON.stringify({ message, sendEmail, sendWhatsApp })
    });

    if (!response.ok) {
      let detail = '';
      try {
        const data = (await response.json()) as { error?: string };
        detail = data.error ?? '';
      } catch {
        detail = await response.text();
      }

      throw new Error(detail || 'No fue posible responder el contacto.');
    }

    const data = (await response.json()) as {
      contact: AdminContact;
      notifications: {
        email: { sent: boolean; warning: string | null };
        whatsapp: { sent: boolean; warning: string | null };
      };
    };

    return data;
  }
}
