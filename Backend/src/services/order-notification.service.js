import { sendOrderStatusEmail } from "./email.service.js";
import { sendWhatsAppToPhone } from "./whatsapp.service.js";

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
  const noteLine = statusNote ? `\nNota: ${statusNote}` : "";

  return `📦 Actualización de pedido ${order.orderId}\nHola ${customerName}, tu pedido ahora está: ${mapStatusLabel(status)}.${noteLine}`;
}

export async function notifyCustomerOrderStatus(order, { status, statusNote } = {}) {
  const warnings = [];

  try {
    await sendOrderStatusEmail(order, { status, statusNote });
  } catch (error) {
    warnings.push(`email-status: ${error.message ?? "failed"}`);
  }

  try {
    const phone = String(order?.customer?.phone ?? "").trim();
    if (phone) {
      await sendWhatsAppToPhone(phone, buildWhatsAppMessage(order, status, statusNote));
    }
  } catch (error) {
    warnings.push(`whatsapp-status: ${error.message ?? "failed"}`);
  }

  return warnings;
}
