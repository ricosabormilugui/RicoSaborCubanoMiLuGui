import { logger } from "../lib/logger.js";
import { getAdminDashboardMetrics } from "../repositories/orders.repository.js";
import { getCustomerMetrics } from "../repositories/customers.repository.js";

function parseDays(value) {
  const days = Number(value);
  if (!Number.isFinite(days)) return 14;
  return Math.max(7, Math.min(days, 30));
}

export async function getDashboardForAdmin(req, res) {
  try {
    const days = parseDays(req.query.days);
    const [orders, customers] = await Promise.all([
      getAdminDashboardMetrics({ days }),
      getCustomerMetrics()
    ]);

    return res.status(200).json({
      generatedAt: new Date().toISOString(),
      range: { days },
      summary: {
        ...orders.summary,
        totalCustomers: customers.totalCustomers,
        marketingCustomers: customers.marketingCustomers
      },
      operations: {
        pendingPaymentOrders: orders.summary.pendingPaymentOrders,
        paymentMethods: orders.paymentMethods,
        shippingZones: orders.shippingZones
      },
      charts: {
        salesByDay: orders.salesByDay,
        ordersByStatus: orders.ordersByStatus
      },
      topProducts: orders.topProducts,
      topCategories: orders.topCategories
    });
  } catch (error) {
    logger.error("dashboard.admin.failed", { error: error.message ?? "Unexpected error" });
    return res.status(500).json({ error: error.message ?? "Unexpected error" });
  }
}
