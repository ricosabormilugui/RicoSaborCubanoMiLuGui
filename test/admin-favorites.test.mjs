import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import '@angular/compiler';
import * as angular from '@angular/core';

const root = fileURLToPath(new URL('../', import.meta.url));
const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

function unsignedJwt(payload) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${header}.${body}.sig`;
}

function memoryStorage() {
  const data = new Map();
  return {
    getItem(key) { return data.has(key) ? data.get(key) : null; },
    setItem(key, value) { data.set(String(key), String(value)); },
    removeItem(key) { data.delete(key); },
    key(index) { return [...data.keys()][index] ?? null; },
    get length() { return data.size; },
    dump() { return Object.fromEntries(data); }
  };
}

function installStorage(local = memoryStorage()) {
  globalThis.localStorage = local;
  globalThis.sessionStorage = memoryStorage();
  globalThis.addEventListener = () => {};
  globalThis.removeEventListener = () => {};
  return local;
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
      if (name === '@angular/router') return { NavigationEnd: class {}, Router: class {} };
      if (name.endsWith('api.config')) return { resolveApiBaseUrl: () => '/api' };
      if (name.endsWith('api-client')) return { ApiRequestError: class extends Error {}, requestJson: () => { throw new Error('Unexpected API'); } };
      if (name.startsWith('.')) {
        const candidate = resolve(dirname(path), name);
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
const { ActiveIdentityService, getStorageKey, GUEST_IDENTITY } = load('src/app/core/services/active-identity.service.ts');
const { FavoritesService } = load('src/app/core/services/favorites.service.ts');
const { ADMIN_FAVORITES_UNAVAILABLE_MESSAGE } = load('src/app/core/config/favorites.config.ts');

function bindRemote(favorites, identity, store = new Map()) {
  const calls = [];
  favorites.useRemoteAdapter({
    async get() {
      calls.push('get');
      const userId = identity.identity()?.type === 'user' ? identity.identity().userId : '';
      return [...(store.get(userId) ?? [])];
    },
    async add(id) {
      calls.push('add');
      const userId = identity.identity()?.type === 'user' ? identity.identity().userId : '';
      const current = [...(store.get(userId) ?? [])];
      const next = current.includes(id) ? current : [...current, id];
      store.set(userId, next);
      return next;
    },
    async remove(id) {
      calls.push('remove');
      const userId = identity.identity()?.type === 'user' ? identity.identity().userId : '';
      const next = (store.get(userId) ?? []).filter(item => item !== id);
      store.set(userId, next);
      return next;
    },
    async removeMany(ids) {
      calls.push('removeMany');
      const userId = identity.identity()?.type === 'user' ? identity.identity().userId : '';
      const drop = new Set(ids);
      const next = (store.get(userId) ?? []).filter(item => !drop.has(item));
      store.set(userId, next);
      return next;
    }
  });
  return { store, calls };
}

function customerJwt(userId) {
  return unsignedJwt({ sub: userId, role: 'customer', exp: Math.floor(Date.now() / 1000) + 3600 });
}

function adminJwt(userId = 'admin:ventas') {
  return unsignedJwt({ sub: userId, role: 'admin', email: 'ventas@milugui.com', exp: Math.floor(Date.now() / 1000) + 3600 });
}

test('A: admin no ve acción favorito en product-card', async () => {
  const card = await read('src/app/shared/ui/product-card.component.ts');
  assert.match(card, /@if \(showFavoriteAction\(\)\)/);
  assert.match(card, /showFavoriteAction = computed\(\(\) => !this\.auth\.isAdminAccount\(\)\)/);
  assert.match(card, /if \(!this\.showFavoriteAction\(\)\) return;/);
  assert.match(card, /class="favorite"/);
});

test('B: admin no ve acción favorito en product-detail', async () => {
  const [html, source] = await Promise.all([
    read('src/app/features/catalog/product-detail-page.component.html'),
    read('src/app/features/catalog/product-detail-page.component.ts')
  ]);
  assert.doesNotMatch(html, /class="favorite"/);
  assert.doesNotMatch(html, /lucideHeart/);
  assert.doesNotMatch(html, /toggleFavorite/);
  assert.doesNotMatch(source, /FavoritesService/);
  assert.doesNotMatch(source, /toggleFavorite/);
  assert.match(html, /app-product-card/);
});

test('D/F: admin no recibe inicia sesión y /favoritos redirige a /productos', async () => {
  const [service, guard, routes, menu] = await Promise.all([
    read('src/app/core/services/favorites.service.ts'),
    read('src/app/core/guards/customer.guard.ts'),
    read('src/app/app.routes.ts'),
    read('src/app/shared/ui/account-menu.component.ts')
  ]);
  assert.match(service, /if \(this\.adminBlocked\) \{[\s\S]*?ADMIN_FAVORITES_UNAVAILABLE_MESSAGE/);
  assert.match(service, /Inicia sesión para guardar productos en favoritos/);
  assert.equal(ADMIN_FAVORITES_UNAVAILABLE_MESSAGE, 'Los favoritos no están disponibles para cuentas de administración.');
  assert.doesNotMatch(service, /adminBlocked[\s\S]{0,180}Inicia sesión para guardar productos en favoritos/);
  assert.match(guard, /export const blockAdminFavoritesGuard/);
  assert.match(guard, /createUrlTree\(\['\/productos'\]\)/);
  assert.match(routes, /canActivate: \[customerGuard, blockAdminFavoritesGuard\]/);
  assert.match(menu, /\*ngIf="!auth\.isAdminAccount\(\)"[\s\S]{0,80}routerLink="\/favoritos"/);
});

test('C/H/G: admin no hace toggle remoto; guest pide login; customer add/remove', async () => {
  installStorage();
  const identity = new ActiveIdentityService();
  const favorites = new FavoritesService(identity);
  const { store, calls } = bindRemote(favorites, identity);

  identity.activate(GUEST_IDENTITY);
  favorites.bindSession('');
  assert.equal(favorites.isAvailable(), true);
  assert.equal(favorites.toggle('cake'), false);
  assert.deepEqual(favorites.ids(), []);
  assert.equal(calls.length, 0);

  identity.beginTransition();
  identity.activate({ type: 'user', userId: 'C1' });
  favorites.bindSession(customerJwt('C1'));
  assert.equal(favorites.toggle('cake'), true);
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.deepEqual(store.get('C1'), ['cake']);
  assert.equal(favorites.toggle('cake'), false);
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.deepEqual(store.get('C1'), []);
  assert.ok(calls.includes('add'));
  assert.ok(calls.includes('remove'));

  const remoteCallsBeforeAdmin = calls.length;
  identity.beginTransition();
  identity.activate({ type: 'user', userId: 'ADMIN' });
  favorites.bindSession(adminJwt());
  assert.equal(favorites.isAvailable(), false);
  assert.equal(favorites.toggle('cake'), false);
  assert.deepEqual(favorites.ids(), []);
  assert.equal(favorites.isFavorite('cake'), false);
  assert.equal(calls.length, remoteCallsBeforeAdmin);
});

test('I/J: customer → logout → admin no hereda corazones; admin → customer recarga los suyos', async () => {
  const storage = installStorage();
  const identity = new ActiveIdentityService();
  const favorites = new FavoritesService(identity);
  const { store, calls } = bindRemote(favorites, identity);
  store.set('C1', ['flan', 'yuca']);

  identity.beginTransition();
  identity.activate({ type: 'user', userId: 'C1' });
  favorites.bindSession(customerJwt('C1'));
  assert.equal(await favorites.syncAuthenticatedFavorites(), true);
  assert.deepEqual(favorites.ids(), ['flan', 'yuca']);
  const customerKey = getStorageKey('favorites', { type: 'user', userId: 'C1' });
  assert.match(storage.getItem(customerKey) ?? '', /flan/);

  favorites.bindSession('');
  identity.beginTransition();
  identity.activate(GUEST_IDENTITY);
  assert.deepEqual(favorites.ids(), []);
  assert.equal(favorites.isFavorite('flan'), false);

  identity.beginTransition();
  identity.activate({ type: 'user', userId: 'ADMIN' });
  favorites.bindSession(adminJwt());
  assert.deepEqual(favorites.ids(), []);
  assert.equal(favorites.isFavorite('flan'), false);
  assert.equal(favorites.toggle('flan'), false);
  assert.deepEqual(store.get('C1'), ['flan', 'yuca']);
  assert.match(storage.getItem(customerKey) ?? '', /flan/);
  assert.equal(calls.filter(item => item !== 'get').length, 0);

  favorites.bindSession('');
  identity.beginTransition();
  identity.activate(GUEST_IDENTITY);
  assert.deepEqual(favorites.ids(), []);

  identity.beginTransition();
  identity.activate({ type: 'user', userId: 'C1' });
  favorites.bindSession(customerJwt('C1'));
  assert.equal(await favorites.syncAuthenticatedFavorites(), true);
  assert.deepEqual(favorites.ids(), ['flan', 'yuca']);
  assert.equal(favorites.isFavorite('flan'), true);
});

test('admin con cache previa del mismo userId no muestra corazones ni llama remoto', async () => {
  const storage = installStorage();
  const identity = new ActiveIdentityService();
  identity.activate({ type: 'user', userId: 'promoted' });
  storage.setItem(getStorageKey('favorites', { type: 'user', userId: 'promoted' }), JSON.stringify({ version: 1, ids: ['stale-heart'] }));
  const favorites = new FavoritesService(identity);
  const { calls } = bindRemote(favorites, identity);
  favorites.bindSession(adminJwt('promoted'));
  assert.deepEqual(favorites.ids(), []);
  assert.equal(favorites.isFavorite('stale-heart'), false);
  assert.equal(await favorites.syncAuthenticatedFavorites(), false);
  assert.equal(calls.length, 0);
});
