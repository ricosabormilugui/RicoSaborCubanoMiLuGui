import {
  addContactReply,
  appendContactNotifications,
  findContactById,
  listContacts,
  markContactAsRead
} from "../repositories/contacts.repository.js";
import { sendDirectEmail } from "../services/email.service.js";
import { sendWhatsAppToPhone } from "../services/whatsapp.service.js";

function serializeContact(contact) {
  if (!contact) return null;

  return {
    ...contact,
    id: String(contact._id),
    _id: undefined
  };
}

function buildReplyWhatsAppMessage(message) {
  return `🍽️ *Rico Sabor Cubano*\n\nHola 👋\n\n${message}\n\nGracias por contactarnos 🙌`;
}

function buildNotification(type, sent, warning) {
  return {
    type,
    status: sent ? "sent" : "error",
    error: warning ?? null,
    date: new Date().toISOString()
  };
}

export async function listContactsForAdmin(req, res) {
  try {
    const status = String(req.query.status ?? "").trim();
    const search = String(req.query.search ?? "").trim();
    const limit = req.query.limit ? Number(req.query.limit) : 100;

    const contacts = await listContacts({
      status: status || undefined,
      search: search || undefined,
      limit: Number.isFinite(limit) ? Math.min(limit, 300) : 100
    });

    return res.status(200).json({ contacts: contacts.map(serializeContact) });
  } catch (error) {
    return res.status(500).json({ error: error.message ?? "Unexpected error" });
  }
}

export async function getContactForAdmin(req, res) {
  try {
    const { id } = req.params;
    let contact = await markContactAsRead(id);

    if (!contact) {
      contact = await findContactById(id);
    }

    if (!contact) {
      return res.status(404).json({ error: "Contact not found" });
    }

    return res.status(200).json({ contact: serializeContact(contact) });
  } catch (error) {
    return res.status(500).json({ error: error.message ?? "Unexpected error" });
  }
}

export async function replyContactForAdmin(req, res) {
  try {
    const { id } = req.params;
    const { message, sendEmail, sendWhatsApp } = req.body ?? {};
    const replyText = String(message ?? "").trim();

    if (!replyText) {
      return res.status(400).json({ error: "message is required" });
    }

    const existing = await findContactById(id);
    if (!existing) {
      return res.status(404).json({ error: "Contact not found" });
    }

    const notifications = {
      email: { sent: false, warning: null },
      whatsapp: { sent: false, warning: null }
    };

    if (sendEmail) {
      const customerEmail = String(existing.email ?? "").trim();
      if (!customerEmail) {
        notifications.email.warning = "cliente sin email";
      } else {
        try {
          await sendDirectEmail({
            to: customerEmail,
            subject: "Respuesta a tu solicitud · Rico Sabor Cubano",
            text: replyText
          });
          notifications.email.sent = true;
        } catch (error) {
          notifications.email.warning = error.message ?? "failed";
        }
      }
    } else {
      notifications.email.warning = "disabled";
    }

    if (sendWhatsApp) {
      const phone = String(existing.phone ?? "").trim();
      if (!phone) {
        notifications.whatsapp.warning = "cliente sin teléfono";
      } else {
        try {
          await sendWhatsAppToPhone(phone, buildReplyWhatsAppMessage(replyText));
          notifications.whatsapp.sent = true;
        } catch (error) {
          notifications.whatsapp.warning = error.message ?? "failed";
        }
      }
    } else {
      notifications.whatsapp.warning = "disabled";
    }

    const updated = await addContactReply(id, {
      from: "admin",
      text: replyText,
      date: new Date().toISOString()
    });

    await appendContactNotifications(id, [
      buildNotification("email", notifications.email.sent, notifications.email.warning),
      buildNotification("whatsapp", notifications.whatsapp.sent, notifications.whatsapp.warning)
    ]);

    const refreshed = await findContactById(id);

    return res.status(200).json({
      ok: true,
      contact: serializeContact(refreshed ?? updated),
      notifications
    });
  } catch (error) {
    return res.status(500).json({ error: error.message ?? "Unexpected error" });
  }
}
