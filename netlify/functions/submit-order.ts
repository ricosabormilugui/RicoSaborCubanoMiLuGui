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

function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }
  return value;
}

async function sendEmailNotification(orderId: string, payload: OrderPayload): Promise<void> {
  const apiKey = getRequiredEnv('RESEND_API_KEY');
  const from = getRequiredEnv('NOTIFY_EMAIL_FROM');
  const to = getRequiredEnv('NOTIFY_EMAIL_TO');

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

  await fetch('https://api.resend.com/emails', {
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
}

async function sendWhatsAppNotification(orderId: string, payload: OrderPayload): Promise<void> {
  const accountSid = getRequiredEnv('TWILIO_ACCOUNT_SID');
  const authToken = getRequiredEnv('TWILIO_AUTH_TOKEN');
  const from = getRequiredEnv('TWILIO_WHATSAPP_FROM');
  const to = getRequiredEnv('NOTIFY_WHATSAPP_TO');

  const body = `Nuevo pedido ${orderId}. Cliente: ${payload.customer?.fullName ?? 'N/A'}. Tel: ${payload.customer?.phone ?? 'N/A'}. Total: ${payload.total ?? 0} EUR.`;

  const form = new URLSearchParams();
  form.set('From', `whatsapp:${from}`);
  form.set('To', `whatsapp:${to}`);
  form.set('Body', body);

  const basicAuth = Buffer.from(`${accountSid}:${authToken}`).toString('base64');

  await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basicAuth}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: form.toString()
  });
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
    await Promise.all([
      sendEmailNotification(orderId, payload),
      sendWhatsAppNotification(orderId, payload)
    ]);

    return new Response(JSON.stringify({ orderId, channel: 'netlify-email-whatsapp' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
