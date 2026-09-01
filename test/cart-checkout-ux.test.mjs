import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import '@angular/compiler';
import * as angular from '@angular/core';

const root = fileURLToPath(new URL('../', import.meta.url));
const read = (path) => readFileSync(resolve(root, path), 'utf8');
const checkoutView = () => read('src/app/features/checkout/checkout-page.component.ts')
  + read('src/app/features/checkout/checkout-page.component.html');
const cartView = () => read('src/app/features/cart/cart-page.component.ts')
  + read('src/app/features/cart/cart-page.component.html')
  + read('src/app/shared/ui/cart-line.component.ts');

function memoryStorage() {
  const data = new Map();
  return {
    getItem(key) { return data.has(key) ? data.get(key) : null; },
    setItem(key, value) { data.set(String(key), String(value)); },
    removeItem(key) { data.delete(key); },
    key(index) { return [...data.keys()][index] ?? null; },
    get length() { return data.size; }
  };
}

function installStorage() {
  globalThis.localStorage = memoryStorage();
  globalThis.sessionStorage = memoryStorage();
  globalThis.addEventListener = () => {};
  globalThis.removeEventListener = () => {};
}

function loader() {
  const cache = new Map();
  function load(path) {
    path = resolve(root, path);
    if (cache.has(path)) return cache.get(path);
    const js = ts.transpileModule(readFileSync(path, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, experimentalDecorators: true }
    }).outputText;
    const module = { exports: {} };
    cache.set(path, module.exports);
    const require = (name) => {
      if (name === '@angular/core') return angular;
      if (name.endsWith('api.config')) return { resolveApiBaseUrl: () => '/api' };
      if (name.endsWith('api-client')) return { ApiRequestError: class extends Error {}, requestJson: () => { throw new Error('Unexpected API'); } };
      if (name.startsWith('.')) {
        const candidate = resolve(dirname(path), name);
        if (name.endsWith('.json')) {
          const parsed = JSON.parse(readFileSync(candidate, 'utf8'));
          return { default: parsed, ...parsed };
        }
        try { return load(candidate.endsWith('.ts') ? candidate : candidate + '.ts'); }
        catch { return load(candidate.replace(/\\/g, '/') + '.ts'); }
      }
      throw new Error('Unmocked ' + name + ' from ' + path);
    };
    new Function('require', 'module', 'exports', js)(require, module, module.exports);
    cache.set(path, module.exports);
    return module.exports;
  }
  return load;
}

installStorage();
const load = loader();
const { ActiveIdentityService, GUEST_IDENTITY } = load('src/app/core/services/active-identity.service.ts');
const { CartService } = load('src/app/core/services/cart.service.ts');
const {
  availableStockForLine,
  cartHasStockConflicts,
  compactCustomizationSummary,
  formatStockConflictMessage,
  isLineBlockingCheckout,
  stockHintForLine,
  tracksInventory
} = load('src/app/core/utils/cart-stock.ts');
const { CouponDraftService } = load('src/app/core/services/coupon.service.ts');
const { CheckoutDraftService } = load('src/app/core/services/checkout-draft.service.ts');

function cart() {
  installStorage();
  const service = new ActiveIdentityService();
  service.activate(GUEST_IDENTITY);
  return new CartService(service);
}

function product(id, extra = {}) {
  return {
    id,
    name: extra.name ?? id,
    description: '',
    price: extra.price ?? 8,
    category: extra.category ?? 'bebidas',
    imageUrl: extra.imageUrl ?? '/beer.jpg',
    available: true,
    published: true,
    trackStock: extra.trackStock ?? false,
    stock: extra.stock ?? 0,
    lowStockAlert: extra.lowStockAlert ?? 5,
    minimumQuantity: extra.minimumQuantity ?? 1,
    unitLabel: extra.unitLabel ?? 'ud',
    customizationOptions: extra.customizationOptions
  };
}

test('A-C: quantity +, - y mínimo 1', () => {
  const service = cart();
  service.add(product('beer'), [], 1);
  assert.equal(service.items()[0].quantity, 1);
  assert.equal(service.increment('beer').applied, true);
  assert.equal(service.items()[0].quantity, 2);
  assert.equal(service.decrement('beer'), true);
  assert.equal(service.items()[0].quantity, 1);
  assert.equal(service.decrement('beer'), false);
  assert.equal(service.items()[0].quantity, 1);
  assert.equal(service.items().length, 1);
});

