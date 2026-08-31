import { BRAND_CONFIG } from "../config/brand.config.js";
import { getSalesReplyTo } from "../config/contact.config.js";
import { fetchWithTimeout } from "../lib/fetch-with-timeout.js";
import {
  buildAdminOrderEmail,
  buildCustomerOrderEmail,
  buildOrderStatusEmail,
  buildPasswordResetEmail,
  escapeHtml
} from "./order-email.templates.js";

function getRequiredEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }
  return value;
}

export function applyStagingEmailSafety(payload, env = process.env) {
  if (String(env.APP_ENV ?? "").trim().toLowerCase() !== "staging") {
    return payload;
  }

  const qaRecipient = String(env.STAGING_EMAIL_TO ?? "").trim();
  if (!qaRecipient) {
    throw new Error("Missing environment variable: STAGING_EMAIL_TO");
  }

  const subject = String(payload?.subject ?? "Mensaje");
  return {
    ...payload,
    to: [qaRecipient],
    cc: undefined,
    bcc: undefined,
    reply_to: qaRecipient,
    subject: subject.startsWith("[STAGING]") ? subject : `[STAGING] ${subject}`
  };
}

async function sendEmail(apiKey, payload) {
  const safePayload = applyStagingEmailSafety(payload);
  const response = await fetchWithTimeout("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(safePayload)
  }, { timeoutMs: Number(process.env.RESEND_TIMEOUT_MS ?? process.env.EXTERNAL_HTTP_TIMEOUT_MS ?? 8_000) });

  if (!response.ok) {
    throw new Error(`Email provider rejected request (${response.status})`);
  }
}

export async function sendOrderEmail(order) {
  const apiKey = getRequiredEnv("RESEND_API_KEY");
  const from = getRequiredEnv("NOTIFY_EMAIL_FROM");
  const to = getRequiredEnv("NOTIFY_EMAIL_TO");
  const customerEmail = order.customer?.email?.trim();
  const admin = buildAdminOrderEmail(order);
  const customer = buildCustomerOrderEmail(order);

  await sendEmail(apiKey, {
    from,
    to: [to],
    reply_to: customerEmail || undefined,
    subject: admin.subject,
    html: admin.html,
    text: admin.text
  });

  if (!customerEmail) {
    return;
  }

  await sendEmail(apiKey, {
    from,
    to: [customerEmail],
    // Emails al cliente son automáticos (footer no-reply). reply_to usa el buzón comercial
    // de ventas, no el buzón operativo NOTIFY_EMAIL_TO.
    reply_to: getSalesReplyTo(),
    subject: customer.subject,
    html: customer.html,
    text: customer.text
  });
}

function buildContactHtml({ name, phone, email, message }) {
  return `
    <h2>📩 Nueva solicitud web</h2>
    <p><b>Nombre:</b> ${escapeHtml(name)}</p>
    <p><b>Teléfono:</b> ${escapeHtml(phone || "—")}</p>
    <p><b>Email:</b> ${escapeHtml(email || "—")}</p>
    <hr/>
    <p><b>Mensaje:</b></p>
    <p>${escapeHtml(message).replaceAll("\n", "<br/>")}</p>
  `;
}

function buildContactText({ name, phone, email, message }) {
  return `📩 NUEVA SOLICITUD WEB

👤 Nombre: ${name}
📞 Teléfono: ${phone || "—"}
📧 Email: ${email || "—"}

📝 Mensaje:
${message}`;
}

export async function sendContactEmail({ subject, details } = {}) {
  const apiKey = getRequiredEnv("RESEND_API_KEY");
  const from = getRequiredEnv("NOTIFY_EMAIL_FROM");
  const to = getRequiredEnv("NOTIFY_EMAIL_TO");

  const normalizedDetails = {
    name: String(details?.name ?? "No indicado"),
    phone: String(details?.phone ?? "").trim(),
    email: String(details?.email ?? "").trim(),
    message: String(details?.message ?? "")
  };

  await sendEmail(apiKey, {
    from,
    to: [to],
    subject: subject || "Nueva solicitud de contacto",
    text: buildContactText(normalizedDetails),
    html: buildContactHtml(normalizedDetails),
    reply_to: normalizedDetails.email || undefined
  });
}

export async function sendDirectEmail({ to, subject, text, html, replyTo } = {}) {
  const apiKey = getRequiredEnv("RESEND_API_KEY");
  const from = getRequiredEnv("NOTIFY_EMAIL_FROM");
  const target = String(to ?? "").trim();

  if (!target) {
    throw new Error("Missing recipient email");
  }

  await sendEmail(apiKey, {
    from,
    to: [target],
    reply_to: replyTo || undefined,
    subject: subject || `Mensaje · ${BRAND_CONFIG.name}`,
    text: String(text ?? ""),
    html: html || undefined
  });
}

export async function sendPasswordResetEmail({ to, fullName, resetUrl, expiresInMinutes } = {}) {
  const message = buildPasswordResetEmail({ fullName, resetUrl, expiresInMinutes });

  await sendDirectEmail({
    to,
    subject: message.subject,
    text: message.text,
    html: message.html,
    replyTo: getSalesReplyTo()
  });
}

export async function sendOrderStatusEmail(order, { status, statusNote } = {}) {
  const customerEmail = String(order?.customer?.email ?? "").trim();
  if (!customerEmail) return;

  const apiKey = getRequiredEnv("RESEND_API_KEY");
  const from = getRequiredEnv("NOTIFY_EMAIL_FROM");
  const message = buildOrderStatusEmail(order, { status, statusNote });

  await sendEmail(apiKey, {
    from,
    to: [customerEmail],
    reply_to: getSalesReplyTo(),
    subject: message.subject,
    html: message.html,
    text: message.text
  });
}
