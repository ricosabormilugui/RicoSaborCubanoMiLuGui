import { sendOrderStatusEmail } from "./email.service.js";

const NOTIFY_STATUSES = new Set(["confirmado", "preparando", "listo", "enviado", "nuevo"]);

export async function notifyCustomerOrderStatus(order, { status, statusNote } = {}) {
  const nextStatus = status ?? order?.status;
  const notifications = {
    email: { sent: false, warning: null }
  };

  if (!NOTIFY_STATUSES.has(nextStatus)) {
    notifications.email.warning = "status-not-notified";
    return notifications;
  }

  try {
    await sendOrderStatusEmail(order, { status: nextStatus, statusNote });
    notifications.email.sent = true;
  } catch (error) {
    notifications.email.warning = error.message ?? "failed";
  }

  return notifications;
}
