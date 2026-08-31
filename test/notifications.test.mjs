import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import test, { beforeEach } from 'node:test';
import ts from 'typescript';
import '@angular/compiler';
import * as angular from '@angular/core';
import * as sonner from 'ngx-sonner';

const root = fileURLToPath(new URL('../', import.meta.url));
const cache = new Map();
// Execute real TS services and component methods, mocking only page dependencies.
function load(path, page = false) {
  path = resolve(root, path);
  if (!page && cache.has(path)) return cache.get(path);
  const source = readFileSync(path, 'utf8');
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, experimentalDecorators: true } }).outputText;
  const module = { exports: {} };
  const require = name => {
    if (name === '@angular/core') return { ...angular, Component: () => target => target };
    if (name === 'ngx-sonner') return sonner;
    if (name.endsWith('customer-auth.service')) return { CustomerAuthService: class {} };
    if (name.endsWith('user-friendly-error') || name.endsWith('notification.config')) return load(resolve(dirname(path), name + '.ts'));
    if (page) return {};
    throw new Error('Unmocked import: ' + name);
  };
  new Function('require', 'module', 'exports', js)(require, module, module.exports);
  if (!page) cache.set(path, module.exports);
  return module.exports;
}
const { NotificationService } = load('src/app/core/services/notification.service.ts');
const { ConfirmDialogService } = load('src/app/core/services/confirm-dialog.service.ts');
const { ConfirmDialogComponent } = load('src/app/shared/ui/confirm-dialog.component.ts', true);
const { getUserFriendlyError } = load('src/app/core/utils/user-friendly-error.ts');
const { AdminPageComponent } = load('src/app/features/admin/admin-page.component.ts', true);
const { AdminProductsPageComponent } = load('src/app/features/admin/admin-products-page.component.ts', true);
const { CheckoutPageComponent } = load('src/app/features/checkout/checkout-page.component.ts', true);
const notifications = new NotificationService();
// Focus unit tests on adapter behavior; browser QA exercises actual lazy loading.
notifications.dispatch = operation => operation(sonner);
beforeEach(() => notifications.dismissAll());

test('cupón: solo el botón Aplicar emite actividad; la validación automática permanece silenciosa', () => {
  const component = Object.create(CheckoutPageComponent.prototype);
  const code = { value: '', setValue(value) { this.value = value; } };
  component.form = { controls: { couponCode: code } };
  component.couponPreviewValid = angular.signal(false);
  component.couponPreviewMessage = angular.signal('');
  const calls = [];
  component.notifications = { success: (...args) => calls.push(['success', ...args]), warning: (...args) => calls.push(['warning', ...args]) };
  component.applyCouponWithFeedback();
  assert.equal(calls.length, 0);
  code.value = ' primer10 ';
  component.applyCouponWithFeedback();
  assert.equal(calls[0][0], 'success');
  assert.equal(calls[0][3].saveToHistory, true);
  assert.match(calls[0][3].history.message, /Pendiente/);
  component.applyCouponPreview();
  assert.equal(calls.length, 1);
  code.value = 'INVALIDO';
  component.applyCouponWithFeedback();
  assert.equal(calls[1][0], 'warning');
  assert.equal(calls[1][3].saveToHistory, true);
});

test('carga diferida aplica loading → success → dismiss en orden', async () => {
  const service = new NotificationService();
  const id = service.loading('Procesando');
  service.updateSuccess(id, 'Terminado');
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(sonner.toastState.toasts().length, 1);
  assert.equal(sonner.toastState.toasts()[0].type, 'success');
  service.dismiss(id);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(sonner.toastState.toasts().length, 0);
});

for (const [type, duration] of Object.entries({ success: 3500, error: 7000, warning: 5500, info: 4000, loading: Infinity })) {
  test(`NotificationService ${type}: contenido, duración y prioridad`, () => {
    const id = notifications[type]('Título', 'Descripción');
    const item = sonner.toastState.toasts()[0];
    assert.equal(item.id, id);
    assert.equal(item.title, 'Título');
    assert.equal(item.description, 'Descripción');
    assert.equal(item.type, type);
    assert.equal(item.duration, duration);
    assert.equal(item.important, type === 'error');
    assert.equal(item.dismissible, type !== 'loading');
  });
}

