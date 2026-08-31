import { BRAND_CONFIG } from "../config/brand.config.js";
import {
  buildOrderWhatsAppUrl,
  buildSalesMailtoUrl,
  getPublicWebUrl,
  getSalesEmail
} from "../config/contact.config.js";
import { joinPublicAssetUrl } from "../config/site.config.js";
import { logger } from "../lib/logger.js";
import {
  buildPaymentSettingsFromEnv,
  formatIbanDisplay,
  normalizePaymentSettings
} from "./payment-settings.service.js";

const BUSINESS_TIME_ZONE = "Europe/Madrid";
const CONTACT_FOR_PAYMENT = "Te contactaremos para facilitarte los datos de pago.";
const NO_REPLY_NOTICE = "Este es un correo automático. Por favor, no respondas a este mensaje.";

const EMAIL_THEME = {
  pageBg: "#f8f5eb",
  cardBg: "#ffffff",
  headerBg: "#ffffff",
  banner: "#e51a32",
  brandBlue: "#0068a8",
  navy: "#0d3d67",
  muted: "#346083",
  border: "#c8d9ef",
  infoBg: "#eaf3ff",
  infoBorder: "#9fc4ee",
  infoText: "#174a7c",
  surface: "#f4f8ff",
  ok: "#065f46"
};

export function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function moneyNumber(value) {
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : 0;
}

export function formatCurrency(value) {
  return new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(moneyNumber(value));
}

function capitalize(value) {
  const text = String(value ?? "");
  return text ? `${text.charAt(0).toLocaleUpperCase("es-ES")}${text.slice(1)}` : text;
}

export function formatFulfillmentDate(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return "Por confirmar";

  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  const instant = dateOnly
    ? new Date(Date.UTC(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]), 12))
    : new Date(raw);
  if (Number.isNaN(instant.getTime())) return "Por confirmar";

  return capitalize(instant.toLocaleDateString("es-ES", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: BUSINESS_TIME_ZONE
  }));
}

export function formatFulfillmentSlot(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return "Por confirmar";
  const match = /^(\d{2}:\d{2})\s*-\s*(\d{2}:\d{2})$/.exec(raw);
  return match ? `${match[1]}–${match[2]}` : raw;
}

export function getPaymentMethodLabel(method) {
  const labels = {
    bizum: "Bizum",
    bank_transfer: "Transferencia bancaria",
    cash: "Efectivo"
  };
  return labels[method] ?? "Pago manual";
}

export function getPaymentMethod(order) {
  const method = order?.payment?.method ?? order?.paymentMethod ?? "bizum";
  return method === "bank_transfer" || method === "cash" ? method : "bizum";
}

function paymentStatusOf(order) {
  return order?.payment?.status ?? order?.paymentStatus ?? "pending";
}

export function getPaymentStatusLabel(order) {
  const status = paymentStatusOf(order);
  if (status === "paid") return "Pagado";
  if (getPaymentMethod(order) === "cash") {
    return deliveryTypeOf(order) === "pickup" ? "Pago al recoger" : "Pago en entrega";
  }
  if (order?.requiresAdvancePayment) return "Pendiente de pago (anticipo)";
  return "Pendiente de pago";
}

function formatIban(value) {
  return formatIbanDisplay(value);
}

function paymentSettingsOf(options = {}) {
  if (options.paymentSettings) return normalizePaymentSettings(options.paymentSettings);
  return buildPaymentSettingsFromEnv(options.env ?? process.env);
}

function getCashInstruction(order, settings) {
  const pickup = deliveryTypeOf(order) === "pickup";
  if (pickup) {
    return settings?.cash?.instructionsPickup || "Pago en efectivo al recoger el pedido.";
  }
  return settings?.cash?.instructionsDelivery || "Pago en efectivo en la entrega.";
}

function orderRef(order) {
  return order?.orderId ? `pedido ${order.orderId}` : "tu número de pedido";
}

function logMissing(log, event, method) {
  (log ?? logger).error(event, { method });
}

