import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('A-I: Destacados / Más vendidos compactos, catálogo y favoritos personales intactos', async () => {
  const [
    copy,
    collection,
    card,
    homeHtml,
    catalog,
    catalogCss,
    detail,
    detailCss,
    favorites,
    favoritesService,
    homeCss,
    accountMenu
  ] = await Promise.all([
    read('src/app/core/config/best-sellers.config.ts'),
    read('src/app/shared/ui/product-collection.css'),
    read('src/app/shared/ui/product-card.component.ts'),
    read('src/app/features/home/home-page.component.html'),
    read('src/app/features/catalog/catalog-page.component.html'),
    read('src/app/features/catalog/catalog-page.component.css'),
    read('src/app/features/catalog/product-detail-page.component.html'),
    read('src/app/features/catalog/product-detail-page.component.css'),
    read('src/app/features/account/favorites-page.component.html'),
    read('src/app/core/services/favorites.service.ts'),
    read('src/app/features/home/home-page.component.css'),
    read('src/app/shared/ui/account-menu.component.ts')
  ]);

  assert.match(copy, /BEST_SELLERS_EYEBROW = 'Destacados'/);
  assert.match(copy, /BEST_SELLERS_TITLE = 'Más vendidos'/);

  const commercialTemplates = [homeHtml, catalog, detail];
  for (const template of commercialTemplates) {
    assert.match(template, /bestSellersEyebrow/);
    assert.match(template, /bestSellersTitle/);
    assert.match(template, /density="compact"/);
    assert.match(template, /class="product-collection"/);
    assert.doesNotMatch(template, /Los favoritos/i);
    assert.doesNotMatch(template, /eyebrow">Favoritos/i);
  }

  const catalogMain = catalog.match(/filteredProducts\(\)[\s\S]*?<\/div>/);
  assert.ok(catalogMain);
  assert.doesNotMatch(catalogMain[0], /density="compact"/);

  assert.match(favorites, /Mis favoritos/);
  assert.match(accountMenu, /Mis favoritos/);
  assert.doesNotMatch(favorites, /bestSellersEyebrow|DESTACADOS|Más vendidos/);
  assert.doesNotMatch(favorites, /density="compact"/);

  assert.match(favoritesService, /ADMIN_FAVORITES_UNAVAILABLE_MESSAGE/);
  assert.match(card, /showFavoriteAction = computed\(\(\) => !this\.auth\.isAdminAccount\(\)\)/);
  assert.match(card, /:host\.is-compact \.product-image \{\s*aspect-ratio: 1 \/ 1/);
  assert.match(collection, /overflow-x:\s*auto/);
  assert.match(collection, /scroll-snap-type:\s*x proximity/);
  assert.match(collection, /flex:\s*0 0 152px/);

  assert.doesNotMatch(homeCss, /:host\.is-compact/);
  assert.doesNotMatch(catalogCss, /:host\.is-compact/);
  assert.doesNotMatch(detailCss, /:host\.is-compact/);
  assert.doesNotMatch(catalogCss, /aspect-ratio:\s*1\s*\/\s*1/);
  assert.doesNotMatch(detailCss, /related-grid/);
});
