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
  const statusLabel = mapStatusLabel(status);
  const total = Number(order?.total ?? 0).toFixed(2);

  const statusMap = {
    nuevo: "🆕 Pedido recibido",
    confirmado: "✅ Pedido confirmado",
    preparando: "👨‍🍳 En preparación",
    listo: "📦 Listo",
    enviado: "🚚 En camino",
    entregado: "🎉 Entregado",
    cancelado: "❌ Cancelado",
    anulado: "❌ Anulado"
  };

  const statusLine = statusMap[status] ?? statusLabel;
  const noteLine = statusNote ? `\nNota: ${statusNote}` : "";

  return `Hola ${customerName} 👋\n\nTu pedido ${order.orderId} ahora está:\n\n${statusLine}${noteLine}\n\nTotal: €${total}\n\nGracias por confiar en Rico Sabor Cubano 🇨🇺`;
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