export function getPaymentInstructions(order, options = {}) {
  const method = getPaymentMethod(order);
  const ref = orderRef(order);
  const settings = paymentSettingsOf(options);
  const log = options.log;

  if (method === "bizum") {
    const phone = settings.bizum.phone;
    if (!phone) {
      logMissing(log, "payment.bizum.configuration_missing", method);
      return CONTACT_FOR_PAYMENT;
    }
    return `Realiza el Bizum al ${phone} indicando ${ref}.`;
  }

  if (method === "bank_transfer") {
    const iban = settings.bankTransfer.iban;
    const holder = settings.bankTransfer.holder;
    if (!iban || !holder) {
      logMissing(log, "payment.bank_transfer.configuration_missing", method);
      return CONTACT_FOR_PAYMENT;
    }
    return `Titular: ${holder}. IBAN: ${formatIban(iban)}. Concepto: ${ref}.`;
  }

  if (!settings.cash.instructionsPickup && !settings.cash.instructionsDelivery) {
    logMissing(log, "payment.cash.configuration_missing", method);
  }
  return getCashInstruction(order, settings);
}

function deliveryTypeOf(order) {
  return order?.deliveryType ?? order?.delivery?.type ?? order?.delivery?.mode;
}

function getShippingCost(order) {
  return moneyNumber(order?.shipping?.cost ?? order?.shippingCost);
}

function getDiscountAmount(order) {
  return moneyNumber(order?.discountAmount ?? order?.promotions?.firstOrderDiscount?.discountAmount);
}

function getCouponCode(order) {
  return String(order?.couponCode ?? order?.promotions?.firstOrderDiscount?.code ?? "").trim().toUpperCase();
}

function getDiscountLabel(order) {
  const amount = getDiscountAmount(order);
  if (amount <= 0) return "";
  const code = getCouponCode(order) || "Cupón";
  const percent = moneyNumber(order?.discountPercent ?? order?.promotions?.firstOrderDiscount?.percent);
  return `${code}${percent ? ` (${percent}%)` : ""}`;
}

function getSubtotal(order) {
  const stored = Number(order?.subtotal);
  if (Number.isFinite(stored)) return stored;
  return (order?.items ?? []).reduce((sum, item) => sum + moneyNumber(item?.unitPrice) * moneyNumber(item?.quantity), 0);
}

function getTotal(order) {
  const stored = Number(order?.total);
  if (Number.isFinite(stored)) return stored;
  return getSubtotal(order) + getShippingCost(order) - getDiscountAmount(order);
}

export function logoUrl(env = process.env) {
  return joinPublicAssetUrl(BRAND_CONFIG.logos.light, env);
}

function itemUnitPrice(item) {
  return moneyNumber(item?.unitPrice);
}

function itemLineTotal(item) {
  return Number((itemUnitPrice(item) * moneyNumber(item?.quantity)).toFixed(2));
}

function customizationLines(item) {
  if (!Array.isArray(item?.customization) || !item.customization.length) return [];
  return item.customization.map((selection) => {
    const label = String(selection?.label ?? "Opción").trim() || "Opción";
    const value = String(selection?.value ?? "").trim();
    const modifier = moneyNumber(selection?.priceModifier ?? selection?.price);
    return {
      label,
      value,
      modifier,
      text: `${label}: ${value}${modifier > 0 ? ` (+${formatCurrency(modifier)})` : ""}`
    };
  });
}

