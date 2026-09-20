import { Injectable } from '@angular/core';
import { DeliveryQuote, DeliveryType } from '../models/order.model';
import { resolveApiBaseUrl } from '../config/api.config';
import { requestJson } from '../utils/api-client';

@Injectable({ providedIn: 'root' })
export class ShippingQuoteService {
  private readonly endpoint = `${resolveApiBaseUrl()}/shipping/quote`;

  quote(input: { deliveryType: DeliveryType; address?: string; postalCode?: string; subtotal: number }): Promise<DeliveryQuote> {
    return requestJson<DeliveryQuote>(this.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input)
    }, 'No se pudo calcular la entrega.', 15_000);
  }
}
