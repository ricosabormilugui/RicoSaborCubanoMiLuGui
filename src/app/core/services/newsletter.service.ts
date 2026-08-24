import { Injectable } from '@angular/core';
import { resolveApiBaseUrl } from '../config/api.config';
import { requestJson } from '../utils/api-client';

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
    return requestJson<NewsletterSubscribeResult>(`${this.apiBase}/newsletter`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, consent })
    }, 'No fue posible registrar la suscripción.');
  }
}
