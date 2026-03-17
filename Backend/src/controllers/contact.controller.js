import { createContact } from "../repositories/contacts.repository.js";
import { sendContactEmail } from "../services/email.service.js";
import { sendWhatsAppNotification } from "../services/whatsapp.service.js";

function normalizeText(value, fallback = "No indicado") {
  const text = String(value ?? "").trim();
  return text || fallback;
}

function buildContactText({ name, phone, email, message }) {
  return `📩 NUEVA SOLICITUD WEB\n\n👤 Nombre: ${normalizeText(name)}\n📞 Teléfono: ${normalizeText(phone)}\n📧 Email: ${normalizeText(email)}\n\n📝 Mensaje:\n${normalizeText(message, "(sin mensaje)")}`;
}

function buildNotification(type, sent, warning) {
  return {
    type,
    status: sent ? "sent" : "error",
    error: warning ?? null,
    date: new Date().toISOString()
  };
}

export async function sendContact(req, res) {
  try {
    const { name, phone, email, message } = req.body ?? {};

    if (!String(name ?? "").trim() || !String(message ?? "").trim()) {
      return res.status(400).json({ ok: false, error: "Datos incompletos" });
    }

    const normalized = {
      name: normalizeText(name),
      phone: normalizeText(phone),
      email: normalizeText(email),
      message: normalizeText(message, "(sin mensaje)")
    };

    const text = buildContactText(normalized);

    const notifications = {
      email: { sent: false, warning: null },
      whatsapp: { sent: false, warning: null }
    };

    try {
      await sendContactEmail({
        subject: "Nueva solicitud de contacto",
        text,
        details: normalized
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

    const now = new Date().toISOString();
    const contact = await createContact({
      ...normalized,
      status: "nuevo",
      createdAt: now,
      updatedAt: now,
      messages: [
        {
          from: "cliente",
          text: normalized.message,
          date: now
        }
      ],
      notifications: [
        buildNotification("email", notifications.email.sent, notifications.email.warning),
        buildNotification("whatsapp", notifications.whatsapp.sent, notifications.whatsapp.warning)
      ]
    });

    return res.status(200).json({
      ok: true,
      contactId: String(contact._id),
      notifications
    });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message ?? "Unexpected error" });
  }
}