test('IDs, claves y contenido deduplican sin conservar un registro paralelo', () => {
  const id = notifications.success('Añadido');
  for (let i = 0; i < 8; i++) assert.equal(notifications.success('Añadido'), id);
  assert.equal(sonner.toastState.toasts().length, 1);
  notifications.info('Primero', '', { key: 'cart' });
  notifications.info('Segundo', '', { key: 'cart', duration: 12000 });
  assert.equal(sonner.toastState.toasts().length, 2);
  assert.equal(sonner.toastState.toasts()[0].title, 'Segundo');
  assert.equal(sonner.toastState.toasts()[0].duration, 12000);
});

test('loading persistente repetido no activa el timer de actualización infinito de Sonner', () => {
  const id = notifications.loading('Guardando', '', { key: 'save' });
  notifications.loading('Guardando', '', { key: 'save' });
  assert.equal(sonner.toastState.toasts()[0].updated, undefined);
  notifications.updateSuccess(id, 'Guardado');
  notifications.loading('Guardando', '', { key: 'save' });
  assert.equal(sonner.toastState.toasts()[0].updated, undefined);
  assert.equal(sonner.toastState.toasts()[0].duration, Infinity);
});

test('updateSuccess/updateError resuelven el mismo toast y restablecen opciones', () => {
  const id = notifications.loading('Procesando');
  notifications.updateSuccess(id, 'Pedido realizado', 'Listo');
  assert.equal(sonner.toastState.toasts().length, 1);
  assert.equal(sonner.toastState.toasts()[0].duration, 3500);
  assert.equal(sonner.toastState.toasts()[0].dismissible, true);
  notifications.updateError(id, 'Error', 'Reintenta');
  const item = sonner.toastState.toasts()[0];
  assert.equal(item.id, id);
  assert.equal(item.type, 'error');
  assert.equal(item.duration, 7000);
  assert.equal(item.description, 'Reintenta');
});

test('dismiss y dismissAll retiran los avisos', () => {
  const id = notifications.info('Uno');
  notifications.info('Dos');
  notifications.dismiss(id);
  assert.equal(sonner.toastState.toasts().length, 1);
  notifications.dismissAll();
  assert.equal(sonner.toastState.toasts().length, 0);
});

test('acciones ejecutan su handler y normalizan rechazos', async () => {
  let called = 0;
  notifications.success('Añadido', '', { action: { label: 'Ver carrito', handler: () => { called++; } } });
  sonner.toastState.toasts()[0].action.onClick();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(called, 1);
  notifications.error('Error', '', { action: { label: 'Reintentar', handler: async () => { throw new Error('MongoServerError'); } } });
  sonner.toastState.toasts()[0].action.onClick();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(sonner.toastState.toasts()[0].description, getUserFriendlyError(null));
});

test('ConfirmDialog abre, confirma, cancela y no encola operaciones destructivas', async () => {
  const service = new ConfirmDialogService();
  const pending = service.open({ title: 'Eliminar producto', message: 'Irreversible', variant: 'danger' });
  assert.equal(service.current().variant, 'danger');
  assert.equal(service.current().cancelText, 'Cancelar');
  assert.equal(await service.open({ title: 'Otro', message: '' }), false);
  service.close(true);
  assert.equal(await pending, true);
  assert.equal(service.current(), null);
  const cancelled = service.open({ title: 'Cancelar', message: '' });
  service.close();
  service.close(true);
  assert.equal(await cancelled, false);
});

test('ConfirmDialog Escape respeta closeOnEscape y cancelar resuelve false', async () => {
  const component = Object.create(ConfirmDialogComponent.prototype);
  component.dialogs = new ConfirmDialogService();
  component.closeElement = () => {};
  let prevented = false;
  const pending = component.dialogs.open({ title: 'Eliminar', message: '', closeOnEscape: false });
  component.onCancel({ preventDefault() { prevented = true; } });
  assert.equal(prevented, true);
  assert.notEqual(component.dialogs.current(), null);
  component.finish(false);
  assert.equal(await pending, false);
  const escapable = component.dialogs.open({ title: 'Eliminar', message: '' });
  component.trapFocus({ key: 'Escape', stopPropagation() {}, preventDefault() {} });
  assert.equal(await escapable, false);
});

