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

function getEnv(name: string): string | undefined {
  const value = process.env[name];
  return value && value.trim().length > 0 ? value : undefined;
}

async function sendEmailNotification(orderId: string, payload: OrderPayload): Promise<NotificationResult> {
  const apiKey = getEnv('RESEND_API_KEY');
  const from = getEnv('NOTIFY_EMAIL_FROM');
  const to = getEnv('NOTIFY_EMAIL_TO');

  if (!apiKey || !from || !to) {
    return {
      channel: 'email',
      configured: false,
      sent: false,
      detail: 'Missing RESEND_API_KEY / NOTIFY_EMAIL_FROM / NOTIFY_EMAIL_TO'
    };
  }

  try {
    const html = `
      <h2>Nuevo pedido: ${orderId}</h2>
      <p><strong>Cliente:</strong> ${payload.customer?.fullName ?? 'N/A'}</p>
      <p><strong>Teléfono:</strong> ${payload.customer?.phone ?? 'N/A'}</p>
      <p><strong>Email:</strong> ${payload.customer?.email ?? 'N/A'}</p>
      <p><strong>Entrega:</strong> ${payload.delivery?.mode ?? 'N/A'}</p>
      <p><strong>Dirección:</strong> ${payload.delivery?.address ?? 'N/A'}</p>
      <p><strong>Total:</strong> ${payload.total ?? 0} EUR</p>
      <p><strong>Items:</strong> ${(payload.items ?? []).map((item) => `${item.name} x${item.quantity}`).join(', ')}</p>
      <p><strong>Notas:</strong> ${payload.notes ?? '-'}</p>
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
      const body = await response.text();
      return {
        channel: 'email',
        configured: true,
        sent: false,
        detail: `Resend ${response.status}: ${body}`
      };
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

async function sendWhatsAppNotification(orderId: string, payload: OrderPayload): Promise<NotificationResult> {
  const accountSid = getEnv('TWILIO_ACCOUNT_SID');
  const authToken = getEnv('TWILIO_AUTH_TOKEN');
  const from = getEnv('TWILIO_WHATSAPP_FROM');
  const to = getEnv('NOTIFY_WHATSAPP_TO');

  if (!accountSid || !authToken || !from || !to) {
    return {
      channel: 'whatsapp',
      configured: false,
      sent: false,
      detail: 'Missing TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN / TWILIO_WHATSAPP_FROM / NOTIFY_WHATSAPP_TO'
    };
  }

  try {
    const body = `Nuevo pedido ${orderId}. Cliente: ${payload.customer?.fullName ?? 'N/A'}. Tel: ${payload.customer?.phone ?? 'N/A'}. Total: ${payload.total ?? 0} EUR.`;

    const form = new URLSearchParams();
    form.set('From', `whatsapp:${from}`);
    form.set('To', `whatsapp:${to}`);
    form.set('Body', body);

    const basicAuth = Buffer.from(`${accountSid}:${authToken}`).toString('base64');

    const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${basicAuth}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: form.toString()
    });

    if (!response.ok) {
      const responseBody = await response.text();
      return {
        channel: 'whatsapp',
        configured: true,
        sent: false,
        detail: `Twilio ${response.status}: ${responseBody}`
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

    const anySent = notifications.some((item) => item.sent);

    return new Response(
      JSON.stringify({
        orderId,
        channel: 'netlify-email-whatsapp',
        accepted: true,
        notifications,
        warning: anySent ? undefined : 'Order accepted, but no notification could be sent.'
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