function buildItemCardHtml(item) {
  const name = escapeHtml(item?.name ?? "Producto");
  const quantity = moneyNumber(item?.quantity);
  const unitPrice = formatCurrency(itemUnitPrice(item));
  const lineTotal = formatCurrency(itemLineTotal(item));
  const options = customizationLines(item)
    .map((line) => `<p style="margin:0 0 6px;font-size:14px;color:${EMAIL_THEME.muted};line-height:1.45;">${escapeHtml(line.text)}</p>`)
    .join("");
  const qtyPrice = quantity > 1
    ? `<p style="margin:10px 0 0;font-size:14px;color:${EMAIL_THEME.navy};">Precio unitario: ${unitPrice}</p>
       <p style="margin:4px 0 0;font-size:14px;color:${EMAIL_THEME.navy};">Cantidad: ${quantity}</p>
       <p style="margin:4px 0 0;font-size:15px;color:${EMAIL_THEME.navy};"><strong>Total línea: ${lineTotal}</strong></p>`
    : `<p style="margin:10px 0 0;font-size:14px;color:${EMAIL_THEME.navy};">Cantidad: ${quantity || 1}</p>
       <p style="margin:4px 0 0;font-size:15px;color:${EMAIL_THEME.navy};"><strong>Precio: ${unitPrice}</strong></p>`;

  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
      <tr>
        <td style="padding:16px 0;border-bottom:1px solid ${EMAIL_THEME.border};">
          <p style="margin:0 0 10px;font-size:16px;font-weight:700;color:${EMAIL_THEME.navy};line-height:1.35;">${name}</p>
          ${options}
          ${qtyPrice}
        </td>
      </tr>
    </table>
  `;
}

function buildItemCardText(item) {
  const quantity = moneyNumber(item?.quantity);
  const lines = [
    String(item?.name ?? "Producto"),
    `Cantidad: ${quantity || 1}`,
    ...customizationLines(item).map((line) => line.text),
    quantity > 1
      ? `Precio unitario: ${formatCurrency(itemUnitPrice(item))}`
      : `Precio: ${formatCurrency(itemUnitPrice(item))}`
  ];
  if (quantity > 1) lines.push(`Total línea: ${formatCurrency(itemLineTotal(item))}`);
  return lines.join("\n");
}

function summaryRows(order) {
  const type = deliveryTypeOf(order);
  const shippingLabel = type === "pickup" ? "Recogida" : "Entrega";
  const discount = getDiscountAmount(order);
  const rows = [
    { label: "Subtotal", value: formatCurrency(getSubtotal(order)) },
    { label: shippingLabel, value: formatCurrency(getShippingCost(order)) }
  ];
  if (discount > 0) {
    rows.push({ label: `Descuento ${getDiscountLabel(order)}`.trim(), value: `-${formatCurrency(discount)}` });
  }
  rows.push({ label: "TOTAL", value: formatCurrency(getTotal(order)), total: true });
  return rows;
}

function buildTotalsHtml(order) {
  const rows = summaryRows(order).map((row) => {
    if (row.total) {
      return `
        <tr>
          <td style="padding:12px 0 0;font-size:16px;font-weight:700;color:${EMAIL_THEME.navy};border-top:2px solid ${EMAIL_THEME.brandBlue};">${escapeHtml(row.label)}</td>
          <td style="padding:12px 0 0;font-size:18px;font-weight:700;color:${EMAIL_THEME.banner};text-align:right;border-top:2px solid ${EMAIL_THEME.brandBlue};">${escapeHtml(row.value)}</td>
        </tr>
      `;
    }
    return `
      <tr>
        <td style="padding:4px 0;font-size:14px;color:${EMAIL_THEME.muted};">${escapeHtml(row.label)}</td>
        <td style="padding:4px 0;font-size:14px;color:${EMAIL_THEME.navy};text-align:right;">${escapeHtml(row.value)}</td>
      </tr>
    `;
  }).join("");

  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:8px 0 0;">
      ${rows}
    </table>
  `;
}

function buildTotalsText(order) {
  return summaryRows(order).map((row) => `${row.label}: ${row.value}`).join("\n");
}

