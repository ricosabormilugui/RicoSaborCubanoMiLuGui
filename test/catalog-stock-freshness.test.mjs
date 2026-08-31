import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const root = fileURLToPath(new URL('../', import.meta.url));
const read = (path) => readFileSync(resolve(root, path), 'utf8');

function loadCartStock() {
  const path = resolve(root, 'src/app/core/utils/cart-stock.ts');
  const js = ts.transpileModule(readFileSync(path, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
  }).outputText;
  const module = { exports: {} };
  const require = (name) => {
    if (name.endsWith('product.model')) {
      return {
        isProductOrderable: (product) => Boolean(product)
          && product.available !== false
          && (product.trackStock !== true || Number(product.stock ?? 0) > 0)
      };
    }
    if (name.endsWith('order.model')) return {};
    throw new Error('Unmocked ' + name);
  };
  new Function('require', 'module', 'exports', js)(require, module, module.exports);
  return module.exports;
}

function loadCatalogHelpers() {
  const source = read('src/app/core/services/catalog.service.ts');
  const match = source.match(/export const PRODUCTS_REQUEST_CACHE_MS[\s\S]*?export function isCatalogAvailabilityStale[\s\S]*?\n\}/);
  assert.ok(match, 'no se encontraron las constantes de caché de disponibilidad');
  const js = ts.transpileModule(match[0], {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
  }).outputText;
  const module = { exports: {} };
  new Function('require', 'module', 'exports', js)(() => ({}), module, module.exports);
  return module.exports;
}

const { evaluateLiveAddToCart } = loadCartStock();
const { isCatalogAvailabilityStale, STOCK_AVAILABILITY_MAX_AGE_MS, PRODUCTS_REQUEST_CACHE_MS } = loadCatalogHelpers();

test('A: stock 0 refrescado no es añadible', () => {
  const result = evaluateLiveAddToCart({ id: 'a', name: 'Cerveza', trackStock: true, stock: 0, available: true }, 1);
  assert.equal(result.allowed, false);
  assert.equal(result.kind, 'sold_out');
  assert.equal(result.message, 'Este producto acaba de agotarse.');
});

test('B: stock cambia 3→1 y la cantidad máxima se actualiza', () => {
  const result = evaluateLiveAddToCart({ id: 'a', name: 'Cerveza', trackStock: true, stock: 1, available: true, minimumQuantity: 1 }, 3);
  assert.equal(result.allowed, true);
  assert.equal(result.quantity, 1);
  assert.equal(result.kind, 'limited');
  assert.equal(result.message, 'Solo quedan 1 unidades disponibles.');
});

test('C-E: backend sigue rechazando y el catálogo se invalida para la siguiente lectura', () => {
  const checkout = read('src/app/features/checkout/checkout-page.component.ts');
  const catalog = read('src/app/core/services/catalog.service.ts');
  const addToCart = read('src/app/core/utils/live-add-to-cart.ts');
  const controller = read('Backend/src/controllers/orders.controller.js');
  assert.match(checkout, /ORDER_STOCK_CONFLICT/);
  assert.match(checkout, /catalog\.invalidate\(\)/);
  assert.match(catalog, /async refreshAvailability/);
  assert.match(catalog, /this\.lastLoadAt = 0/);
  assert.match(catalog, /loadProducts\(\{ force: true \}\)/);
  assert.match(addToCart, /refreshTrackedProduct/);
  assert.doesNotMatch(controller, /ORDER_STOCK_CONFLICT[\s\S]{0,40}disabled/);
  assert.equal(isCatalogAvailabilityStale(Date.now() - 59_000), false);
  assert.equal(isCatalogAvailabilityStale(Date.now() - 60_000), true);
  assert.equal(STOCK_AVAILABILITY_MAX_AGE_MS, 60_000);
  assert.equal(PRODUCTS_REQUEST_CACHE_MS, 5 * 60_000);
});

test('add-to-cart y páginas críticas refrescan disponibilidad', () => {
  const home = read('src/app/features/home/home-page.component.ts');
  const catalogPage = read('src/app/features/catalog/catalog-page.component.ts');
  const cart = read('src/app/features/cart/cart-page.component.ts');
  const checkout = read('src/app/features/checkout/checkout-page.component.ts');
  const detail = read('src/app/features/catalog/product-detail-page.component.ts');
  assert.match(home, /refreshAvailability\(\)/);
  assert.match(catalogPage, /refreshAvailability\(\)/);
  assert.match(cart, /refreshAvailability\(\)/);
  assert.match(checkout, /loadProducts\(\{ force: true \}\)/);
  assert.match(detail, /refreshTrackedProduct/);
  assert.match(detail, /upsertProduct/);
  assert.match(home, /addSimpleProductWithFreshStock/);
});