test('D-E: no supera stock y + queda deshabilitado en el máximo', () => {
  const service = cart();
  service.add(product('beer', { trackStock: true, stock: 5 }), [], 4);
  assert.equal(service.items()[0].quantity, 4);
  assert.equal(service.increment('beer').applied, true);
  assert.equal(service.items()[0].quantity, 5);
  assert.equal(service.canIncrement(service.items()[0]), false);
  assert.equal(service.increment('beer').applied, false);
  assert.equal(service.increment('beer').available, 5);
  assert.equal(service.items()[0].quantity, 5);
});

test('F-G: poco stock y agotado usan el stock real', () => {
  const low = { productId: 'a', quantity: 1, trackStock: true, stock: 3, lowStockAlert: 5 };
  const last = { productId: 'b', quantity: 1, trackStock: true, stock: 2 };
  const out = { productId: 'c', quantity: 1, trackStock: true, stock: 0 };
  assert.equal(stockHintForLine(low, [low]).message, 'Quedan 3 unidades');
  assert.equal(stockHintForLine(last, [last]).message, 'Últimas 2 unidades');
  assert.equal(stockHintForLine(out, [out]).kind, 'out');
  assert.equal(stockHintForLine(out, [out]).message, 'Producto agotado');
});

test('H-J: eliminar, personalización preservada y total reactivo', () => {
  const service = cart();
  const customization = [{ label: 'Bizcocho', value: 'Vainilla', groupKey: 'flavors', optionId: 'vainilla' }];
  service.add(product('cake', { price: 40, category: 'tartas' }), customization, 1);
  service.add(product('beer', { price: 2 }), [], 2);
  assert.equal(service.items().length, 2);
  assert.deepEqual(service.items()[0].customization, customization);
  const before = service.subtotal();
  service.remove('beer');
  assert.equal(service.items().length, 1);
  assert.equal(service.items()[0].customization[0].value, 'Vainilla');
  assert.ok(service.subtotal() < before);
  service.increment(service.items()[0].productId);
  assert.equal(service.items()[0].quantity, 2);
  assert.equal(service.items()[0].customization[0].value, 'Vainilla');
});

test('K-N: checkout resume el mismo CartService y el payload usa la quantity actual', () => {
  const checkout = checkoutView();
  const orderService = read('src/app/core/services/order.service.ts');
  assert.match(checkout, /<app-cart-line/);
  assert.match(checkout, /mode="summary"/);
  assert.match(orderService, /items: this\.cartService\.items\(\)/);
  const service = cart();
  service.add(product('beer', { price: 10 }), [], 1);
  assert.equal(service.items()[0].quantity, 1);
  service.increment('beer');
  assert.equal(service.items()[0].quantity, 2);
  assert.equal(service.subtotal(), 20);
});

test('O-P: el checkout vacío no renderiza el formulario', () => {
  const checkout = checkoutView();
  const cartPage = cartView();
  assert.doesNotMatch(checkout, /onSummaryRemoved/);
  assert.match(checkout, /!orderId\(\) && !cart\.items\(\)\.length/);
  assert.match(checkout, /Tu carrito está vacío/);
  assert.match(checkout, /Volver a productos/);
  assert.match(cartPage, /Tu carrito está vacío/);
  assert.match(cartPage, /Ver productos/);
  const service = cart();
  service.add(product('beer'), [], 1);
  service.remove('beer');
  assert.equal(service.items().length, 0);
});

