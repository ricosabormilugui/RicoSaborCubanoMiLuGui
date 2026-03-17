import { Injectable } from '@angular/core';
import { resolveApiBaseUrl } from '../config/api.config';
import { CustomerAuthService } from './customer-auth.service';

export interface CustomerOrder {
  orderId: string;
  status: 'nuevo' | 'confirmado' | 'preparando' | 'listo' | 'enviado' | 'entregado' | 'cancelado' | 'anulado';
  createdAt: string;
  total?: number;
  deliveryDate?: string;
  deliverySlot?: string;
  deliveryType?: "delivery" | "pickup";
  items?: Array<{ name: string; quantity: number }>;
  notes?: string;
}

@Injectable({ providedIn: 'root' })
export class CustomerOrdersService {
  private readonly endpoint = `${resolveApiBaseUrl()}/orders/me`;

  constructor(private readonly auth: CustomerAuthService) {}

  async listMyOrders(): Promise<CustomerOrder[]> {
    const token = this.auth.token();
    if (!token) {
      return [];
    }

    const response = await fetch(this.endpoint, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (!response.ok) {
      throw new Error('No se pudo cargar tu historial de pedidos.');
    }

    const data = (await response.json()) as { orders?: CustomerOrder[] };
    return data.orders ?? [];
  }
}
