export default async (request: Request): Promise<Response> => {
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  }

  const payload = (await request.json()) as { customer?: { fullName?: string; phone?: string }; items?: unknown[] };

  if (!payload.customer?.fullName || !payload.customer.phone || !payload.items?.length) {
    return new Response(JSON.stringify({ error: 'Invalid order payload' }), { status: 400 });
  }

  const orderId = `RS-${Date.now()}`;

  return new Response(JSON.stringify({ orderId }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
};
