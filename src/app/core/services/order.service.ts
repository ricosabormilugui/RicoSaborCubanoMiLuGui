import { Injectable, effect, untracked } from '@angular/core';
import { CheckoutFormData, OrderPayload, PaymentMethod } from '../models/order.model';
import { resolveApiBaseUrl } from '../config/api.config';
import { getCheckoutPaymentInstructions, getPaymentMethodLabel } from '../config/payment.config';
import { CartService } from './cart.service';
import { CustomerAuthService } from './customer-auth.service';
import { DeliveryStateService } from './delivery-state.service';
import { ActiveIdentityService } from './active-identity.service';
import { calculateShippingQuote } from '../config/shipping.config';
import { requestJson } from '../utils/api-client';
import { OrderIdempotencyIntent } from '../utils/order-idempotency';

export { getPaymentMethodLabel };

export function getPaymentInstructions(method: PaymentMethod, orderId?: string): string {
  return getCheckoutPaymentInstructions(method, orderId);
}

export interface SubmitOrderResponse {
  orderId: string;
  channel: 'backend';
  destination: string;
  warning?: string;
}

@Injectable({ providedIn: 'root' })
export class OrderService {
  private readonly backendEndpoint = `${resolveApiBaseUrl()}/orders`;
  private readonly orderIntent: OrderIdempotencyIntent;

  constructor(
    private readonly cartService: CartService,
    private readonly customerAuth: CustomerAuthService,
    private readonly deliveryState: DeliveryStateService,
    private readonly identity: ActiveIdentityService
  ) {
    this.orderIntent = new OrderIdempotencyIntent(undefined, undefined, () => this.identity.storageKey('order-intent'));
    effect(() => {
      const session = this.identity.session();
      untracked(() => this.orderIntent.bindIdentity(session));
    });
  }

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
    const idempotencyKey = this.orderIntent.keyFor(payload);
    return this.submitToBackend(payload, idempotencyKey);
  }

  completeOrderIntent(): void {
    this.orderIntent.complete();
  }

  adoptGuestIntent(): boolean {
    return this.orderIntent.adoptGuestIntent();
  }

  private async submitToBackend(
    payload: OrderPayload,
    idempotencyKey: string
  ): Promise<SubmitOrderResponse> {
    try {
      const data = await requestJson<{
        orderId: string;
        accountMode?: string;
        warnings?: string[];
        notifications?: {
          email?: { sent?: boolean; warning?: string | null };
        };
        coupon?: { valid?: boolean; discountAmount?: number; code?: string | null };
        totals?: { total?: number };
      }>(this.backendEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': idempotencyKey,
          ...(this.customerAuth.token()
            ? { Authorization: `Bearer ${this.customerAuth.token()}` }
            : {})
        },
        body: JSON.stringify(payload)
      }, 'No hemos podido enviar tu pedido. Inténtalo de nuevo.', 15_000);

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
        destination: '',
        warning: warningParts.length ? warningParts.join(' | ') : undefined
      };
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('No hemos podido enviar tu pedido. Inténtalo de nuevo.');
    }
  }

  private buildPhone(countryCode: string, number: string): string {
    const code = String(countryCode ?? '').replace(/\D/g, '');
    const cleanNumber = String(number ?? '').replace(/\D/g, '');
    return `${code}${cleanNumber}`;
  }
}
