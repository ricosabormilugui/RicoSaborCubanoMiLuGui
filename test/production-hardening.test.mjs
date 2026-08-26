import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const rootUrl = new URL('../', import.meta.url);
const read = (path) => readFileSync(new URL(path, rootUrl), 'utf8');

test('la capa API distingue red, timeout, 401, 403, 409, 429 y 5xx', () => {
  const client = read('src/app/core/utils/api-client.ts');
  assert.match(client, /kind: ApiErrorKind/);
  const normalizer = read('src/app/core/utils/user-friendly-error.ts');
  assert.match(client, /getUserFriendlyError\(\{ status, message: detail \}, fallback\)/);
  for (const status of [401, 403, 404, 409, 429, 500]) assert.match(normalizer, new RegExp(`status === ${status}|status >= ${status}`));
  assert.match(client, /controller\.abort\(\)/);
  assert.match(client, /X-Request-Id/);
});

test('un error de red conserva catálogo disponible y muestra reintento', () => {
  const service = read('src/app/core/services/catalog.service.ts');
  const template = read('src/app/features/catalog/catalog-page.component.html');
  assert.match(service, /readonly loadError = signal\(''\)/);
  assert.match(service, /readonly hasLiveCatalog = signal\(false\)/);
  assert.match(service, /this\.hasLiveCatalog\.set\(true\)/);
  assert.match(service, /this\.hasLiveCatalog\.set\(false\)/);
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

test('el sitemap público conserva su ruta al atravesar la Function de Netlify', () => {
  const proxy = read('netlify/functions/api-proxy.ts');
  const netlify = read('netlify.toml');

  assert.match(proxy, /pathname === '\/sitemap\.xml'/);
  assert.match(proxy, /return 'sitemap\.xml'/);

  const sitemapRule = netlify.indexOf('from = "/sitemap.xml"');
  const apiRule = netlify.indexOf('from = "/api/*"');
  const spaRule = netlify.indexOf('from = "/*"');
  assert.ok(sitemapRule >= 0 && sitemapRule < apiRule && apiRule < spaRule);
  assert.match(netlify, /to = "\/\.netlify\/functions\/api-proxy\/sitemap\.xml"/);
});

test('ninguna utilidad de autenticación conserva secretos fijos de respaldo', () => {
  const token = read('Backend/src/utils/auth-token.js');
  assert.match(token, /getRequiredEnv\("AUTH_TOKEN_SECRET"\)/);
  assert.doesNotMatch(token, /change-me-in-production|DEFAULT_SECRET/);
});

test('Render exige origen público y comprueba el endpoint real de salud', () => {
  const render = read('render.yaml');
  assert.match(render, /healthCheckPath: \/api\/health/);
  assert.match(render, /key: FRONTEND_URL/);
  assert.match(render, /key: CORS_ORIGIN/);
});

test('los ejemplos de entorno permanecen versionables sin exponer archivos reales', () => {
  const gitignore = read('.gitignore');
  assert.match(gitignore, /^\.env\*$/m);
  assert.match(gitignore, /^!\.env\.example$/m);
  assert.match(gitignore, /^!Backend\/\.env\.example$/m);
});

test('staging usa backend aislado, pagos no reales y un artefacto no indexable', () => {
  const angular = JSON.parse(read('angular.json'));
  const staging = angular.projects['ricosabor-tienda'].architect.build.configurations.staging;
  const replacements = staging.fileReplacements.map(({ replace, with: target }) => `${replace}:${target}`);
  assert.ok(replacements.includes('src/app/core/config/payment.config.ts:src/app/core/config/payment.config.staging.ts'));

  const payments = read('src/app/core/config/payment.config.staging.ts');
  assert.match(payments, /NO REALIZAR PAGOS/);
  assert.doesNotMatch(payments, /\bES\d{22}\b|\+34\d{9}/);

  const render = read('render.yaml');
  assert.match(render, /name: mixsabor-backend-staging/);
  assert.match(render, /key: APP_ENV\s+value: staging/);
  assert.match(render, /key: STAGING_EMAIL_TO/);

  const outputScript = read('scripts/prepare-staging-output.mjs');
  assert.match(outputScript, /noindex,nofollow,noarchive/);
  assert.match(outputScript, /User-agent: \*\\nDisallow: \/\\n/);
  assert.match(outputScript, /X-Robots-Tag: noindex, nofollow, noarchive/);
});
