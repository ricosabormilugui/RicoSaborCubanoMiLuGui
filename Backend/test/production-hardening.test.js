import assert from "node:assert/strict";
import test from "node:test";
import { createApp } from "../src/app.js";
import { fetchWithTimeout } from "../src/lib/fetch-with-timeout.js";
import { validateRuntimeEnv } from "../src/lib/env.js";
import { applyStagingEmailSafety } from "../src/services/email.service.js";
import { createRateLimit } from "../src/middleware/rate-limit.middleware.js";
import { persistOrderAndNotify } from "../src/controllers/orders.controller.js";

async function withServer(options, run) {
  const server = createApp(options).listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  const address = server.address();
  try {
    return await run(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

test("health confirma que el proceso está vivo y devuelve requestId", async () => {
  await withServer({}, async (base) => {
    const response = await fetch(`${base}/api/health`, { headers: { "X-Request-Id": "test-request-123" } });
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.status, "ok");
    assert.equal(response.headers.get("x-request-id"), "test-request-123");
    assert.equal(body.database, undefined);
  });
});

test("readiness responde 503 sin detalles cuando Mongo no está disponible", async () => {
  await withServer({ databaseCheck: async () => { throw new Error("mongodb://user:secret@private-host"); } }, async (base) => {
    const response = await fetch(`${base}/api/ready`);
    const body = await response.json();
    assert.equal(response.status, 503);
    assert.equal(body.status, "unavailable");
    assert.equal(body.database, "unavailable");
    assert.doesNotMatch(JSON.stringify(body), /private-host|secret/);
  });
});

test("una ruta API desconocida devuelve 404 JSON con requestId", async () => {
  await withServer({}, async (base) => {
    const response = await fetch(`${base}/api/no-existe`);
    const body = await response.json();
    assert.equal(response.status, 404);
    assert.match(response.headers.get("content-type"), /application\/json/);
    assert.equal(typeof body.requestId, "string");
  });
});

test("un error inesperado no expone mensaje ni stack al cliente", async () => {
  await withServer({ configure: (app) => app.get("/api/test-error", () => { throw new Error("secret stack detail"); }) }, async (base) => {
    const response = await fetch(`${base}/api/test-error`);
    const body = await response.json();
    assert.equal(response.status, 500);
    assert.equal(body.message, "Se produjo un error interno.");
    assert.equal("stack" in body, false);
    assert.doesNotMatch(JSON.stringify(body), /secret stack detail/);
  });
});

test("rate limit responde 429 con Retry-After y mensaje genérico", () => {
  const middleware = createRateLimit({ windowMs: 60_000, max: 1, now: () => 1_000 });
  const request = { ip: "127.0.0.1", socket: {} };
  const response = {
    headers: {}, statusCode: 200, body: undefined,
    setHeader(name, value) { this.headers[name] = value; },
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; }
  };
  let nextCalls = 0;
  middleware(request, response, () => { nextCalls += 1; });
  middleware(request, response, () => { nextCalls += 1; });
  assert.equal(nextCalls, 1);
  assert.equal(response.statusCode, 429);
  assert.equal(response.headers["Retry-After"], "60");
  assert.match(response.body.message, /demasiados intentos/i);
});

test("fetch externo aborta al superar el timeout", async () => {
  const fetchImpl = (_url, { signal }) => new Promise((_resolve, reject) => {
    signal.addEventListener("abort", () => reject(Object.assign(new Error("aborted"), { name: "AbortError" })));
  });
  await assert.rejects(
    fetchWithTimeout("https://example.invalid", {}, { timeoutMs: 10, fetchImpl }),
    (error) => error.code === "EXTERNAL_TIMEOUT" && error.status === 503
  );
});

test("el pedido permanece persistido aunque falle el email", async () => {
  const events = [];
  const result = await persistOrderAndNotify({ orderId: "MLG-TEST" }, {
    persist: async () => { events.push("persisted"); },
    afterPersist: async () => { events.push("post-persist"); },
    emailSender: async () => { events.push("email"); throw new Error("provider unavailable"); },
    notificationAppender: async () => { events.push("audit"); },
    requestId: "test-request-123"
  });
  assert.deepEqual(events, ["persisted", "post-persist", "email", "audit"]);
  assert.equal(result.notifications.email.sent, false);
  assert.deepEqual(result.warnings, ["email-not-sent"]);
});

test("producción arranca sin PAYMENT_* porque la fuente canónica es la base de datos", () => {
  const environment = {
    NODE_ENV: "production",
    MONGODB_URI: "mongodb://database.test/mixsabor",
    AUTH_TOKEN_SECRET: "test-secret-with-at-least-32-characters",
    FRONTEND_URL: "https://mixsabor.test",
    CORS_ORIGIN: "https://mixsabor.test"
  };

  assert.equal(validateRuntimeEnv(environment).environment, "production");
});

test("desarrollo puede arrancar sin datos de pago de staging", () => {
  const environment = {
    NODE_ENV: "development",
    MONGODB_URI: "mongodb://database.test/mixsabor",
    AUTH_TOKEN_SECRET: "test-secret-with-at-least-32-characters",
    FRONTEND_URL: "http://localhost:4200"
  };

  assert.equal(validateRuntimeEnv(environment).environment, "development");
});

test("producción acepta PAYMENT_* como bootstrap opcional", () => {
  const environment = {
    NODE_ENV: "production",
    MONGODB_URI: "mongodb://database.test/mixsabor",
    AUTH_TOKEN_SECRET: "test-secret-with-at-least-32-characters",
    FRONTEND_URL: "https://mixsabor.test",
    CORS_ORIGIN: "https://mixsabor.test",
    PAYMENT_BIZUM_PHONE: "+34000000000",
    PAYMENT_BANK_IBAN: "ES0000000000000000000000",
    PAYMENT_BANK_HOLDER: "QA MIXSABOR",
    PAYMENT_CASH_INSTRUCTIONS: "Pago de prueba al recoger"
  };

  assert.equal(validateRuntimeEnv(environment).environment, "production");
});

test("staging exige runtime production-like, base aislada, Resend y destinatario QA", () => {
  const base = {
    NODE_ENV: "production",
    APP_ENV: "staging",
    MONGODB_URI: "mongodb://database.test/mixsabor_staging",
    MONGODB_DB_NAME: "mixsabor_staging",
    AUTH_TOKEN_SECRET: "test-secret-with-at-least-32-characters",
    FRONTEND_URL: "https://staging.mixsabor.test",
    CORS_ORIGIN: "https://staging.mixsabor.test",
    RESEND_API_KEY: "re_test",
    NOTIFY_EMAIL_FROM: "qa@mixsabor.test",
    NOTIFY_EMAIL_TO: "operaciones-qa@mixsabor.test",
    STAGING_EMAIL_TO: "buzon-qa@mixsabor.test",
    PAYMENT_BIZUM_PHONE: "+34000000000",
    PAYMENT_BANK_IBAN: "ES0000000000000000000000",
    PAYMENT_BANK_HOLDER: "QA MIXSABOR",
    PAYMENT_CASH_INSTRUCTIONS: "Instrucciones aprobadas para QA"
  };

  assert.equal(validateRuntimeEnv(base).appEnvironment, "staging");
  assert.throws(
    () => validateRuntimeEnv({ ...base, NODE_ENV: "development" }),
    /Staging must run with NODE_ENV=production/
  );
  assert.throws(
    () => validateRuntimeEnv({ ...base, MONGODB_DB_NAME: "ricoSaborCubano" }),
    /Staging MONGODB_DB_NAME/
  );
  assert.throws(
    () => validateRuntimeEnv({ ...base, STAGING_EMAIL_TO: "" }),
    /Staging requires complete Resend configuration and STAGING_EMAIL_TO/
  );
});

test("la seguridad de email redirige staging y no altera producción", () => {
  const payload = {
    to: ["cliente-real@example.com"],
    cc: ["copia@example.com"],
    bcc: ["oculta@example.com"],
    reply_to: "cliente-real@example.com",
    subject: "Pedido recibido"
  };

  const safe = applyStagingEmailSafety(payload, {
    APP_ENV: "staging",
    STAGING_EMAIL_TO: "qa-controlado@example.test"
  });
  assert.deepEqual(safe.to, ["qa-controlado@example.test"]);
  assert.equal(safe.cc, undefined);
  assert.equal(safe.bcc, undefined);
  assert.equal(safe.reply_to, "qa-controlado@example.test");
  assert.equal(safe.subject, "[STAGING] Pedido recibido");
  assert.strictEqual(applyStagingEmailSafety(payload, { APP_ENV: "production" }), payload);
});

test("producción rechaza por seguridad un destinatario de redirección staging", () => {
  const environment = {
    NODE_ENV: "production",
    APP_ENV: "production",
    MONGODB_URI: "mongodb://database.test/mixsabor",
    AUTH_TOKEN_SECRET: "test-secret-with-at-least-32-characters",
    FRONTEND_URL: "https://mixsabor.test",
    CORS_ORIGIN: "https://mixsabor.test",
    STAGING_EMAIL_TO: "qa@example.test",
    PAYMENT_BIZUM_PHONE: "+34000000000",
    PAYMENT_BANK_IBAN: "ES0000000000000000000000",
    PAYMENT_BANK_HOLDER: "MIXSABOR",
    PAYMENT_CASH_INSTRUCTIONS: "Instrucciones configuradas"
  };

  assert.throws(
    () => validateRuntimeEnv(environment),
    /STAGING_EMAIL_TO cannot be configured when APP_ENV=production/
  );
});
