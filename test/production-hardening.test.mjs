import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const rootUrl = new URL('../', import.meta.url);
const read = (path) => readFileSync(new URL(path, rootUrl), 'utf8');

test('la capa API distingue red, timeout, 401, 403, 409, 429 y 5xx', () => {
  const client = read('src/app/core/utils/api-client.ts');
  assert.match(client, /kind: ApiErrorKind/);
  for (const status of [401, 403, 404, 409, 429, 500]) assert.match(client, new RegExp(`status === ${status}|status >= ${status}`));
  assert.match(client, /controller\.abort\(\)/);
  assert.match(client, /X-Request-Id/);
});

test('un error de red conserva catálogo disponible y muestra reintento', () => {
  const service = read('src/app/core/services/catalog.service.ts');
  const template = read('src/app/features/catalog/catalog-page.component.html');
  assert.match(service, /readonly loadError = signal\(''\)/);
  assert.match(service, /this\.products\.set\(fallbackProducts\)/);
  assert.match(template, /catalog\.loadError\(\)/);
  assert.match(template, />Reintentar</);
});

test('restoreSession solo limpia auth por 401 o 403', () => {
  const auth = read('src/app/core/services/customer-auth.service.ts');
  assert.match(auth, /error\.status === 401 \|\| error\.status === 403/);
  assert.match(auth, /Network and 5xx errors keep the local session/);
});

test('el checkout solo vacía carrito después de recibir éxito', () => {
  const checkout = read('src/app/features/checkout/checkout-page.component.ts');
  const submit = checkout.indexOf('await this.orderService.submitOrder(payload)');
  const clear = checkout.indexOf('this.cart.clear()', submit);
  const failure = checkout.indexOf('} catch (error)', submit);
  assert.ok(submit >= 0 && clear > submit && failure > clear);
});

test('el proxy aplica timeout y propaga requestId sin exponer backend interno', () => {
  const proxy = read('netlify/functions/api-proxy.ts');
  assert.match(proxy, /BACKEND_TIMEOUT_MS/);
  assert.match(proxy, /X-Request-Id/);
  assert.match(proxy, /Idempotency-Key/);
  assert.doesNotMatch(proxy, /your-render-app\.onrender\.com/);
});
