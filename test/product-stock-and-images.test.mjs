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
      if (name === '@angular/core') return {
        ...angular,
        afterNextRender: (fn) => fn()
      };
      if (name === '@angular/common') return { CommonModule: class {}, CurrencyPipe: class {} };
      if (name === '@angular/router') return { ActivatedRoute: class {}, RouterLink: class {}, Router: class {} };
      if (name.endsWith('add-to-cart-button.component')) return { AddToCartButtonComponent: class {}, AddToCartAction: undefined };
      if (name.endsWith('product-card.component')) return { ProductCardComponent: class {} };
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
const { ProductDetailPageComponent } = load('src/app/features/catalog/product-detail-page.component.ts');
const { CartService } = load('src/app/core/services/cart.service.ts');
const { ActiveIdentityService, GUEST_IDENTITY } = load('src/app/core/services/active-identity.service.ts');
const {
  evaluateLiveAddToCart,
  maxAddableQuantity,
  stockHintForProduct,
  stockHintForLine,
  cartHasStockConflicts,
  isLineBlockingCheckout
} = load('src/app/core/utils/cart-stock.ts');

function cart() {
  installStorage();
  const identity = new ActiveIdentityService();
  identity.activate(GUEST_IDENTITY);
  return new CartService(identity);
}

function product(id, extra = {}) {
  return {
    id,
    name: extra.name ?? id,
    description: '',
    price: extra.price ?? 8,
    category: extra.category ?? 'bebidas',
    imageUrl: extra.imageUrl ?? '/beer.jpg',
    available: extra.available ?? true,
    published: extra.published ?? true,
    trackStock: extra.trackStock ?? false,
    stock: extra.stock ?? 0,
    lowStockAlert: extra.lowStockAlert ?? 5,
    minimumQuantity: extra.minimumQuantity ?? 1
  };
}

function pageFor(item, service = cart()) {
  const page = Object.create(ProductDetailPageComponent.prototype);
  page.selectedCustomization = angular.signal({});
  page.customizationError = angular.signal('');
  page.quantity = angular.signal(1);
  page.expandedGroupKeys = angular.signal([]);
  page.optionPreviewLimit = 8;
  page.cart = service;
  page.notifications = { success() {}, warning() {} };
  page.router = { navigateByUrl() {} };
  page.injector = {};
  page.product = angular.signal(item);
  return page;
}

test('A-B: detalle stock 3 limita quantity y deshabilita +', () => {
  const item = product('beer', { trackStock: true, stock: 3 });
  const page = pageFor(item);
  assert.equal(page.maxQuantity(item), 3);
  page.setQuantity(20);
  assert.equal(page.quantity(), 3);
  assert.equal(page.canIncrease(item), false);
  page.setQuantity(2);
  assert.equal(page.canIncrease(item), true);
  page.adjustQuantity(1);
  assert.equal(page.quantity(), 3);
  assert.equal(page.canIncrease(item), false);
});

test('C: stock 0 bloquea añadir y muestra Producto agotado', () => {
  const item = product('beer', { trackStock: true, stock: 0 });
  const page = pageFor(item);
  assert.equal(page.isOrderable(item), false);
  assert.equal(page.canAdd(item), false);
  assert.equal(page.canIncrease(item), false);
  assert.equal(page.stockHint(item).message, 'Producto agotado');
  assert.equal(page.addToCart(item), false);
});

test('D: trackStock false no limita por inventario ni muestra Quedan X', () => {
  const item = product('cake', { trackStock: false, stock: 0, category: 'tartas' });
  const page = pageFor(item);
  assert.equal(page.maxQuantity(item), 99);
  page.setQuantity(20);
  assert.equal(page.quantity(), 20);
  assert.equal(page.canIncrease(item), true);
  assert.equal(page.stockHint(item).kind, 'none');
  assert.equal(stockHintForProduct(item).message, '');
});

