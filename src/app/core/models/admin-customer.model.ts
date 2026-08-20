export type AdminCustomerCouponStatus = 'used' | 'available' | 'not_requested' | 'unknown';
export type AdminCustomerCouponFilter = '' | 'used' | 'not_used';
export type AdminCustomerOrdersFilter = '' | 'with_orders' | 'without_orders';
export type AdminCustomerMarketingFilter = '' | 'true' | 'false';

export interface AdminCustomerCoupon {
  code?: string | null;
  percent?: number | null;
  status?: string | null;
  usedAt?: string | null;
  orderId?: string | null;
}

export interface AdminCustomer {
  id: string;
  fullName?: string | null;
  email?: string | null;
  phone?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  source?: string | null;
  marketingConsent?: boolean | null;
  acceptsPromotions?: boolean | null;
  marketingConsentAt?: string | null;
  newsletter?: {
    subscribed?: boolean | null;
    subscribedAt?: string | null;
    source?: string | null;
  } | null;
  orderCount?: number | null;
  totalSpent?: number | null;
  lastOrderAt?: string | null;
  firstOrderDiscount?: AdminCustomerCoupon | null;
  firstOrderCoupon?: AdminCustomerCoupon | null;
}

export interface AdminCustomerMetrics {
  totalCustomers: number;
  marketingCustomers: number;
  customersWithOrders: number;
}

export interface AdminCustomerPagination {
  page: number;
  limit: number;
  total: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface AdminCustomerListResult {
  customers: AdminCustomer[];
  pagination: AdminCustomerPagination;
  metrics: AdminCustomerMetrics;
}
