import { randomUUID } from "crypto";
import { sendOrderEmail } from "../services/email.service.js";
import {
  appendOrderNotifications,
  deleteOrderById,
  findCouponRedemption,
  findOrderById,
  findPreviousValidOrderForCustomer,
  listOrders,
  listOrdersForCustomer,
  saveOrder,
  updateOrderPayment,
  updateOrderStatus
} from "../repositories/orders.repository.js";
import { applyOrderStockAdjustments } from "../repositories/products.repository.js";
import { findCustomerForCoupon, markFirstOrderCouponUsed, upsertCustomerFromOrder } from "../repositories/customers.repository.js";
import { DELIVERY_RULES, calculateShippingQuote, normalizePostalCode } from "../config/shipping.config.js";
import { sendOrderStatusEmail } from "../services/email.service.js";
import { validateOrderFulfillment } from "../services/order-rules.service.js";

const allowedStatuses = new Set(["nuevo", "confirmado", "preparando", "listo", "enviado", "entregado", "cancelado", "anulado"]);
const notifyStatuses = new Set(["confirmado", "preparando", "listo", "enviado"]);

const FIRST_ORDER_COUPON = {
  code: "PRIMER10",
  percent: 10,
  discountType: "percent",
  appliesTo: "items_subtotal"
};

function normalizeCouponCode(value) {
  const code = String(value ?? "").trim().toUpperCase().replace(/\s+/g, "");
  return code || null;
}

function getRequestedCouponCode(payload) {
  return normalizeCouponCode(
    payload?.couponCode
      ?? payload?.coupon?.code
      ?? payload?.promotions?.firstOrderDiscount?.code
  );
}

function calculateFirstOrderDiscount(subtotal) {
  return Number(((Number(subtotal ?? 0) * FIRST_ORDER_COUPON.percent) / 100).toFixed(2));
}

function customerHasPreviousValidOrder(customer) {
  const orderCount = Number(customer?.orderCount ?? 0);
  const orderIds = Array.isArray(customer?.orderIds) ? customer.orderIds.filter(Boolean) : [];
  return orderCount > 0 || orderIds.length > 0;
}

function customerCouponAlreadyUsed(customer) {
  return (
    customer?.firstOrderDiscount?.status === "used"
    || Boolean(customer?.firstOrderDiscount?.usedAt)
    || customer?.firstOrderCoupon?.status === "used"
    || Boolean(customer?.firstOrderCoupon?.usedAt)
  );
}

async function validateFirstOrderCoupon({ code, email, phone, customerId }) {
  if (!code) {
    return { requested: false, valid: false, reason: null, discountAmount: 0 };
  }

  if (code !== FIRST_ORDER_COUPON.code) {
    return { requested: true, valid: false, reason: "coupon-not-found", discountAmount: 0 };
  }

  if (!email && !phone && !customerId) {
    return { requested: true, valid: false, reason: "coupon-requires-customer", discountAmount: 0 };
  }

  const existingCustomer = await findCustomerForCoupon({ email, phone, customerId });
  if (customerCouponAlreadyUsed(existingCustomer)) {
    return { requested: true, valid: false, reason: "coupon-already-used", customer: existingCustomer, discountAmount: 0 };
  }

  if (customerHasPreviousValidOrder(existingCustomer)) {
    return { requested: true, valid: false, reason: "coupon-first-order-only", customer: existingCustomer, discountAmount: 0 };
  }

  const previousOrder = await findPreviousValidOrderForCustomer({ email, phone, customerId: customerId ?? existingCustomer?._id });
  if (previousOrder) {
    return { requested: true, valid: false, reason: "coupon-first-order-only", customer: existingCustomer, discountAmount: 0 };
  }

  const redeemedOrder = await findCouponRedemption({ code, email, phone, customerId: customerId ?? existingCustomer?._id });
  if (redeemedOrder) {
    return { requested: true, valid: false, reason: "coupon-already-used", customer: existingCustomer, discountAmount: 0 };
  }

  return { requested: true, valid: true, reason: null, customer: existingCustomer, discountAmount: 0 };
}

function buildCouponError(reason) {
  const messages = {
    "coupon-not-found": "Cupón no válido. Revisa el código introducido.",
    "coupon-requires-customer": "Para usar PRIMER10 necesitamos email o teléfono del cliente.",
    "coupon-already-used": "El cupón PRIMER10 ya fue utilizado por este cliente.",
    "coupon-first-order-only": "PRIMER10 solo puede aplicarse al primer pedido del cliente."
  };

  return messages[reason] ?? "No se pudo aplicar el cupón.";
}

function normalizeDelivery(payload) {
  const date = payload?.deliveryDate ?? payload?.delivery?.date ?? null;
  const slot = payload?.deliverySlot ?? payload?.delivery?.slot ?? null;
  const type = payload?.deliveryType ?? payload?.delivery?.type ?? "delivery";

  return {
    date,
    slot,
    type,
    postalCode: normalizePostalCode(payload?.delivery?.postalCode ?? payload?.postalCode)
  };
}

