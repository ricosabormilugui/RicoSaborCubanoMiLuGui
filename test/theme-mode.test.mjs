import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import '@angular/compiler';
import * as angular from '@angular/core';

const root = fileURLToPath(new URL('../', import.meta.url));
const DOCUMENT = Symbol('DOCUMENT');

function memoryStorage() {
  const data = new Map();
  return {
    getItem(key) { return data.has(key) ? data.get(key) : null; },
    setItem(key, value) { data.set(String(key), String(value)); },
    removeItem(key) { data.delete(key); }
  };
}

function element() {
  return {
    attributes: {},
    classList: { toggle() {} },
    style: {},
    setAttribute(name, value) { this.attributes[name] = value; }
  };
}

function loader(document) {
  const cache = new Map();
  const effects = [];
  function load(path) {
    path = resolve(root, path);
    if (cache.has(path)) return cache.get(path);
    const js = ts.transpileModule(readFileSync(path, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, experimentalDecorators: true }
    }).outputText;
    const module = { exports: {} };
    const require = (name) => {
      if (name === '@angular/common') return { DOCUMENT };
      if (name === '@angular/core') {
        return {
          ...angular,
          inject: (token) => {
            if (token === DOCUMENT) return document;
            throw new Error('Unmocked inject token');
          },
          signal: (initial) => {
            const inner = angular.signal(initial);
            const notify = () => { for (const fn of effects) fn(); };
            return Object.assign(() => inner(), {
              set(value) { inner.set(value); notify(); },
              update(fn) { inner.update(fn); notify(); }
            });
          },
          effect: (fn) => { effects.push(fn); fn(); },
          Injectable: () => (cls) => cls
        };
      }
      if (name.startsWith('.')) return load(resolve(dirname(path), name + '.ts'));
      throw new Error('Unmocked ' + name);
    };
    new Function('require', 'module', 'exports', js)(require, module, module.exports);
    cache.set(path, module.exports);
    return module.exports;
  }
  return load;
}

function createTheme({ stored, prefersDark = true } = {}) {
  const local = memoryStorage();
  if (stored !== undefined && stored !== null) local.setItem('theme-mode', stored);
  const rootEl = element();
  const body = element();
  const storageListeners = [];
  const document = {
    documentElement: rootEl,
    body,
    defaultView: {
      localStorage: local,
      matchMedia: () => ({
        matches: !prefersDark,
        addEventListener() {
          throw new Error('prefers-color-scheme must not drive the initial theme');
        }
      }),
      addEventListener(type, fn) {
        if (type === 'storage') storageListeners.push(fn);
      }
    }
  };
  const { ThemeService, resolveThemeMode, DEFAULT_THEME, THEME_STORAGE_KEY } = loader(document)('src/app/core/services/theme.service.ts');
  return {
    service: new ThemeService(),
    local,
    rootEl,
    body,
    storageListeners,
    resolveThemeMode,
    DEFAULT_THEME,
    THEME_STORAGE_KEY
  };
}

function bootstrapTheme(stored) {
  let theme = 'light';
  const source = readFileSync(resolve(root, 'src/index.html'), 'utf8');
  const script = source.match(/<script>\s*\(\(\) => \{([\s\S]*?)\}\)\(\);\s*<\/script>/)[1];
  const localStorage = memoryStorage();
  if (stored !== undefined && stored !== null) localStorage.setItem('theme-mode', stored);
  const document = { documentElement: element() };
  const matchMedia = () => ({ matches: false });
  new Function('localStorage', 'document', 'matchMedia', script)(localStorage, document, matchMedia);
  return document.documentElement.attributes['data-theme'];
}

test('resolveThemeMode: preferencia válida, vacío e inválido', () => {
  const { resolveThemeMode, DEFAULT_THEME, THEME_STORAGE_KEY } = createTheme();
  assert.equal(THEME_STORAGE_KEY, 'theme-mode');
  assert.equal(DEFAULT_THEME, 'light');
  assert.equal(resolveThemeMode('light'), 'light');
  assert.equal(resolveThemeMode('dark'), 'dark');
  assert.equal(resolveThemeMode(null), 'light');
  assert.equal(resolveThemeMode(undefined), 'light');
  assert.equal(resolveThemeMode(''), 'light');
  assert.equal(resolveThemeMode('system'), 'light');
  assert.equal(resolveThemeMode('{dark}'), 'light');
});

test('caso 1: localStorage vacío abre en light y no guarda hasta un cambio manual', () => {
  const { service, local, rootEl } = createTheme();
  assert.equal(service.mode(), 'light');
  assert.equal(rootEl.attributes['data-theme'], 'light');
  assert.equal(local.getItem('theme-mode'), null);
});

test('caso 2: un cambio a dark persiste y se recarga en dark', () => {
  const first = createTheme();
  first.service.toggle();
  assert.equal(first.service.mode(), 'dark');
  assert.equal(first.local.getItem('theme-mode'), 'dark');

  const reloaded = createTheme({ stored: first.local.getItem('theme-mode') });
  assert.equal(reloaded.service.mode(), 'dark');
  assert.equal(reloaded.rootEl.attributes['data-theme'], 'dark');
});

test('caso 3: volver a light persiste light', () => {
  const first = createTheme({ stored: 'dark' });
  first.service.toggle();
  assert.equal(first.service.mode(), 'light');
  assert.equal(first.local.getItem('theme-mode'), 'light');

  const reloaded = createTheme({ stored: 'light' });
  assert.equal(reloaded.service.mode(), 'light');
});

test('caso 4: SO en dark sin theme-mode sigue en light', () => {
  const { service, local, rootEl } = createTheme({ prefersDark: true });
  assert.equal(service.mode(), 'light');
  assert.equal(rootEl.attributes['data-theme'], 'light');
  assert.equal(local.getItem('theme-mode'), null);
  assert.equal(bootstrapTheme(null), 'light');
});

test('caso 5: theme-mode inválido hace fallback a light', () => {
  const { service, rootEl } = createTheme({ stored: 'purple' });
  assert.equal(service.mode(), 'light');
  assert.equal(rootEl.attributes['data-theme'], 'light');
  assert.equal(bootstrapTheme('nope'), 'light');
  assert.equal(bootstrapTheme('dark'), 'dark');
  assert.equal(bootstrapTheme('light'), 'light');
});

test('el arranque inline no consulta prefers-color-scheme y la clave permanece global', () => {
  const index = readFileSync(resolve(root, 'src/index.html'), 'utf8');
  const theme = readFileSync(resolve(root, 'src/app/core/services/theme.service.ts'), 'utf8');
  const auth = readFileSync(resolve(root, 'src/app/core/services/customer-auth.service.ts'), 'utf8');
  assert.doesNotMatch(index, /prefers-color-scheme/);
  assert.doesNotMatch(theme, /prefers-color-scheme/);
  assert.doesNotMatch(theme, /sessionStorage/);
  assert.match(theme, /THEME_STORAGE_KEY = 'theme-mode'/);
  assert.doesNotMatch(auth, /theme-mode/);
  assert.doesNotMatch(auth, /localStorage\.clear\(/);
});

test('el destino de pedido no expone nombres internos de backend', () => {
  const orders = readFileSync(resolve(root, 'src/app/core/services/order.service.ts'), 'utf8');
  assert.doesNotMatch(orders, /destination: `Backend API/);
  assert.doesNotMatch(orders, /Netlify Function \(submit-order\)/);
  assert.doesNotMatch(orders, /destination: 'memoria local/);
  assert.match(orders, /sin persistir el pedido completo/);
});