function fulfillmentFields(order) {
  const type = deliveryTypeOf(order);
  const pickup = type === "pickup";
  const date = formatFulfillmentDate(order.deliveryDate ?? order.delivery?.date);
  const slot = formatFulfillmentSlot(order.deliverySlot ?? order.delivery?.slot);
  const address = String(order.delivery?.address ?? "").trim();
  const reference = String(order.delivery?.reference ?? "").trim();
  const postalCode = String(order.shipping?.postalCode ?? "").trim();
  const notes = String(order.notes ?? "").trim();

  const fields = [
    { label: "Modalidad", value: pickup ? "Recogida" : "Entrega a domicilio" },
    { label: "Fecha", value: date },
    { label: "Horario", value: slot }
  ];
  if (!pickup && address) {
    fields.push({ label: "Dirección", value: postalCode ? `${address} · CP ${postalCode}` : address });
  }
  if (!pickup && reference) fields.push({ label: "Referencia", value: reference });
  if (notes) fields.push({ label: "Notas", value: notes });
  return fields;
}

function buildFulfillmentHtml(order) {
  const rows = fulfillmentFields(order)
    .map((field) => `<p style="margin:0 0 8px;font-size:14px;color:${EMAIL_THEME.navy};line-height:1.45;"><strong>${escapeHtml(field.label)}:</strong> ${escapeHtml(field.value)}</p>`)
    .join("");
  return `<div style="background:${EMAIL_THEME.surface};border:1px solid ${EMAIL_THEME.border};padding:14px 16px;">${rows}</div>`;
}

function buildFulfillmentText(order) {
  return fulfillmentFields(order).map((field) => `${field.label}: ${field.value}`).join("\n");
}

function paymentHeadline(order) {
  const status = paymentStatusOf(order);
  if (status === "paid") return "Pago recibido";
  if (getPaymentMethod(order) === "cash") {
    return deliveryTypeOf(order) === "pickup" ? "Pago al recoger" : "Pago en entrega";
  }
  if (order?.requiresAdvancePayment) return "Pendiente de pago anticipado";
  return "Pendiente de pago";
}

function cashIntro(order) {
  return deliveryTypeOf(order) === "pickup"
    ? "Hemos recibido tu pedido. El importe se paga en efectivo al recoger."
    : "Hemos recibido tu pedido. El importe se paga en efectivo en la entrega.";
}

function paymentRow(label, value) {
  return `<p style="margin:0 0 8px;"><strong>${escapeHtml(label)}:</strong> ${escapeHtml(value)}</p>`;
}

function paymentDetailHtml(order, options) {
  const method = getPaymentMethod(order);
  const methodLabel = getPaymentMethodLabel(method);
  const statusLabel = getPaymentStatusLabel(order);
  const header = `${paymentRow("Método de pago", methodLabel)}${paymentRow("Estado del pago", statusLabel)}`;
  const settings = paymentSettingsOf(options);

  if (method === "bizum") {
    const phone = settings.bizum.phone;
    if (!phone) {
      return `${header}<p style="margin:0;">${escapeHtml(getPaymentInstructions(order, options))}</p>`;
    }
    return `
      ${header}
      <p style="margin:12px 0 8px;">Realiza el Bizum al:</p>
      <p style="margin:0 0 8px;font-size:18px;font-weight:700;letter-spacing:.02em;">${escapeHtml(phone)}</p>
      ${paymentRow("Concepto", orderRef(order))}
    `;
  }

  if (method === "bank_transfer") {
    const iban = settings.bankTransfer.iban;
    const holder = settings.bankTransfer.holder;
    if (!iban || !holder) {
      return `${header}<p style="margin:0;">${escapeHtml(getPaymentInstructions(order, options))}</p>`;
    }
    return `
      ${header}
      <p style="margin:12px 0 8px;font-weight:700;">Datos para la transferencia</p>
      ${paymentRow("Titular", holder)}
      ${paymentRow("IBAN", formatIban(iban))}
      ${paymentRow("Concepto", orderRef(order))}
    `;
  }

  return `
    ${header}
    <p style="margin:0;">${escapeHtml(getCashInstruction(order, settings))}</p>
  `;
}

function buttonCell(href, label, background) {
  return `<a href="${escapeHtml(href)}" style="display:inline-block;background:${background};color:#ffffff;text-decoration:none;font-weight:700;font-size:14px;line-height:1.3;padding:12px 18px;border-radius:999px;">${escapeHtml(label)}</a>`;
}

