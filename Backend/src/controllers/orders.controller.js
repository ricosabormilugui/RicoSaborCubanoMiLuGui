import { randomUUID } from "crypto";
import { sendOrderEmail } from "../services/email.service.js";
import { normalizePhone, sendWhatsAppNotification, sendWhatsAppToPhone } from "../services/whatsapp.service.js";
import { notifyCustomerOrderStatus } from "../services/order-notification.service.js";
import {
  appendOrderNotifications,
  findOrderById,
  listOrders,
  listOrdersForCustomer,
  saveOrder,
  updateOrderStatus
} from "../repositories/orders.repository.js";
import { applyOrderStockAdjustments } from "../repositories/products.repository.js";

const allowedStatuses = new Set(["nuevo", "confirmado", "preparando", "listo", "enviado", "entregado", "cancelado", "anulado"]);
const notifyStatuses = new Set(["confirmado", "preparando", "listo", "enviado"]);
const SLOTS = ["12:00-14:00", "14:00-16:00", "18:00-20:00"];
const CLOSED_DAYS = [0];
const CUT_OFF_HOUR = 16;

function normalizeDelivery(payload) {
  const date = payload?.deliveryDate ?? payload?.delivery?.date ?? null;
  const slot = payload?.deliverySlot ?? payload?.delivery?.slot ?? null;
  const type = payload?.deliveryType ?? payload?.delivery?.type ?? "delivery";

  return {
    date,
    slot,
    type: type === "pickup" ? "pickup" : "delivery"
  };
}

function validateDelivery(delivery) {
  if (!delivery?.date || !delivery?.slot) {
    return "Delivery date and slot required";
  }

  if (!SLOTS.includes(delivery.slot)) {
    return "Horario inválido";
  }

  const selected = new Date(delivery.date);
  if (Number.isNaN(selected.getTime())) {
    return "Fecha inválida";
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  selected.setHours(0, 0, 0, 0);

  if (selected < today) {
    return "Fecha inválida";
  }

  if (CLOSED_DAYS.includes(selected.getDay())) {
    return "No hay servicio ese día";
  }

  const now = new Date();
  if (selected.toDateString() === now.toDateString() && now.getHours() >= CUT_OFF_HOUR) {
    return "Ya no puedes pedir para hoy";
  }

  return null;
}

function parseLimit(value, { fallback, max }) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed < 1) {
    return fallback;
  }

  return Math.min(Math.floor(parsed), max);
}

function buildNotificationHistory(notifications) {
  const now = new Date().toISOString();
  return ["whatsapp", "email"].map((type) => ({
    type,
    status: notifications?.[type]?.sent ? "sent" : "failed",
    date: now,
    error: notifications?.[type]?.warning ?? null
  }));
}

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
    const normalizedDelivery = normalizeDelivery(payload);
    const deliveryValidationError = validateDelivery(normalizedDelivery);

    if (deliveryValidationError) {
      return res.status(400).json({ error: deliveryValidationError });
    }

    const canonicalPhone = normalizePhone(payload?.customer?.phone);

    if (!canonicalPhone || canonicalPhone.length < 9) {
      return res.status(400).json({ error: "Invalid customer phone" });
    }

    const order = {
      ...payload,
      customer: {
        ...(payload.customer ?? {}),
        phone: canonicalPhone
      },
      ...orderIdentity,
      customerEmailNormalized,
      deliveryDate: normalizedDelivery.date,
      deliverySlot: normalizedDelivery.slot,
      deliveryType: normalizedDelivery.type,
      delivery: {
        ...(payload.delivery ?? {}),
        date: normalizedDelivery.date,
        slot: normalizedDelivery.slot,
        type: normalizedDelivery.type
      },
      orderId: `MLG-${randomUUID().slice(0, 8).toUpperCase()}`,
      createdAt: new Date().toISOString(),
      status: "nuevo",
      notifications: [],
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
    await applyOrderStockAdjustments(order.items);

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

    const notifications = await notifyCustomerOrderStatus(order, { status: "nuevo" });
    await appendOrderNotifications(order.orderId, buildNotificationHistory(notifications));

    return res.status(201).json({
      ok: true,
      orderId: order.orderId,
      accountMode: order.accountMode,
      notifications,
      warnings: warnings.length ? warnings : undefined
    });

  } catch (error) {
    return res.status(500).json({ error: error.message ?? "Unexpected error" });
  }
}

export async function listMyOrders(req, res) {
  try {
    const limit = parseLimit(req.query.limit, { fallback: 100, max: 200 });

    const orders = await listOrdersForCustomer({
      userId: req.auth?.sub,
      email: req.auth?.email,
      limit
    });

    return res.status(200).json({ orders });

  } catch (error) {
    return res.status(500).json({ error: error.message ?? "Unexpected error" });
  }
}

export async function listOrdersForAdmin(req, res) {
  try {
    const status = req.query.status;
    const limit = parseLimit(req.query.limit, { fallback: 100, max: 500 });

    const orders = await listOrders({
      status,
      limit
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

    if (existing.status === status) {
      return res.status(200).json({
        ok: true,
        order: existing,
        notifications: {
          whatsapp: { sent: false, warning: "status-unchanged" },
          email: { sent: false, warning: "status-unchanged" }
        }
      });
    }

    const updated = await updateOrderStatus(orderId, status, {
      statusNote: statusNote ?? null,
      deliverySignature: status === "entregado"
        ? String(deliverySignature).trim()
        : null,
      updatedBy: req.auth?.email ?? "admin"
    });

    const notifications = notifyStatuses.has(status)
      ? await notifyCustomerOrderStatus(updated, {
        status,
        statusNote: statusNote ?? null
      })
      : {
        whatsapp: { sent: false, warning: "status-not-notified" },
        email: { sent: false, warning: "status-not-notified" }
      };

    await appendOrderNotifications(orderId, buildNotificationHistory(notifications));

    const refreshedOrder = await findOrderById(orderId);

    return res.status(200).json({
      ok: true,
      order: refreshedOrder ?? updated,
      notifications
    });

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
    const phone = req.body?.phone;

    if (!message || typeof message !== "string") {
      return res.status(400).json({ error: "Message is required" });
    }

    if (phone) {
      await sendWhatsAppToPhone(normalizePhone(phone), message);
      return res.status(200).json({ sent: true, target: "phone" });
    }

    await sendWhatsAppNotification(message);

    return res.status(200).json({ sent: true, target: "default" });

  } catch (error) {
    return res.status(500).json({ error: error.message ?? "Unexpected error" });
  }
}