test('ConfirmDialog Tab/Shift+Tab contienen el foco y cerrar restaura scroll/foco', () => {
  const component = Object.create(ConfirmDialogComponent.prototype);
  const doc = { activeElement: null, body: { style: { overflow: 'hidden' } }, documentElement: { style: { overflow: 'hidden' } } };
  const first = { focus() { doc.activeElement = first; } };
  const last = { focus() { doc.activeElement = last; } };
  const element = { open: true, close() { this.open = false; }, querySelectorAll: () => [first, last] };
  component.document = doc;
  component.dialog = () => ({ nativeElement: element });
  doc.activeElement = first;
  component.trapFocus({ key: 'Tab', shiftKey: true, preventDefault() {} });
  assert.equal(doc.activeElement, last);
  component.trapFocus({ key: 'Tab', shiftKey: false, preventDefault() {} });
  assert.equal(doc.activeElement, first);
  component.previousOverflow = { body: 'auto', root: '' };
  component.returnFocus = { isConnected: true, focus() { doc.activeElement = 'trigger'; } };
  component.closeElement();
  assert.equal(element.open, false);
  assert.equal(doc.body.style.overflow, 'auto');
  assert.equal(doc.documentElement.style.overflow, '');
  assert.equal(doc.activeElement, 'trigger');
});

for (const [status, expected] of [[401, /sesión/], [403, /permisos/], [409, /conflicto/], [500, /Inténtalo/], [0, /conexión/]]) {
  test(`normaliza HTTP ${status}`, () => assert.match(getUserFriendlyError({ status }), expected));
}
test('preserva stock/validación y oculta errores técnicos, HTML y objetos', () => {
  assert.equal(getUserFriendlyError('Agotado'), 'Agotado');
  assert.equal(getUserFriendlyError({ status: 409, message: 'Stock insuficiente: quedan 2 unidades.' }), 'Stock insuficiente: quedan 2 unidades.');
  assert.equal(getUserFriendlyError({ status: 400, error: { message: 'El email ya existe.' } }), 'El email ya existe.');
  for (const message of ['MongoServerError: E11000', 'ECONNRESET', 'Unexpected token <', '500 Internal Server Error', '<html>Error</html>', 'Error backendapi', 'Backend API (guest)', 'No se pudo enviar el pedido por Netlify Function.']) assert.equal(getUserFriendlyError(new Error(message)), getUserFriendlyError(null));
});

test('cancelar eliminación de producto no llama al backend; confirmar notifica éxito', async () => {
  const component = Object.create(AdminProductsPageComponent.prototype);
  component.notifications = notifications;
  let calls = 0;
  component.adminProducts = { async deleteProduct() { calls++; } };
  component.loadProducts = async () => {};
  component.confirmDialog = { open: async () => false };
  await component.removeProduct({ _id: '1', name: 'Producto' });
  assert.equal(calls, 0);
  component.confirmDialog.open = async () => true;
  await component.removeProduct({ _id: '1', name: 'Producto' });
  assert.equal(calls, 1);
  assert.equal(sonner.toastState.toasts()[0].type, 'success');
});

test('categoría con productos conserva la protección y no abre confirmación', async () => {
  const component = Object.create(AdminProductsPageComponent.prototype);
  component.deletingCategory = angular.signal(false);
  component.notifications = notifications;
  component.confirmDialog = { open() { assert.fail('No debe abrir confirmación'); } };
  component.productCategories = { deleteCategory() { assert.fail('No debe borrar'); } };
  await component.requestCategoryDeletion({ _id: '1', productCount: 2 });
  assert.equal(sonner.toastState.toasts()[0].type, 'warning');
  assert.match(sonner.toastState.toasts()[0].description, /2 productos asociados/);
});

test('guardar producto conserva el formulario al fallar y libera el estado ocupado', async () => {
  const component = Object.create(AdminProductsPageComponent.prototype);
  component.savingProduct = angular.signal(false);
  component.editId = angular.signal('product-1');
  component.notifications = notifications;
  component.form = { name: 'Producto', price: 20, stock: 2 };
  component.markStepAttempted = () => {};
  component.isStepValid = () => true;
  component.normalizedFormPayload = () => component.form;
  component.resetForm = () => assert.fail('No debe limpiar el formulario');
  component.adminProducts = { async updateProduct(id, payload) {
    assert.equal(id, 'product-1');
    assert.deepEqual(payload, { name: 'Producto', price: 20, stock: 2 });
    throw new Error('ECONNRESET');
  } };
  await component.saveProduct();
  assert.equal(component.savingProduct(), false);
  assert.equal(component.form.name, 'Producto');
  assert.equal(sonner.toastState.toasts().length, 1);
  assert.equal(sonner.toastState.toasts()[0].type, 'error');
});

