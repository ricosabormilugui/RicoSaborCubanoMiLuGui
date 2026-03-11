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

async function runStep(stepName, runner, warnings) {
  try {
    await runner();
  } catch (error) {
    warnings.push(`${stepName}: ${error.message ?? "failed"}`);
  }
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

    const warnings = [];

    await runStep("persistence", async () => {
      await saveOrder(order);
    }, warnings);

    await runStep("email", async () => {
      await sendOrderEmail(order);
    }, warnings);

    await runStep("whatsapp", async () => {
      await sendWhatsAppNotification(
        `🛒 Nuevo pedido en MiLuGui\n\nCliente: ${order.customer.fullName}\nTeléfono: ${order.customer.phone}\nTotal: ${order.total ?? 0}€`
      );
    }, warnings);

    return res.status(201).json({
      orderId: order.orderId,
      warnings: warnings.length ? warnings : undefined
    });
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
