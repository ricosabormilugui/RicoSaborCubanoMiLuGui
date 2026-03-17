import {
  appendContactNotifications,
  createContact,
  findContactById,
  findContactByRequestId
} from "../repositories/contacts.repository.js";
import { sendContactEmail } from "../services/email.service.js";
import { sendWhatsAppNotification } from "../services/whatsapp.service.js";

function normalizeText(value, fallback = "No indicado") {
  const text = String(value ?? "").trim();
  return text || fallback;
}

function buildNotification(type, sent, warning) {
  return {
    type,
    status: sent ? "sent" : "error",
    error: warning ?? null,
    date: new Date().toISOString()
  };
}

function buildContactWhatsApp({ name, phone, email, message }) {
  return `🍽️ *Rico Sabor Cubano*\n\n📩 *Nueva solicitud*\n\n👤 ${name}\n📞 ${phone || "—"}\n📧 ${email || "—"}\n\n📝 ${message}`;
}

function getChannelSummary(contact, type) {
  const events = Array.isArray(contact?.notifications)
    ? contact.notifications.filter((item) => item?.type === type)
    : [];

  if (!events.length) {
    return { sent: false, warning: "no-attempt" };
  }

  const latest = events[events.length - 1];
  return {
    sent: latest?.status === "sent",
    warning: latest?.error ?? null
  };
}

export async function sendContact(req, res) {
  try {
    const { name, phone, email, message, requestId } = req.body ?? {};

    if (!String(name ?? "").trim() || !String(message ?? "").trim()) {
      return res.status(400).json({ ok: false, error: "Datos incompletos" });
    }

    const normalizedRequestId = String(requestId ?? "").trim();
    if (!normalizedRequestId) {
      return res.status(400).json({ ok: false, error: "requestId is required" });
    }

    const duplicated = await findContactByRequestId(normalizedRequestId);
    if (duplicated) {
      return res.status(200).json({
        ok: true,
        duplicated: true,
        contactId: String(duplicated._id),
        notifications: {
          email: getChannelSummary(duplicated, "email"),
          whatsapp: getChannelSummary(duplicated, "whatsapp")
        }
      });
    }

    const normalized = {
      name: normalizeText(name),
      phone: normalizeText(phone, ""),
      email: normalizeText(email, ""),
      message: normalizeText(message, "(sin mensaje)")
    };

    const now = new Date().toISOString();
    let created;
    try {
      created = await createContact({
        ...normalized,
        requestId: normalizedRequestId,
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
        notifications: []
      });
    } catch (error) {
      if (error?.code === 11000) {
        const existing = await findContactByRequestId(normalizedRequestId);
        if (existing) {
          return res.status(200).json({
            ok: true,
            duplicated: true,
            contactId: String(existing._id),
            notifications: {
              email: getChannelSummary(existing, "email"),
              whatsapp: getChannelSummary(existing, "whatsapp")
            }
          });
        }
      }

      throw error;
    }

    const notifications = {
      email: { sent: false, warning: null },
      whatsapp: { sent: false, warning: null }
    };

    try {
      await sendContactEmail({
        subject: "Nueva solicitud de contacto",
        details: normalized
      });
      notifications.email.sent = true;
    } catch (error) {
      notifications.email.warning = error.message ?? "failed";
    }

    try {
      await sendWhatsAppNotification(buildContactWhatsApp(normalized));
      notifications.whatsapp.sent = true;
    } catch (error) {
      notifications.whatsapp.warning = error.message ?? "failed";
    }

    await appendContactNotifications(String(created._id), [
      buildNotification("email", notifications.email.sent, notifications.email.warning),
      buildNotification("whatsapp", notifications.whatsapp.sent, notifications.whatsapp.warning)
    ]);

    const anySent = notifications.email.sent || notifications.whatsapp.sent;
    const stored = await findContactById(String(created._id));

    return res.status(anySent ? 200 : 207).json({
      ok: anySent,
      contactId: String(created._id),
      notifications: {
        email: getChannelSummary(stored ?? created, "email"),
        whatsapp: getChannelSummary(stored ?? created, "whatsapp")
      }
    });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message ?? "Unexpected error" });
  }
}
