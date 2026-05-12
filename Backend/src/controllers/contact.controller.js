import {
  appendContactNotifications,
  createContact,
  findContactByRequestId,
  findRecentDuplicateContact,
  updateContactLastNotifications
} from '../repositories/contacts.repository.js';
import { notifyContact } from '../services/contact-notification.service.js';
import { upsertCustomerFromContact } from '../repositories/customers.repository.js';
import { logger } from '../lib/logger.js';

export async function getContactEndpointStatus(_req, res) {
  return res.status(200).json({ ok: true, endpoint: "contact", methods: ["POST"] });
}

function normalizeText(value, fallback = 'No indicado') {
  const text = String(value ?? '').trim();
  return text || fallback;
}

function normalizePayload({ name, phone, email, message }) {
  return {
    name: normalizeText(name),
    phone: normalizeText(phone, ''),
    email: normalizeText(email, '').toLowerCase(),
    message: normalizeText(message, '(sin mensaje)')
  };
}

function normalizeNotificationShape(lastNotifications) {
  return {
    email: {
      sent: Boolean(lastNotifications?.email?.sent),
      warning: lastNotifications?.email?.warning ?? null
    }
  };
}

function duplicatedResponse(contact) {
  return {
    ok: true,
    duplicated: true,
    contactId: String(contact._id),
    notifications: normalizeNotificationShape(contact.lastNotifications)
  };
}

export async function sendContact(req, res) {
  try {
    const { name, phone, email, message, requestId, bypassContentDedup } = req.body ?? {};

    if (!String(name ?? '').trim() || !String(message ?? '').trim()) {
      return res.status(400).json({ ok: false, error: 'Datos incompletos' });
    }

    const normalizedRequestId = String(requestId ?? '').trim();
    if (!normalizedRequestId) {
      return res.status(400).json({ ok: false, error: 'requestId is required' });
    }

    const duplicatedByRequest = await findContactByRequestId(normalizedRequestId);
    if (duplicatedByRequest) {
      return res.status(200).json(duplicatedResponse(duplicatedByRequest));
    }

    const normalized = normalizePayload({ name, phone, email, message });

    if (!bypassContentDedup) {
      const duplicatedByContent = await findRecentDuplicateContact({
        email: normalized.email,
        message: normalized.message
      });

      if (duplicatedByContent) {
        return res.status(200).json(duplicatedResponse(duplicatedByContent));
      }
    }

    const now = new Date().toISOString();
    let contact;

    try {
      contact = await createContact({
        ...normalized,
        requestId: normalizedRequestId,
        status: 'nuevo',
        createdAt: now,
        updatedAt: now,
        messages: [
          {
            from: 'cliente',
            text: normalized.message,
            date: now
          }
        ],
        notifications: [],
        lastNotifications: null
      });
    } catch (error) {
      if (error?.code === 11000) {
        const existing = await findContactByRequestId(normalizedRequestId);
        if (existing) {
          return res.status(200).json(duplicatedResponse(existing));
        }
      }
      throw error;
    }

    await upsertCustomerFromContact(contact);

    const { notifications, notificationsAudit } = await notifyContact(normalized);

    await appendContactNotifications(String(contact._id), notificationsAudit);
    await updateContactLastNotifications(String(contact._id), notifications);

    const anySent = notifications.email.sent;

    logger.info('contact.notify', {
      contactId: String(contact._id),
      channels: notifications,
      ok: anySent
    });

    return res.status(anySent ? 200 : 207).json({
      ok: anySent,
      contactId: String(contact._id),
      notifications
    });
  } catch (error) {
    logger.error('contact.submit.error', { error: error.message ?? 'Unexpected error' });
    return res.status(500).json({ ok: false, error: error.message ?? 'Unexpected error' });
  }
}
