import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { PRODUCTION_SITE_URL } from "../src/config/site.config.js";
import {
  buildAdminOrderEmail,
  buildCustomerOrderEmail,
  buildOrderStatusEmail,
  formatCurrency,
  formatFulfillmentDate,
  getPaymentInstructions,
  logoUrl
} from "../src/services/order-email.templates.js";

const FORBIDDEN = /PENDIENTE_CONFIGURAR|backendapi|Backend API|\bRender\b|\bNetlify\b|\bundefined\b|\bnull\b/i;
const PAYMENT_ENV = {
  PAYMENT_BIZUM_PHONE: "+34644339404",
  PAYMENT_BANK_IBAN: "ES7515632626343269629293",
  PAYMENT_BANK_HOLDER: "AMED PUENTES PADRÓN",
  PAYMENT_CASH_INSTRUCTIONS: "Pagar en efectivo al recibir o recoger el pedido."
};

function capturingLog() {
  const events = [];
  return { events, error(event, data) { events.push({ event, data }); } };
}

function normalize(value) {
  return String(value).replace(/\u00A0/g, " ");
}

function assertSafe(output, label) {
  const text = normalize(output);
  assert.doesNotMatch(text, FORBIDDEN, `${label} contiene texto técnico`);
  assert.doesNotMatch(text, /process\.env|JWT|mongodb:\/\//i, `${label} contiene secretos o internals`);
}

function customizedCake({ quantity = 1, unitPrice = 40 } = {}) {
  return {
    name: "Tarta Capuchino Cubano",
    unitPrice,
    quantity,
    requiresAdvancePayment: true,
    customization: [
      { label: "Tamaño", value: "Mediana · 20 cm · 10–12 porciones", priceModifier: 15 },
      { label: "Bizcocho", value: "Vainilla" },
      { label: "Relleno", value: "Guayaba" },
      { label: "Cobertura", value: "Merengue italiano" }
    ]
  };
}

function sampleOrder(overrides = {}) {
  const items = overrides.items ?? [{ name: "Croqueta de jamón", unitPrice: 12, quantity: 1 }];
  const subtotal = overrides.subtotal ?? items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  const shippingCost = overrides.shippingCost ?? 5;
  const discountAmount = overrides.discountAmount ?? 0;
  return {
    orderId: "MLG-TEST01",
    customer: { fullName: "Ana Cliente", email: "ana@example.com", phone: "600000000" },
    deliveryType: "delivery",
    delivery: {
      type: "delivery",
      date: "2026-09-05",
      slot: "18:00-21:00",
      address: "Calle Mayor 1",
      reference: "Portero"
    },
    payment: { method: "bizum", status: "pending" },
    shipping: { cost: shippingCost, zoneName: "Alcorcón", postalCode: "28922" },
    shippingCost,
    discountAmount,
    couponCode: discountAmount ? "PRIMER10" : "",
    discountPercent: discountAmount ? 10 : 0,
    items,
    subtotal,
    total: overrides.total ?? Number((subtotal + shippingCost - discountAmount).toFixed(2)),
    notes: "Sin cebolla",
    requiresAdvancePayment: Boolean(overrides.requiresAdvancePayment),
    ...overrides
  };
}

test("caso A: email de pedido normal", () => {
  const email = buildCustomerOrderEmail(sampleOrder(), { env: PAYMENT_ENV });
  assert.match(email.subject, /MIXSABOR · Pedido recibido #MLG-TEST01/);
  assert.match(normalize(email.html), /Croqueta de jamón/);
  assert.match(normalize(email.html), /12,00\s*€/);
  assertSafe(email.html, "html A");
  assertSafe(email.text, "text A");
});

test("caso B: email de producto personalizado", () => {
  const order = sampleOrder({ items: [customizedCake()], requiresAdvancePayment: true, shippingCost: 0, total: 40 });
  order.shippingCost = 5;
  order.shipping.cost = 5;
  order.subtotal = 40;
  order.total = 45;
  const email = buildCustomerOrderEmail(order, { env: PAYMENT_ENV });
  assert.match(email.html, /Tarta Capuchino Cubano/);
  assert.match(email.html, /pago anticipado/i);
  assert.match(email.html, /Tamaño: Mediana/);
  assert.match(email.html, /Bizcocho: Vainilla/);
});

test("caso C: múltiples personalizaciones son escaneables", () => {
  const email = buildCustomerOrderEmail(sampleOrder({ items: [customizedCake()] }), { env: PAYMENT_ENV });
  assert.match(email.html, /Relleno: Guayaba/);
  assert.match(email.html, /Cobertura: Merengue italiano/);
  assert.doesNotMatch(email.html, /<ul style="margin:6px 0 0;padding-left:18px;/);
});

test("caso D: cantidad mayor que 1 deja el total de línea inequívoco", () => {
  const email = buildCustomerOrderEmail(sampleOrder({ items: [customizedCake({ quantity: 2 })], subtotal: 80, total: 85 }), { env: PAYMENT_ENV });
  assert.match(email.html, /Cantidad: 2/);
  assert.match(normalize(email.html), /Precio unitario: 40,00\s*€/);
  assert.match(normalize(email.html), /Total línea: 80,00\s*€/);
});

test("caso E: el suplemento no se duplica en el precio", () => {
  const email = buildCustomerOrderEmail(sampleOrder({ items: [customizedCake({ unitPrice: 40 })], subtotal: 40, total: 45 }), { env: PAYMENT_ENV });
  assert.match(normalize(email.html), /\(\+15,00\s*€\)/);
  assert.match(normalize(email.html), /Precio: 40,00\s*€/);
  assert.doesNotMatch(normalize(email.html), /Precio: 55,00\s*€/);
  assert.doesNotMatch(normalize(email.html), /Total línea: 55,00\s*€/);
});

test("caso F: subtotal correcto", () => {
  const email = buildCustomerOrderEmail(sampleOrder({ items: [customizedCake({ quantity: 2 })], subtotal: 80, shippingCost: 5, total: 85 }), { env: PAYMENT_ENV });
  assert.match(normalize(email.html), /Subtotal<\/td>\s*<td[^>]*>80,00\s*€/);
});

test("caso G: descuento correcto", () => {
  const email = buildCustomerOrderEmail(sampleOrder({ subtotal: 80, discountAmount: 8, shippingCost: 5, total: 77 }), { env: PAYMENT_ENV });
  assert.match(email.html, /Descuento PRIMER10/);
  assert.match(normalize(email.html), /-8,00\s*€/);
});

test("caso H: envío correcto", () => {
  const email = buildCustomerOrderEmail(sampleOrder({ shippingCost: 5.9, total: 17.9 }), { env: PAYMENT_ENV });
  assert.match(email.html, />Entrega</);
  assert.match(normalize(email.html), /5,90\s*€/);
});

test("caso I: total correcto y destacado", () => {
  const email = buildCustomerOrderEmail(sampleOrder({ subtotal: 80, discountAmount: 5, shippingCost: 5, total: 80 }), { env: PAYMENT_ENV });
  assert.match(normalize(email.html), /TOTAL<\/td>\s*<td[^>]*>80,00\s*€/);
  assert.match(email.html, /font-size:18px;font-weight:700/);
});

test("el branding visual reutiliza logo light y paleta de la web", () => {
  const email = buildCustomerOrderEmail(sampleOrder(), {
    env: { ...PAYMENT_ENV, FRONTEND_URL: "https://mixsabor.example.test" }
  });
  assert.match(email.html, /logo_mixsabor_light_256\.png/);
  assert.match(email.html, /alt="MIXSABOR"/);
  assert.match(email.html, /#e51a32/);
  assert.match(email.html, /#0068a8/);
  assert.match(email.html, /#0d3d67/);
  assert.match(email.html, /#f8f5eb/);
  assert.doesNotMatch(email.html, /#4e2f1f/);
  assert.doesNotMatch(email.html, /#f7f3ea/);
});

test("el logo del email es una URL pública absoluta y no usa localhost", () => {
  const expectedPath = "/assets/branding/logo_mixsabor_light_256.png";
  const assetOnDisk = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "public", "assets", "branding", "logo_mixsabor_light_256.png");
  assert.equal(existsSync(assetOnDisk), true);

  const fromLocal = logoUrl({ FRONTEND_URL: "http://localhost:4200/" });
  assert.equal(fromLocal, `${PRODUCTION_SITE_URL}${expectedPath}`);
  assert.match(fromLocal, /^https:\/\//);
  assert.doesNotMatch(fromLocal, /localhost|127\.0\.0\.1|\bundefined\b|\bnull\b/);
  assert.doesNotMatch(fromLocal, /https:\/\/[^/]+\/\//);

  const fromHttps = logoUrl({ FRONTEND_URL: "https://mixsabor.example.test/" });
  assert.equal(fromHttps, `https://mixsabor.example.test${expectedPath}`);
  assert.doesNotMatch(fromHttps, /https:\/\/[^/]+\/\//);

  const fromMissing = logoUrl({});
  assert.equal(fromMissing, `${PRODUCTION_SITE_URL}${expectedPath}`);

  const html = buildCustomerOrderEmail(sampleOrder(), { env: { ...PAYMENT_ENV, FRONTEND_URL: "http://127.0.0.1:4200" } }).html;
  assert.match(html, new RegExp(`src="${PRODUCTION_SITE_URL.replace(/[.]/g, "\\.")}${expectedPath}"`));
  assert.match(html, /alt="MIXSABOR"/);
  assert.doesNotMatch(html, /localhost/);
  const fallback = buildCustomerOrderEmail(sampleOrder(), { env: PAYMENT_ENV }).html;
  assert.match(fallback, /MIXSABOR/);
});

test("caso J: delivery muestra dirección y fecha local", () => {
  const email = buildCustomerOrderEmail(sampleOrder(), { env: PAYMENT_ENV });
  assert.match(email.html, /Modalidad:<\/strong> Entrega a domicilio/);
  assert.match(email.html, /Calle Mayor 1/);
  assert.match(email.html, /Sábado, 5 de septiembre de 2026/);
  assert.match(email.html, /18:00–21:00/);
  assert.doesNotMatch(email.html, /2026-09-05T/);
});

test("caso K: pickup no muestra dirección", () => {
  const order = sampleOrder({
    deliveryType: "pickup",
    delivery: { type: "pickup", date: "2026-09-05", slot: "12:00-14:00", address: "Calle Mayor 1" },
    shippingCost: 0,
    total: 12
  });
  const email = buildCustomerOrderEmail(order, { env: PAYMENT_ENV });
  assert.match(email.html, /Modalidad:<\/strong> Recogida/);
  assert.doesNotMatch(email.html, /Dirección:/);
  assert.match(email.html, />Recogida</);
});

test("caso L: Bizum configurado muestra el número y el concepto existente", () => {
  const email = buildCustomerOrderEmail(sampleOrder(), { env: PAYMENT_ENV });
  assert.match(email.html, /Método de pago:<\/strong> Bizum/);
  assert.match(email.html, /\+34644339404/);
  assert.match(email.html, /Concepto:<\/strong> pedido MLG-TEST01/);
  assert.equal(
    getPaymentInstructions(sampleOrder(), { env: PAYMENT_ENV }),
    "Realiza el Bizum al +34644339404 indicando pedido MLG-TEST01."
  );
});

test("caso M: Bizum sin configurar no muestra placeholder y registra el fallo", () => {
  const log = capturingLog();
  const email = buildCustomerOrderEmail(sampleOrder(), { env: {}, log });
  assert.equal(log.events[0].event, "payment.bizum.configuration_missing");
  assert.match(email.html, /Te contactaremos para facilitarte los datos de pago\./);
  assert.doesNotMatch(email.html, /Realiza el Bizum al:/);
  assertSafe(email.html, "html M");
});

test("caso N-S: placeholders e internals no aparecen en cliente, admin ni estado", () => {
  const log = capturingLog();
  const order = sampleOrder({ items: [customizedCake()], requiresAdvancePayment: true });
  const customer = buildCustomerOrderEmail(order, { env: { PAYMENT_BIZUM_PHONE: "PENDIENTE_CONFIGURAR_PAYMENT_BIZUM_PHONE" }, log });
  const admin = buildAdminOrderEmail(order, { env: {}, log });
  const status = buildOrderStatusEmail(order, { status: "preparando", statusNote: "Horno listo" });
  for (const output of [customer.html, customer.text, admin.html, admin.text, status.html, status.text]) {
    assertSafe(output, "output combinado");
  }
});

test("caso T: HTML del usuario se escapa", () => {
  const order = sampleOrder({
    customer: { fullName: '<script>alert("x")</script>', email: "ana@example.com" },
    notes: "<img src=x onerror=alert(1)>",
    items: [{
      name: "Tarta <b>Hacked</b>",
      unitPrice: 40,
      quantity: 1,
      customization: [{ label: "Mensaje", value: "<iframe src='evil'>" }]
    }]
  });
  const email = buildCustomerOrderEmail(order, { env: PAYMENT_ENV });
  assert.match(email.html, /&lt;script&gt;/);
  assert.match(email.html, /&lt;b&gt;Hacked&lt;\/b&gt;/);
  assert.match(email.html, /&lt;iframe src=&#39;evil&#39;&gt;/);
  assert.doesNotMatch(email.html, /<script>alert/);
  assert.doesNotMatch(email.html, /<iframe src=/);
});

test("caso U: email de cambio de estado reutiliza el formato de negocio", () => {
  const email = buildOrderStatusEmail(sampleOrder(), { status: "preparando" });
  assert.equal(email.subject, "MIXSABOR · Tu pedido #MLG-TEST01 está en preparación");
  assert.match(email.html, /En preparación/);
  assert.match(email.text, /En preparación/);
  assert.match(email.html, /Sábado, 5 de septiembre de 2026/);
  assertSafe(email.html, "status html");
});

test("caso V: markup móvil de una columna, sin flex/grid", () => {
  const email = buildCustomerOrderEmail(sampleOrder({ items: [customizedCake({ quantity: 2 })] }), { env: PAYMENT_ENV });
  assert.doesNotMatch(email.html, /display:\s*flex/);
  assert.doesNotMatch(email.html, /display:\s*grid/);
  assert.doesNotMatch(email.html, /<th[^>]*>Producto/);
  assert.match(email.html, /max-width:600px/);
  assert.match(email.html, /width="100%"/);
  assert.match(email.html, /name="viewport"/);
});

test("caso W: existe texto plano equivalente", () => {
  const email = buildCustomerOrderEmail(sampleOrder({ items: [customizedCake({ quantity: 2 })], discountAmount: 5, total: 80 }), { env: PAYMENT_ENV });
  assert.ok(email.text.includes("Tarta Capuchino Cubano"));
  assert.ok(email.text.includes("Cantidad: 2"));
  assert.ok(email.text.includes("Tamaño: Mediana"));
  assert.match(normalize(email.text), /TOTAL: 85,00\s*€|TOTAL: 80,00\s*€/);
  assert.ok(email.text.includes("Entrega a domicilio"));
});

test("efectivo y pedido pagado se representan según la lógica existente", () => {
  const cash = buildCustomerOrderEmail(sampleOrder({ payment: { method: "cash", status: "pending" } }), { env: PAYMENT_ENV });
  assert.match(cash.html, /Se paga al recoger o entregar/);
  const paid = buildCustomerOrderEmail(sampleOrder({ payment: { method: "bizum", status: "paid" } }), { env: PAYMENT_ENV });
  assert.match(paid.html, /Pagado/);
});

test("las fuentes de email no contienen PENDIENTE_CONFIGURAR", () => {
  const files = [
    new URL("../src/services/email.service.js", import.meta.url),
    new URL("../src/services/order-email.templates.js", import.meta.url),
    new URL("../../netlify/functions/submit-order.ts", import.meta.url)
  ];
  for (const file of files) {
    assert.doesNotMatch(readFileSync(file, "utf8"), /PENDIENTE_CONFIGURAR/);
  }
});

test("formatCurrency y fecha usan formato español", () => {
  assert.match(normalize(formatCurrency(40)), /40,00\s*€/);
  assert.equal(formatFulfillmentDate("2026-09-05"), "Sábado, 5 de septiembre de 2026");
});

test("fixture HTML de inspección manual", () => {
  const email = buildCustomerOrderEmail(sampleOrder({
    items: [customizedCake({ quantity: 2 })],
    subtotal: 80,
    discountAmount: 5,
    shippingCost: 5,
    total: 80,
    requiresAdvancePayment: true
  }), { env: PAYMENT_ENV });
  const outDir = join(dirname(fileURLToPath(import.meta.url)), "fixtures");
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, "order-email-preview.html"), email.html);
  assert.match(email.html, /MIXSABOR|Tarta Capuchino Cubano/);
});