test('Q-V: stock bloquea confirmación, unlimited y personalizado no inventan inventario', () => {
  const tracked = { productId: 'a', quantity: 4, trackStock: true, stock: 2 };
  const unlimited = { productId: 'b', quantity: 8, trackStock: false, stock: 0 };
  const custom = { productId: 'cake::x', baseProductId: 'cake', quantity: 1, trackStock: false, customization: [{ label: 'Relleno', value: 'Guayaba' }] };
  assert.equal(isLineBlockingCheckout(tracked, [tracked]), true);
  assert.equal(cartHasStockConflicts([tracked, unlimited]), true);
  assert.equal(tracksInventory(unlimited), false);
  assert.equal(isLineBlockingCheckout(unlimited, [unlimited]), false);
  assert.equal(stockHintForLine(unlimited, [unlimited]).kind, 'none');
  assert.equal(tracksInventory(custom), false);
  assert.equal(stockHintForLine(custom, [custom]).message, '');
  const checkout = checkoutView();
  assert.match(checkout, /hasBlockingStock\(\)/);
  assert.match(checkout, /submitDisabled\(\)/);
  assert.match(checkout, /La disponibilidad de tu pedido ha cambiado/);
  assert.match(checkout, /ORDER_STOCK_CONFLICT/);
  assert.match(checkout, /applyRemoteStock/);
  assert.equal(formatStockConflictMessage({ productName: 'Cerveza Palma Cristal', requested: 4, available: 2 }), 'Ya no quedan 4 unidades de Cerveza Palma Cristal. Disponibles: 2.');
});

test('A: el carrito permite +/−', () => {
  const cartPage = cartView();
  assert.match(cartPage, /mode="cart"/);
  assert.match(cartPage, /qty-btn/);
  assert.match(cartPage, /aria-label\]="'Reducir cantidad de ' \+ item\(\)\.name"/);
  assert.match(cartPage, /aria-label\]="'Aumentar cantidad de ' \+ item\(\)\.name"/);
  const service = cart();
  service.add(product('beer'), [], 1);
  assert.equal(service.increment('beer').applied, true);
  assert.equal(service.items()[0].quantity, 2);
});

test('papelera sustituye Eliminar de línea y mantiene el toast', () => {
  const line = read('src/app/shared/ui/cart-line.component.ts');
  const icon = read('src/app/shared/ui/icon.component.ts');
  const checkout = checkoutView();
  assert.match(icon, /aria-hidden="true"/);
  assert.match(line, /name="trash"/);
  assert.match(line, /aria-label="Eliminar producto"/);
  assert.match(line, /title="Eliminar producto"/);
  assert.match(line, /type="button"/);
  assert.match(line, /\(click\)="remove\(\)"/);
  assert.match(line, /removed\.emit\(item\)/);
  assert.match(cartView(), /onRemoved\(\$event\)/);
  assert.doesNotMatch(line, /remove-label/);
  assert.doesNotMatch(line, />Eliminar</);
  assert.match(checkout, /\[disabled\]="submitDisabled\(\)"/);
  assert.match(checkout, /\[attr\.aria-busy\]="loading\(\)"/);
  assert.match(checkout, /Confirmar pedido/);
  assert.match(checkout, /Procesando…/);
});

