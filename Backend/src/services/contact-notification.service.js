import { sendContactEmail } from './email.service.js';

function buildRetryMeta(sent, warning, retries = 0) {
  if (sent || !warning) {
    return { retries, nextRetryAt: null };
  }

  const nextRetries = retries + 1;
  const delayMs = (2 ** nextRetries) * 60_000;

  return {
    retries: nextRetries,
    nextRetryAt: new Date(Date.now() + delayMs).toISOString()
  };
}

export async function notifyContact(contact, { retries = { email: 0 } } = {}) {
  const notifications = {
    email: { sent: false, warning: null }
  };

  try {
    await sendContactEmail({
      subject: 'Nueva solicitud de contacto',
      details: contact
    });
    notifications.email.sent = true;
  } catch (error) {
    notifications.email.warning = error.message ?? 'failed';
  }

  return {
    notifications,
    notificationsAudit: [
      {
        type: 'email',
        status: notifications.email.sent ? 'sent' : 'error',
        error: notifications.email.warning,
        date: new Date().toISOString(),
        ...buildRetryMeta(notifications.email.sent, notifications.email.warning, retries.email ?? 0)
      }
    ]
  };
}
