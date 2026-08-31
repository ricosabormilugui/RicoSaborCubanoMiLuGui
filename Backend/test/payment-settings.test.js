import assert from "node:assert/strict";
import test from "node:test";
import { requireAdmin } from "../src/middleware/auth.middleware.js";
import { createPaymentSettingsHandlers } from "../src/controllers/payment-settings.controller.js";
import { createMemoryPaymentSettingsRepository } from "../src/repositories/payment-settings.repository.js";
import {
  buildPaymentSettingsFromEnv,
  createPaymentSettingsService,
  getEnabledPaymentMethods,
  isValidIban,
  normalizeIban,
  toPublicPaymentSettings,
  validatePaymentSettingsPayload
} from "../src/services/payment-settings.service.js";
import { resolveOrderPayment } from "../src/controllers/orders.controller.js";
import { buildCustomerOrderEmail } from "../src/services/order-email.templates.js";

function mockResponse() {
  return {
    statusCode: 200,
    body: undefined,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    }
  };
}

const VALID_IBAN = "ES7515632626343269629293";

function completeSettings(overrides = {}) {
  return {
    bizum: { enabled: true, phone: "+34644339404", instructions: "Indica el pedido" },
    bankTransfer: { enabled: true, holder: "AMED PUENTES PADRÓN", iban: VALID_IBAN, instructions: "" },
    cash: {
      enabled: true,
      instructionsPickup: "Pago en efectivo al recoger el pedido.",
      instructionsDelivery: "Pago en efectivo en la entrega."
    },
    ...overrides
  };
}

function createService(initial = null, env = {}) {
  const repository = createMemoryPaymentSettingsRepository(initial);
  const service = createPaymentSettingsService({
    readDocument: () => repository.findPaymentSettingsDocument(),
    writeDocument: (settings, options) => repository.savePaymentSettingsDocument(settings, options),
    env,
    ttlMs: 15_000,
    log: { info() {}, error() {} }
  });
  const handlers = createPaymentSettingsHandlers(service);
  return { repository, service, handlers };
}

test("pago A: GET admin autorizado devuelve la configuración", async () => {
  const { handlers } = createService(completeSettings());
  const response = mockResponse();
  await handlers.getPaymentSettingsForAdmin({ auth: { role: "admin" } }, response);
  assert.equal(response.statusCode, 200);
  assert.equal(response.body.payment.bizum.phone, "+34644339404");
  assert.equal(response.body.payment.bizum.status, "configured");
  assert.equal(response.body.payment.bankTransfer.status, "configured");
  assert.equal(response.body.payment.cash.status, "active");
});

test("pago B: GET admin no autorizado", () => {
  const response = mockResponse();
  let continued = false;
  requireAdmin({ headers: {} }, response, () => { continued = true; });
  assert.equal(response.statusCode, 401);
  assert.equal(continued, false);
});

test("pago C: PUT admin autorizado guarda de forma atómica", async () => {
  const { handlers, service } = createService(completeSettings());
  const response = mockResponse();
  await handlers.updatePaymentSettingsForAdmin({
    auth: { role: "admin", email: "admin@mixsabor.test" },
    body: completeSettings({
      bizum: { enabled: true, phone: "+34600000001", instructions: "" }
    })
  }, response);
  assert.equal(response.statusCode, 200);
  assert.equal(response.body.payment.bizum.phone, "+34600000001");
  const stored = await service.getCanonical({ allowCache: false });
  assert.equal(stored.bizum.phone, "+34600000001");
});

test("pago D: PUT admin no autorizado", () => {
  const response = mockResponse();
  let continued = false;
  requireAdmin({ headers: { authorization: "Bearer" } }, response, () => { continued = true; });
  assert.equal(response.statusCode, 401);
  assert.equal(continued, false);
});

test("pago E: Bizum activo sin teléfono → 400", async () => {
  const { handlers } = createService(completeSettings());
  const response = mockResponse();
  await handlers.updatePaymentSettingsForAdmin({
    auth: { role: "admin" },
    body: completeSettings({ bizum: { enabled: true, phone: "" } })
  }, response);
  assert.equal(response.statusCode, 400);
  assert.match(response.body.error, /teléfono/i);
  assert.equal(response.body.fields[0].field, "bizum.phone");
});

test("pago F: transferencia activa sin titular → 400", () => {
  const { errors } = validatePaymentSettingsPayload(completeSettings({
    bankTransfer: { enabled: true, holder: "", iban: VALID_IBAN }
  }));
  assert.ok(errors.some((item) => item.field === "bankTransfer.holder"));
});

test("pago G: transferencia activa sin IBAN → 400", async () => {
  const { handlers } = createService(completeSettings());
  const response = mockResponse();
  await handlers.updatePaymentSettingsForAdmin({
    auth: { role: "admin" },
    body: completeSettings({
      bankTransfer: { enabled: true, holder: "Titular", iban: "" }
    })
  }, response);
  assert.equal(response.statusCode, 400);
  assert.equal(response.body.fields[0].field, "bankTransfer.iban");
});

test("pago H: IBAN se normaliza y valida", () => {
  assert.equal(normalizeIban("es75 1563 2626 3432 6962 9293"), VALID_IBAN);
  assert.equal(isValidIban("ES75 1563 2626 3432 6962 9293"), true);
  const { settings, errors } = validatePaymentSettingsPayload(completeSettings({
    bankTransfer: { enabled: true, holder: "Titular", iban: "es75 1563 2626 3432 6962 9293" }
  }));
  assert.equal(errors.length, 0);
  assert.equal(settings.bankTransfer.iban, VALID_IBAN);
});

