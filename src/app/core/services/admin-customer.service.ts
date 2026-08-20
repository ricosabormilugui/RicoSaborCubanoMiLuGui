import { Injectable } from '@angular/core';
import { resolveApiBaseUrl } from '../config/api.config';
import { AdminAuthService } from './admin-auth.service';
import {
  AdminCustomerCouponFilter,
  AdminCustomerListResult,
  AdminCustomerMarketingFilter,
  AdminCustomerOrdersFilter
} from '../models/admin-customer.model';

export interface AdminCustomerListParams {
  search?: string;
  marketingFilter?: AdminCustomerMarketingFilter;
  ordersFilter?: AdminCustomerOrdersFilter;
  couponFilter?: AdminCustomerCouponFilter;
  page?: number;
  limit?: number;
}

@Injectable({ providedIn: 'root' })
export class AdminCustomerService {
  private readonly apiBase = resolveApiBaseUrl();

  constructor(private readonly auth: AdminAuthService) {}

  async listCustomers(params: AdminCustomerListParams = {}): Promise<AdminCustomerListResult> {
    const query = new URLSearchParams();
    const search = params.search?.trim();

    if (search) query.set('search', search);
    if (params.marketingFilter === 'true') query.set('marketing', 'true');
    if (params.ordersFilter === 'with_orders') query.set('hasOrders', 'true');
    if (params.ordersFilter === 'without_orders') query.set('hasOrders', 'false');
    if (params.couponFilter) query.set('couponStatus', params.couponFilter);
    query.set('page', String(params.page ?? 1));
    query.set('limit', String(params.limit ?? 50));

    const response = await fetch(`${this.apiBase}/admin/customers?${query.toString()}`, {
      headers: { Authorization: `Bearer ${this.auth.token()}` }
    });

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        this.auth.logout();
      }
      throw new Error('No fue posible cargar clientes/newsletter.');
    }

    const data = (await response.json()) as AdminCustomerListResult;

    return {
      customers: data.customers ?? [],
      pagination: data.pagination ?? {
        page: params.page ?? 1,
        limit: params.limit ?? 50,
        total: 0,
        hasNextPage: false,
        hasPreviousPage: false
      },
      metrics: data.metrics ?? {
        totalCustomers: 0,
        marketingCustomers: 0,
        customersWithOrders: 0
      }
    };
  }
}
