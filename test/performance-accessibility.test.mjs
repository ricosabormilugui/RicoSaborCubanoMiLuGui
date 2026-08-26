import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import test from 'node:test';

const rootUrl = new URL('../', import.meta.url);
const read = (path) => readFileSync(new URL(path, rootUrl), 'utf8');
const pngDimensions = (path) => {
  const image = readFileSync(new URL(path, rootUrl));
  assert.equal(image.toString('ascii', 1, 4), 'PNG');
  return { width: image.readUInt32BE(16), height: image.readUInt32BE(20) };
};

test('Home y Catálogo se cargan por rutas lazy sin entrar en main', () => {
  const routes = read('src/app/app.routes.ts');
  assert.doesNotMatch(routes, /import \{ (?:HomePageComponent|CatalogPageComponent) \}/);
  assert.match(routes, /path: '', loadComponent: \(\) => import\('\.\/features\/home\/home-page\.component'\)/);
  assert.match(routes, /path: 'productos', loadComponent: \(\) => import\('\.\/features\/catalog\/catalog-page\.component'\)/);
});

test('el shell no carga Forms ni Angular Animations para controles nativos simples', () => {
  const app = read('src/app/app.component.ts');
  const config = read('src/main.config.ts');
  assert.doesNotMatch(app, /@angular\/forms|@angular\/animations|\[@fade\]/);
  assert.doesNotMatch(config, /provideAnimations/);
});

test('los logos derivados conservan originales y reducen el peso de descarga', () => {
  for (const theme of ['light', 'dark']) {
    const original = `public/assets/branding/logo_mixsabor_${theme}.png`;
    const optimized = `public/assets/branding/logo_mixsabor_${theme}_256.png`;
    assert.deepEqual(pngDimensions(optimized), { width: 256, height: 256 });
    assert.ok(statSync(new URL(optimized, rootUrl)).size < statSync(new URL(original, rootUrl)).size / 5);
  }
});

test('las imágenes Cloudinary usan formato/calidad automáticos, ancho limitado y srcset', () => {
  const utility = read('src/app/core/utils/responsive-image.ts');
  const home = read('src/app/features/home/home-page.component.html');
  const catalog = read('src/app/features/catalog/catalog-page.component.html');
  const card = read('src/app/shared/ui/product-card.component.ts');
  assert.match(utility, /f_auto,q_auto,c_limit,w_/);
  assert.match(utility, /responsiveImageSrcset/);
  assert.match(utility, /if \(!value\) return null/);
  assert.match(home, /fetchpriority="high"/);
  assert.match(home, /srcset/);
  assert.match(catalog, /app-product-card/);
  assert.match(card, /fetchpriority/);
  assert.match(card, /responsiveImageSrcset/);
});

test('menú y búsqueda gestionan semántica, foco, Escape e inert', () => {
  const app = read('src/app/app.component.ts');
  assert.match(app, /\[attr\.inert\]="menuOpen\(\) \? null : ''"/);
  assert.match(app, /role="dialog" aria-modal="true"/);
  assert.match(app, /<button class="result"/);
  assert.match(app, /event\.key !== 'Escape'/);
  assert.match(app, /trapSearchFocus/);
  assert.match(app, /trapMenuFocus/);
});

test('el diálogo destructivo de categorías gestiona foco, Tab y Escape', () => {
  const admin = read('src/app/features/admin/admin-products-page.component.ts');
  const template = read('src/app/shared/ui/confirm-dialog.component.html');
  const dialog = read('src/app/shared/ui/confirm-dialog.component.ts');
  assert.match(admin, /await this.confirmDialog.open/);
  assert.match(template, /aria-modal="true"/);
  assert.match(template, /data-cancel autofocus/);
  assert.match(template, /\(cancel\)="onCancel\(\$event\)"/);
  assert.match(dialog, /trapFocus/);
  assert.match(dialog, /returnFocus\.focus/);
});

test('checkout enfoca el primer control inválido tras validar', () => {
  const checkout = read('src/app/features/checkout/checkout-page.component.ts');
  assert.match(checkout, /focusFirstInvalidField\(\)/);
  assert.match(checkout, /\.checkout-form \[aria-invalid="true"\]/);
  assert.match(checkout, /target\?\.focus\(\)/);
  assert.match(checkout, /aria-label="Número de teléfono"/);
});

test('auth y contacto no dependen del placeholder como nombre accesible', () => {
  const login = read('src/app/features/auth/login-page.component.ts');
  const register = read('src/app/features/auth/register-page.component.ts');
  const contact = read('src/app/features/contact/contact-page.component.ts');
  assert.match(login, /aria-label="Email"/);
  assert.match(login, /aria-label="Contraseña"/);
  assert.match(register, /aria-label="Nombre completo"/);
  assert.match(contact, /aria-label="Mensaje"/);
});

test('el tema se determina antes de cargar la aplicación y no usa el esquema del sistema', () => {
  const index = read('src/index.html');
  const theme = read('src/app/core/services/theme.service.ts');
  assert.match(index, /localStorage\.getItem\('theme-mode'\)/);
  assert.match(index, /document\.documentElement\.setAttribute\('data-theme', theme\)/);
  assert.match(index, /data-theme="light"/);
  assert.doesNotMatch(index, /prefers-color-scheme/);
  assert.doesNotMatch(theme, /prefers-color-scheme/);
  assert.match(theme, /DEFAULT_THEME: ThemeMode = 'light'/);
  assert.match(theme, /THEME_STORAGE_KEY = 'theme-mode'/);
});

test('productos y categorías reutilizan la carga durante cinco minutos', () => {
  const products = read('src/app/core/services/catalog.service.ts');
  const categories = read('src/app/core/services/product-category.service.ts');
  assert.match(products, /PRODUCTS_REQUEST_CACHE_MS = 5 \* 60_000/);
  assert.match(categories, /PUBLIC_CATEGORIES_CACHE_MS = 5 \* 60_000/);
});
