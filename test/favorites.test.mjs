import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('la ruta /favoritos es lazy, protegida y reutiliza FavoritesService', async () => {
  const [routes, guard, page, service, auth, identity, login, register] = await Promise.all([
    read('src/app/app.routes.ts'),
    read('src/app/core/guards/customer.guard.ts'),
    read('src/app/features/account/favorites-page.component.ts'),
    read('src/app/core/services/favorites.service.ts'),
    read('src/app/core/services/customer-auth.service.ts'),
    read('src/app/core/utils/identity-storage.ts'),
    read('src/app/features/auth/login-page.component.ts'),
    read('src/app/features/auth/register-page.component.ts')
  ]);

  assert.match(routes, /path: 'favoritos'/);
  assert.match(routes, /loadComponent: \(\) => import\('\.\/features\/account\/favorites-page\.component'\)/);
  assert.match(routes, /path: 'favoritos'[\s\S]{0,280}canActivate: \[customerGuard\]/);
  assert.match(routes, /privateSeo\('Mis favoritos'/);
  assert.match(guard, /queryParams: \{ returnUrl: state\.url \}/);
  assert.match(login, /safe-return-url/);
  assert.match(register, /safe-return-url/);
  assert.match(page, /FavoritesService/);
  assert.match(page, /favorites\.ids\(\)/);
  assert.match(page, /hasLiveCatalog\(\)/);
  assert.match(page, /pruneMissing/);
  assert.doesNotMatch(page, /localStorage/);
  assert.match(service, /\/customer\/favorites/);
  assert.match(service, /method: 'POST'/);
  assert.match(service, /method: 'DELETE'/);
  assert.match(service, /syncAuthenticatedFavorites/);
  assert.match(service, /Inicia sesión para guardar productos en favoritos/);
  assert.match(service, /FAVORITES_LIMIT_MESSAGE/);
  assert.doesNotMatch(service, /adoptGuestFavorites/);
  assert.doesNotMatch(service, /guestIds/);
  assert.match(identity, /mixsabor\.guest\.favorites/);
  assert.match(auth, /await this\.favorites\.syncAuthenticatedFavorites\(\)/);
  assert.match(auth, /this\.favorites\.bindSession\(token/);
});

test('Mis favoritos reutiliza app-product-card, grid del catálogo y estado vacío', async () => {
  const [template, styles, catalogStyles, card] = await Promise.all([
    read('src/app/features/account/favorites-page.component.html'),
    read('src/app/features/account/favorites-page.component.css'),
    read('src/app/features/catalog/catalog-page.component.css'),
    read('src/app/shared/ui/product-card.component.ts')
  ]);

  assert.match(template, /<h1>Mis favoritos<\/h1>/);
  assert.match(template, /app-product-card/);
  assert.match(template, /\[addAction\]="addAction\(product\)"/);
  assert.doesNotMatch(template, /<app-(?!product-card)[\w-]*card/);
  assert.match(template, /Aún no tienes favoritos/);
  assert.match(template, /Guarda los productos que más te gusten/);
  assert.match(template, /routerLink="\/productos"/);
  assert.match(template, />Explorar productos<\/a>/);
  assert.match(template, /role="status"/);
  assert.match(styles, /\.grid\s*\{[^}]*grid-template-columns:\s*repeat\(2,/s);
  assert.match(catalogStyles, /\.grid\s*\{[^}]*grid-template-columns:\s*repeat\(2,/s);
  assert.match(card, /selector: 'app-product-card'/);
  assert.match(card, /this\.favorites\.toggle\(this\.product\(\)\.id\)/);
});

test('el acceso a favoritos queda en el menú autenticado', async () => {
  const [app, menu] = await Promise.all([
    read('src/app/app.component.ts'),
    read('src/app/shared/ui/account-menu.component.ts')
  ]);

  assert.match(app, /<app-account-menu/);
  assert.doesNotMatch(app, /openAccount\(/);
  assert.doesNotMatch(app, /userMenuOpen/);
  assert.match(menu, /routerLink="\/favoritos"/);
  assert.match(menu, /Mis favoritos/);
  assert.match(menu, /auth\.isAuthenticated\(\)/);
  assert.match(menu, /auth\.logout\(\)/);
  assert.doesNotMatch(app, /routerLink="\/favoritos"/);
  assert.doesNotMatch(app, /routerLink="\/favoritos"[\s\S]{0,80}class="icon-btn"/);
});
