import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const rootUrl = new URL('../', import.meta.url);
const read = (path) => readFileSync(new URL(path, rootUrl), 'utf8');

test('A-C: production + API failure never becomes a local draft success', () => {
  const service = read('src/app/core/services/order.service.ts');
  const checkout = read('src/app/features/checkout/checkout-page.component.ts');
  assert.doesNotMatch(service, /saveOrderLocally/);
  assert.doesNotMatch(service, /isLocalEnvironment/);
  assert.doesNotMatch(service, /ORDER_SUBMISSION_MODE === 'local'/);
  assert.doesNotMatch(service, /ORDER_SUBMISSION_MODE === 'netlify'/);
  assert.doesNotMatch(service, /LOCAL-\$\{Date\.now/);
  assert.match(service, /backendEndpoint/);
  assert.match(service, /'Idempotency-Key': idempotencyKey/);
  assert.match(checkout, /if \(this\.loading\(\)\) return/);
  assert.doesNotMatch(checkout, /isLocalDraft|ng serve|local draft/i);
  const submit = checkout.indexOf('await this.orderService.submitOrder(payload)');
  const clear = checkout.indexOf('this.cart.clear()', submit);
  const failure = checkout.indexOf('} catch (error)', submit);
  assert.ok(submit >= 0 && clear > submit && failure > clear);
  assert.doesNotMatch(checkout.slice(failure), /cart\.clear\(\)|orderId\.set\(result/);
  assert.match(checkout, /No hemos podido enviar tu pedido/);
});

test('D-F: retry uses canonical idempotency and there is no legacy skip path', () => {
  const service = read('src/app/core/services/order.service.ts');
  const checkout = read('src/app/features/checkout/checkout-page.component.ts');
  assert.match(service, /this\.orderIntent\.keyFor\(payload\)/);
  assert.match(service, /completeOrderIntent\(\): void/);
  assert.match(checkout, /this\.orderService\.completeOrderIntent\(\)/);
  assert.doesNotMatch(service, /\/\.netlify\/functions\/submit-order/);
  assert.equal(existsSync(new URL('netlify/functions/submit-order.ts', rootUrl)), false);
});

test('G-H: email is not sent from frontend or local fallback', () => {
  const service = read('src/app/core/services/order.service.ts');
  assert.doesNotMatch(service, /RESEND_API_KEY|sendEmail|api\.resend\.com/);
});

test('K-S: checkout uses public payment settings, not hardcoded operational data', () => {
  const config = read('src/app/core/config/payment.config.ts');
  const checkout = read('src/app/features/checkout/checkout-page.component.ts');
  assert.match(checkout, /paymentSettings\.getPublicSettings\(\)/);
  assert.doesNotMatch(config, /\bES\d{22}\b|\+34\d{9}/);
  assert.doesNotMatch(config, /enabled:\s*true/);
  assert.match(checkout, /Ahora mismo no hay métodos de pago disponibles/);
});

test('M: production environment does not use localhost as API', () => {
  const prod = read('src/environments/environment.prod.ts');
  assert.doesNotMatch(prod, /localhost|127\.0\.0\.1/);
  assert.match(prod, /production:\s*true/);
  assert.match(prod, /apiUrl:\s*''/);
});

test('T-Y: customer UI has no technical ops copy', () => {
  const checkout = read('src/app/features/checkout/checkout-page.component.ts');
  const legalPage = read('src/app/features/legal/legal-page.component.ts');
  const legalDocs = read('src/app/core/config/legal.config.ts');
  const contact = read('shared/contact.config.json');
  assert.doesNotMatch(checkout, /Backend API|ng serve|\bRender\b|Netlify Function|local draft/i);
  assert.doesNotMatch(legalPage, /PENDIENTE_CONFIGURAR|Backend API|ng serve/);
  assert.doesNotMatch(legalDocs.slice(legalDocs.indexOf('LEGAL_DOCUMENTS')), /PENDIENTE_CONFIGURAR/);
  assert.match(legalDocs, /contactConfig\.salesEmail/);
  assert.match(contact, /ventas@milugui\.com/);
});

test('Z: 5xx and transport errors become user-facing copy', () => {
  const helper = read('src/app/core/utils/user-friendly-error.ts');
  assert.match(helper, /Vuelve a iniciar sesión/);
  assert.match(helper, /No hemos podido conectar en este momento/);
  assert.match(helper, /ECONNREFUSED|AxiosError|FetchError/);
  assert.match(helper, /status >= 500\) return fallback/);
});
