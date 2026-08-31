import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const rootUrl = new URL('../', import.meta.url);
const read = (path) => readFileSync(new URL(path, rootUrl), 'utf8');
const checkoutSources = () => read('src/app/features/checkout/checkout-page.component.ts') + read('src/app/features/checkout/checkout-page.component.html');

test('checkout A: carga la configuración pública de pagos', () => {
  const checkout = checkoutSources();
  const service = read('src/app/core/services/payment-settings.service.ts');
  assert.match(service, /\/payment-settings/);
  assert.match(checkout, /loadPaymentSettings\(\)/);
  assert.match(checkout, /paymentSettings\.getPublicSettings\(\)/);
});

test('checkout B-C: solo muestra métodos activos y oculta los desactivados', () => {
  const checkout = checkoutSources();
  assert.match(checkout, /settings\.bizum\.enabled/);
  assert.match(checkout, /settings\.bankTransfer\.enabled/);
  assert.match(checkout, /settings\.cash\.enabled/);
  assert.match(checkout, /availablePaymentMethods\(\)/);
});

test('checkout D-E: loading y error de configuración', () => {
  const checkout = checkoutSources();
  assert.match(checkout, /paymentSettingsLoading/);
  assert.match(checkout, /Cargando métodos de pago/);
  assert.match(checkout, /paymentSettingsError/);
  assert.match(checkout, />Reintentar</);
});

test('checkout F: sin métodos disponibles muestra mensaje de negocio', () => {
  const checkout = checkoutSources();
  assert.match(checkout, /Ahora mismo no hay métodos de pago disponibles/);
  assert.match(checkout, /!availablePaymentMethods\(\)\.length/);
});

test('checkout G: una selección inválida se limpia si la config cambia', () => {
  const checkout = checkoutSources();
  assert.match(checkout, /reconcilePaymentMethod\(\)/);
  assert.match(checkout, /available\.some\(\(method\) => method\.value === current\)/);
});

test('checkout H: no depende de payment.config.ts hardcodeado', () => {
  const config = read('src/app/core/config/payment.config.ts');
  const checkout = checkoutSources();
  const orderService = read('src/app/core/services/order.service.ts');
  assert.doesNotMatch(config, /MANUAL_PAYMENT_DETAILS/);
  assert.doesNotMatch(config, /\bES\d{22}\b|\+34\d{9}/);
  assert.doesNotMatch(checkout, /MANUAL_PAYMENT_DETAILS/);
  assert.doesNotMatch(orderService, /MANUAL_PAYMENT_DETAILS/);
  assert.match(config, /PAYMENT_METHOD_META/);
});

test('admin pagos A-H: carga, edición, validación, guardado e indicadores', () => {
  const page = read('src/app/features/admin/admin-payment-settings-page.component.ts');
  const html = read('src/app/features/admin/admin-payment-settings-page.component.html');
  const service = read('src/app/core/services/admin-payment-settings.service.ts');
  const model = read('src/app/core/models/payment-settings.model.ts');
  assert.match(service, /\/admin\/payment-settings/);
  assert.match(page, /loadSettings\(\)/);
  assert.match(html, /form\.bizum\.phone/);
  assert.match(html, /form\.bankTransfer\.holder/);
  assert.match(html, /form\.bankTransfer\.iban/);
  assert.match(html, /form\.bizum\.enabled/);
  assert.match(html, /form\.bankTransfer\.enabled/);
  assert.match(html, /form\.cash\.enabled/);
  assert.match(page, /validate\(\)/);
  assert.match(html, /Guardar cambios/);
  assert.match(page, /updateError/);
  assert.match(html, /bizumStatus\(\)/);
  assert.match(html, /transferStatus\(\)/);
  assert.match(html, /cashStatus\(\)/);
  assert.match(model, /Configurado/);
  assert.match(model, /Incompleto/);
  assert.match(model, /Desactivado/);
  assert.match(model, /Activo/);
});

test('la ruta admin de pagos está protegida', () => {
  const routes = read('src/app/app.routes.ts');
  assert.match(routes, /path: 'admin\/pagos'/);
  assert.match(routes, /admin-payment-settings-page\.component/);
  assert.match(routes, /canActivate: \[adminGuard\]/);
});
