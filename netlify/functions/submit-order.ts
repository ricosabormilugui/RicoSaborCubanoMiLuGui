interface OrderPayload {
  customer?: {
    fullName?: string;
    phone?: string;
    email?: string;
  };
  delivery?: {
    mode?: 'delivery' | 'pickup';
    address?: string;
    reference?: string;
    preferredTime?: string;
  };
  notes?: string;
  items?: Array<{
    productId: string;
    name: string;
    description?: string;
    unitPrice: number;
    quantity: number;
  }>;
  subtotal?: number;
  taxAmount?: number;
  taxRate?: number;
  total?: number;
}

type NotificationResult = {
  channel: 'email' | 'whatsapp';
  configured: boolean;
  sent: boolean;
  detail?: string;
};

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function formatCurrency(value: number | undefined): string {
  return `${Number(value ?? 0).toFixed(2)} EUR`;
}

function getEnv(name: string): string | undefined {
  const value = process.env[name];
  return value && value.trim().length > 0 ? value : undefined;
}

function getDeliveryModeLabel(mode: OrderPayload['delivery'] extends { mode?: infer T } ? T : never): string {
  return mode === 'pickup' ? 'Recogida en local' : 'Entrega a domicilio';
}

function resolveTaxSummary(payload: OrderPayload): { subtotal: number; taxAmount: number; total: number; taxLabel: string } {
  const subtotal = Number(payload.subtotal ?? 0);
  const total = Number(payload.total ?? subtotal);
  const inferredTax = Number((total - subtotal).toFixed(2));
  const taxAmount = Number((payload.taxAmount ?? inferredTax).toFixed(2));
  const taxRate = Number(payload.taxRate ?? 0);
  const taxLabel = taxRate > 0 ? `Impuestos (${taxRate.toFixed(2)}%)` : 'Impuestos';

  return { subtotal, taxAmount, total, taxLabel };
}

function buildOrderItemsRows(items: OrderPayload['items'] = []): string {
  return items
    .map((item) => {
      const name = escapeHtml(item?.name ?? 'Producto');
      const description = item?.description?.trim() ? escapeHtml(item.description) : 'Sin descripción';
      const quantity = Number(item?.quantity ?? 0);
      const unitPrice = Number(item?.unitPrice ?? 0);
      const lineTotal = quantity * unitPrice;

      return `
        <tr>
          <td style="padding:10px 8px;border-bottom:1px solid #eee;color:#3d3d3d;">
            <div style="font-weight:600;color:#2f2f2f;">${name}</div>
            <div style="font-size:12px;color:#707070;margin-top:4px;">${description}</div>
          </td>
          <td style="padding:10px 8px;border-bottom:1px solid #eee;text-align:center;">${quantity}</td>
          <td style="padding:10px 8px;border-bottom:1px solid #eee;text-align:right;">${formatCurrency(unitPrice)}</td>
          <td style="padding:10px 8px;border-bottom:1px solid #eee;text-align:right;font-weight:600;">${formatCurrency(lineTotal)}</td>
        </tr>
      `;
    })
    .join('');
}

function buildOrderFinancialSummary(payload: OrderPayload): string {
  const { subtotal, taxAmount, total, taxLabel } = resolveTaxSummary(payload);

  return `
    <div style="text-align:right;margin-bottom:18px;">
      <p style="margin:0 0 6px;"><strong>Subtotal:</strong> ${formatCurrency(subtotal)}</p>
      <p style="margin:0 0 6px;"><strong>${taxLabel}:</strong> ${formatCurrency(taxAmount)}</p>
      <p style="margin:0;"><strong>Total:</strong> <span style="font-size:18px;">${formatCurrency(total)}</span></p>
    </div>
  `;
}

