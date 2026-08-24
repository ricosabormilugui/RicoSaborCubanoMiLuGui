import { BRAND_CONFIG } from "../config/brand.config.js";
import { fetchWithTimeout } from "../lib/fetch-with-timeout.js";

function getRequiredEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }
  return value;
}


function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatCurrency(value) {
  const amount = Number(value ?? 0);
  return `${amount.toFixed(2)} EUR`;
}

function getDeliveryModeLabel(mode) {
  return mode === "pickup" ? "Recogida en Alcorcón" : "Entrega a domicilio";
}

function formatDeliveryDate(value) {
  if (!value) return "No definida";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return String(value);
  return parsed.toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function formatDateTime(value) {
  const parsed = value ? new Date(value) : new Date();
  if (Number.isNaN(parsed.getTime())) return String(value ?? "No definida");
  return parsed.toLocaleString("es-ES", { dateStyle: "short", timeStyle: "short" });
}

function getPaymentMethodLabel(method) {
  const labels = {
    bizum: "Bizum",
    bank_transfer: "Transferencia bancaria",
    cash: "Efectivo / Cash"
  };

  return labels[method] ?? "Pago manual";
}

function getPaymentInstructions(order) {
  const method = order?.payment?.method ?? order?.paymentMethod ?? "bizum";
  const orderId = order?.orderId ? `pedido ${order.orderId}` : "número de pedido";

  if (method === "bizum") {
    return `Enviar Bizum al ${process.env.PAYMENT_BIZUM_PHONE || "PENDIENTE_CONFIGURAR_PAYMENT_BIZUM_PHONE"} indicando ${orderId}.`;
  }

  if (method === "bank_transfer") {
    const iban = process.env.PAYMENT_BANK_IBAN || "PENDIENTE_CONFIGURAR_PAYMENT_BANK_IBAN";
    const holder = process.env.PAYMENT_BANK_HOLDER || "PENDIENTE_CONFIGURAR_PAYMENT_BANK_HOLDER";
    return `Transferencia a ${iban}, titular ${holder}, indicando ${orderId} en el concepto.`;
  }

  const cashInstructions = process.env.PAYMENT_CASH_INSTRUCTIONS || "PENDIENTE_CONFIGURAR_PAYMENT_CASH_INSTRUCTIONS: pagar en efectivo al recibir o recoger el pedido.";
  return `${cashInstructions} Indica ${orderId} al equipo.`;
}

function getPaymentStatusLabel(status) {
  return status === "paid" ? "Pagado" : "Pendiente de pago";
}

function getShippingCost(order) {
  return Number(order?.shipping?.cost ?? order?.shippingCost ?? 0);
}

function getDiscountAmount(order) {
  return Number(order?.discountAmount ?? order?.promotions?.firstOrderDiscount?.discountAmount ?? 0);
}

function getCouponCode(order) {
  return String(order?.couponCode ?? order?.promotions?.firstOrderDiscount?.code ?? "").trim().toUpperCase();
}

function getDiscountLabel(order) {
  const amount = getDiscountAmount(order);
  if (amount <= 0) return null;

  const code = getCouponCode(order) || "Cupón";
  const percent = Number(order?.discountPercent ?? order?.promotions?.firstOrderDiscount?.percent ?? 0);
  return `${code}${percent ? ` (${percent}%)` : ""}`;
}

function getShippingLabel(order) {
  if ((order?.deliveryType ?? order?.delivery?.type) === "pickup") {
    return "Recogida en Alcorcón · sin coste";
  }

  const zone = order?.shipping?.zoneName ? `${order.shipping.zoneName} · ` : "";
  const postalCode = order?.shipping?.postalCode ? `CP ${order.shipping.postalCode} · ` : "";
  const free = order?.shipping?.freeShippingApplied ? " · envío gratis aplicado" : "";
  return `${zone}${postalCode}${formatCurrency(getShippingCost(order))}${free}`;
}

function buildOrderItemsRows(items = []) {
  return items
    .map((item) => {
      const name = escapeHtml(item?.name ?? "Producto");
      const quantity = Number(item?.quantity ?? 0);
      const unitPrice = Number(item?.unitPrice ?? 0);
      const lineTotal = quantity * unitPrice;
      const customization = Array.isArray(item?.customization) && item.customization.length
        ? `<ul style="margin:6px 0 0;padding-left:18px;color:#707070;font-size:12px;">${item.customization.map((selection) => {
          const modifier = Number(selection?.priceModifier ?? selection?.price ?? 0);
          const modifierText = Number.isFinite(modifier) && modifier > 0 ? ` (+${formatCurrency(modifier)})` : "";
          return `<li>${escapeHtml(selection?.label ?? "Opción")}: ${escapeHtml(selection?.value ?? "")}${modifierText}</li>`;
        }).join("")}</ul>`
        : "";

      return `
        <tr>
          <td style="padding:10px 8px;border-bottom:1px solid #eee;color:#3d3d3d;">${name}${customization}</td>
          <td style="padding:10px 8px;border-bottom:1px solid #eee;color:#3d3d3d;text-align:center;">${quantity}</td>
          <td style="padding:10px 8px;border-bottom:1px solid #eee;color:#3d3d3d;text-align:right;">${formatCurrency(unitPrice)}</td>
          <td style="padding:10px 8px;border-bottom:1px solid #eee;color:#101010;text-align:right;font-weight:600;">${formatCurrency(lineTotal)}</td>
        </tr>
      `;
    })
    .join("");
}

function buildCustomerOrderEmail(order) {
  const customerName = escapeHtml(order.customer?.fullName ?? "cliente");
  const deliveryType = order.deliveryType ?? order.delivery?.type;
  const deliveryMode = getDeliveryModeLabel(deliveryType);
  const address = order.delivery?.address ? escapeHtml(order.delivery.address) : "No aplica";
  const reference = order.delivery?.reference ? escapeHtml(order.delivery.reference) : "No indicada";
  const deliveryDate = formatDeliveryDate(order.deliveryDate ?? order.delivery?.date);
  const deliverySlot = escapeHtml(order.deliverySlot ?? order.delivery?.slot ?? "Sin franja");
  const notes = order.notes ? escapeHtml(order.notes) : "Sin notas";
  const shippingLabel = escapeHtml(getShippingLabel(order));
  const shippingCost = getShippingCost(order);
  const discountAmount = getDiscountAmount(order);
  const discountLabel = getDiscountLabel(order);
  const discountLine = discountAmount > 0
    ? `<p style="text-align:right;margin:0 0 4px;color:#1f7a3a;"><strong>Descuento ${escapeHtml(discountLabel)}:</strong> -${formatCurrency(discountAmount)}</p>`
    : "";
  const paymentMethod = getPaymentMethodLabel(order.payment?.method ?? order.paymentMethod);
  const paymentStatus = getPaymentStatusLabel(order.payment?.status ?? order.paymentStatus);
  const paymentInstructions = escapeHtml(getPaymentInstructions(order));

  return `
    <div style="background:#f7f3ea;padding:24px;font-family:Arial,Helvetica,sans-serif;color:#2f2f2f;">
      <div style="max-width:650px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #f0e6d4;">
        <div style="background:#4e2f1f;color:#fff;padding:20px 24px;">
          <h1 style="margin:0;font-size:24px;">${BRAND_CONFIG.name}</h1>
          <p style="margin:4px 0 0;font-size:13px;opacity:.9;">${BRAND_CONFIG.slogan}</p>
          <p style="margin:6px 0 0;font-size:14px;opacity:.95;">Pedido recibido · pendiente de pago</p>
        </div>

        <div style="padding:24px;">
          <p style="margin:0 0 12px;font-size:16px;">¡Gracias, <strong>${customerName}</strong>!</p>
          <p style="margin:0 0 18px;font-size:14px;color:#555;">Hemos recibido tu pedido. <strong>No queda confirmado definitivamente hasta validar el pago</strong>.</p>

          <div style="background:#fff8e1;border:1px solid #f2c96d;border-radius:10px;padding:14px 16px;margin-bottom:18px;">
            <p style="margin:0 0 8px;"><strong>Número de pedido:</strong> ${escapeHtml(order.orderId ?? "N/A")}</p>
            <p style="margin:0 0 8px;"><strong>Estado del pago:</strong> ${escapeHtml(paymentStatus)}</p>
            <p style="margin:0 0 8px;"><strong>Método de pago:</strong> ${escapeHtml(paymentMethod)}</p>
            <p style="margin:0;"><strong>Instrucciones:</strong> ${paymentInstructions}</p>
          </div>

          <table style="width:100%;border-collapse:collapse;font-size:14px;margin-bottom:18px;">
            <thead>
              <tr style="background:#fff3df;">
                <th style="padding:10px 8px;text-align:left;color:#5f4028;">Producto</th>
                <th style="padding:10px 8px;text-align:center;color:#5f4028;">Cant.</th>
                <th style="padding:10px 8px;text-align:right;color:#5f4028;">Precio</th>
                <th style="padding:10px 8px;text-align:right;color:#5f4028;">Subtotal</th>
              </tr>
            </thead>
            <tbody>${buildOrderItemsRows(order.items)}</tbody>
          </table>

          <div style="text-align:right;margin-bottom:18px;">
            <p style="margin:0 0 6px;font-size:14px;color:#555;"><strong>Subtotal:</strong> ${formatCurrency(order.subtotal)}</p>
            ${discountLine}
            <p style="margin:0 0 6px;font-size:14px;color:#555;"><strong>Envío:</strong> ${formatCurrency(shippingCost)}</p>
            <p style="margin:0;font-size:14px;color:#555;"><strong>Total:</strong> <span style="font-size:18px;color:#1f1f1f;">${formatCurrency(order.total)}</span></p>
          </div>

          <div style="background:#fafafa;border:1px solid #ececec;border-radius:10px;padding:14px 16px;">
            <p style="margin:0 0 8px;"><strong>Entrega:</strong> ${deliveryMode}</p>
            <p style="margin:0 0 8px;"><strong>Coste de envío:</strong> ${shippingLabel}</p>
            <p style="margin:0 0 8px;"><strong>Dirección:</strong> ${address}</p>
            <p style="margin:0 0 8px;"><strong>Referencia:</strong> ${reference}</p>
            <p style="margin:0 0 8px;"><strong>Fecha:</strong> ${deliveryDate}</p>
            <p style="margin:0 0 8px;"><strong>Franja:</strong> ${deliverySlot}</p>
            <p style="margin:0;"><strong>Notas:</strong> ${notes}</p>
          </div>

          <p style="margin:18px 0 0;font-size:13px;color:#777;">Cuando validemos el pago te enviaremos la confirmación definitiva.</p>
        </div>
      </div>
    </div>
  `;
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
  const paymentMethod = getPaymentMethodLabel(order.payment?.method ?? order.paymentMethod);
  const paymentStatus = getPaymentStatusLabel(order.payment?.status ?? order.paymentStatus);
  const paymentInstructions = escapeHtml(getPaymentInstructions(order));
  const address = order.delivery?.address ? escapeHtml(order.delivery.address) : "No aplica";
  const reference = order.delivery?.reference ? escapeHtml(order.delivery.reference) : "No indicada";
  const notes = order.notes ? escapeHtml(order.notes) : "Sin notas";
  const shippingLabel = escapeHtml(getShippingLabel(order));
  const shippingCost = getShippingCost(order);
  const discountAmount = getDiscountAmount(order);
  const discountLabel = getDiscountLabel(order);
  const discountLine = discountAmount > 0
    ? `<p style="text-align:right;margin:0 0 4px;color:#1f7a3a;"><strong>Descuento ${escapeHtml(discountLabel)}:</strong> -${formatCurrency(discountAmount)}</p>`
    : "";

  await sendEmail(apiKey, {
    from,
    to: [to],
    subject: `Nuevo pedido ${order.orderId} · pendiente de pago · ${BRAND_CONFIG.name}`,
    html: `
      <h2>Nuevo pedido: ${escapeHtml(order.orderId)}</h2>
      <p><strong>Fecha/hora:</strong> ${formatDateTime(order.createdAt)}</p>
      <p><strong>Estado:</strong> Pedido recibido · ${escapeHtml(paymentStatus)}</p>
      <p><strong>Método de pago:</strong> ${escapeHtml(paymentMethod)}</p>
      <p><strong>Instrucciones comunicadas:</strong> ${paymentInstructions}</p>
      <hr/>
      <p><strong>Cliente:</strong> ${escapeHtml(order.customer?.fullName ?? "N/A")}</p>
      <p><strong>Teléfono:</strong> ${escapeHtml(order.customer?.phone ?? "N/A")}</p>
      <p><strong>Email:</strong> ${escapeHtml(customerEmail || "N/A")}</p>
      <p><strong>Entrega:</strong> ${formatDeliveryDate(order.deliveryDate ?? order.delivery?.date)} · ${escapeHtml(order.deliverySlot ?? order.delivery?.slot ?? "Sin franja")} · ${escapeHtml(getDeliveryModeLabel(order.deliveryType ?? order.delivery?.type))}</p>
      <p><strong>Envío:</strong> ${shippingLabel}</p>
      <p><strong>Dirección:</strong> ${address}</p>
      <p><strong>Referencia:</strong> ${reference}</p>
      <p><strong>Notas:</strong> ${notes}</p>
      <table style="width:100%;border-collapse:collapse;margin-top:16px;">
        <thead><tr><th align="left">Producto</th><th>Cant.</th><th align="right">Precio</th><th align="right">Subtotal</th></tr></thead>
        <tbody>${buildOrderItemsRows(order.items)}</tbody>
      </table>
      <p style="text-align:right;margin:16px 0 4px;"><strong>Subtotal:</strong> ${formatCurrency(order.subtotal)}</p>
      ${discountLine}
      <p style="text-align:right;margin:0 0 4px;"><strong>Envío:</strong> ${formatCurrency(shippingCost)}</p>
      <p style="text-align:right;font-size:18px;margin:0;"><strong>Total:</strong> ${formatCurrency(order.total)}</p>
    `
  });

  if (!customerEmail) {
    return;
  }

  await sendEmail(apiKey, {
    from,
    to: [customerEmail],
    subject: `Pedido recibido ${order.orderId} · pendiente de pago · ${BRAND_CONFIG.name}`,
    html: buildCustomerOrderEmail(order)
  });
}

  /*await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject: `Nuevo pedido ${order.orderId} · ${BRAND_CONFIG.name}`,
      html: `
        <h2>Nuevo pedido: ${order.orderId}</h2>
        <p><strong>Cliente:</strong> ${order.customer?.fullName ?? "N/A"}</p>
        <p><strong>Teléfono:</strong> ${order.customer?.phone ?? "N/A"}</p>
        <p><strong>Total:</strong> ${order.total ?? 0} EUR</p>
      `
    })
  });
}
*/



function mapOrderStatusLabel(status) {
  const labels = {
    nuevo: "Nuevo",
    confirmado: "Confirmado",
    preparando: "Preparando",
    listo: "Listo",
    enviado: "Enviado",
    entregado: "Entregado",
    cancelado: "Cancelado",
    anulado: "Anulado"
  };

  return labels[status] ?? status;
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
      <div style="background:#f7f3ea;padding:24px;font-family:Arial,Helvetica,sans-serif;color:#2f2f2f;">
        <div style="max-width:620px;margin:0 auto;background:#fff;border:1px solid #f0e6d4;border-radius:12px;overflow:hidden;">
          <div style="background:#4e2f1f;color:#fff;padding:20px 24px;">
            <h1 style="margin:0;font-size:24px;">${BRAND_CONFIG.name}</h1>
            <p style="margin:4px 0 0;font-size:13px;opacity:.9;">${BRAND_CONFIG.slogan}</p>
          </div>
          <div style="padding:24px;">
            <p>Hola <strong>${safeName}</strong>,</p>
            <p>Hemos recibido una solicitud para restablecer la contraseña de tu cuenta.</p>
            <p style="margin:24px 0;">
              <a href="${safeUrl}" style="display:inline-block;background:#2f7d32;color:#fff;text-decoration:none;font-weight:700;padding:12px 18px;border-radius:8px;">Restablecer contraseña</a>
            </p>
            <p>Este enlace caduca en <strong>${minutes} minutos</strong> y solo puede utilizarse una vez.</p>
            <p style="color:#666;font-size:14px;">Si no solicitaste este cambio, puedes ignorar este mensaje.</p>
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

  const customerName = escapeHtml(order?.customer?.fullName ?? "cliente");
  const statusLabel = escapeHtml(mapOrderStatusLabel(status ?? order?.status));
  const note = statusNote ? `<p style="margin:0;"><strong>Nota:</strong> ${escapeHtml(statusNote)}</p>` : "";
  const deliveryDate = formatDeliveryDate(order?.deliveryDate ?? order?.delivery?.date);
  const deliverySlot = escapeHtml(order?.deliverySlot ?? order?.delivery?.slot ?? "Sin franja");

  await sendEmail(apiKey, {
    from,
    to: [customerEmail],
    subject: `Actualización de tu pedido ${order?.orderId ?? ""} · ${BRAND_CONFIG.name}`,
    html: `
      <div style="font-family:Arial,Helvetica,sans-serif;color:#1f2937;">
        <h2 style="margin-bottom:12px;">Tu pedido ${escapeHtml(order?.orderId ?? "")} ha cambiado de estado</h2>
        <p>Hola <strong>${customerName}</strong>,</p>
        <p>El nuevo estado de tu pedido es: <strong>${statusLabel}</strong>.</p>
        <p><strong>Entrega:</strong> ${deliveryDate} · ${deliverySlot}</p>
        ${note}
        <p style="margin-top:18px;">Gracias por confiar en ${BRAND_CONFIG.name}.</p>
      </div>
    `
  });
}
