import { Injectable } from '@angular/core';
import { CheckoutFormData, OrderPayload } from '../models/order.model';
import { ORDER_SUBMISSION_MODE } from '../config/order.config';
import { resolveApiBaseUrl } from '../config/api.config';
import { CartService } from './cart.service';
import { CustomerAuthService } from './customer-auth.service';

export interface SubmitOrderResponse {
  orderId: string;
  channel: 'netlify' | 'local' | 'backend';
  destination: string;
  warning?: string;
}

@Injectable({ providedIn: 'root' })
export class OrderService {
  private readonly netlifyEndpoint = '/.netlify/functions/submit-order';
  private readonly backendEndpoint = `${resolveApiBaseUrl()}/orders`;

  constructor(
    private readonly cartService: CartService,
    private readonly customerAuth: CustomerAuthService
  ) {}

  createPayload(data: CheckoutFormData): OrderPayload {
    const subtotal = Number(this.cartService.subtotal().toFixed(2));
    const profileEmail = this.customerAuth.profile()?.email;

    return {
      customer: {
        fullName: data.fullName,
        phone: data.phone,
        email: data.email || profileEmail
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

    if (this.isLocalEnvironment()) {
      try {
        const response = await fetch(this.backendEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(this.customerAuth.token()
              ? { Authorization: `Bearer ${this.customerAuth.token()}` }
              : {})
          },
          body: JSON.stringify(payload)
        });

        if (response.ok) {
          const data = (await response.json()) as {
            orderId: string;
            accountMode?: string;
          };

          return {
            orderId: data.orderId,
            channel: 'backend',
            destination: `Backend API (${data.accountMode ?? 'guest'})`
          };
        }
      } catch {
        // fallback a Netlify
      }
    }

    try {
      const response = await fetch(this.netlifyEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        const data = (await response.json()) as {
          orderId: string;
          warning?: string;
          notifications?: Array<{
            channel: string;
            sent: boolean;
            detail?: string;
          }>;
        };

        const notificationErrors = (data.notifications ?? [])
          .filter((item) => !item.sent && item.detail)
          .map((item) => `${item.channel}: ${item.detail}`);

        const warning =
          [data.warning, ...notificationErrors].filter(Boolean).join(' | ') ||
          undefined;

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
      const orders = current
        ? (JSON.parse(current) as Array<
            OrderPayload & { orderId: string; createdAt: string }
          >)
        : [];

      orders.push({
        orderId,
        createdAt: new Date().toISOString(),
        ...payload
      });

      globalThis?.localStorage?.setItem(storageKey, JSON.stringify(orders));
    } catch {}

    return {
      orderId,
      channel: 'local',
      destination: 'localStorage (clave: ricosabor-local-orders)'
    };
  }
}
