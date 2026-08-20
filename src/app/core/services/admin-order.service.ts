import { Injectable } from '@angular/core';
import { resolveApiBaseUrl } from '../config/api.config';
import { AdminOrder, AdminOrderStatus } from '../models/admin-order.model';
import { AdminAuthService } from './admin-auth.service';

export interface NotificationChannelResult {
  sent: boolean;
  warning: string | null;
}



export interface UpdatePaymentResult {
  notifications: {
    email: NotificationChannelResult;
  };
}

export interface UpdateStatusResult {
  notifications: {
    email: NotificationChannelResult;
  };
}

@Injectable({ providedIn: 'root' })
export class AdminOrderService {
  private readonly apiBase = resolveApiBaseUrl();

  constructor(private readonly auth: AdminAuthService) {}

  async login(email: string, password: string): Promise<void> {
    const response = await fetch(`${this.apiBase}/auth/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    if (!response.ok) {
      throw new Error('Credenciales de administrador inválidas.');
    }

    const data = (await response.json()) as { token: string };
    this.auth.setToken(data.token ?? '');
  }

  async listOrders(status?: AdminOrderStatus): Promise<AdminOrder[]> {
    const params = status ? `?status=${encodeURIComponent(status)}` : '';
    const response = await fetch(`${this.apiBase}/admin/orders${params}`, {
      headers: { Authorization: `Bearer ${this.auth.token()}` }
    });

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        this.auth.logout();
      }
      throw new Error('No fue posible cargar pedidos.');
    }

    const data = (await response.json()) as { orders?: AdminOrder[] };
    return data.orders ?? [];
  }

  async updateStatus(
    orderId: string,
    status: AdminOrderStatus,
    statusNote?: string,
    deliverySignature?: string
  ): Promise<UpdateStatusResult> {
    const response = await fetch(`${this.apiBase}/admin/orders/${encodeURIComponent(orderId)}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.auth.token()}`
      },
      body: JSON.stringify({ status, statusNote, deliverySignature })
    });

    if (!response.ok) {
      let detail = '';
      try {
        const data = (await response.json()) as { error?: string };
        detail = data.error ?? '';
      } catch {
        detail = await response.text();
      }

      throw new Error(detail || 'No fue posible actualizar estado del pedido.');
    }

    const data = (await response.json()) as {
      notifications?: {
        email?: NotificationChannelResult;
      };
    };

    return {
      notifications: {
        email: data.notifications?.email ?? { sent: false, warning: 'unknown' }
      }
    };
  }

  async deleteOrder(orderId: string): Promise<void> {
    const response = await fetch(`${this.apiBase}/admin/orders/${encodeURIComponent(orderId)}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${this.auth.token()}` }
    });
    if (!response.ok) throw new Error('No fue posible borrar el pedido.');
  }

  async updatePayment(orderId: string, paymentStatus: string, note = "", notifyCustomer = true): Promise<UpdatePaymentResult> {
    const response = await fetch(`${this.apiBase}/admin/orders/${encodeURIComponent(orderId)}/payment`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.auth.token()}`
      },
      body: JSON.stringify({ paymentStatus, note, notifyCustomer })
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.error || "No fue posible actualizar pago.");
    }
    const data = await response.json();
    return { notifications: { email: data.notifications?.email ?? { sent: false, warning: "unknown" } } };
  }
}