test('B-C: checkout no muestra +/− y sí muestra cantidad', () => {
  const checkout = checkoutView();
  const line = read('src/app/shared/ui/cart-line.component.ts');
  assert.match(checkout, /mode="summary"/);
  assert.doesNotMatch(checkout, /mode="cart"/);
  assert.doesNotMatch(checkout, /qty-btn|Aumentar cantidad|Reducir cantidad/);
  assert.match(line, /isSummary\(\)/);
  assert.match(line, /Cantidad: ' \+ item\(\)\.quantity/);
  assert.match(line, /qty-readout/);
  assert.match(line, /item\(\)\.quantity \}\} × \{\{ item\(\)\.unitPrice/);
});

test('D: Editar pedido vuelve a /carrito', () => {
  const checkout = checkoutView();
  assert.match(checkout, /routerLink="\/carrito"/);
  assert.match(checkout, /← Editar pedido/);
  assert.match(checkout, />Editar pedido</);
  assert.doesNotMatch(checkout, /path: 'checkout\/2'|stepper|paso 2/i);
});

test('E-F: cupón editable solo en carrito; checkout muestra el ya aplicado', () => {
  const checkout = checkoutView();
  const cartPage = cartView();
  assert.match(cartPage, /Código de descuento/);
  assert.match(cartPage, />Aplicar</);
  assert.match(cartPage, />Quitar</);
  assert.doesNotMatch(checkout, /Código de descuento/);
  assert.doesNotMatch(checkout, />Aplicar</);
  assert.doesNotMatch(checkout, /applyCouponWithFeedback/);
  assert.match(checkout, /Cupón \{\{ coupon\.code\(\) \}\}/);
  assert.match(checkout, /couponDiscountPreview\(\)/);
});

test('G-I: stock normal no genera ruido; conflicto bloquea y permite ajustar', () => {
  const checkout = checkoutView();
  const line = read('src/app/shared/ui/cart-line.component.ts');
  assert.match(line, /if \(this\.isSummary\(\)\)/);
  assert.match(line, /kind === 'out'/);
  assert.match(line, /kind === 'conflict'/);
  assert.match(line, /this\.cart\.stockHint\(item\)\.message/);
  assert.match(line, /canAdjust\(\)/);
  assert.match(line, /adjustToAvailable/);
  assert.match(checkout, /submitDisabled\(\)/);
  assert.match(checkout, /hasBlockingStock\(\)/);
  const quiet = { productId: 'a', quantity: 1, trackStock: true, stock: 20, lowStockAlert: 5 };
  assert.equal(stockHintForLine(quiet, [quiet]).kind, 'none');
});

test('J-K: empty carrito y checkout', () => {
  const checkout = checkoutView();
  const cartPage = read('src/app/features/cart/cart-page.component.html');
  assert.match(cartPage, /Tu carrito está vacío/);
  assert.match(cartPage, />Ver productos</);
  assert.match(checkout, /Tu carrito está vacío/);
  assert.match(checkout, /Volver a productos/);
  assert.match(checkout, /!orderId\(\) && !cart\.items\(\)\.length/);
});

test('L: estado de cupón, draft y carrito se conserva al navegar', () => {
  installStorage();
  const identity = new ActiveIdentityService();
  identity.activate(GUEST_IDENTITY);
  const coupon = new CouponDraftService(identity);
  const draft = new CheckoutDraftService(identity);
  const service = new CartService(identity);
  service.add(product('beer', { price: 10 }), [], 2);
  coupon.setCode('PRIMER10');
  assert.equal(coupon.apply().valid, true);
  draft.save({ fullName: 'Ana Pérez', phoneNumber: '644423790' });
  assert.equal(coupon.code(), 'PRIMER10');
  assert.equal(coupon.applied(), true);
  assert.equal(coupon.discount(50), 5);
  assert.equal(draft.snapshot().fullName, 'Ana Pérez');
  assert.equal(service.items()[0].quantity, 2);
  const checkout = checkoutView();
  assert.match(checkout, /persistCheckoutState\(\)/);
  assert.match(checkout, /checkoutDraft\.save/);
  assert.match(checkout, /coupon\.applied\(\)/);
  assert.match(read('src/app/core/services/customer-auth.service.ts'), /adoptGuestCoupon\(\)/);
  assert.match(read('src/app/core/services/customer-auth.service.ts'), /adoptGuestDraft\(\)/);
});

test('W: checkout es una página de finalizar, no un carrito duplicado', () => {
  const checkout = checkoutView();
  const cartPage = read('src/app/features/cart/cart-page.component.html');
  assert.match(checkout, /Finaliza tu pedido/);
  assert.match(checkout, />Contacto</);
  assert.match(checkout, />Entrega</);
  assert.match(checkout, />Pago</);
  assert.match(checkout, /Domicilio/);
  assert.match(checkout, /Recogida/);
  assert.match(checkout, /\[attr\.min\]="minimumDeliveryDate\(\) \|\| null"/);
  assert.match(checkout, /paymentMethod/);
  assert.match(checkout, /Confirmar pedido/);
  assert.match(checkout, /Procesando…/);
  assert.match(checkout, /submitDisabled\(\)/);
  assert.match(checkout, /if \(this\.loading\(\)\) return/);
  assert.match(checkout, /No hemos podido enviar tu pedido/);
  assert.match(checkout, /routerLink="\/productos"/);
  assert.match(cartPage, /routerLink="\/checkout"/);
  assert.match(cartPage, /Continuar/);
  assert.doesNotMatch(checkout, /path: 'checkout\/2'|stepper|paso 2/i);
});

test('personalizaciones: carrito completo y checkout compacto', () => {
  const item = {
    customization: [
      { label: 'Tamaño', value: 'Mediana · 20 cm · 10–12 porciones' },
      { label: 'Bizcocho', value: 'Vainilla' },
      { label: 'Relleno', value: 'Guayaba' },
      { label: 'Cobertura', value: 'Merengue italiano' }
    ]
  };
  assert.equal(compactCustomizationSummary(item), 'Mediana · 20 cm · 10–12 porciones · Vainilla · Guayaba · Merengue italiano');
  const cartPage = cartView();
  assert.match(cartPage, /option\.label/);
  assert.match(cartPage, /compactSummary\(\)/);
});

test('el carrito persiste miniatura y stock del producto sin una API extra', () => {
  const service = cart();
  service.add(product('beer', { trackStock: true, stock: 6, imageUrl: '/p.jpg' }), [], 4);
  const item = service.items()[0];
  assert.equal(item.imageUrl, '/p.jpg');
  assert.equal(item.trackStock, true);
  assert.equal(item.stock, 6);
  assert.equal(item.quantity, 4);
  service.syncInventory([product('beer', { trackStock: true, stock: 2, imageUrl: '/p.jpg', name: 'Cerveza' })]);
  assert.equal(service.items()[0].stock, 2);
  assert.equal(service.items()[0].quantity, 4);
  assert.equal(stockHintForLine(service.items()[0], service.items()).kind, 'conflict');
  assert.equal(service.adjustToAvailable('beer'), true);
  assert.equal(service.items()[0].quantity, 2);
});

test('availableStockForLine agrega otras líneas del mismo producto base', () => {
  const a = { productId: 'p::x', baseProductId: 'p', quantity: 2, trackStock: true, stock: 5 };
  const b = { productId: 'p::y', baseProductId: 'p', quantity: 2, trackStock: true, stock: 5 };
  assert.equal(availableStockForLine(a, [a, b]), 3);
  assert.equal(availableStockForLine(b, [a, b]), 3);
});

test('hotfix visual: Pago continua el fondo de checkout y el carrito no infla altura', () => {
  const checkoutCss = read('src/app/features/checkout/checkout-page.component.css');
  const cartCss = read('src/app/features/cart/cart-page.component.css');
  const styles = read('src/styles.scss');
  const app = read('src/app/app.component.ts');
  assert.match(styles, /:root\[data-theme='light'\][\s\S]*color-scheme:\s*light/);
  assert.match(checkoutCss, /\.form-section[\s\S]*background:\s*transparent/);
  assert.match(checkoutCss, /\.payment-fieldset[\s\S]*color-scheme:\s*inherit/);
  assert.match(checkoutCss, /\.consent-check a \{ color: var\(--accent-green\)/);
  assert.doesNotMatch(checkoutCss, /background:\s*#111827|background:\s*var\(--bg-elevated\)/);
  assert.doesNotMatch(app, /100vh - 150px/);
  assert.match(app, /\.main-layout\{width:100%;min-height:0\}/);
  assert.match(app, /\.page-content\{[^}]*flex:1/);
  assert.doesNotMatch(cartCss, /min-height:\s*calc\(100vh/);
  assert.match(cartCss, /padding-bottom: 2\.4rem/);
});

test('W-Y: reserva de pago en confirmación, admin y catálogo', () => {
  const checkout = checkoutView();
  const admin = read('src/app/features/admin/admin-page.component.ts');
  const catalog = read('src/app/core/services/catalog.service.ts');
  const rules = read('Backend/src/config/order-rules.json');
  assert.match(rules, /"paymentReservationMinutes": 120/);
  assert.match(checkout, /Tu pedido está reservado durante/);
  assert.match(checkout, /paymentExpiresAt/);
  assert.match(checkout, /catalog\.invalidate\(\)/);
  assert.doesNotMatch(checkout, /2 \* 60 \* 60 \* 1000/);
  assert.match(admin, /Reserva hasta/);
  assert.match(admin, /pago no recibido dentro del plazo/);
  assert.match(catalog, /invalidate\(\): void/);
  assert.match(catalog, /refreshAvailability/);
});
