import { Injectable } from '@angular/core';
import { resolveApiBaseUrl } from '../config/api.config';

export interface NewsletterSubscribeResult {
  ok: boolean;
  duplicated?: boolean;
  discount?: {
    code: string;
    percent: number;
    status: string;
  };
}

@Injectable({ providedIn: 'root' })
export class NewsletterService {
  private readonly apiBase = resolveApiBaseUrl();

  async subscribe(email: string, consent: boolean): Promise<NewsletterSubscribeResult> {
    const response = await fetch(`${this.apiBase}/newsletter`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, consent })
    });

    const data = (await response.json().catch(() => ({}))) as NewsletterSubscribeResult & { error?: string };

    if (!response.ok) {
      throw new Error(data.error ?? 'No fue posible registrar la suscripción.');
    }

    return data;
  }
}
