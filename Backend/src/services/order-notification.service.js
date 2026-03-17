import { sendOrderStatusEmail } from "./email.service.js";
import { sendWhatsAppToPhone } from "./whatsapp.service.js";

const NOTIFY_STATUSES = new Set(["confirmado", "preparando", "listo", "enviado", "nuevo"]);

function mapStatusLabel(status) {
  const labels = {
    nuevo: "Nuevo",
    confirmado: "Confirmado",
    preparando: "Preparando",
    listo: "Listo",
    enviado: "Enviado",
    entregado: "Entregado",
    cancelado: "Cancelado",
    anulado: "Anulado"
  };

  return labels[status] ?? status;
}

function buildWhatsAppMessage(order, status, statusNote) {
  const customerName = order?.customer?.fullName ?? "cliente";
  const total = Number(order?.total ?? 0).toFixed(2);
  const noteLine = statusNote ? `\n📝 *Nota:* ${statusNote}` : "";

  return `🍽️ *Rico Sabor Cubano*\n\nHola ${customerName} 👋\n\n📦 *Pedido:* ${order.orderId}\n💰 *Total:* €${total}\n\n📍 *Estado:* ${mapStatusLabel(status)}${noteLine}\n\nGracias por tu pedido 🙌`;
}

export async function notifyCustomerOrderStatus(order, { status, statusNote } = {}) {
  const nextStatus = status ?? order?.status;
  const notifications = {
    whatsapp: { sent: false, warning: null },
    email: { sent: false, warning: null }
  };

  if (!NOTIFY_STATUSES.has(nextStatus)) {
    notifications.whatsapp.warning = "status-not-notified";
    notifications.email.warning = "status-not-notified";
    return notifications;
  }

  try {
    await sendOrderStatusEmail(order, { status: nextStatus, statusNote });
    notifications.email.sent = true;
  } catch (error) {
    notifications.email.warning = error.message ?? "failed";
  }

  try {
    const phone = String(order?.customer?.phone ?? "").trim();
    if (!phone) {
      notifications.whatsapp.warning = "cliente sin teléfono";
      return notifications;
    }

    await sendWhatsAppToPhone(phone, buildWhatsAppMessage(order, nextStatus, statusNote));
    notifications.whatsapp.sent = true;
  } catch (error) {
    notifications.whatsapp.warning = error.message ?? "failed";
  }

  return notifications;
}