test('pedido: cancelar no borra y fallo confirmado conserva los datos', async () => {
  const component = Object.create(AdminPageComponent.prototype);
  component.notifications = notifications;
  component.orders = angular.signal([{ orderId: '1' }]);
  let calls = 0;
  component.adminOrders = { async deleteOrder() { calls++; throw new Error('ECONNRESET'); } };
  component.confirmDialog = { open: async () => false };
  await component.deleteOrder('1');
  assert.equal(calls, 0);
  component.confirmDialog.open = async () => true;
  await component.deleteOrder('1');
  assert.equal(calls, 1);
  assert.equal(component.orders().length, 1);
  assert.equal(sonner.toastState.toasts()[0].type, 'error');
});

test('cancelar un pedido requiere confirmación y conserva argumentos del contrato', async () => {
  const component = Object.create(AdminPageComponent.prototype);
  component.notifications = notifications;
  let args;
  component.adminOrders = { async updateStatus(...values) { args = values; return { notifications: { email: { sent: true } } }; } };
  component.loadOrders = async () => {};
  component.confirmDialog = { open: async () => false };
  await component.updateStatus('1', 'cancelado', 'nota', 'firma');
  assert.equal(args, undefined);
  component.confirmDialog.open = async () => true;
  await component.updateStatus('1', 'cancelado', 'nota', 'firma');
  assert.deepEqual(args, ['1', 'cancelado', 'nota', 'firma']);
});

test('checkbox de pago conserva el estado si se cancela la confirmación', async () => {
  const component = Object.create(AdminPageComponent.prototype);
  component.confirmDialog = { open: async () => false };
  component.adminOrders = { updatePayment() { assert.fail('No debe actualizarse'); } };
  const input = { checked: false };
  component.onPaymentChange({ payment: { status: 'paid' } }, { target: input }, '');
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(input.checked, true);
});

test('checkout mantiene carrito/intención al fallar y resuelve un solo toast', async () => {
  const component = Object.create(CheckoutPageComponent.prototype);
  for (const key of ['loading', 'orderId', 'destination', 'isLocalDraft', 'notificationWarning']) component[key] = angular.signal(key === 'loading' ? false : '');
  component.notifications = notifications;
  component.form = { markAllAsTouched() {}, value: { deliveryDate: '2026-09-01', deliverySlot: '10:00' }, controls: { deliveryType: { value: 'pickup' }, paymentMethod: { value: 'bizum' } }, invalid: false, getRawValue: () => ({}) };
  component.cart = { items: () => [{}], clear() { assert.fail('No debe vaciar carrito'); } };
  for (const method of ['updateAddressValidation', 'reconcileDeliverySlot', 'validateDeliverySelection', 'sanitizePhoneDigits', 'sanitizePostalCode', 'applyCouponPreview', 'reconcilePaymentMethod']) component[method] = () => {};
  component.requiresAdvancePayment = () => false;
  component.paymentSettingsLoading = () => false;
  component.paymentSettingsError = () => '';
  component.availablePaymentMethods = () => [{ value: 'bizum' }];
  component.shippingQuote = () => ({ available: true });
  component.orderService = { createPayload: () => ({}), async submitOrder() { throw new Error('Stock insuficiente.'); }, completeOrderIntent() { assert.fail('No debe limpiar intención'); } };
  component.identity = { session: () => '1:guest', isCurrent: () => true };
  await component.submit();
  assert.equal(component.loading(), false);
  assert.equal(sonner.toastState.toasts().length, 1);
  assert.equal(sonner.toastState.toasts()[0].description, 'Stock insuficiente.');
  assert.equal(sonner.toastState.toasts()[0].type, 'error');
});

test('frontend sin APIs nativas ni imports de Sonner fuera de su servicio/host', () => {
  for (const file of readdirSync(resolve(root, 'src'), { recursive: true }).filter(file => /\.(ts|html)$/.test(file))) {
    const content = readFileSync(resolve(root, 'src', file), 'utf8');
    assert.doesNotMatch(content, /\b(?:alert|confirm|prompt)\s*\(/, file);
    if (!/notification(?:s\.component|\.service)\.ts$/.test(file)) assert.doesNotMatch(content, /from ['"]ngx-sonner['"]/, file);
  }
});