test('E: low stock reutiliza los umbrales del carrito', () => {
  const last = product('beer', { trackStock: true, stock: 1 });
  const two = product('beer', { trackStock: true, stock: 2 });
  const three = product('beer', { trackStock: true, stock: 3, lowStockAlert: 5 });
  assert.equal(stockHintForProduct(last).message, 'Última unidad');
  assert.equal(stockHintForProduct(two).message, 'Últimas 2 unidades');
  assert.equal(stockHintForProduct(three).message, 'Quedan 3 unidades');
});

test('F: stock fresco menor capar add-to-cart y avisa', () => {
  const result = evaluateLiveAddToCart(product('beer', { trackStock: true, stock: 1 }), 3);
  assert.equal(result.allowed, true);
  assert.equal(result.quantity, 1);
  assert.equal(result.kind, 'limited');
  assert.equal(result.message, 'Solo quedan 1 unidades disponibles.');
});

test('G: carrito ya tiene 2 / stock 3 → solo 1 adicional', () => {
  const item = product('beer', { trackStock: true, stock: 3 });
  const service = cart();
  service.add(item, [], 2);
  const page = pageFor(item, service);
  assert.equal(page.maxQuantity(item), 1);
  page.setQuantity(2);
  assert.equal(page.quantity(), 1);
  const evaluation = evaluateLiveAddToCart(item, 2, service.items());
  assert.equal(evaluation.quantity, 1);
  assert.equal(evaluation.kind, 'limited');
  assert.equal(evaluation.message, 'Solo quedan 3 unidades disponibles.');
  assert.equal(page.addToCart(item, 2), true);
  assert.equal(service.items()[0].quantity, 3);
});

test('H: varias configuraciones suman contra el mismo stock', () => {
  const item = product('beer', { trackStock: true, stock: 3 });
  const service = cart();
  service.add(item, [{ label: 'Pack', value: 'A', groupKey: 'pack', optionId: 'a' }], 2);
  service.add(item, [{ label: 'Pack', value: 'B', groupKey: 'pack', optionId: 'b' }], 2);
  assert.equal(service.items().length, 2);
  assert.equal(service.items().reduce((sum, line) => sum + line.quantity, 0), 3);
  assert.equal(maxAddableQuantity(item, service.items()), 0);
  const evaluation = evaluateLiveAddToCart(item, 1, service.items());
  assert.equal(evaluation.allowed, false);
  assert.equal(evaluation.kind, 'limited');
});

test('I-M: cards y detalle usan contain, aspect-ratio y fondo token', () => {
  const card = read('src/app/shared/ui/product-card.component.ts');
  const detailCss = read('src/app/features/catalog/product-detail-page.component.css');
  const line = read('src/app/shared/ui/cart-line.component.ts');
  assert.match(card, /\.product-image\s*\{[^}]*aspect-ratio:\s*4\s*\/\s*3/s);
  assert.match(card, /\.product-image img\s*\{[^}]*object-fit:\s*contain/s);
  assert.match(card, /\.product-image img\s*\{[^}]*width:\s*100%/s);
  assert.match(card, /\.product-image img\s*\{[^}]*height:\s*100%/s);
  assert.doesNotMatch(card, /object-fit:\s*cover/);
  assert.match(card, /var\(--brand-cream\)[\s\S]*var\(--surface-0\)/);
  assert.match(detailCss, /\.hero-image[\s\S]*object-fit: contain/);
  assert.match(detailCss, /\.hero-frame[\s\S]*aspect-ratio: 4 \/ 3/);
  assert.match(detailCss, /\.thumb img \{[^}]*object-fit: contain/s);
  assert.match(detailCss, /var\(--brand-cream\).*var\(--surface-0\)/);
  assert.match(line, /object-fit: contain/);
  assert.doesNotMatch(detailCss, /object-fit: cover/);
});

