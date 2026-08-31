import { BRAND_CONFIG } from "../config/brand.config.js";
import { fetchWithTimeout } from "../lib/fetch-with-timeout.js";
import {
  buildAdminOrderEmail,
  buildCustomerOrderEmail,
  buildOrderStatusEmail,
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
    reply_to: to,
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

export async function sendDirectEmail({ to, subject, text, html } = {}) {
  const apiKey = getRequiredEnv("RESEND_API_KEY");
  const from = getRequiredEnv("NOTIFY_EMAIL_FROM");
  const target = String(to ?? "").trim();

  if (!target) {
    throw new Error("Missing recipient email");
  }

  await sendEmail(apiKey, {
    from,
    to: [target],
    subject: subject || `Mensaje · ${BRAND_CONFIG.name}`,
    text: String(text ?? ""),
    html: html || undefined
  });
}

export async function sendPasswordResetEmail({ to, fullName, resetUrl, expiresInMinutes } = {}) {
  const recipientName = String(fullName ?? "cliente").trim() || "cliente";
  const safeName = escapeHtml(recipientName);
  const safeUrl = escapeHtml(resetUrl);
  const minutes = Number(expiresInMinutes);

  await sendDirectEmail({
    to,
    subject: `Restablece tu contraseña · ${BRAND_CONFIG.name}`,
    text: [
      `Hola ${recipientName},`,
      "",
      "Hemos recibido una solicitud para restablecer la contraseña de tu cuenta.",
      `Abre este enlace para definir una nueva contraseña: ${resetUrl}`,
      `El enlace caduca en ${minutes} minutos y solo puede utilizarse una vez.`,
      "",
      "Si no solicitaste este cambio, puedes ignorar este mensaje."
    ].join("\n"),
    html: `
      <div style="background:#f8f5eb;padding:24px;font-family:Arial,Helvetica,sans-serif;color:#0d3d67;">
        <div style="max-width:620px;margin:0 auto;background:#ffffff;border:1px solid #c8d9ef;overflow:hidden;">
          <div style="height:4px;background:#e51a32;font-size:1px;line-height:4px;">&nbsp;</div>
          <div style="background:#ffffff;color:#0d3d67;padding:20px 24px;text-align:center;border-bottom:3px solid #0068a8;">
            <h1 style="margin:0;font-size:22px;letter-spacing:.06em;">${BRAND_CONFIG.name}</h1>
            <p style="margin:4px 0 0;font-size:13px;color:#346083;">${BRAND_CONFIG.slogan}</p>
          </div>
          <div style="padding:24px;">
            <p>Hola <strong>${safeName}</strong>,</p>
            <p>Hemos recibido una solicitud para restablecer la contraseña de tu cuenta.</p>
            <p style="margin:24px 0;">
              <a href="${safeUrl}" style="display:inline-block;background:#e51a32;color:#ffffff;text-decoration:none;font-weight:700;padding:12px 18px;border-radius:999px;">Restablecer contraseña</a>
            </p>
            <p>Este enlace caduca en <strong>${minutes} minutos</strong> y solo puede utilizarse una vez.</p>
            <p style="color:#346083;font-size:14px;">Si no solicitaste este cambio, puedes ignorar este mensaje.</p>
          </div>
        </div>
      </div>
    `
  });
}

export async function sendOrderStatusEmail(order, { status, statusNote } = {}) {
  const customerEmail = String(order?.customer?.email ?? "").trim();
  if (!customerEmail) return;

  const apiKey = getRequiredEnv("RESEND_API_KEY");
  const from = getRequiredEnv("NOTIFY_EMAIL_FROM");
  const replyTo = process.env.NOTIFY_EMAIL_TO;
  const message = buildOrderStatusEmail(order, { status, statusNote });

  await sendEmail(apiKey, {
    from,
    to: [customerEmail],
    reply_to: replyTo || undefined,
    subject: message.subject,
    html: message.html,
    text: message.text
  });
}
