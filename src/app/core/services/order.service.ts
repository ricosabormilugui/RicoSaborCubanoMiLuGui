import { Injectable } from '@angular/core';
import { CheckoutFormData, OrderPayload, PaymentMethod } from '../models/order.model';
import { ORDER_SUBMISSION_MODE } from '../config/order.config';
import { resolveApiBaseUrl } from '../config/api.config';
import { CartService } from './cart.service';
import { CustomerAuthService } from './customer-auth.service';
import { DeliveryStateService } from './delivery-state.service';
import { MANUAL_PAYMENT_DETAILS } from '../config/payment.config';
import { calculateShippingQuote } from '../config/shipping.config';

export function getPaymentMethodLabel(method: PaymentMethod): string {
  const labels: Record<PaymentMethod, string> = {
    bizum: 'Bizum',
    bank_transfer: 'Transferencia bancaria',
    cash: 'Efectivo / Cash'
  };

  return labels[method];
}

export function getPaymentInstructions(method: PaymentMethod, orderId?: string): string {
  const concept = orderId ? `pedido ${orderId}` : 'tu nombre y número de pedido';

  if (method === 'bizum') {
    return `Envía el total por Bizum al ${MANUAL_PAYMENT_DETAILS.bizumPhone} indicando ${concept}.`;
  }

  if (method === 'bank_transfer') {
    return `Realiza la transferencia a ${MANUAL_PAYMENT_DETAILS.bankIban} a nombre de ${MANUAL_PAYMENT_DETAILS.bankAccountHolder}. Indica ${concept} en el concepto.`;
  }

  return `${MANUAL_PAYMENT_DETAILS.cashInstructions} Indica ${concept} al equipo.`;
}

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

    const shipping = this.buildShipping(data, subtotal);

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
        postalCode: data.postalCode,
        reference: data.reference
      },
      notes: data.notes,
      marketingConsent: data.marketingConsent,
      legalConsent: data.legalConsent,
      couponCode: this.normalizeCouponCode(data.couponCode),
      promotions: {
        firstOrderDiscount: {
          code: this.normalizeCouponCode(data.couponCode) || '',
          percent: 10,
          status: this.normalizeCouponCode(data.couponCode) ? 'requested' : 'not_requested'
        }
      },
      payment: {
        method: data.paymentMethod,
        status: 'pending',
        instructions: ''
      },
      paymentMethod: data.paymentMethod,
      paymentStatus: 'pending',
      shipping,
      shippingCost: shipping.cost,
      items: this.cartService.items(),
      subtotal,
      discountAmount: 0,
      discountType: null,
      discountPercent: 0,
      total: Number((subtotal + shipping.cost).toFixed(2))
    };
  }


  private normalizeCouponCode(value: string | null | undefined): string | null {
    const code = String(value ?? '').trim().toUpperCase().replace(/\s+/g, '');
    return code || null;
  }

  private buildShipping(data: CheckoutFormData, subtotal: number): OrderPayload['shipping'] {
    const quote = calculateShippingQuote(data.deliveryType, data.postalCode, subtotal);

    return {
      zoneId: quote.zoneId,
      zoneName: quote.zoneName,
      postalCode: quote.postalCode,
      cost: Number(quote.cost.toFixed(2)),
      minimumOrder: quote.minimumOrder,
      freeShippingFrom: quote.freeShippingFrom,
      freeShippingApplied: quote.freeShippingApplied
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
        }> | Record<string, unknown>;
      };

      const notificationErrors = (Array.isArray(data.notifications) ? data.notifications : [])
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
        let message = 'No se pudo enviar el pedido.';
        try {
          const errorData = (await response.json()) as { error?: string };
          message = errorData.error || message;
        } catch {}
        throw new Error(message);
      }

      const data = (await response.json()) as {
        orderId: string;
        accountMode?: string;
        warnings?: string[];
        notifications?: {
          email?: { sent?: boolean; warning?: string | null };
        };
        coupon?: { valid?: boolean; discountAmount?: number; code?: string | null };
        total?: number;
      };

      const warningParts: string[] = [];

      if (data.coupon?.valid && Number(data.coupon.discountAmount ?? 0) > 0) {
        warningParts.push(`Cupón ${data.coupon.code ?? 'PRIMER10'} aplicado: -${Number(data.coupon.discountAmount ?? 0).toFixed(2)} €.`);
      }

      if (Array.isArray(data.warnings) && data.warnings.length) {
        warningParts.push(...data.warnings);
      }


      return {
        orderId: data.orderId,
        channel: 'backend',
        destination: `Backend API (${data.accountMode ?? 'guest'})`,
        warning: warningParts.length ? warningParts.join(' | ') : undefined
      };
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
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