function buildAdminOrderEmail(orderId: string, payload: OrderPayload, customerEmail?: string): string {
  const customerName = escapeHtml(payload.customer?.fullName ?? 'N/A');
  const phone = escapeHtml(payload.customer?.phone ?? 'N/A');
  const email = escapeHtml(customerEmail || 'N/A');
  const deliveryMode = getDeliveryModeLabel(payload.delivery?.mode);

  return `
    <div style="font-family:Arial;">
      <h2>Nuevo pedido ${escapeHtml(orderId)}</h2>
      <p><strong>Cliente:</strong> ${customerName}</p>
      <p><strong>Teléfono:</strong> ${phone}</p>
      <p><strong>Email:</strong> ${email}</p>
      <p><strong>Entrega:</strong> ${deliveryMode}</p>

      <table style="width:100%;border-collapse:collapse;">
        <thead>
          <tr>
            <th>Producto</th>
            <th>Cant</th>
            <th>Precio</th>
            <th>Subtotal</th>
          </tr>
        </thead>
        <tbody>
          ${buildOrderItemsRows(payload.items)}
        </tbody>
      </table>

      ${buildOrderFinancialSummary(payload)}
    </div>
  `;
}

function buildCustomerOrderEmail(orderId: string, payload: OrderPayload): string {
  const customerName = escapeHtml(payload.customer?.fullName ?? 'cliente');

  return `
    <div style="font-family:Arial;">
      <h2>Gracias por tu pedido</h2>
      <p>Hola ${customerName}</p>
      <p>Tu pedido <strong>${escapeHtml(orderId)}</strong> ha sido recibido.</p>

      <table style="width:100%;border-collapse:collapse;">
        <tbody>
          ${buildOrderItemsRows(payload.items)}
        </tbody>
      </table>

      ${buildOrderFinancialSummary(payload)}
    </div>
  `;
}

async function sendEmailNotification(orderId: string, payload: OrderPayload): Promise<NotificationResult> {
  const apiKey = getEnv('RESEND_API_KEY');
  const from = getEnv('NOTIFY_EMAIL_FROM');
  const to = getEnv('NOTIFY_EMAIL_TO');
  const customerEmail = payload.customer?.email?.trim();

  if (!apiKey || !from || !to) {
    return { channel: 'email', configured: false, sent: false };
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from,
        to: [to],
        subject: `Nuevo pedido ${orderId}`,
        html: buildAdminOrderEmail(orderId, payload, customerEmail)
      })
    });

    if (!response.ok) {
      return { channel: 'email', configured: true, sent: false };
    }

    if (customerEmail) {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from,
          to: [customerEmail],
          subject: `Confirmación pedido ${orderId}`,
          html: buildCustomerOrderEmail(orderId, payload)
        })
      });
    }

    return { channel: 'email', configured: true, sent: true };
  } catch (error) {
    return { channel: 'email', configured: true, sent: false };
  }
}

function buildWhatsappMessage(orderId: string, payload: OrderPayload): string {
  const itemsSummary = (payload.items ?? [])
    .map((item) => `• ${item.quantity} x ${item.name}`)
    .join('\n');

  return `🛒 Nuevo pedido ${orderId}
Cliente: ${payload.customer?.fullName ?? 'N/A'}
Teléfono: ${payload.customer?.phone ?? 'N/A'}
${itemsSummary}
Total: ${formatCurrency(payload.total)}`;
}

function resolveWhatsappWebhookUrl(): string | undefined {
  const directUrl = getEnv('WHATSAPP_WEBHOOK_URL');
  if (directUrl) return directUrl;

  const backendApiUrl = getEnv('BACKEND_API_URL');
  if (!backendApiUrl) return undefined;

  return `${backendApiUrl.replace(/\/$/, '')}/api/whatsapp/notify`;
}

async function sendWhatsAppNotification(orderId: string, payload: OrderPayload): Promise<NotificationResult> {
  const webhookUrl = resolveWhatsappWebhookUrl();

  if (!webhookUrl) {
    return { channel: 'whatsapp', configured: false, sent: false };
  }

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        orderId,
        message: buildWhatsappMessage(orderId, payload),
        payload
      })
    });

    if (!response.ok) {
      return { channel: 'whatsapp', configured: true, sent: false };
    }

    return { channel: 'whatsapp', configured: true, sent: true };
  } catch {
    return { channel: 'whatsapp', configured: true, sent: false };
  }
}

export default async (request: Request): Promise<Response> => {
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  }

  const payload = (await request.json()) as OrderPayload;

  const orderId = `RS-${Date.now()}`;

  const notifications = await Promise.all([
    sendEmailNotification(orderId, payload),
    sendWhatsAppNotification(orderId, payload)
  ]);

  return new Response(
    JSON.stringify({
      orderId,
      accepted: true,
      notifications
    }),
    { status: 200 }
  );
};