test("pago I: la configuración de DB tiene prioridad sobre env", async () => {
  const { service } = createService(
    completeSettings({ bizum: { enabled: true, phone: "+34611111111" } }),
    { PAYMENT_BIZUM_PHONE: "+34644339404" }
  );
  const settings = await service.getCanonical();
  assert.equal(settings.bizum.phone, "+34611111111");
  const email = buildCustomerOrderEmail(
    { orderId: "MLG-DB01", payment: { method: "bizum" }, customer: { fullName: "Ana" }, items: [], deliveryType: "delivery" },
    { env: { PAYMENT_BIZUM_PHONE: "+34644339404" }, paymentSettings: settings }
  );
  assert.match(email.html, /\+34611111111/);
  assert.doesNotMatch(email.html, /\+34644339404/);
});

test("pago J: env se usa como fallback si la DB está vacía", async () => {
  const { service } = createService(null, {
    PAYMENT_BIZUM_PHONE: "+34644339404",
    PAYMENT_BANK_HOLDER: "AMED PUENTES PADRÓN",
    PAYMENT_BANK_IBAN: VALID_IBAN,
    PAYMENT_CASH_INSTRUCTIONS: "Pagar en efectivo al recoger o entregar."
  });
  const settings = await service.getCanonical();
  assert.equal(settings.bizum.enabled, true);
  assert.equal(settings.bizum.phone, "+34644339404");
  assert.equal(settings.bankTransfer.iban, VALID_IBAN);
  assert.equal(settings.cash.enabled, true);
});

test("pago K: el endpoint público no expone teléfono ni IBAN", async () => {
  const { handlers } = createService(completeSettings());
  const response = mockResponse();
  await handlers.getPublicPaymentSettings({}, response);
  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.body.payment, {
    bizum: { enabled: true },
    bankTransfer: { enabled: true },
    cash: { enabled: true }
  });
  assert.equal(JSON.stringify(response.body).includes("+34644339404"), false);
  assert.equal(JSON.stringify(response.body).includes(VALID_IBAN), false);
  assert.doesNotMatch(JSON.stringify(response.body), /holder|phone|iban/i);
});

test("pago L: método desactivado se rechaza al crear pedido", async () => {
  await assert.rejects(
    () => resolveOrderPayment(
      { payment: { method: "bizum" } },
      { loadSettings: async () => completeSettings({ bizum: { enabled: false, phone: "" } }) }
    ),
    /no está disponible/
  );
});

test("pago M: método activo se acepta", async () => {
  const payment = await resolveOrderPayment(
    { payment: { method: "bank_transfer" } },
    { loadSettings: async () => completeSettings() }
  );
  assert.equal(payment.method, "bank_transfer");
});

test("pago N: un cambio admin afecta al email", async () => {
  const { service } = createService(completeSettings());
  await service.save(completeSettings({
    bizum: { enabled: true, phone: "+34699999999", instructions: "" }
  }), { updatedBy: "admin@mixsabor.test" });
  const settings = await service.getCanonical();
  const email = buildCustomerOrderEmail(
    { orderId: "MLG-NEW01", payment: { method: "bizum" }, customer: { fullName: "Ana" }, items: [], deliveryType: "delivery" },
    { paymentSettings: settings }
  );
  assert.match(email.html, /\+34699999999/);
});

test("pago O: un cambio admin afecta a la validación de pedido", async () => {
  const { service } = createService(completeSettings());
  await service.save(completeSettings({
    cash: { enabled: false, instructionsPickup: "x", instructionsDelivery: "y" }
  }));
  await assert.rejects(
    () => resolveOrderPayment(
      { payment: { method: "cash" } },
      { loadSettings: () => service.getCanonical() }
    ),
    /no está disponible/
  );
});

test("pago P: sin métodos activos el pedido falla con mensaje de negocio", async () => {
  await assert.rejects(
    () => resolveOrderPayment(
      { payment: { method: "bizum" } },
      {
        loadSettings: async () => ({
          bizum: { enabled: false, phone: "", instructions: "" },
          bankTransfer: { enabled: false, holder: "", iban: "", instructions: "" },
          cash: { enabled: false, instructionsPickup: "", instructionsDelivery: "" }
        })
      }
    ),
    /no hay métodos de pago disponibles/
  );
});

test("un método activo incompleto no se publica ni se acepta en pedido", () => {
  const settings = completeSettings({ bizum: { enabled: true, phone: "" } });
  const publicSettings = toPublicPaymentSettings(settings);
  assert.equal(publicSettings.bizum.enabled, false);
  assert.equal(getEnabledPaymentMethods(settings).includes("bizum"), false);
});

test("el bootstrap desde env no mezcla un documento existente", async () => {
  const fromEnv = buildPaymentSettingsFromEnv({
    PAYMENT_BIZUM_PHONE: "+34644339404"
  });
  assert.equal(fromEnv.bizum.phone, "+34644339404");
  const { service } = createService(
    completeSettings({ bizum: { enabled: true, phone: "+34622222222" } }),
    { PAYMENT_BIZUM_PHONE: "+34644339404" }
  );
  const stored = await service.getCanonical();
  assert.equal(stored.bizum.phone, "+34622222222");
});
