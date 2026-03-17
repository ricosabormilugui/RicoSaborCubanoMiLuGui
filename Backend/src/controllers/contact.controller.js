import { sendContactEmail } from "../services/email.service.js";
import { sendWhatsAppNotification } from "../services/whatsapp.service.js";

function normalizeText(value, fallback = "No indicado") {
  const text = String(value ?? "").trim();
  return text || fallback;
}

function buildContactText({ name, phone, email, message }) {
  return `📩 NUEVA SOLICITUD WEB\n\n👤 Nombre: ${normalizeText(name)}\n📞 Teléfono: ${normalizeText(phone)}\n📧 Email: ${normalizeText(email)}\n\n📝 Mensaje:\n${normalizeText(message, "(sin mensaje)")}`;
}

export async function sendContact(req, res) {
  try {
    const { name, phone, email, message } = req.body ?? {};

    if (!String(name ?? "").trim() || !String(message ?? "").trim()) {
      return res.status(400).json({ ok: false, error: "Datos incompletos" });
    }

    const text = buildContactText({ name, phone, email, message });

    const notifications = {
      email: { sent: false, warning: null },
      whatsapp: { sent: false, warning: null }
    };

    try {
      await sendContactEmail({
        subject: "Nueva solicitud de contacto",
        text,
        details: {
          name: normalizeText(name),
          phone: normalizeText(phone),
          email: normalizeText(email),
          message: normalizeText(message, "(sin mensaje)")
        }
      });
      notifications.email.sent = true;
    } catch (error) {
      notifications.email.warning = error.message ?? "failed";
    }

    try {
      await sendWhatsAppNotification(text);
      notifications.whatsapp.sent = true;
    } catch (error) {
      notifications.whatsapp.warning = error.message ?? "failed";
    }

    return res.status(200).json({ ok: true, notifications });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message ?? "Unexpected error" });
  }
}