function calculateItemsSubtotal(items = []) {
  return Number(
    items
      .reduce((sum, item) => sum + Number(item?.unitPrice ?? 0) * Number(item?.quantity ?? 0), 0)
      .toFixed(2)
  );
}

function normalizeShipping(payload, delivery) {
  const subtotal = calculateItemsSubtotal(payload?.items);
  const quote = calculateShippingQuote(delivery.type, delivery.postalCode, subtotal);

  return {
    quote,
    details: {
      zoneId: quote.zoneId,
      zoneName: quote.zoneName,
      postalCode: quote.postalCode,
      cost: Number(quote.cost.toFixed(2)),
      minimumOrder: quote.minimumOrder,
      freeShippingFrom: quote.freeShippingFrom,
      freeShippingApplied: quote.freeShippingApplied
    }
  };
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
  return ["email"].map((type) => ({
    type,
    status: notifications?.[type]?.sent ? "sent" : "failed",
    date: now,
    error: notifications?.[type]?.warning ?? null
  }));
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

function normalizeMarketingConsent(payload) {
  return Boolean(payload?.marketingConsent ?? payload?.customer?.marketingConsent ?? false);
}

function normalizePhone(phone) {
  let clean = String(phone ?? "")
    .replace(/[^0-9]/g, "")
    .replace(/^0+/, "");

  if (clean.length === 9) {
    clean = `34${clean}`;
  }

  return clean;
}

function normalizePayment(payload) {
  const method = String(payload?.payment?.method ?? payload?.paymentMethod ?? "bizum").trim();
  const allowedMethods = new Set(["bizum", "bank_transfer", "cash"]);
  const normalizedMethod = allowedMethods.has(method) ? method : "bizum";

  return {
    method: normalizedMethod,
    status: "pending",
    instructions: ""
  };
}

function requiresAdvancePaymentForItems(items = []) {
  return items.some((item) =>
    Boolean(item?.requiresAdvancePayment)
    || Boolean(item?.isCustomizable)
    || (Array.isArray(item?.customization) && item.customization.length > 0)
    || (Array.isArray(item?.customizationOptions) && item.customizationOptions.length > 0)
    || String(item?.category ?? item?.categoryName ?? "").toLowerCase().includes("personaliz")
  );
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
    const normalizedPayment = normalizePayment(payload);
    const requiresAdvancePayment = requiresAdvancePaymentForItems(payload?.items ?? []);
    const marketingConsent = normalizeMarketingConsent(payload);
    const normalizedShipping = normalizeShipping(payload, normalizedDelivery);
    const requiredAdvanceNoticeHours = requiresAdvancePayment
      ? DELIVERY_RULES.personalizedAdvanceNoticeHours
      : DELIVERY_RULES.advanceNoticeHours;
    const deliveryValidationError = validateOrderFulfillment(normalizedDelivery, {
      advanceNoticeHours: requiredAdvanceNoticeHours
    });

    if (deliveryValidationError) {
      return res.status(400).json({ error: deliveryValidationError });
    }

    if (!normalizedShipping.quote.available) {
      return res.status(400).json({ error: normalizedShipping.quote.message });
    }
    if (requiresAdvancePayment && normalizedPayment.method === "cash" && !DELIVERY_RULES.cashAllowedForAdvancePaymentOrders) {
      return res.status(400).json({ error: "Este pedido requiere pago anticipado y no permite pago en efectivo." });
    }

    const canonicalPhone = normalizePhone(payload?.customer?.phone);

    if (!canonicalPhone || canonicalPhone.length < 9) {
      return res.status(400).json({ error: "Invalid customer phone" });
    }

    const subtotal = calculateItemsSubtotal(payload.items);
    const requestedCouponCode = getRequestedCouponCode(payload);
    const couponValidation = await validateFirstOrderCoupon({
      code: requestedCouponCode,
      email: customerEmailNormalized,
      phone: canonicalPhone,
      customerId: payload?.customerId
    });

    if (couponValidation.requested && !couponValidation.valid) {
      return res.status(400).json({
        error: buildCouponError(couponValidation.reason),
        coupon: { code: requestedCouponCode, valid: false, reason: couponValidation.reason }
      });
    }

    const discountAmount = couponValidation.valid ? calculateFirstOrderDiscount(subtotal) : 0;
    const total = Number((subtotal - discountAmount + normalizedShipping.details.cost).toFixed(2));
    const orderId = `MLG-${randomUUID().slice(0, 8).toUpperCase()}`;
    const createdAt = new Date().toISOString();

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
        type: normalizedDelivery.type,
        postalCode: normalizedShipping.details.postalCode
      },
      payment: normalizedPayment,
      paymentMethod: normalizedPayment.method,
      paymentStatus: normalizedPayment.status,
      requiresAdvancePayment,
      shipping: normalizedShipping.details,
      shippingCost: normalizedShipping.details.cost,
      subtotal,
      couponCode: couponValidation.valid ? FIRST_ORDER_COUPON.code : null,
      discountAmount,
      discountType: couponValidation.valid ? FIRST_ORDER_COUPON.discountType : null,
      discountPercent: couponValidation.valid ? FIRST_ORDER_COUPON.percent : 0,
      total,
      marketingConsent,
      promotions: {
        ...(payload.promotions ?? {}),
        firstOrderDiscount: {
          code: FIRST_ORDER_COUPON.code,
          percent: FIRST_ORDER_COUPON.percent,
          status: couponValidation.valid ? "used" : "not_requested",
          discountAmount,
          appliesTo: FIRST_ORDER_COUPON.appliesTo,
          ...(couponValidation.valid ? { usedAt: createdAt, orderId } : {})
        }
      },
      orderId,
      createdAt,
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

    const linkedCustomer = await upsertCustomerFromOrder(order, { marketingConsent });
    if (linkedCustomer?._id) {
      order.customerId = String(linkedCustomer._id);
    }

    await saveOrder(order);

    if (couponValidation.valid && order.customerId) {
      await markFirstOrderCouponUsed(order.customerId, {
        orderId: order.orderId,
        code: FIRST_ORDER_COUPON.code,
        percent: FIRST_ORDER_COUPON.percent
      });
    }

    await applyOrderStockAdjustments(order.items);

    const warnings = [];
    let emailSent = false;

    try {
      await sendOrderEmail(order);
      emailSent = true;
    } catch (error) {
      warnings.push(`email: ${error.message ?? "failed"}`);
    }

    const notifications = {
      email: { sent: emailSent, warning: emailSent ? null : "email-not-sent" }
    };
    await appendOrderNotifications(order.orderId, buildNotificationHistory(notifications));

    return res.status(201).json({
      ok: true,
      orderId: order.orderId,
      accountMode: order.accountMode,
      notifications,
      coupon: {
        code: order.couponCode,
        valid: Boolean(order.couponCode),
        discountAmount: order.discountAmount,
        discountPercent: order.discountPercent,
        reason: couponValidation.reason
      },
      totals: {
        subtotal: order.subtotal,
        discountAmount: order.discountAmount,
        shippingCost: order.shippingCost,
        total: order.total
      },
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

export async function deleteOrderForAdmin(req, res) {
  try {
    const { orderId } = req.params;
    if (!orderId || String(orderId).trim().length < 4) {
      return res.status(400).json({ error: "Invalid order id" });
    }
    const deleted = await deleteOrderById(orderId);
    if (!deleted) return res.status(404).json({ error: "Order not found" });
    return res.status(200).json({ ok: true, deleted: true, orderId });
  } catch (error) {
    return res.status(500).json({ error: error.message ?? "Unexpected error" });
  }
}

export async function updateOrderPaymentForAdmin(req, res) {
  try {
    const { orderId } = req.params;
    const paymentStatus = String(req.body?.paymentStatus ?? "").trim();
    const notifyCustomer = Boolean(req.body?.notifyCustomer ?? true);
    const note = String(req.body?.note ?? "").trim();
    const allowed = new Set(["pending", "paid", "rejected", "refunded", "failed", "cancelled"]);
    if (!allowed.has(paymentStatus)) return res.status(400).json({ error: "Invalid paymentStatus" });
    const existing = await findOrderById(orderId);
    if (!existing) return res.status(404).json({ error: "Order not found" });
    if (existing.paymentStatus === paymentStatus || existing?.payment?.status === paymentStatus) {
      return res.status(200).json({ ok: true, order: existing, notifications: { email: { sent: false, warning: "payment-unchanged" } } });
    }
    const updated = await updateOrderPayment(orderId, {
      status: paymentStatus,
      note,
      confirmedAt: paymentStatus === "paid" ? new Date().toISOString() : null
    }, { paymentUpdatedBy: req.auth?.email ?? "admin" });
    let email = { sent: false, warning: "payment-not-notified" };
    if (notifyCustomer && paymentStatus === "paid" && existing.customer?.email) {
      try {
        await sendOrderStatusEmail(updated, { status: updated.status, statusNote: `Pago confirmado. ${note}`.trim() });
        email = { sent: true, warning: null };
      } catch (error) {
        email = { sent: false, warning: error.message ?? "payment-email-failed" };
      }
    }
    await appendOrderNotifications(orderId, buildNotificationHistory({ email }));
    return res.status(200).json({ ok: true, order: updated, notifications: { email } });
  } catch (error) {
    return res.status(500).json({ error: error.message ?? "Unexpected error" });
  }
}
