import { AdminOrderStatus, AdminPaymentMethod } from './admin-order.model';

export interface AdminDashboardSummary {
  totalOrders: number;
  pendingOrders: number;
  pendingPaymentOrders: number;
  totalSales: number;
  monthSales: number;
  averageTicket: number;
  totalCustomers: number;
  marketingCustomers: number;
}

export interface AdminDashboardCountMetric {
  count: number;
}

export interface AdminDashboardPaymentMetric extends AdminDashboardCountMetric {
  method: AdminPaymentMethod | 'sin_metodo' | string;
  sales: number;
}

export interface AdminDashboardShippingMetric extends AdminDashboardCountMetric {
  zone: string;
  sales: number;
}

export interface AdminDashboardStatusMetric extends AdminDashboardCountMetric {
  status: AdminOrderStatus | 'sin_estado' | string;
}

export interface AdminDashboardSalesDay {
  day: string;
  sales: number;
  orders: number;
}

export interface AdminDashboardTopProduct {
  name: string;
  quantity: number;
  sales: number;
}

export interface AdminDashboardTopCategory {
  category: string;
  quantity: number;
  sales: number;
}

export interface AdminDashboardData {
  generatedAt: string;
  range: { days: number };
  summary: AdminDashboardSummary;
  operations: {
    pendingPaymentOrders: number;
    paymentMethods: AdminDashboardPaymentMetric[];
    shippingZones: AdminDashboardShippingMetric[];
  };
  charts: {
    salesByDay: AdminDashboardSalesDay[];
    ordersByStatus: AdminDashboardStatusMetric[];
  };
  topProducts: AdminDashboardTopProduct[];
  topCategories: AdminDashboardTopCategory[];
}
