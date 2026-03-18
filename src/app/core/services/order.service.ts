import { Injectable } from '@angular/core';
import { CheckoutFormData, OrderPayload } from '../models/order.model';
import { ORDER_SUBMISSION_MODE } from '../config/order.config';
import { resolveApiBaseUrl } from '../config/api.config';
import { CartService } from './cart.service';
import { CustomerAuthService } from './customer-auth.service';
import { DeliveryStateService } from './delivery-state.service';

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
    private readonly customerAuth: CustomerAuthService,
    private readonly deliveryState: DeliveryStateService
  ) {}

  createPayload(data: CheckoutFormData): OrderPayload {
    const subtotal = Number(this.cartService.subtotal().toFixed(2));
    const profileEmail = this.customerAuth.profile()?.email;

    this.deliveryState.setDeliveryState({
      date: data.deliveryDate,
      slot: data.deliverySlot,
      type: data.deliveryType
    });

    return {
      customer: {
        fullName: data.fullName,
        phone: this.buildPhone(data.phoneCountryCode, data.phoneNumber),
        email: data.email || profileEmail
      },
      deliveryDate: data.deliveryDate,
      deliverySlot: data.deliverySlot,
      deliveryType: data.deliveryType,
      delivery: {
        date: data.deliveryDate,
        slot: data.deliverySlot,
        type: data.deliveryType,
        address: data.address,
        reference: data.reference
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

    if (ORDER_SUBMISSION_MODE === 'netlify') {
      return this.submitToNetlify(payload);
    }

    const backendResult = await this.submitToBackend(payload);
    if (backendResult) {
      return backendResult;
    }

    throw new Error('No se pudo guardar el pedido en el backend.');
  }

  private async submitToNetlify(
    payload: OrderPayload
  ): Promise<SubmitOrderResponse> {
    try {
      const response = await fetch(this.netlifyEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error('No se pudo enviar el pedido por Netlify Function.');
      }

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
    } catch {
      if (this.isLocalEnvironment()) {
        return this.saveOrderLocally(payload);
      }

      throw new Error('No se pudo enviar el pedido por Netlify Function.');
    }
  }

  private async submitToBackend(
    payload: OrderPayload
  ): Promise<SubmitOrderResponse | null> {
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

      if (!response.ok) {
        return null;
      }

      const data = (await response.json()) as {
        orderId: string;
        accountMode?: string;
        warnings?: string[];
        notifications?: {
          whatsapp?: { sent?: boolean; warning?: string | null };
          email?: { sent?: boolean; warning?: string | null };
        };
      };

      const whatsappSent = data.notifications?.whatsapp?.sent;
      const whatsappWarning = data.notifications?.whatsapp?.warning;
      const warningParts: string[] = [];

      if (Array.isArray(data.warnings) && data.warnings.length) {
        warningParts.push(...data.warnings);
      }

      if (whatsappSent === false) {
        warningParts.push(
          whatsappWarning === 'whatsapp-not-registered'
            ? 'Este número no tiene WhatsApp activo. Te enviaremos email.'
            : `WhatsApp no enviado${whatsappWarning ? `: ${whatsappWarning}` : ''}`
        );
      } else if (whatsappSent === true) {
        warningParts.push('Recibirás confirmación por WhatsApp.');
      }

      return {
        orderId: data.orderId,
        channel: 'backend',
        destination: `Backend API (${data.accountMode ?? 'guest'})`,
        warning: warningParts.length ? warningParts.join(' | ') : undefined
      };
    } catch {
      return null;
    }
  }


  private buildPhone(countryCode: string, number: string): string {
    const code = String(countryCode ?? '').replace(/\D/g, '');
    const cleanNumber = String(number ?? '').replace(/\D/g, '');
    return `${code}${cleanNumber}`;
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
