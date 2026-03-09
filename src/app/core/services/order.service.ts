import { Injectable } from '@angular/core';
import { CheckoutFormData, OrderPayload } from '../models/order.model';
import { CartService } from './cart.service';

@Injectable({ providedIn: 'root' })
export class OrderService {
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

  async submitOrder(payload: OrderPayload): Promise<{ orderId: string }> {
    const response = await fetch('/.netlify/functions/submit-order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error('No se pudo enviar el pedido.');
    }

    return response.json() as Promise<{ orderId: string }>;
  }
}
