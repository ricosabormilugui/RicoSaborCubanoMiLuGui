import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import '@angular/compiler';
import * as angular from '@angular/core';

const root = fileURLToPath(new URL('../', import.meta.url));

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
const { getCustomizationGroups, buildCartCustomizationSelections } = load('src/app/core/utils/customization-pricing.ts');
const { PRODUCT_CREATION_PRESETS } = load('src/app/core/config/product-creation-presets.config.ts');

function cakeProduct(overrides = {}) {
  const preset = PRODUCT_CREATION_PRESETS.find((item) => item.id === 'tarta-personalizada').product;
  return {
    id: 'tarta-personalizada',
    slug: 'tarta-personalizada',
    imageUrl: '/cake.jpg',
    available: true,
    published: true,
    trackStock: false,
    stock: 0,
    lowStockAlert: 0,
    ...preset,
    ...overrides
  };
}

function guestCart() {
  const identity = new ActiveIdentityService();
  identity.activate(GUEST_IDENTITY);
  return new CartService(identity);
}

function pageFor(product, cart = guestCart()) {
  const page = Object.create(ProductDetailPageComponent.prototype);
  page.selectedCustomization = angular.signal({});
  page.customizationError = angular.signal('');
  page.quantity = angular.signal(1);
  page.expandedGroupKeys = angular.signal([]);
  page.optionPreviewLimit = 8;
  page.cart = cart;
  page.notifications = { success() {} };
  page.router = { navigateByUrl() {} };
  page.injector = {};
  page.product = angular.signal(product);
  return page;
}

test('ngFor trackOption no usa this.optionId y renderiza todas las opciones de cada grupo', () => {
  const product = cakeProduct();
  const page = pageFor(product);
  const groups = page.customizationGroups(product);
  assert.ok(groups.length >= 5);

  const differ = { optionId: undefined };
  for (const group of groups) {
    const visible = page.visibleOptions(group);
    assert.ok(visible.length >= 1, `el grupo ${group.key} debe exponer opciones`);
    const ids = visible.map((option, index) => {
      return ProductDetailPageComponent.prototype.trackOption.call(differ, index, option);
    });
    assert.equal(ids.length, visible.length);
    assert.equal(new Set(ids).size, ids.length);
    assert.ok(ids.every((id) => typeof id === 'string' && id.length > 0));
  }
});

test('selección single, extra y precio dinámico sobre un producto personalizable', () => {
  const product = cakeProduct();
  const page = pageFor(product);
  const groups = Object.fromEntries(page.customizationGroups(product).map((group) => [group.key, group]));
  const size = groups.sizes.options.find((option) => /Mediana/i.test(option.name));
  const flavor = groups.flavors.options.find((option) => option.name === 'Vainilla');
  const filling = groups.fillings.options.find((option) => option.name === 'Nutella');
  const topping = groups.toppings.options.find((option) => option.name === 'Buttercream');
  const decoration = groups.decorations.options.find((option) => /Topper/i.test(option.name));

  page.selectCustomization(groups.sizes, size);
  page.selectCustomization(groups.flavors, flavor);
  page.selectCustomization(groups.fillings, filling);
  page.selectCustomization(groups.toppings, topping);
  page.selectCustomization(groups.decorations, decoration);

  assert.equal(page.isOptionSelected('sizes', size), true);
  assert.equal(page.isOptionSelected('sizes', groups.sizes.options[0]), false);
  assert.equal(page.customizationExtraTotal(), 41);
  assert.equal(page.customizedTotal(product), 73);
  assert.ok(page.configurationSummary(product).includes('Mediana'));
  assert.ok(page.configurationSummary(product).includes('Nutella'));
});

test('selección multiple permite marcar y desmarcar extras', () => {
  const product = cakeProduct({
    customizationOptions: {
      ...cakeProduct().customizationOptions,
      groupSettings: { decorations: { selectionType: 'multiple', required: false } },
      decorations: [
        { name: 'Foto impresa' },
        { name: 'Topper premium', priceModifier: 10 },
        { name: 'Flores', priceModifier: 6 }
      ]
    }
  });
  const page = pageFor(product);
  const decorations = page.customizationGroups(product).find((group) => group.key === 'decorations');
  assert.equal(decorations.selectionType, 'multiple');
  page.selectCustomization(decorations, decorations.options[1]);
  page.selectCustomization(decorations, decorations.options[2]);
  assert.equal(page.isOptionSelected('decorations', decorations.options[1]), true);
  assert.equal(page.isOptionSelected('decorations', decorations.options[2]), true);
  assert.equal(page.customizationExtraTotal(), 16);
  page.selectCustomization(decorations, decorations.options[1]);
  assert.equal(page.isOptionSelected('decorations', decorations.options[1]), false);
  assert.equal(page.customizationExtraTotal(), 6);
});

test('addToCart crea configurationId distinto por configuración y no lanza si falta un obligatorio', () => {
  const product = cakeProduct();
  const cart = guestCart();
  const page = pageFor(product, cart);
  const groups = page.customizationGroups(product);

  assert.equal(page.addToCart(product), false);
  assert.match(page.customizationError(), /Selecciona .+ para continuar/);

  for (const group of groups) page.selectCustomization(group, group.options[0]);
  assert.equal(page.addToCart(product), true);
  const first = cart.items()[0];
  assert.ok(first.configurationId);
  assert.equal(first.baseProductId, product.id);

  const other = groups.find((group) => group.options.length > 1);
  page.selectCustomization(other, other.options[1]);
  const customizationB = buildCartCustomizationSelections(product, page.selectedCustomization());
  cart.add(product, customizationB, 1);
  assert.equal(cart.items().length, 2);
  assert.notEqual(cart.items()[0].configurationId, cart.items()[1].configurationId);
});