test('N: carrito guardado stock 3 → actual 0 → conflicto agotado', () => {
  const service = cart();
  service.add(product('beer', { trackStock: true, stock: 3, name: 'Cerveza Palma Cristal' }), [], 2);
  service.syncInventory([product('beer', { trackStock: true, stock: 0, name: 'Cerveza Palma Cristal' })], { pruneMissing: true });
  const line = service.items()[0];
  assert.equal(line.quantity, 2);
  assert.equal(line.stock, 0);
  assert.equal(stockHintForLine(line, service.items()).kind, 'out');
  assert.equal(stockHintForLine(line, service.items()).message, 'Producto agotado');
  assert.equal(cartHasStockConflicts(service.items()), true);
  assert.equal(service.canIncrement(line), false);
});

test('O: quantity 5 → stock 2 → conflicto y ajustar', () => {
  const service = cart();
  service.add(product('beer', { trackStock: true, stock: 5 }), [], 5);
  service.syncInventory([product('beer', { trackStock: true, stock: 2 })], { pruneMissing: true });
  const line = service.items()[0];
  assert.equal(line.quantity, 5);
  assert.equal(stockHintForLine(line, service.items()).kind, 'conflict');
  assert.match(stockHintForLine(line, service.items()).message, /Solo quedan 2 unidades/);
  assert.equal(service.adjustToAvailable('beer'), true);
  assert.equal(service.items()[0].quantity, 2);
  assert.equal(cartHasStockConflicts(service.items()), false);
});

test('P: login merge > stock queda en conflicto, no válido por encima', () => {
  installStorage();
  const identity = new ActiveIdentityService();
  identity.activate(GUEST_IDENTITY);
  const service = new CartService(identity);
  service.add(product('beer', { trackStock: true, stock: 3 }), [], 2);
  identity.activate({ type: 'user', userId: 'u1' });
  service.add(product('beer', { trackStock: true, stock: 3 }), [], 2);
  assert.equal(service.adoptGuestCart(), true);
  assert.equal(service.items()[0].quantity, 4);
  service.syncInventory([product('beer', { trackStock: true, stock: 3 })], { pruneMissing: true });
  assert.equal(service.items()[0].quantity, 4);
  assert.equal(service.items()[0].stock, 3);
  assert.equal(isLineBlockingCheckout(service.items()[0], service.items()), true);
  assert.equal(cartHasStockConflicts(service.items()), true);
});

test('Q: producto eliminado no está disponible y bloquea checkout', () => {
  const service = cart();
  service.add(product('gone', { trackStock: false }), [], 1);
  service.syncInventory([product('other', { trackStock: false })], { pruneMissing: true });
  const line = service.items()[0];
  assert.equal(line.unavailable, true);
  assert.equal(stockHintForLine(line, service.items()).message, 'Este producto ya no está disponible.');
  assert.equal(isLineBlockingCheckout(line, service.items()), true);
  assert.equal(service.canIncrement(line), false);
  assert.equal(cartHasStockConflicts(service.items()), true);
});

test('R: trackStock false no se marca agotado por ausencia de stock', () => {
  const service = cart();
  service.add(product('cake', { trackStock: false, stock: 0, category: 'tartas' }), [], 2);
  service.syncInventory([product('cake', { trackStock: false, stock: 0, category: 'tartas' })], { pruneMissing: true });
  const line = service.items()[0];
  assert.equal(line.unavailable, false);
  assert.equal(line.trackStock, false);
  assert.equal(stockHintForLine(line, service.items()).kind, 'none');
  assert.equal(cartHasStockConflicts(service.items()), false);
});

test('S: checkout y carrito bloquean con línea inválida', () => {
  const checkout = read('src/app/features/checkout/checkout-page.component.ts')
    + read('src/app/features/checkout/checkout-page.component.html');
  const cartPage = read('src/app/features/cart/cart-page.component.html');
  assert.match(checkout, /hasBlockingStock\(\)/);
  assert.match(checkout, /submitDisabled\(\)/);
  assert.match(cartPage, /hasStockConflicts\(\)/);
  assert.match(cartPage, /\[class\.is-disabled\]="cart\.hasStockConflicts\(\)"/);
});
