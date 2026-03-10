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
  return mode === "pickup" ? "Recogida en local" : "Entrega a domicilio";
}

function buildOrderItemsRows(items = []) {
  return items
    .map((item) => {
      const name = escapeHtml(item?.name ?? "Producto");
      const quantity = Number(item?.quantity ?? 0);
      const unitPrice = Number(item?.unitPrice ?? 0);
      const lineTotal = quantity * unitPrice;

      return `
        <tr>
          <td style="padding:10px 8px;border-bottom:1px solid #eee;color:#3d3d3d;">${name}</td>
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
  const deliveryMode = getDeliveryModeLabel(order.delivery?.mode);
  const address = order.delivery?.address ? escapeHtml(order.delivery.address) : "No aplica";
  const reference = order.delivery?.reference ? escapeHtml(order.delivery.reference) : "No indicada";
  const preferredTime = order.delivery?.preferredTime ? escapeHtml(order.delivery.preferredTime) : "Sin preferencia";
  const notes = order.notes ? escapeHtml(order.notes) : "Sin notas";

  return `
    <div style="background:#f7f3ea;padding:24px;font-family:Arial,Helvetica,sans-serif;color:#2f2f2f;">
      <div style="max-width:650px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #f0e6d4;">
        <div style="background:#4e2f1f;color:#fff;padding:20px 24px;">
          <h1 style="margin:0;font-size:24px;">MiLuGui</h1>
          <p style="margin:6px 0 0;font-size:14px;opacity:.95;">Confirmación de pedido</p>
        </div>

        <div style="padding:24px;">
          <p style="margin:0 0 12px;font-size:16px;">¡Gracias por tu compra, <strong>${customerName}</strong>!</p>
          <p style="margin:0 0 18px;font-size:14px;color:#555;">Hemos recibido tu pedido correctamente. Aquí tienes el resumen:</p>

          <div style="background:#fdf8f0;border:1px solid #f2e4cc;border-radius:10px;padding:14px 16px;margin-bottom:18px;">
            <p style="margin:0 0 8px;"><strong>Número de pedido:</strong> ${escapeHtml(order.orderId ?? "N/A")}</p>
            <p style="margin:0 0 8px;"><strong>Cliente:</strong> ${customerName}</p>
            <p style="margin:0;"><strong>Teléfono:</strong> ${escapeHtml(order.customer?.phone ?? "N/A")}</p>
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
            <tbody>
              ${buildOrderItemsRows(order.items)}
            </tbody>
          </table>

          <div style="text-align:right;margin-bottom:18px;">
            <p style="margin:0;font-size:14px;color:#555;"><strong>Total:</strong> <span style="font-size:18px;color:#1f1f1f;">${formatCurrency(order.total)}</span></p>
          </div>

          <div style="background:#fafafa;border:1px solid #ececec;border-radius:10px;padding:14px 16px;">
            <p style="margin:0 0 8px;"><strong>Entrega:</strong> ${deliveryMode}</p>
            <p style="margin:0 0 8px;"><strong>Dirección:</strong> ${address}</p>
            <p style="margin:0 0 8px;"><strong>Referencia:</strong> ${reference}</p>
            <p style="margin:0 0 8px;"><strong>Horario preferido:</strong> ${preferredTime}</p>
            <p style="margin:0;"><strong>Notas:</strong> ${notes}</p>
          </div>

          <p style="margin:18px 0 0;font-size:13px;color:#777;">Si necesitas ajustar algo de tu pedido, respóndenos por WhatsApp o teléfono y te ayudamos.</p>
        </div>
      </div>
    </div>
  `;
}

async function sendEmail(apiKey, payload) {
  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });
}



export async function sendOrderEmail(order) {
  const apiKey = getRequiredEnv("RESEND_API_KEY");
  const from = getRequiredEnv("NOTIFY_EMAIL_FROM");
  const to = getRequiredEnv("NOTIFY_EMAIL_TO");
  const customerEmail = order.customer?.email?.trim();

  await sendEmail(apiKey, {
    from,
    to: [to],
    subject: `Nuevo pedido ${order.orderId} · MiLuGui`,
    html: `
      <h2>Nuevo pedido: ${order.orderId}</h2>
      <p><strong>Cliente:</strong> ${order.customer?.fullName ?? "N/A"}</p>
      <p><strong>Teléfono:</strong> ${order.customer?.phone ?? "N/A"}</p>
      <p><strong>Email:</strong> ${customerEmail || "N/A"}</p>
      <p><strong>Total:</strong> ${formatCurrency(order.total)}</p>
    `
  });

  if (!customerEmail) {
    return;
  }

  await sendEmail(apiKey, {
    from,
    to: [customerEmail],
    subject: `Tu pedido ${order.orderId} está confirmado · MiLuGui`,
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
      subject: `Nuevo pedido ${order.orderId} · MiLuGui`,
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

