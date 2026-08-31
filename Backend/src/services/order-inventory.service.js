import { restoreOrderStockAdjustments } from "../repositories/products.repository.js";
import { releaseFirstOrderCouponIfOwnedByOrder, revertCustomerOrderCounters } from "../repositories/customers.repository.js";
import { logger } from "../lib/logger.js";

export const VOID_ORDER_STATUSES = ["cancelado", "anulado"];

function paymentStatusOf(order) {
  return order?.payment?.status ?? order?.paymentStatus ?? "pending";
}

export async function voidOrderAndReleaseInventory(orderId, {
  reason,
  nextStatus = "cancelado",
  nextPaymentStatus = null,
  extraFilter = {},
  extraSet = {},
  statusNote = null,
  updatedBy = "system",
  collection,
  runTransaction,
  stockRestorer = restoreOrderStockAdjustments,
  couponReleaser = releaseFirstOrderCouponIfOwnedByOrder,
  customerCounterReverter = revertCustomerOrderCounters,
  now = new Date()
} = {}) {
  if (!orderId || !collection || !runTransaction) return null;
  const nowIso = now.toISOString();

  return runTransaction(async (session) => {
    const previous = await collection.findOneAndUpdate(
      {
        orderId,
        inventoryReleasedAt: null,
        status: { $nin: VOID_ORDER_STATUSES },
        ...extraFilter
      },
      {
        $set: {
          status: nextStatus,
          ...(nextPaymentStatus ? {
            paymentStatus: nextPaymentStatus,
            "payment.status": nextPaymentStatus
          } : {}),
          cancellationReason: reason,
          inventoryReleasedAt: nowIso,
          inventoryReleaseReason: reason,
          updatedAt: nowIso,
          updatedBy,
          ...extraSet
        },
        $push: {
          statusHistory: {
            status: nextStatus,
            at: nowIso,
            note: statusNote,
            signature: null
          }
        }
      },
      { returnDocument: "before", session }
    );

    if (!previous) return null;

    await stockRestorer(previous.items ?? [], { session });

    if (paymentStatusOf(previous) !== "paid") {
      await couponReleaser(previous.customerId, previous.orderId, { session });
      await customerCounterReverter(previous.customerId, previous.orderId, {
        session,
        total: previous.total
      });
    }

    logger.info("order.stock.released", {
      orderId: previous.orderId,
      reason
    });

    return {
      ...previous,
      status: nextStatus,
      paymentStatus: nextPaymentStatus ?? previous.paymentStatus,
      payment: {
        ...(previous.payment ?? {}),
        ...(nextPaymentStatus ? { status: nextPaymentStatus } : {})
      },
      cancellationReason: reason,
      inventoryReleasedAt: nowIso,
      inventoryReleaseReason: reason,
      updatedAt: nowIso,
      ...extraSet
    };
  });
}
