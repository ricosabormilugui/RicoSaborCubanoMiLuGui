import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import '@angular/compiler';
import * as angular from '@angular/core';

const root = fileURLToPath(new URL('../', import.meta.url));

function memoryStorage() {
  const data = new Map();
  return {
    getItem(key) { return data.has(key) ? data.get(key) : null; },
    setItem(key, value) {
      if (this.failKeys?.has(key)) throw new Error('persist failed');
      data.set(String(key), String(value));
    },
    removeItem(key) { data.delete(key); },
    key(index) { return [...data.keys()][index] ?? null; },
    get length() { return data.size; },
    failKeys: new Set(),
    dump() { return Object.fromEntries(data); }
  };
}

function installStorage(local = memoryStorage(), session = memoryStorage()) {
  globalThis.localStorage = local;
  globalThis.sessionStorage = session;
  globalThis.addEventListener = () => {};
  globalThis.removeEventListener = () => {};
  return { local, session };
}

function loader(overrides = {}) {
  const cache = new Map();
  function load(path) {
    path = resolve(root, path);
    if (cache.has(path)) return cache.get(path);
    const js = ts.transpileModule(readFileSync(path, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, experimentalDecorators: true }
    }).outputText;
    const module = { exports: {} };
    cache.set(path, module.exports);
    const require = name => {
      if (name in overrides) return overrides[name];
      if (name === '@angular/core') return angular;
      if (name === '@angular/core/rxjs-interop') return { takeUntilDestroyed: () => x => x };
      if (name === '@angular/router') return { NavigationEnd: class {} };
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

const load = loader();
const { ActiveIdentityService, getStorageKey, GUEST_IDENTITY, StaleIdentityError } = load('src/app/core/services/active-identity.service.ts');
const { CartService } = load('src/app/core/services/cart.service.ts');
const { FavoritesService } = load('src/app/core/services/favorites.service.ts');
const { DeliveryStateService } = load('src/app/core/services/delivery-state.service.ts');
const { NotificationHistoryService } = load('src/app/core/services/notification-history.service.ts');
const { IdentityRequestService } = load('src/app/core/services/identity-request.service.ts');
const { transferGuestOrderIntent, OrderIdempotencyIntent } = load('src/app/core/utils/order-idempotency.ts');

function item(id, extra = {}) {
  return { productId: id, baseProductId: id, name: id, unitPrice: 8, quantity: extra.quantity ?? 1, ...extra };
}

function product(id) {
  return { id, name: id, description: '', price: 8, minimumQuantity: 1, unitLabel: 'ud' };
}

function names(cart) {
  return cart.items().map(entry => entry.productId);
}

function bindRemote(h, store = new Map()) {
  h.favorites.useRemoteAdapter({
    async get() {
      if (typeof store.throwGet === 'function') throw store.throwGet();
      const userId = h.identity.identity()?.type === 'user' ? h.identity.identity().userId : '';
      return [...(store.get(userId) ?? [])];
    },
    async add(id) {
      if (typeof store.throwMutate === 'function') throw store.throwMutate();
      const userId = h.identity.identity()?.type === 'user' ? h.identity.identity().userId : '';
      const current = [...(store.get(userId) ?? [])];
      if (current.includes(id)) return current;
      if (current.length >= 200) {
        const error = new Error('Has alcanzado el límite de 200 favoritos.');
        error.status = 409;
        throw error;
      }
      const next = [...current, id];
      store.set(userId, next);
      return next;
    },
    async remove(id) {
      if (typeof store.throwMutate === 'function') throw store.throwMutate();
      const userId = h.identity.identity()?.type === 'user' ? h.identity.identity().userId : '';
      const next = (store.get(userId) ?? []).filter(item => item !== id);
      store.set(userId, next);
      return next;
    },
    async removeMany(ids) {
      if (typeof store.throwMutate === 'function') throw store.throwMutate();
      const userId = h.identity.identity()?.type === 'user' ? h.identity.identity().userId : '';
      const drop = new Set(ids);
      const next = (store.get(userId) ?? []).filter(item => !drop.has(item));
      store.set(userId, next);
      return next;
    }
  });
  return store;
}

function harness() {
  const storage = installStorage();
  const identity = new ActiveIdentityService();
  identity.activate(GUEST_IDENTITY);
  const cart = new CartService(identity);
  const delivery = new DeliveryStateService(identity);
  const favorites = new FavoritesService(identity);
  const activity = new NotificationHistoryService(storage.local, identity);
  return { identity, cart, delivery, favorites, activity, storage };
}

function login(h, userId) {
  h.identity.beginTransition();
  assert.deepEqual(h.cart.items(), []);
  h.identity.activate({ type: 'user', userId });
  return h.cart.adoptGuestCart() && h.delivery.adoptGuestShipping();
}

function logout(h) {
  h.identity.beginTransition();
  assert.deepEqual(h.cart.items(), []);
  h.identity.activate(GUEST_IDENTITY);
}

test('Guest → B: transfiere el carrito guest, consume guest y no deja flash del carrito anterior', () => {
  const h = harness();
  h.cart.add(product('X'));
  assert.deepEqual(names(h.cart), ['X']);
  assert.equal(login(h, 'B'), true);
  assert.deepEqual(names(h.cart), ['X']);
  assert.deepEqual(h.cart.readIdentityCart(GUEST_IDENTITY), []);
  assert.equal(h.storage.local.getItem(getStorageKey('cart', GUEST_IDENTITY)), null);
});

test('B → Guest: el logout no transfiere el carrito de B', () => {
  const h = harness();
  login(h, 'B');
  h.cart.add(product('B1'));
  logout(h);
  assert.deepEqual(names(h.cart), []);
  assert.deepEqual(h.cart.readIdentityCart({ type: 'user', userId: 'B' }).map(entry => entry.productId), ['B1']);
});

test('Guest → C: C recibe el carrito guest actual, no el de B', () => {
  const h = harness();
  h.cart.add(product('Y'));
  assert.equal(login(h, 'C'), true);
  assert.deepEqual(names(h.cart), ['Y']);
  assert.deepEqual(h.cart.readIdentityCart(GUEST_IDENTITY), []);
});

test('B → C: C no recibe el carrito de B', () => {
  const h = harness();
  login(h, 'B');
  h.cart.add(product('B1'));
  logout(h);
  login(h, 'C');
  assert.deepEqual(names(h.cart), []);
});

test('B vuelve: recupera B1 y nunca G2 ni C1', () => {
  const h = harness();
  login(h, 'B');
  h.cart.add(product('B1'));
  logout(h);
  h.cart.add(product('G2'));
  login(h, 'C');
  h.cart.add(product('C1'));
  logout(h);
  login(h, 'B');
  assert.deepEqual(names(h.cart), ['B1']);
  assert.ok(!names(h.cart).includes('G2'));
  assert.ok(!names(h.cart).includes('C1'));
});

test('si falla la persistencia del carrito de usuario, el guest se conserva', () => {
  const h = harness();
  h.cart.add(product('X'));
  const userKey = getStorageKey('cart', { type: 'user', userId: 'B' });
  h.storage.local.failKeys.add(userKey);
  h.identity.beginTransition();
  h.identity.activate({ type: 'user', userId: 'B' });
  assert.equal(h.cart.adoptGuestCart(), false);
  assert.equal(h.cart.readIdentityCart(GUEST_IDENTITY)[0].productId, 'X');
  assert.equal(h.storage.local.getItem(userKey), null);
});

test('E2E A/B/C: guest G1 → B, logout vacío, guest G2 → C, B recupera G1+B1', () => {
  const h = harness();
  h.cart.add(product('G1'));
  login(h, 'B');
  assert.deepEqual(names(h.cart), ['G1']);
  assert.deepEqual(h.cart.readIdentityCart(GUEST_IDENTITY), []);
  h.cart.add(product('B1'));
  logout(h);
  assert.deepEqual(names(h.cart), []);
  h.cart.add(product('G2'));
  login(h, 'C');
  assert.deepEqual(names(h.cart), ['G2']);
  assert.ok(!names(h.cart).includes('G1'));
  assert.ok(!names(h.cart).includes('B1'));
  h.cart.add(product('C1'));
  logout(h);
  login(h, 'B');
  assert.deepEqual(names(h.cart).sort(), ['B1', 'G1']);
  assert.ok(!names(h.cart).includes('G2'));
  assert.ok(!names(h.cart).includes('C1'));
});

test('merge reutiliza productId/configuración: mismas líneas se combinan, personalizaciones distintas se separan', () => {
  const h = harness();
  h.cart.add(product('cake'), [{ label: 'Relleno', value: 'Chocolate', groupKey: 'filling', optionId: 'choco' }]);
  h.cart.add(product('plain'));
  login(h, 'B');
  h.cart.add(product('plain'));
  h.cart.add(product('cake'), [{ label: 'Relleno', value: 'Vainilla', groupKey: 'filling', optionId: 'vanilla' }]);
  const lines = h.cart.items();
  const plain = lines.find(entry => entry.baseProductId === 'plain');
  const chocolate = lines.filter(entry => entry.baseProductId === 'cake');
  assert.equal(plain.quantity, 2);
  assert.equal(chocolate.length, 2);
});

test('alerts: C no ve la actividad de B; B la recupera al volver', () => {
  const h = harness();
  login(h, 'B');
  h.activity.add({ type: 'success', title: 'Alert B' });
  assert.equal(h.activity.items()[0].title, 'Alert B');
  logout(h);
  login(h, 'C');
  assert.deepEqual(h.activity.items(), []);
  logout(h);
  login(h, 'B');
  assert.equal(h.activity.items()[0].title, 'Alert B');
  assert.equal(h.storage.local.getItem('mixsabor.notifications'), null);
});

test('checkout/shipping: C no hereda fecha, franja ni tipo de B; guest sí puede transferir al login', () => {
  const h = harness();
  h.delivery.setDeliveryState({ date: '2026-09-01', slot: '10:00-12:00', type: 'pickup' });
  login(h, 'B');
  assert.equal(h.delivery.date(), '2026-09-01');
  assert.equal(h.delivery.slot(), '10:00-12:00');
  h.delivery.setDeliveryState({ date: '2026-09-10', slot: '18:00-20:00', type: 'delivery' });
  logout(h);
  assert.equal(h.delivery.date(), null);
  assert.equal(h.delivery.slot(), null);
  login(h, 'C');
  assert.equal(h.delivery.date(), null);
  assert.equal(h.delivery.slot(), null);
  logout(h);
  login(h, 'B');
  assert.equal(h.delivery.date(), '2026-09-10');
  assert.equal(h.delivery.slot(), '18:00-20:00');
});

test('intención de pedido guest se transfiere al usuario y no vuelve al guest', () => {
  const { session } = installStorage();
  const guestKey = getStorageKey('order-intent', GUEST_IDENTITY);
  session.setItem(guestKey, JSON.stringify({ key: 'order_guestkey01', fingerprint: 'fp-guest' }));
  assert.equal(transferGuestOrderIntent('B', session), true);
  assert.equal(session.getItem(guestKey), null);
  assert.equal(JSON.parse(session.getItem(getStorageKey('order-intent', { type: 'user', userId: 'B' }))).key, 'order_guestkey01');
  const intent = new OrderIdempotencyIntent(session, { randomUUID: () => 'aaaaaaaa-bbbb-4000-8000-cccccccccccc' }, () => getStorageKey('order-intent', GUEST_IDENTITY));
  intent.bindIdentity('1:guest');
  assert.notEqual(intent.keyFor({ items: [{ quantity: 1 }] }), 'order_guestkey01');
});

test('respuestas tardías de B se ignoran tras login de C', async () => {
  const identity = new ActiveIdentityService();
  identity.activate({ type: 'user', userId: 'B' });
  const requests = new IdentityRequestService(identity);
  let resolveB;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = () => new Promise(resolve => { resolveB = resolve; });
  const pending = requests.fetch('https://example.test/b');
  identity.beginTransition();
  identity.activate({ type: 'user', userId: 'C' });
  resolveB(new Response(JSON.stringify({ secret: 'from-B' }), { headers: { 'Content-Type': 'application/json' } }));
  await assert.rejects(pending, error => error instanceof StaleIdentityError);
  globalThis.fetch = originalFetch;
});

test('IdentityRequestService también descarta el body si la identidad cambia durante json()', async () => {
  const identity = new ActiveIdentityService();
  identity.activate({ type: 'user', userId: 'B' });
  const requests = new IdentityRequestService(identity);
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({ secret: 'from-B' }), { headers: { 'Content-Type': 'application/json' } });
  const response = await requests.fetch('https://example.test/b');
  identity.activate({ type: 'user', userId: 'C' });
  await assert.rejects(response.json(), error => error instanceof StaleIdentityError);
  globalThis.fetch = originalFetch;
});

test('favoritos: login hidrata el backend y no mezcla leftovers guest', async () => {
  const h = harness();
  const remote = bindRemote(h);
  remote.set('U1', ['B', 'C']);
  h.storage.local.setItem(getStorageKey('favorites', GUEST_IDENTITY), JSON.stringify({ version: 1, ids: ['A', 'B'] }));
  h.storage.local.setItem(getStorageKey('favorites', { type: 'user', userId: 'U1' }), JSON.stringify({ version: 1, ids: ['C', 'D'] }));
  assert.equal(h.favorites.toggle('A'), false);
  h.identity.beginTransition();
  h.identity.activate({ type: 'user', userId: 'U1' });
  h.favorites.bindSession('token-U1');
  assert.equal(await h.favorites.syncAuthenticatedFavorites(), true);
  assert.deepEqual(h.favorites.ids(), ['B', 'C']);
  assert.deepEqual(remote.get('U1'), ['B', 'C']);
  assert.equal(h.storage.local.getItem(getStorageKey('favorites', GUEST_IDENTITY)), null);
  assert.equal(await h.favorites.syncAuthenticatedFavorites(), true);
  assert.deepEqual(h.favorites.ids(), ['B', 'C']);
});

test('favoritos: fallo GET no interpreta la colección como vacía', async () => {
  const h = harness();
  const remote = bindRemote(h);
  h.identity.activate({ type: 'user', userId: 'U1' });
  h.favorites.bindSession('token-U1');
  assert.equal(h.favorites.toggle('local'), true);
  remote.throwGet = () => new Error('offline');
  assert.equal(await h.favorites.syncAuthenticatedFavorites(), false);
  assert.deepEqual(h.favorites.ids(), ['local']);
});

test('favoritos: hidratar sesión restaura backend y add/remove persisten el estado canónico', async () => {
  const h = harness();
  const remote = bindRemote(h);
  remote.set('U1', ['X']);
  h.identity.activate({ type: 'user', userId: 'U1' });
  h.favorites.bindSession('token-U1');
  assert.equal(await h.favorites.syncAuthenticatedFavorites(), true);
  assert.deepEqual(h.favorites.ids(), ['X']);
  assert.equal(h.favorites.toggle('Y'), true);
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(remote.get('U1'), ['X', 'Y']);
  assert.equal(h.favorites.toggle('X'), false);
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(h.favorites.ids(), ['Y']);
  assert.deepEqual(remote.get('U1'), ['Y']);
  remote.throwMutate = () => new Error('offline');
  assert.equal(h.favorites.toggle('Z'), true);
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(h.favorites.ids(), ['Y']);
  assert.deepEqual(remote.get('U1'), ['Y']);
});

test('favoritos: logout deja la UI vacía y no crea namespace guest', () => {
  const h = harness();
  bindRemote(h);
  h.identity.activate({ type: 'user', userId: 'U1' });
  h.favorites.bindSession('token-U1');
  h.favorites.toggle('A');
  h.favorites.toggle('B');
  h.favorites.bindSession('');
  logout(h);
  assert.deepEqual(h.favorites.ids(), []);
  assert.equal(h.favorites.isFavorite('B'), false);
  assert.equal(h.storage.local.getItem(getStorageKey('favorites', GUEST_IDENTITY)), null);
  assert.deepEqual(h.favorites.readIdentityFavorites({ type: 'user', userId: 'U1' }), ['A', 'B']);
});

test('favoritos guest: el corazón no guarda ni crea mixsabor.guest.favorites', () => {
  const h = harness();
  h.storage.local.setItem(getStorageKey('favorites', GUEST_IDENTITY), JSON.stringify({ version: 1, ids: ['stale'] }));
  const cleaned = new FavoritesService(h.identity);
  assert.equal(cleaned.toggle('p1'), false);
  assert.deepEqual(cleaned.ids(), []);
  assert.equal(cleaned.isFavorite('p1'), false);
  assert.equal(h.storage.local.getItem(getStorageKey('favorites', GUEST_IDENTITY)), null);
  assert.equal(h.favorites.toggle('p2'), false);
  assert.deepEqual(h.favorites.ids(), []);
});

test('favoritos: pruneMissing ignora catálogo vacío y persiste la poda de huérfanos', async () => {
  const h = harness();
  const remote = bindRemote(h);
  h.identity.activate({ type: 'user', userId: 'U1' });
  h.favorites.bindSession('token-U1');
  h.favorites.toggle('keep');
  h.favorites.toggle('gone');
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(await h.favorites.pruneMissing([]), false);
  assert.deepEqual(h.favorites.ids(), ['keep', 'gone']);
  assert.deepEqual(remote.get('U1'), ['keep', 'gone']);
  assert.equal(await h.favorites.pruneMissing(['keep']), true);
  assert.deepEqual(h.favorites.ids(), ['keep']);
  assert.deepEqual(remote.get('U1'), ['keep']);
});

test('favoritos: si la poda remota falla no se pierde la colección', async () => {
  const h = harness();
  const remote = bindRemote(h);
  h.identity.activate({ type: 'user', userId: 'U1' });
  h.favorites.bindSession('token-U1');
  h.favorites.toggle('A');
  h.favorites.toggle('X');
  await new Promise((resolve) => setImmediate(resolve));
  remote.throwMutate = () => new Error('offline');
  assert.equal(await h.favorites.pruneMissing(['A']), false);
  assert.deepEqual(h.favorites.ids(), ['A', 'X']);
  assert.deepEqual(remote.get('U1'), ['A', 'X']);
});

test('favoritos: 199 add 200, el 201 no muta y remove vuelve a 199', async () => {
  const h = harness();
  const remote = bindRemote(h);
  h.identity.activate({ type: 'user', userId: 'U1' });
  h.favorites.bindSession('token-U1');
  for (let index = 0; index < 199; index++) h.favorites.toggle(`p${index}`);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(h.favorites.toggle('p199'), true);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(h.favorites.ids().length, 200);
  assert.equal(h.favorites.toggle('overflow'), false);
  assert.equal(h.favorites.ids().length, 200);
  assert.equal(h.favorites.isFavorite('overflow'), false);
  assert.equal(h.favorites.toggle('p199'), false);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(h.favorites.ids().length, 199);
  assert.equal(remote.get('U1').length, 199);
});

test('favoritos: usuarios distintos no se ven y A recupera los suyos', () => {
  const h = harness();
  bindRemote(h);
  login(h, 'A');
  h.favorites.bindSession('token-A');
  h.favorites.toggle('A1');
  h.favorites.toggle('A2');
  h.favorites.bindSession('');
  logout(h);
  login(h, 'B');
  h.favorites.bindSession('token-B');
  h.favorites.toggle('C1');
  assert.deepEqual(h.favorites.ids(), ['C1']);
  assert.equal(h.favorites.isFavorite('A1'), false);
  h.favorites.bindSession('');
  logout(h);
  login(h, 'A');
  h.favorites.bindSession('token-A');
  assert.deepEqual(h.favorites.ids(), ['A1', 'A2']);
});

test('favoritos backend: A y B quedan aislados al hidratar desde el servidor', async () => {
  const h = harness();
  const remote = bindRemote(h);
  remote.set('A', ['A1', 'A2']);
  remote.set('B', ['C1']);
  h.identity.activate({ type: 'user', userId: 'A' });
  h.favorites.bindSession('token-A');
  assert.equal(await h.favorites.syncAuthenticatedFavorites(), true);
  assert.deepEqual(h.favorites.ids(), ['A1', 'A2']);
  h.favorites.bindSession('');
  logout(h);
  assert.deepEqual(h.favorites.ids(), []);
  h.identity.activate({ type: 'user', userId: 'B' });
  h.favorites.bindSession('token-B');
  assert.equal(await h.favorites.syncAuthenticatedFavorites(), true);
  assert.deepEqual(h.favorites.ids(), ['C1']);
  assert.equal(h.favorites.isFavorite('A1'), false);
});

test('claves globales de tema y cookies no se namespacian; pedidos locales ya no se persisten', () => {
  const auth = readFileSync(resolve(root, 'src/app/core/services/customer-auth.service.ts'), 'utf8');
  const theme = readFileSync(resolve(root, 'src/app/core/services/theme.service.ts'), 'utf8');
  const cookies = readFileSync(resolve(root, 'src/app/core/services/cookie-consent.service.ts'), 'utf8');
  const orders = readFileSync(resolve(root, 'src/app/core/services/order.service.ts'), 'utf8');
  const identity = readFileSync(resolve(root, 'src/app/core/utils/identity-storage.ts'), 'utf8');
  const checkout = readFileSync(resolve(root, 'src/app/features/checkout/checkout-page.component.ts'), 'utf8');
  assert.match(theme, /THEME_STORAGE_KEY = 'theme-mode'/);
  assert.match(cookies, /ricosabor-cookie-consent-v1/);
  assert.doesNotMatch(auth, /localStorage\.clear\(/);
  assert.doesNotMatch(orders, /ricosabor-local-orders/);
  assert.match(orders, /sin persistir el pedido completo/);
  assert.match(identity, /mixsabor\.guest\.\$\{resource\}/);
  assert.match(identity, /LEGACY_LOCAL_KEYS/);
  assert.match(checkout, /this\.identity\.session\(\)/);
  assert.match(checkout, /fullName: ''/);
  assert.match(checkout, /phoneNumber: ''/);
  assert.match(checkout, /if \(!this\.identity\.isCurrent\(checkoutSession\)\) return/);
});

test('CustomerAuthService.login hidrata favoritos del backend y logout no los copia', async () => {
  const storage = installStorage();
  const identity = new ActiveIdentityService();
  identity.activate(GUEST_IDENTITY);
  const cart = new CartService(identity);
  const delivery = new DeliveryStateService(identity);
  cart.add(product('G1'));
  const favorites = new FavoritesService(identity);
  assert.equal(favorites.toggle('G1'), false);
  const remote = new Map([['B', ['X']]]);
  favorites.useRemoteAdapter({
    async get() {
      const userId = identity.identity()?.type === 'user' ? identity.identity().userId : '';
      return [...(remote.get(userId) ?? [])];
    },
    async add(id) {
      const userId = identity.identity()?.type === 'user' ? identity.identity().userId : '';
      const current = [...(remote.get(userId) ?? [])];
      const next = current.includes(id) ? current : [...current, id];
      remote.set(userId, next);
      return next;
    },
    async remove(id) {
      const userId = identity.identity()?.type === 'user' ? identity.identity().userId : '';
      const next = (remote.get(userId) ?? []).filter(item => item !== id);
      remote.set(userId, next);
      return next;
    },
    async removeMany(ids) {
      const userId = identity.identity()?.type === 'user' ? identity.identity().userId : '';
      const drop = new Set(ids);
      const next = (remote.get(userId) ?? []).filter(item => !drop.has(item));
      remote.set(userId, next);
      return next;
    }
  });
  let pending;
  const compiled = loader({
    '@angular/core': { ...angular, inject: () => ({
      dismissAll() {},
      close() {},
      bindSession: (token, onExpired) => favorites.bindSession(token, onExpired),
      syncAuthenticatedFavorites: () => favorites.syncAuthenticatedFavorites(),
      adoptGuestCart: () => cart.adoptGuestCart(),
      adoptGuestShipping: () => delivery.adoptGuestShipping(),
      warning() {}
    }) },
    '../utils/api-client': {
      ApiRequestError: class extends Error {},
      requestJson: () => new Promise(resolve => { pending = resolve; })
    }
  });
  const { CustomerAuthService } = compiled('src/app/core/services/customer-auth.service.ts');
  const auth = new CustomerAuthService({ logout() {}, setToken() {} }, identity);
  const login = auth.login('b@example.test', 'Secret1');
  pending({ token: 'token-B', userId: 'B', role: 'customer' });
  await login;
  assert.equal(identity.key(), 'user:B');
  assert.deepEqual(names(cart), ['G1']);
  assert.deepEqual(cart.readIdentityCart(GUEST_IDENTITY), []);
  assert.deepEqual(favorites.ids(), ['X']);
  assert.deepEqual(remote.get('B'), ['X']);
  assert.equal(storage.local.getItem(getStorageKey('favorites', GUEST_IDENTITY)), null);
  auth.logout();
  assert.equal(identity.key(), 'guest');
  assert.deepEqual(names(cart), []);
  assert.deepEqual(favorites.ids(), []);
  assert.deepEqual(favorites.readIdentityFavorites({ type: 'user', userId: 'B' }), ['X']);
  assert.equal(storage.local.getItem('theme-mode'), null);
});
