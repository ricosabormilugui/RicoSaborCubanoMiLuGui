import { Injectable } from '@angular/core';
import { CheckoutFormData, OrderPayload } from '../models/order.model';
import { BACKEND_API_BASE_URL, ORDER_SUBMISSION_MODE } from '../config/order.config';
import { CartService } from './cart.service';

export interface SubmitOrderResponse {
  orderId: string;
  channel: 'netlify' | 'local' | 'api';
  destination: string;
  warning?: string;
}

@Injectable({ providedIn: 'root' })
export class OrderService {
  private readonly netlifyEndpoint = '/.netlify/functions/submit-order';
  private readonly apiEndpoint = `${BACKEND_API_BASE_URL}/api/orders`;

  constructor(private readonly cartService: CartService) {}

  createPayload(data: CheckoutFormData): OrderPayload {
    const subtotal = Number(this.cartService.subtotal().toFixed(2));
    return {
      customer: {
        fullName: data.fullName,
        phone: data.phone,
        email: data.email
      },
      delivery: {
        mode: data.deliveryMode,
        address: data.address,
        reference: data.reference,
        preferredTime: data.preferredTime
      },
      notes: data.notes,
      items: this.cartService.items(),
      subtotal,
      total: subtotal
    };
  }

  async submitOrder(payload: OrderPayload): Promise<SubmitOrderResponse> {
    if (ORDER_SUBMISSION_MODE === 'local') {
      return this.saveOrderLocally(payload);
    }

    if (ORDER_SUBMISSION_MODE === 'api') {
      return this.submitToBackendApi(payload);
    }

    return this.submitToNetlify(payload);
  }

  private async submitToBackendApi(payload: OrderPayload): Promise<SubmitOrderResponse> {
    try {
      const response = await fetch(this.apiEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        let backendError = 'No se pudo enviar el pedido al backend.';

        try {
          const errorPayload = (await response.json()) as { error?: string };
          if (errorPayload?.error) {
            backendError = errorPayload.error;
          }
        } catch {
          // ignored: response body may not be JSON
        }

        throw new Error(backendError);
      }

      const data = (await response.json()) as { orderId: string; warnings?: string[] };
      const warning = (data.warnings ?? []).join(' | ') || undefined;

      return {
        orderId: data.orderId,
        channel: 'api',
        destination: `Backend API (${this.apiEndpoint})`,
        warning
      };
    } catch (error) {
      if (this.isLocalEnvironment()) {
        return this.saveOrderLocally(payload);
      }

      const message = error instanceof Error ? error.message : 'No se pudo enviar el pedido al backend.';
      throw new Error(message);
    }
  }

  private async submitToNetlify(payload: OrderPayload): Promise<SubmitOrderResponse> {
    try {
      const response = await fetch(this.netlifyEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        const data = (await response.json()) as { orderId: string; warning?: string; notifications?: Array<{ channel: string; sent: boolean; detail?: string }> };
        const notificationErrors = (data.notifications ?? [])
          .filter((item) => !item.sent && item.detail)
          .map((item) => `${item.channel}: ${item.detail}`);
        const warning = [data.warning, ...notificationErrors].filter(Boolean).join(' | ') || undefined;

        return {
          orderId: data.orderId,
          channel: 'netlify',
          destination: 'Netlify Function (submit-order)',
          warning
        };
      }

      if (this.isLocalEnvironment()) {
        return this.saveOrderLocally(payload);
      }

      throw new Error('No se pudo enviar el pedido.');
    } catch {
      if (this.isLocalEnvironment()) {
        return this.saveOrderLocally(payload);
      }
      throw new Error('No se pudo enviar el pedido.');
    }
  }

  private isLocalEnvironment(): boolean {
    const host = globalThis?.location?.hostname ?? '';
    return host === 'localhost' || host === '127.0.0.1';
  }

  private saveOrderLocally(payload: OrderPayload): SubmitOrderResponse {
    const orderId = `LOCAL-${Date.now()}`;
    const storageKey = 'ricosabor-local-orders';

    try {
      const current = globalThis?.localStorage?.getItem(storageKey);
      const orders = current ? (JSON.parse(current) as Array<OrderPayload & { orderId: string; createdAt: string }>) : [];
      orders.push({
        orderId,
        createdAt: new Date().toISOString(),
        ...payload
      });
      globalThis?.localStorage?.setItem(storageKey, JSON.stringify(orders));
    } catch {
      // Si storage falla (modo privado / permisos), igualmente devolvemos orderId local
    }

    return {
      orderId,
      channel: 'local',
      destination: 'localStorage (clave: ricosabor-local-orders)'
    };
  }
}
