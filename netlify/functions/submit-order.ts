interface OrderPayload {
  customer?: {
    fullName?: string;
    phone?: string;
    email?: string;
  };
  deliveryDate?: string;
  deliverySlot?: string;
  deliveryType?: 'delivery' | 'pickup';
  delivery?: {
    mode?: 'delivery' | 'pickup';
    type?: 'delivery' | 'pickup';
    date?: string;
    slot?: string;
    address?: string;
    reference?: string;
    preferredTime?: string;
  };
  payment?: {
    method?: 'bizum' | 'bank_transfer' | 'cash';
    status?: 'pending' | 'paid' | 'failed' | 'cancelled';
    instructions?: string;
  };
  paymentMethod?: 'bizum' | 'bank_transfer' | 'cash';
  paymentStatus?: 'pending' | 'paid' | 'failed' | 'cancelled';
  shipping?: {
    zoneId?: string;
    zoneName?: string;
    postalCode?: string;
    cost?: number;
    minimumOrder?: number;
    freeShippingFrom?: number;
    freeShippingApplied?: boolean;
  };
  shippingCost?: number;
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
  channel: 'email';
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

function getDeliveryModeLabel(mode: 'delivery' | 'pickup' | undefined): string {
  return mode === 'pickup' ? 'Recogida en local' : 'Entrega a domicilio';
}

function formatDateTime(value: Date = new Date()): string {
  return value.toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' });
}

function getPaymentMethod(payload: OrderPayload): 'bizum' | 'bank_transfer' | 'cash' {
  const method = payload.payment?.method ?? payload.paymentMethod ?? 'bizum';
  return method === 'bank_transfer' || method === 'cash' ? method : 'bizum';
}

function getPaymentMethodLabel(method: ReturnType<typeof getPaymentMethod>): string {
  const labels = {
    bizum: 'Bizum',
    bank_transfer: 'Transferencia bancaria',
    cash: 'Efectivo / Cash'
  } as const;

  return labels[method];
}

function getPaymentInstructions(orderId: string, payload: OrderPayload): string {
  const method = getPaymentMethod(payload);

  if (method === 'bizum') {
    return `Enviar Bizum al ${getEnv('PAYMENT_BIZUM_PHONE') ?? 'PENDIENTE_CONFIGURAR_PAYMENT_BIZUM_PHONE'} indicando pedido ${orderId}.`;
  }

  if (method === 'bank_transfer') {
    const iban = getEnv('PAYMENT_BANK_IBAN') ?? 'PENDIENTE_CONFIGURAR_PAYMENT_BANK_IBAN';
    const holder = getEnv('PAYMENT_BANK_HOLDER') ?? 'PENDIENTE_CONFIGURAR_PAYMENT_BANK_HOLDER';
    return `Transferencia a ${iban}, titular ${holder}, indicando pedido ${orderId} en el concepto.`;
  }

  return `${getEnv('PAYMENT_CASH_INSTRUCTIONS') ?? 'PENDIENTE_CONFIGURAR_PAYMENT_CASH_INSTRUCTIONS: pagar en efectivo al recibir o recoger el pedido.'} Indica pedido ${orderId} al equipo.`;
}

function resolveTaxSummary(payload: OrderPayload): { subtotal: number; shippingCost: number; taxAmount: number; total: number; taxLabel: string } {
  const subtotal = Number(payload.subtotal ?? 0);
  const shippingCost = Number(payload.shipping?.cost ?? payload.shippingCost ?? 0);
  const total = Number(payload.total ?? subtotal + shippingCost);
  const inferredTax = Number((total - subtotal - shippingCost).toFixed(2));
  const taxAmount = Number((payload.taxAmount ?? inferredTax).toFixed(2));
  const taxRate = Number(payload.taxRate ?? 0);
  const taxLabel = taxRate > 0 ? `Impuestos (${taxRate.toFixed(2)}%)` : 'Impuestos';

  return { subtotal, shippingCost, taxAmount, total, taxLabel };
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
  const { subtotal, shippingCost, taxAmount, total, taxLabel } = resolveTaxSummary(payload);

  return `
    <div style="text-align:right;margin-bottom:18px;">
      <p style="margin:0 0 6px;"><strong>Subtotal:</strong> ${formatCurrency(subtotal)}</p>
      <p style="margin:0 0 6px;"><strong>Envío:</strong> ${formatCurrency(shippingCost)}</p>
      <p style="margin:0 0 6px;"><strong>${taxLabel}:</strong> ${formatCurrency(taxAmount)}</p>
      <p style="margin:0;"><strong>Total:</strong> <span style="font-size:18px;">${formatCurrency(total)}</span></p>
    </div>
  `;
}

function buildAdminOrderEmail(orderId: string, payload: OrderPayload, customerEmail?: string): string {
  const customerName = escapeHtml(payload.customer?.fullName ?? 'N/A');
  const phone = escapeHtml(payload.customer?.phone ?? 'N/A');
  const email = escapeHtml(customerEmail || 'N/A');
  const deliveryMode = getDeliveryModeLabel(payload.delivery?.type ?? payload.delivery?.mode ?? payload.deliveryType);
  const deliveryDate = escapeHtml(payload.delivery?.date ?? payload.deliveryDate ?? 'No definida');
  const deliverySlot = escapeHtml(payload.delivery?.slot ?? payload.deliverySlot ?? payload.delivery?.preferredTime ?? 'Sin franja');
  const address = escapeHtml(payload.delivery?.address ?? 'No aplica');
  const reference = escapeHtml(payload.delivery?.reference ?? 'No indicada');
  const notes = escapeHtml(payload.notes ?? 'Sin notas');
  const paymentMethod = getPaymentMethod(payload);
  const paymentInstructions = escapeHtml(getPaymentInstructions(orderId, payload));
  const shippingLabel = escapeHtml(payload.deliveryType === 'pickup' || payload.delivery?.type === 'pickup' ? 'Recogida en local · sin coste' : `${payload.shipping?.zoneName ? `${payload.shipping.zoneName} · ` : ''}${formatCurrency(payload.shipping?.cost ?? payload.shippingCost)}`);

  return `
    <div style="font-family:Arial;">
      <h2>Nuevo pedido ${escapeHtml(orderId)} · pendiente de pago</h2>
      <p><strong>Fecha/hora:</strong> ${formatDateTime()}</p>
      <p><strong>Estado:</strong> Pedido recibido · pendiente de pago</p>
      <p><strong>Método de pago:</strong> ${escapeHtml(getPaymentMethodLabel(paymentMethod))}</p>
      <p><strong>Instrucciones:</strong> ${paymentInstructions}</p>
      <hr/>
      <p><strong>Cliente:</strong> ${customerName}</p>
      <p><strong>Teléfono:</strong> ${phone}</p>
      <p><strong>Email:</strong> ${email}</p>
      <p><strong>Entrega:</strong> ${deliveryMode} · ${deliveryDate} · ${deliverySlot}</p>
      <p><strong>Envío:</strong> ${shippingLabel}</p>
      <p><strong>Dirección:</strong> ${address}</p>
      <p><strong>Referencia:</strong> ${reference}</p>
      <p><strong>Notas:</strong> ${notes}</p>

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
  const paymentMethod = getPaymentMethod(payload);
  const paymentInstructions = escapeHtml(getPaymentInstructions(orderId, payload));

  return `
    <div style="font-family:Arial;">
      <h2>Pedido recibido · pendiente de pago</h2>
      <p>Hola ${customerName}</p>
      <p>Tu pedido <strong>${escapeHtml(orderId)}</strong> ha sido recibido, pero <strong>no queda confirmado definitivamente hasta validar el pago</strong>.</p>
      <p><strong>Método:</strong> ${escapeHtml(getPaymentMethodLabel(paymentMethod))}</p>
      <p><strong>Instrucciones:</strong> ${paymentInstructions}</p>

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
        subject: `Nuevo pedido ${orderId} · pendiente de pago`,
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
          subject: `Pedido recibido ${orderId} · pendiente de pago`,
          html: buildCustomerOrderEmail(orderId, payload)
        })
      });
    }

    return { channel: 'email', configured: true, sent: true };
  } catch (error) {
    return { channel: 'email', configured: true, sent: false };
  }
}

export default async (request: Request): Promise<Response> => {
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  }

  const payload = (await request.json()) as OrderPayload;

  const orderId = `RS-${Date.now()}`;

  const notifications = await Promise.all([
    sendEmailNotification(orderId, payload)
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