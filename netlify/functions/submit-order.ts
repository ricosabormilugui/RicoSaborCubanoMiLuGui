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
    unitPrice: number;
    quantity: number;
  }>;
  subtotal?: number;
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

function buildOrderItemsRows(items: OrderPayload['items'] = []): string {
  return items
    .map((item) => {
      const name = escapeHtml(item?.name ?? 'Producto');
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
    .join('');
}

function buildCustomerOrderEmail(orderId: string, payload: OrderPayload): string {
  const customerName = escapeHtml(payload.customer?.fullName ?? 'cliente');
  const deliveryMode = getDeliveryModeLabel(payload.delivery?.mode);
  const address = payload.delivery?.address ? escapeHtml(payload.delivery.address) : 'No aplica';
  const reference = payload.delivery?.reference ? escapeHtml(payload.delivery.reference) : 'No indicada';
  const preferredTime = payload.delivery?.preferredTime ? escapeHtml(payload.delivery.preferredTime) : 'Sin preferencia';
  const notes = payload.notes ? escapeHtml(payload.notes) : 'Sin notas';

  return `
    <div style="background:#f7f3ea;padding:24px;font-family:Arial,Helvetica,sans-serif;color:#2f2f2f;">
      <div style="max-width:650px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #f0e6d4;">
        <div style="background:#4e2f1f;color:#fff;padding:20px 24px;">
          <h1 style="margin:0;font-size:24px;">Rico Sabor Cubano</h1>
          <p style="margin:6px 0 0;font-size:14px;opacity:.95;">Confirmación de pedido</p>
        </div>

        <div style="padding:24px;">
          <p style="margin:0 0 12px;font-size:16px;">¡Gracias por tu compra, <strong>${customerName}</strong>!</p>
          <p style="margin:0 0 18px;font-size:14px;color:#555;">Hemos recibido tu pedido correctamente. Aquí tienes el resumen:</p>

          <div style="background:#fdf8f0;border:1px solid #f2e4cc;border-radius:10px;padding:14px 16px;margin-bottom:18px;">
            <p style="margin:0 0 8px;"><strong>Número de pedido:</strong> ${escapeHtml(orderId)}</p>
            <p style="margin:0 0 8px;"><strong>Cliente:</strong> ${customerName}</p>
            <p style="margin:0;"><strong>Teléfono:</strong> ${escapeHtml(payload.customer?.phone ?? 'N/A')}</p>
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
              ${buildOrderItemsRows(payload.items)}
            </tbody>
          </table>

          <div style="text-align:right;margin-bottom:18px;">
            <p style="margin:0;font-size:14px;color:#555;"><strong>Total:</strong> <span style="font-size:18px;color:#1f1f1f;">${formatCurrency(payload.total)}</span></p>
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

async function sendEmailNotification(orderId: string, payload: OrderPayload): Promise<NotificationResult> {
  const apiKey = getEnv('RESEND_API_KEY');
  const from = getEnv('NOTIFY_EMAIL_FROM');
  const to = getEnv('NOTIFY_EMAIL_TO');
  const customerEmail = payload.customer?.email?.trim();

  if (!apiKey || !from || !to) {
    return { channel: 'email', configured: false, sent: false, detail: 'Missing email env vars' };
  }

  try {
    const html = `
      <h2>Nuevo pedido: ${orderId}</h2>
      <p><strong>Cliente:</strong> ${escapeHtml(payload.customer?.fullName ?? 'N/A')}</p>
      <p><strong>Teléfono:</strong> ${escapeHtml(payload.customer?.phone ?? 'N/A')}</p>
      <p><strong>Email:</strong> ${escapeHtml(customerEmail || 'N/A')}</p>
      <p><strong>Total:</strong> ${formatCurrency(payload.total)}</p>
    `;

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from,
        to: [to],
        subject: `Nuevo pedido ${orderId} · Rico Sabor Cubano`,
        html
      })
    });

    if (!response.ok) {
      return {
        channel: 'email',
        configured: true,
        sent: false,
        detail: `Resend ${response.status}: ${await response.text()}`
      };
    }

    if (customerEmail) {
      const customerResponse = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from,
          to: [customerEmail],
          subject: `Tu pedido ${orderId} está confirmado · Rico Sabor Cubano`,
          html: buildCustomerOrderEmail(orderId, payload)
        })
      });

      if (!customerResponse.ok) {
        return {
          channel: 'email',
          configured: true,
          sent: false,
          detail: `Customer email ${customerResponse.status}: ${await customerResponse.text()}`
        };
      }
    }

    return { channel: 'email', configured: true, sent: true };
  } catch (error) {
    return {
      channel: 'email',
      configured: true,
      sent: false,
      detail: error instanceof Error ? error.message : 'Unexpected email error'
    };
  }
}

function buildWhatsappMessage(orderId: string, payload: OrderPayload): string {
  return [
    `🛒 Nuevo pedido ${orderId}`,
    `Cliente: ${payload.customer?.fullName ?? 'N/A'}`,
    `Teléfono: ${payload.customer?.phone ?? 'N/A'}`,
    `Total: ${payload.total ?? 0} EUR`
  ].join('\n');
}

function resolveWhatsappWebhookUrl(): string | undefined {
  const directUrl = getEnv('WHATSAPP_WEBHOOK_URL');
  if (directUrl) return directUrl;

  const backendApiUrl = getEnv('BACKEND_API_URL');
  if (!backendApiUrl) return undefined;

  const base = backendApiUrl.replace(/\/$/, '');
  return `${base}/api/whatsapp/notify`;
}

function isLocalhostUrl(url: string): boolean {
  return /https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?/i.test(url);
}

function isProductionRuntime(): boolean {
  const netlifyContext = (getEnv('CONTEXT') ?? '').toLowerCase();
  if (netlifyContext === 'production') {
    return true;
  }

  const nodeEnv = (getEnv('NODE_ENV') ?? '').toLowerCase();
  return nodeEnv === 'production';
}

async function sendWhatsAppNotification(orderId: string, payload: OrderPayload): Promise<NotificationResult> {
  const webhookUrl = resolveWhatsappWebhookUrl();
  const webhookToken = getEnv('WHATSAPP_WEBHOOK_TOKEN');

  if (!webhookUrl) {
    return {
      channel: 'whatsapp',
      configured: false,
      sent: false,
      detail: 'Missing WHATSAPP_WEBHOOK_URL or BACKEND_API_URL'
    };
  }

  if (isLocalhostUrl(webhookUrl) && isProductionRuntime()) {
    return {
      channel: 'whatsapp',
      configured: false,
      sent: false,
      detail: `Invalid WhatsApp webhook for production: ${webhookUrl}. Use public backend URL.`
    };
  }

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(webhookToken ? { Authorization: `Bearer ${webhookToken}` } : {})
      },
      body: JSON.stringify({
        orderId,
        message: buildWhatsappMessage(orderId, payload),
        payload
      })
    });

    if (!response.ok) {
      return {
        channel: 'whatsapp',
        configured: true,
        sent: false,
        detail: `Webhook ${response.status}: ${await response.text()}`
      };
    }

    return { channel: 'whatsapp', configured: true, sent: true };
  } catch (error) {
    return {
      channel: 'whatsapp',
      configured: true,
      sent: false,
      detail: error instanceof Error ? error.message : 'Unexpected WhatsApp error'
    };
  }
}

export default async (request: Request): Promise<Response> => {
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  }

  try {
    const payload = (await request.json()) as OrderPayload;

    if (!payload.customer?.fullName || !payload.customer.phone || !payload.items?.length) {
      return new Response(JSON.stringify({ error: 'Invalid order payload' }), { status: 400 });
    }

    const orderId = `RS-${Date.now()}`;

    const notifications = await Promise.all([
      sendEmailNotification(orderId, payload),
      sendWhatsAppNotification(orderId, payload)
    ]);

    const anySent = notifications.some((n) => n.sent);

    return new Response(
      JSON.stringify({
        orderId,
        channel: 'netlify-email-whatsapp-webhook',
        accepted: true,
        notifications,
        warning: anySent ? undefined : 'Order accepted but no notification could be sent'
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unexpected error' }),
      { status: 500 }
    );
  }
};