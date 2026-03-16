import { sendOrderEmail } from "../services/email.service.js";
import { sendWhatsAppNotification } from "../services/whatsapp.service.js";
import {
  findOrderById,
  listOrders,
  listOrdersForCustomer,
  saveOrder,
  updateOrderStatus
} from "../repositories/orders.repository.js";

const allowedStatuses = new Set(["nuevo", "enviado", "entregado", "anulado"]);

function isWebhookAuthorized(req) {
  const expectedToken = process.env.WHATSAPP_WEBHOOK_TOKEN;
  if (!expectedToken) return true;

  const authHeader = req.headers.authorization ?? "";
  const bearer = authHeader.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length).trim()
    : "";

  return bearer === expectedToken;
}

function normalizeCustomerEmail(payload, auth) {
  const fromPayload = String(payload?.customer?.email ?? "")
    .trim()
    .toLowerCase();

  const fromAuth =
    auth?.role === "customer"
      ? String(auth?.email ?? "").trim().toLowerCase()
      : "";

  return fromPayload || fromAuth || null;
}

function buildOrderIdentity(payload, auth) {
  if (auth?.role === "customer") {
    return {
      accountMode: "registered",
      userId: auth.sub
    };
  }

  return {
    accountMode: "guest"
  };
}

export async function createOrder(req, res) {
  try {
    const payload = req.body;

    if (!payload?.customer?.fullName || !payload?.customer?.phone || !payload?.items?.length) {
      return res.status(400).json({ error: "Invalid order payload" });
    }

    const orderIdentity = buildOrderIdentity(payload, req.auth);
    const customerEmailNormalized = normalizeCustomerEmail(payload, req.auth);

    const order = {
      ...payload,
      ...orderIdentity,
      customerEmailNormalized,
      orderId: `MLG-${Date.now()}`,
      createdAt: new Date().toISOString(),
      status: "nuevo",
      statusHistory: [
        {
          status: "nuevo",
          at: new Date().toISOString(),
          note: null,
          signature: null
        }
      ]
    };
    await saveOrder(order);

    const warnings = [];

    try {
      await sendOrderEmail(order);
    } catch (error) {
      warnings.push(`email: ${error.message ?? "failed"}`);
    }

    try {
      await sendWhatsAppNotification(
        `🛒 Nuevo pedido en MiLuGui

Cliente: ${order.customer.fullName}
Teléfono: ${order.customer.phone}
Total: ${order.total ?? 0}€`
      );
    } catch (error) {
      warnings.push(`whatsapp: ${error.message ?? "failed"}`);
    }

    return res.status(201).json({
      orderId: order.orderId,
      accountMode: order.accountMode,
      warnings: warnings.length ? warnings : undefined
    });

  } catch (error) {
    return res.status(500).json({ error: error.message ?? "Unexpected error" });
  }
}

export async function listMyOrders(req, res) {
  try {
    const limit = req.query.limit ? Number(req.query.limit) : 100;

    const orders = await listOrdersForCustomer({
      userId: req.auth?.sub,
      email: req.auth?.email,
      limit: Number.isFinite(limit) ? Math.min(limit, 200) : 100
    });

    return res.status(200).json({ orders });

  } catch (error) {
    return res.status(500).json({ error: error.message ?? "Unexpected error" });
  }
}

export async function listOrdersForAdmin(req, res) {
  try {
    const status = req.query.status;
    const limit = req.query.limit ? Number(req.query.limit) : 100;

    const orders = await listOrders({
      status,
      limit: Number.isFinite(limit) ? Math.min(limit, 500) : 100
    });

    return res.status(200).json({ orders });

  } catch (error) {
    return res.status(500).json({ error: error.message ?? "Unexpected error" });
  }
}

export async function updateOrderStatusForAdmin(req, res) {
  try {
    const { orderId } = req.params;
    const { status, statusNote, deliverySignature } = req.body ?? {};

    if (!allowedStatuses.has(status)) {
      return res.status(400).json({ error: "Invalid status" });
    }

    if (status === "entregado" && (!deliverySignature || String(deliverySignature).trim().length < 3)) {
      return res.status(400).json({ error: "deliverySignature is required for delivered orders" });
    }

    const existing = await findOrderById(orderId);

    if (!existing) {
      return res.status(404).json({ error: "Order not found" });
    }

    const updated = await updateOrderStatus(orderId, status, {
      statusNote: statusNote ?? null,
      deliverySignature: status === "entregado"
        ? String(deliverySignature).trim()
        : null,
      updatedBy: req.auth?.email ?? "admin"
    });

    return res.status(200).json({ order: updated });

  } catch (error) {
    return res.status(500).json({ error: error.message ?? "Unexpected error" });
  }
}

export async function notifyWhatsApp(req, res) {
  if (!isWebhookAuthorized(req)) {
    return res.status(401).json({ error: "Unauthorized webhook" });
  }

  try {
    const message = req.body?.message;

    if (!message || typeof message !== "string") {
      return res.status(400).json({ error: "Message is required" });
    }

    await sendWhatsAppNotification(message);

    return res.status(200).json({ sent: true });

  } catch (error) {
    return res.status(500).json({ error: error.message ?? "Unexpected error" });
  }
}