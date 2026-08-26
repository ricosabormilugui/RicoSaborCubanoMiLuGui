import { markFirstOrderCouponUsed, upsertCustomerFromOrder } from "../repositories/customers.repository.js";
import { saveOrder } from "../repositories/orders.repository.js";
import { applyOrderStockAdjustments } from "../repositories/products.repository.js";
import { notifyOrderOwner } from "./user-notification.service.js";

export class CouponConsumptionError extends Error {
  constructor() {
    super("El cupón ya fue utilizado por este cliente.");
    this.name = "CouponConsumptionError";
    this.status = 409;
    this.code = "COUPON_CONFLICT";
  }
}

export async function commitOrderUnitOfWork(order, {
  session,
  marketingConsent = false,
  coupon,
  customerUpserter = upsertCustomerFromOrder,
  couponConsumer = markFirstOrderCouponUsed,
  stockAdjuster = applyOrderStockAdjustments,
  orderSaver = saveOrder,
  notificationWriter = notifyOrderOwner
} = {}) {
  const linkedCustomer = await customerUpserter(order, { marketingConsent, session });
  if (linkedCustomer?._id) order.customerId = String(linkedCustomer._id);

  if (coupon?.valid && order.customerId) {
    const couponCustomer = await couponConsumer(order.customerId, {
      orderId: order.orderId,
      code: coupon.code,
      percent: coupon.percent
    }, { session });
    if (!couponCustomer) throw new CouponConsumptionError();
  }

  await stockAdjuster(order.items, { session });
  await orderSaver(order, { session });
  await notificationWriter(order, { session });
  return order;
}
