import { listOrders, updateOrderStatus } from "../services/orders.repository.js";

const ALLOWED_STATUSES = new Set(["nuevo", "en_preparacion", "en_camino", "entregado", "cancelado"]);

export async function getOrders(req, res) {
  try {
    const limitValue = Number(req.query.limit ?? 50);
    const limit = Number.isFinite(limitValue) ? Math.min(Math.max(limitValue, 1), 200) : 50;

    const orders = await listOrders(limit);
    return res.json({ orders });
  } catch (error) {
    return res.status(500).json({ error: error.message ?? "Unexpected error" });
  }
}

export async function patchOrderStatus(req, res) {
  const orderId = String(req.params.orderId || "").trim();
  const status = String(req.body?.status || "").trim();

  if (!orderId || !status) {
    return res.status(400).json({ error: "orderId and status are required" });
  }

  if (!ALLOWED_STATUSES.has(status)) {
    return res.status(400).json({ error: "Invalid status" });
  }

  try {
    const updated = await updateOrderStatus(orderId, status);

    if (!updated) {
      return res.status(404).json({ error: "Order not found" });
    }

    return res.json({ updated: true, orderId, status });
  } catch (error) {
    return res.status(500).json({ error: error.message ?? "Unexpected error" });
  }
}
