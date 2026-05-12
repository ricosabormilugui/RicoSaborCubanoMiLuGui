import { logger } from "../lib/logger.js";
import { listCustomers } from "../repositories/customers.repository.js";

function serializeCustomer(customer) {
  if (!customer) return null;

  return {
    ...customer,
    id: String(customer._id),
    _id: undefined
  };
}

function parseBooleanFilter(value) {
  const normalized = String(value ?? "").trim();
  if (normalized === "true") return true;
  if (normalized === "false") return false;
  return undefined;
}

export async function listCustomersForAdmin(req, res) {
  try {
    const search = String(req.query.search ?? "").trim();
    const limit = req.query.limit ? Number(req.query.limit) : 50;
    const page = req.query.page ? Number(req.query.page) : 1;
    const couponStatus = String(req.query.couponStatus ?? "").trim();

    const result = await listCustomers({
      search: search || undefined,
      marketingConsent: parseBooleanFilter(req.query.marketing),
      hasOrders: parseBooleanFilter(req.query.hasOrders),
      couponStatus: couponStatus === "used" || couponStatus === "not_used" ? couponStatus : undefined,
      limit: Number.isFinite(limit) ? Math.min(limit, 100) : 50,
      page: Number.isFinite(page) ? page : 1
    });

    return res.status(200).json({
      customers: result.customers.map(serializeCustomer),
      pagination: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        hasNextPage: result.page * result.limit < result.total,
        hasPreviousPage: result.page > 1
      },
      metrics: result.metrics
    });
  } catch (error) {
    logger.error("customers.admin.list.failed", { error: error.message ?? "Unexpected error" });
    return res.status(500).json({ error: error.message ?? "Unexpected error" });
  }
}
