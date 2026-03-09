import { saveOrder } from "../services/orders.repository.js";
import { sendOrderEmail } from "../services/email.service.js";
import { sendWhatsAppNotification } from "../services/whatsapp.service.js";

export async function createOrder(req, res) {
  try {
    const payload = req.body;

    if (!payload?.customer?.fullName || !payload?.customer?.phone || !payload?.items?.length) {
      return res.status(400).json({ error: "Invalid order payload" });
    }

    const order = {
      ...payload,
      orderId: `MLG-${Date.now()}`,
      createdAt: new Date().toISOString(),
      status: "nuevo"
    };

    await saveOrder(order);

    await Promise.all([
      sendOrderEmail(order),
      sendWhatsAppNotification(`🛒 Nuevo pedido en MiLuGui\n\nCliente: ${order.customer.fullName}\nTeléfono: ${order.customer.phone}\nTotal: ${order.total ?? 0}€`)
    ]);

    return res.status(201).json({ orderId: order.orderId });
  } catch (error) {
    return res.status(500).json({ error: error.message ?? "Unexpected error" });
  }
}
