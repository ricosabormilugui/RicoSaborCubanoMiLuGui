import orderRules from '../../Backend/src/config/order-rules.json';

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
    requiresAdvancePayment?: boolean;
    customization?: unknown[];
  }>;
  subtotal?: number;
  taxAmount?: number;
  taxRate?: number;
  total?: number;
  requiresAdvancePayment?: boolean;
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
  const fulfillmentError = validateFulfillment(payload);
  if (fulfillmentError) {
    return new Response(JSON.stringify({ error: fulfillmentError }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

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

type RuntimeDeliveryType = 'delivery' | 'pickup';

function getMadridParts(value: Date): { year: number; month: number; day: number; hour: number; minute: number; second: number } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: orderRules.timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23'
  }).formatToParts(value);
  const numberPart = (type: Intl.DateTimeFormatPartTypes): number => Number(parts.find((part) => part.type === type)?.value ?? 0);
  return {
    year: numberPart('year'),
    month: numberPart('month'),
    day: numberPart('day'),
    hour: numberPart('hour'),
    minute: numberPart('minute'),
    second: numberPart('second')
  };
}

function validateFulfillment(payload: OrderPayload, now = new Date()): string | null {
  const type = payload.delivery?.type ?? payload.delivery?.mode ?? payload.deliveryType;
  const date = payload.delivery?.date ?? payload.deliveryDate ?? '';
  const slot = payload.delivery?.slot ?? payload.deliverySlot ?? '';
  if (type !== 'delivery' && type !== 'pickup') return 'El tipo de entrega debe ser delivery o pickup.';
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!dateMatch) return 'La fecha seleccionada no es válida.';
  const year = Number(dateMatch[1]);
  const month = Number(dateMatch[2]);
  const day = Number(dateMatch[3]);
  const dateCheck = new Date(Date.UTC(year, month - 1, day));
  if (dateCheck.getUTCFullYear() !== year || dateCheck.getUTCMonth() !== month - 1 || dateCheck.getUTCDate() !== day) {
    return 'La fecha seleccionada no es válida.';
  }
  if (orderRules.closedWeekdays.includes(dateCheck.getUTCDay())) return 'No hay servicio en la fecha seleccionada.';
  const allowedSlots = orderRules.slots[type as RuntimeDeliveryType];
  if (!allowedSlots.includes(slot)) {
    return type === 'delivery'
      ? `Para entrega a domicilio la única franja válida es ${orderRules.slots.delivery[0]}.`
      : 'La franja seleccionada no está disponible para recogida en tienda.';
  }
  const nowParts = getMadridParts(now);
  const today = `${nowParts.year}-${String(nowParts.month).padStart(2, '0')}-${String(nowParts.day).padStart(2, '0')}`;
  if (!orderRules.sameDayDelivery && date <= today) return 'No se admiten pedidos para el mismo día.';
  const slotStart = /^(\d{2}):(\d{2})-/.exec(slot);
  if (!slotStart) return 'La franja horaria no es válida.';
  const intendedUtc = Date.UTC(year, month - 1, day, Number(slotStart[1]), Number(slotStart[2]), 0);
  let fulfillmentAt = new Date(intendedUtc);
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const actual = getMadridParts(fulfillmentAt);
    const representedUtc = Date.UTC(actual.year, actual.month - 1, actual.day, actual.hour, actual.minute, actual.second);
    fulfillmentAt = new Date(fulfillmentAt.getTime() + intendedUtc - representedUtc);
  }
  const requiresAdvancePayment = Boolean(payload.requiresAdvancePayment)
    || Boolean(payload.items?.some((item) => item.requiresAdvancePayment || Boolean(item.customization?.length)));
  const hours = requiresAdvancePayment
    ? orderRules.personalizedAdvanceNoticeHours
    : orderRules.advanceNoticeHours;
  return fulfillmentAt.getTime() < now.getTime() + hours * 60 * 60 * 1000
    ? `El pedido requiere al menos ${hours} horas completas de antelación.`
    : null;
}