export function buildEmailFooterHtml({ orderId } = {}) {
  const salesEmail = getSalesEmail();
  const siteUrl = getPublicWebUrl();
  const mailto = buildSalesMailtoUrl(orderId);
  const whatsapp = buildOrderWhatsAppUrl(orderId);
  let siteHost = "";
  try {
    siteHost = new URL(siteUrl).hostname;
  } catch {
    siteHost = siteUrl.replace(/^https:\/\//, "");
  }

  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:24px 0 0;">
      <tr>
        <td style="border-top:1px solid ${EMAIL_THEME.border};padding:20px 0 0;font-family:Arial,Helvetica,sans-serif;">
          <p style="margin:0 0 8px;font-size:16px;font-weight:700;color:${EMAIL_THEME.navy};">¿Necesitas ayuda?</p>
          <p style="margin:0 0 12px;font-size:14px;color:${EMAIL_THEME.muted};">Puedes contactar con nosotros:</p>
          <p style="margin:0 0 6px;font-size:14px;color:${EMAIL_THEME.navy};"><strong>Email</strong><br>${escapeHtml(salesEmail)}</p>
          <p style="margin:0 0 6px;font-size:14px;color:${EMAIL_THEME.navy};"><strong>Web</strong><br>${escapeHtml(siteHost)}</p>
          <p style="margin:0 0 14px;font-size:14px;color:${EMAIL_THEME.navy};"><strong>WhatsApp</strong></p>
          <table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:0 0 14px;">
            <tr>
              <td style="padding:0 0 10px 0;">${buttonCell(mailto, "Contactar por email", EMAIL_THEME.banner)}</td>
            </tr>
            <tr>
              <td>${buttonCell(whatsapp, "Contactar por WhatsApp", EMAIL_THEME.brandBlue)}</td>
            </tr>
          </table>
          <p style="margin:0 0 16px;font-size:14px;"><a href="${escapeHtml(siteUrl)}" style="color:${EMAIL_THEME.brandBlue};font-weight:700;text-decoration:underline;">Visitar MIXSABOR</a></p>
          <p style="margin:0 0 12px;font-size:13px;color:${EMAIL_THEME.muted};">${escapeHtml(NO_REPLY_NOTICE)}</p>
          <p style="margin:0;font-size:12px;color:${EMAIL_THEME.muted};">© ${escapeHtml(BRAND_CONFIG.name)}</p>
        </td>
      </tr>
    </table>
  `;
}

export function buildEmailFooterText({ orderId } = {}) {
  const salesEmail = getSalesEmail();
  const siteUrl = getPublicWebUrl();
  const mailto = buildSalesMailtoUrl(orderId);
  const whatsapp = buildOrderWhatsAppUrl(orderId);
  return [
    "¿Necesitas ayuda?",
    "Puedes contactar con nosotros:",
    `Email: ${salesEmail}`,
    `Web: ${siteUrl}`,
    `WhatsApp: ${whatsapp}`,
    mailto ? `Email (enlace): ${mailto}` : "",
    NO_REPLY_NOTICE,
    `© ${BRAND_CONFIG.name}`
  ].filter(Boolean).join("\n");
}

function wrapEmail({ preheader, heading, subtitle, bodyHtml, env, orderId }) {
  const logo = escapeHtml(logoUrl(env));
  const brand = escapeHtml(BRAND_CONFIG.name);
  const logoBlock = logo
    ? `<img src="${logo}" alt="${brand}" width="200" style="display:block;margin:0 auto;border:0;outline:none;text-decoration:none;height:auto;max-width:200px;">`
    : `<p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:22px;font-weight:800;letter-spacing:.06em;color:${EMAIL_THEME.navy};">${brand}</p>`;
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
  <title>${escapeHtml(heading)}</title>
</head>
<body style="margin:0;padding:0;background:${EMAIL_THEME.pageBg};">
  <span style="display:none!important;visibility:hidden;opacity:0;height:0;width:0;overflow:hidden;">${escapeHtml(preheader)}</span>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${EMAIL_THEME.pageBg};">
    <tr>
      <td align="center" style="padding:16px 12px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:${EMAIL_THEME.cardBg};border:1px solid ${EMAIL_THEME.border};border-collapse:collapse;">
          <tr>
            <td bgcolor="${EMAIL_THEME.banner}" height="4" style="background:${EMAIL_THEME.banner};font-size:1px;line-height:4px;">&nbsp;</td>
          </tr>
          <tr>
            <td align="center" style="background:${EMAIL_THEME.headerBg};padding:24px 20px 18px;font-family:Arial,Helvetica,sans-serif;">
              ${logoBlock}
              <p style="margin:12px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:800;letter-spacing:.08em;color:${EMAIL_THEME.navy};">${brand}</p>
              <h1 style="margin:14px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:22px;line-height:1.3;color:${EMAIL_THEME.navy};">${escapeHtml(heading)}</h1>
              ${subtitle ? `<p style="margin:6px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:${EMAIL_THEME.muted};">${escapeHtml(subtitle)}</p>` : ""}
            </td>
          </tr>
          <tr>
            <td bgcolor="${EMAIL_THEME.brandBlue}" height="3" style="background:${EMAIL_THEME.brandBlue};font-size:1px;line-height:3px;">&nbsp;</td>
          </tr>
          <tr>
            <td style="padding:20px;font-family:Arial,Helvetica,sans-serif;color:${EMAIL_THEME.navy};font-size:15px;line-height:1.5;">
              ${bodyHtml}
              ${buildEmailFooterHtml({ orderId })}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function getCustomerOrderSubject(order) {
  return `${BRAND_CONFIG.name} · Pedido recibido #${order?.orderId ?? ""}`.trim();
}

export function getAdminOrderSubject(order) {
  return `${BRAND_CONFIG.name} · Nuevo pedido #${order?.orderId ?? ""}`.trim();
}

export function getOrderStatusSubject(order, status) {
  const id = order?.orderId ? `#${order.orderId}` : "";
  const subjects = {
    nuevo: `${BRAND_CONFIG.name} · Pedido recibido ${id}`.trim(),
    confirmado: `${BRAND_CONFIG.name} · Tu pedido ${id} está confirmado`,
    preparando: `${BRAND_CONFIG.name} · Tu pedido ${id} está en preparación`,
    listo: `${BRAND_CONFIG.name} · Tu pedido ${id} está listo`,
    enviado: `${BRAND_CONFIG.name} · Tu pedido ${id} está en camino`,
    entregado: `${BRAND_CONFIG.name} · Tu pedido ${id} ha sido entregado`,
    cancelado: `${BRAND_CONFIG.name} · Tu pedido ${id} ha sido cancelado`,
    anulado: `${BRAND_CONFIG.name} · Tu pedido ${id} ha sido cancelado`
  };
  return subjects[status] ?? `${BRAND_CONFIG.name} · Actualización de tu pedido ${id}`.trim();
}

export function mapOrderStatusLabel(status) {
  const labels = {
    nuevo: "Nuevo",
    confirmado: "Confirmado",
    preparando: "En preparación",
    listo: "Listo",
    enviado: "En camino",
    entregado: "Entregado",
    cancelado: "Cancelado",
    anulado: "Anulado"
  };
  return labels[status] ?? "Actualizado";
}

export function buildCustomerOrderEmail(order, options = {}) {
  const customerName = order.customer?.fullName ?? "cliente";
  const itemsHtml = (order.items ?? []).map(buildItemCardHtml).join("");
  const itemsText = (order.items ?? []).map(buildItemCardText).join("\n\n");
  const intro = order.requiresAdvancePayment
    ? "Hemos recibido tu pedido. Requiere pago anticipado y no queda confirmado hasta validar el pago."
    : getPaymentMethod(order) === "cash"
      ? cashIntro(order)
      : "Hemos recibido tu pedido. No queda confirmado definitivamente hasta validar el pago.";

  const html = wrapEmail({
    env: options.env,
    orderId: order.orderId,
    preheader: `Pedido ${order.orderId ?? ""} · ${paymentHeadline(order)}`,
    heading: "Pedido recibido",
    subtitle: paymentHeadline(order),
    bodyHtml: `
      <p style="margin:0 0 12px;font-size:16px;">¡Gracias, <strong>${escapeHtml(customerName)}</strong>!</p>
      <p style="margin:0 0 18px;font-size:14px;color:${EMAIL_THEME.muted};">${escapeHtml(intro)}</p>
      <div style="background:${EMAIL_THEME.infoBg};border:1px solid ${EMAIL_THEME.infoBorder};border-left:4px solid ${EMAIL_THEME.banner};padding:14px 16px;margin-bottom:18px;color:${EMAIL_THEME.infoText};">
        <p style="margin:0 0 8px;"><strong>Número de pedido:</strong> ${escapeHtml(order.orderId ?? "")}</p>
        ${paymentDetailHtml(order, options)}
      </div>
      ${itemsHtml}
      ${buildTotalsHtml(order)}
      <div style="height:18px;line-height:18px;font-size:1px;">&nbsp;</div>
      ${buildFulfillmentHtml(order)}
    `
  });

  const text = [
    `${BRAND_CONFIG.name} · Pedido recibido`,
    `Hola ${customerName},`,
    intro,
    `Número de pedido: ${order.orderId ?? ""}`,
    `Método de pago: ${getPaymentMethodLabel(getPaymentMethod(order))}`,
    `Estado del pago: ${getPaymentStatusLabel(order)}`,
    getPaymentInstructions(order, options),
    "",
    itemsText,
    "",
    buildTotalsText(order),
    "",
    buildFulfillmentText(order),
    "",
    buildEmailFooterText({ orderId: order.orderId })
  ].join("\n");

  return { subject: getCustomerOrderSubject(order), html, text };
}

export function buildAdminOrderEmail(order, options = {}) {
  const customerName = order.customer?.fullName ?? "N/A";
  const phone = order.customer?.phone ?? "N/A";
  const email = order.customer?.email ?? "N/A";
  const itemsHtml = (order.items ?? []).map(buildItemCardHtml).join("");
  const itemsText = (order.items ?? []).map(buildItemCardText).join("\n\n");

  const html = wrapEmail({
    env: options.env,
    orderId: order.orderId,
    preheader: `Nuevo pedido ${order.orderId ?? ""}`,
    heading: `Nuevo pedido ${order.orderId ?? ""}`,
    subtitle: paymentHeadline(order),
    bodyHtml: `
      <p style="margin:0 0 8px;"><strong>Cliente:</strong> ${escapeHtml(customerName)}</p>
      <p style="margin:0 0 8px;"><strong>Teléfono:</strong> ${escapeHtml(phone)}</p>
      <p style="margin:0 0 8px;"><strong>Email:</strong> ${escapeHtml(email)}</p>
      <div style="background:${EMAIL_THEME.infoBg};border:1px solid ${EMAIL_THEME.infoBorder};border-left:4px solid ${EMAIL_THEME.banner};padding:14px 16px;margin:16px 0;color:${EMAIL_THEME.infoText};">
        ${paymentDetailHtml(order, options)}
      </div>
      ${itemsHtml}
      ${buildTotalsHtml(order)}
      <div style="height:18px;line-height:18px;font-size:1px;">&nbsp;</div>
      ${buildFulfillmentHtml(order)}
    `
  });

  const text = [
    `${BRAND_CONFIG.name} · Nuevo pedido ${order.orderId ?? ""}`,
    `Cliente: ${customerName}`,
    `Teléfono: ${phone}`,
    `Email: ${email}`,
    `Método de pago: ${getPaymentMethodLabel(getPaymentMethod(order))}`,
    getPaymentInstructions(order, options),
    "",
    itemsText,
    "",
    buildTotalsText(order),
    "",
    buildFulfillmentText(order),
    "",
    buildEmailFooterText({ orderId: order.orderId })
  ].join("\n");

  return { subject: getAdminOrderSubject(order), html, text };
}

export function buildOrderStatusEmail(order, { status, statusNote } = {}, options = {}) {
  const resolvedStatus = status ?? order?.status;
  const customerName = order?.customer?.fullName ?? "cliente";
  const statusLabel = mapOrderStatusLabel(resolvedStatus);
  const note = String(statusNote ?? "").trim();
  const html = wrapEmail({
    env: options.env,
    orderId: order?.orderId,
    preheader: `Tu pedido ${order?.orderId ?? ""} está ${statusLabel.toLowerCase()}`,
    heading: `Tu pedido ${order?.orderId ?? ""}`,
    subtitle: statusLabel,
    bodyHtml: `
      <p style="margin:0 0 12px;">Hola <strong>${escapeHtml(customerName)}</strong>,</p>
      <p style="margin:0 0 16px;">El estado de tu pedido es: <strong>${escapeHtml(statusLabel)}</strong>.</p>
      ${buildFulfillmentHtml(order)}
      ${note ? `<p style="margin:16px 0 0;"><strong>Nota:</strong> ${escapeHtml(note)}</p>` : ""}
      <p style="margin:18px 0 0;font-size:13px;color:${EMAIL_THEME.muted};">Gracias por confiar en ${escapeHtml(BRAND_CONFIG.name)}.</p>
    `
  });
  const text = [
    `${BRAND_CONFIG.name} · ${statusLabel}`,
    `Hola ${customerName},`,
    `El estado de tu pedido ${order?.orderId ?? ""} es: ${statusLabel}.`,
    buildFulfillmentText(order),
    note ? `Nota: ${note}` : "",
    `Gracias por confiar en ${BRAND_CONFIG.name}.`,
    "",
    buildEmailFooterText({ orderId: order?.orderId })
  ].filter(Boolean).join("\n");

  return { subject: getOrderStatusSubject(order, resolvedStatus), html, text };
}

export function buildPasswordResetEmail({ fullName, resetUrl, expiresInMinutes } = {}, options = {}) {
  const recipientName = String(fullName ?? "cliente").trim() || "cliente";
  const minutes = Number(expiresInMinutes);
  const html = wrapEmail({
    env: options.env,
    preheader: "Restablece tu contraseña",
    heading: "Restablece tu contraseña",
    bodyHtml: `
      <p style="margin:0 0 12px;">Hola <strong>${escapeHtml(recipientName)}</strong>,</p>
      <p style="margin:0 0 16px;">Hemos recibido una solicitud para restablecer la contraseña de tu cuenta.</p>
      <p style="margin:0 0 18px;">
        <a href="${escapeHtml(resetUrl)}" style="display:inline-block;background:${EMAIL_THEME.banner};color:#ffffff;text-decoration:none;font-weight:700;padding:12px 18px;border-radius:999px;">Restablecer contraseña</a>
      </p>
      <p style="margin:0 0 12px;">Este enlace caduca en <strong>${escapeHtml(String(minutes))}</strong> minutos y solo puede utilizarse una vez.</p>
      <p style="margin:0;color:${EMAIL_THEME.muted};font-size:14px;">Si no solicitaste este cambio, puedes ignorar este mensaje.</p>
    `
  });
  const text = [
    `Hola ${recipientName},`,
    "",
    "Hemos recibido una solicitud para restablecer la contraseña de tu cuenta.",
    `Abre este enlace para definir una nueva contraseña: ${resetUrl}`,
    `El enlace caduca en ${minutes} minutos y solo puede utilizarse una vez.`,
    "",
    "Si no solicitaste este cambio, puedes ignorar este mensaje.",
    "",
    buildEmailFooterText()
  ].join("\n");

  return {
    subject: `Restablece tu contraseña · ${BRAND_CONFIG.name}`,
    html,
    text
  };
}
