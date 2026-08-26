import { Injectable } from '@angular/core';
import { resolveApiBaseUrl } from '../config/api.config';
import { CustomerAuthService } from './customer-auth.service';
import { ActiveIdentityService, StaleIdentityError } from './active-identity.service';
import { IdentityRequestService } from './identity-request.service';

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

  constructor(
    private readonly auth: CustomerAuthService,
    private readonly identity: ActiveIdentityService,
    private readonly identityRequest: IdentityRequestService
  ) {}

  async listMyOrders(): Promise<CustomerOrder[]> {
    const token = this.auth.token();
    const session = this.identity.session();
    if (!token || !this.auth.profile()?.userId) {
      return [];
    }

    try {
      const response = await this.identityRequest.fetch(this.endpoint, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!response.ok) {
        throw new Error('No se pudo cargar tu historial de pedidos.');
      }

      const data = (await response.json()) as { orders?: CustomerOrder[] };
      this.identity.assertCurrent(session);
      return data.orders ?? [];
    } catch (error) {
      if (error instanceof StaleIdentityError) return [];
      throw error;
    }
  }
}
