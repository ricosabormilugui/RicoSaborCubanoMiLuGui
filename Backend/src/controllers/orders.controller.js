import { saveOrder } from "../services/orders.repository.js";
import { sendOrderEmail } from "../services/email.service.js";
import { sendWhatsAppNotification } from "../services/whatsapp.service.js";

function isWebhookAuthorized(req) {
  const expectedToken = process.env.WHATSAPP_WEBHOOK_TOKEN;
  if (!expectedToken) return true;

  const authHeader = req.headers.authorization ?? "";
  const bearer = authHeader.startsWith("Bearer ") ? authHeader.slice("Bearer ".length).trim() : "";
  return bearer === expectedToken;
}

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

export async function notifyWhatsApp(req, res) {
  if (!isWebhookAuthorized(req)) {
    return res.status(401).json({ error: "Unauthorized webhook" });
  }

  try {
    const message = req.body?.message;
    if (!message || typeof message !== "string") {
      return res.status(400).json({ error: "Message is required" });
    }

    await sendWhatsAppNotification(message);
    return res.status(200).json({ sent: true });
  } catch (error) {
    return res.status(500).json({ error: error.message ?? "Unexpected error" });
  }
}
