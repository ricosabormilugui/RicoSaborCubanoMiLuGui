import { expirePaymentReservation, listExpiredPendingPaymentOrders } from "../repositories/orders.repository.js";
import { notifyOrderOwner } from "./user-notification.service.js";
import { logger } from "../lib/logger.js";

const DEFAULT_SWEEP_MS = 120_000;

export async function expireOverduePaymentReservations({ now = new Date(), limit = 50 } = {}) {
  const candidates = await listExpiredPendingPaymentOrders({ now, limit });
  const expired = [];

  for (const candidate of candidates) {
    try {
      const order = await expirePaymentReservation(candidate.orderId, { now });
      if (!order) continue;
      expired.push(order);
      await notifyOrderOwner(order).catch((error) => {
        logger.exception("order.payment_reservation.notify_failed", error, { orderId: order.orderId });
      });
    } catch (error) {
      logger.exception("order.payment_reservation.expire_failed", error, { orderId: candidate.orderId });
    }
  }

  logger.info("order.payment_reservation.sweep_completed", {
    candidates: candidates.length,
    expired: expired.length
  });

  return expired;
}

export function startPaymentExpirationJob({
  intervalMs = Number(process.env.PAYMENT_EXPIRATION_SWEEP_MS ?? DEFAULT_SWEEP_MS),
  sweep = expireOverduePaymentReservations
} = {}) {
  const ms = Number(intervalMs);
  const delay = Number.isFinite(ms) && ms >= 60_000 ? ms : DEFAULT_SWEEP_MS;
  void sweep();
  const handle = setInterval(() => {
    void sweep();
  }, delay);
  handle.unref?.();
  logger.info("order.payment_reservation.job_started", { intervalMs: delay });
  return () => clearInterval(handle);
}
