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
      <p><strong>Cliente:</strong> ${payload.customer?.fullName ?? 'N/A'}</p>
      <p><strong>Teléfono:</strong> ${payload.customer?.phone ?? 'N/A'}</p>
      <p><strong>Email:</strong> ${customerEmail || 'N/A'}</p>
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
          html: `
            <h2>¡Gracias por tu pedido!</h2>
            <p>Hola ${escapeHtml(payload.customer?.fullName ?? 'cliente')},</p>
            <p>Recibimos tu pedido <strong>${escapeHtml(orderId)}</strong> correctamente.</p>
            <p><strong>Total:</strong> ${formatCurrency(payload.total)}</p>
          `
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