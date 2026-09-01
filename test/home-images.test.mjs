import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

function brickMediaRule(styles) {
  const match = styles.match(/\.brick-media \{\s*flex:[^}]+\}/);
  assert.ok(match, 'falta la regla principal .brick-media');
  return match[0];
}

function brickMediaImgRule(styles) {
  const match = styles.match(/\.brick-media img\s*\{[^}]+\}/);
  assert.ok(match, 'falta la regla .brick-media img');
  return match[0];
}

test('A-F: hero y bricks editoriales comparten frame 16:10 y cover', async () => {
  const [styles, template] = await Promise.all([
    read('src/app/features/home/home-page.component.css'),
    read('src/app/features/home/home-page.component.html')
  ]);
  const media = brickMediaRule(styles);
  const img = brickMediaImgRule(styles);

  assert.match(media, /aspect-ratio:\s*16\s*\/\s*10/);
  assert.match(media, /max-width:\s*760px/);
  assert.match(media, /background:\s*transparent/);
  assert.match(styles, /\.brick\s*\{[^}]*gap:\s*clamp\(1\.6rem/s);
  assert.match(styles, /\.brick-copy\s*\{[^}]*justify-content:\s*center/s);
  assert.doesNotMatch(styles, /\.brick-copy\s*\{[^}]*justify-content:\s*flex-end/s);
  assert.match(styles, /\.brick-copy-inner\s*\{[^}]*margin-inline:\s*auto/s);
  assert.match(styles, /\.brick-copy-inner\s*\{[^}]*max-width:\s*36rem/s);
  assert.match(styles, /\.brick-copy-inner\s*\{[^}]*text-align:\s*left/s);
  assert.doesNotMatch(styles, /\.brick-copy-inner\s*\{[^}]*text-align:\s*center/s);
  assert.match(img, /width:\s*100%/);
  assert.match(img, /height:\s*100%/);
  assert.match(img, /object-fit:\s*cover/);
  assert.match(img, /object-position:\s*center center/);
  assert.doesNotMatch(img, /object-fit:\s*contain/);
  assert.doesNotMatch(styles, /aspect-ratio:\s*16\s*\/\s*9/);
  assert.doesNotMatch(styles, /\.brick-media\s*\{[^}]*aspect-ratio:\s*4\s*\/\s*3/s);
  assert.equal([...template.matchAll(/class="brick-media"/g)].length, 4);
  assert.match(template, /class="brick brick-reverse"/);
});

test('G-L: categorías 1:1, Más vendidos compacto, catálogo y admin intactos', async () => {
  const [home, homeHtml, card, catalog, detail, global, collection] = await Promise.all([
    read('src/app/features/home/home-page.component.css'),
    read('src/app/features/home/home-page.component.html'),
    read('src/app/shared/ui/product-card.component.ts'),
    read('src/app/features/catalog/catalog-page.component.html'),
    read('src/app/features/catalog/product-detail-page.component.css'),
    read('src/styles.scss'),
    read('src/app/shared/ui/product-collection.css')
  ]);

  assert.match(home, /\.collection-photo\s*\{[^}]*aspect-ratio:\s*1\s*\/\s*1/s);
  assert.match(home, /\.collection-card\s*\{[^}]*flex:\s*0 0 clamp\(168px, 18vw, 240px\)/s);
  assert.match(home, /\.collection-photo img\s*\{[^}]*object-fit:\s*contain/s);
  assert.match(collection, /\.product-collection\s*\{[^}]*repeat\(auto-fill,\s*160px\)/s);
  assert.match(collection, /flex:\s*0 0 152px/);
  assert.match(homeHtml, /density="compact"/);
  assert.match(homeHtml, /class="collection-card"/);

  assert.match(card, /density = input<'default' \| 'compact'>/);
  assert.match(card, /:host\.is-compact \.product-image \{\s*aspect-ratio: 1 \/ 1/);
  assert.match(card, /\.product-image img\s*\{[^}]*object-fit:\s*contain/s);
  assert.match(card, /\.product-image\s*\{[^}]*aspect-ratio:\s*1\s*\/\s*1/s);
  assert.doesNotMatch(card, /object-fit:\s*cover/);
  assert.match(card, /showFavoriteAction = computed\(\(\) => !this\.auth\.isAdminAccount\(\)\)/);

  const catalogMain = catalog.match(/filteredProducts\(\)[\s\S]*?<\/div>/);
  assert.ok(catalogMain, 'falta el grid principal del catálogo');
  assert.doesNotMatch(catalogMain[0], /density="compact"/);
  assert.doesNotMatch(catalogMain[0], /variant="compact"/);
  assert.match(catalog, /class="best-sellers"[\s\S]*density="compact"/);
  assert.match(homeHtml, /density="compact"/);
  assert.match(detail, /object-fit: contain/);
  assert.match(detail, /object-fit: contain/);
  assert.doesNotMatch(global, /\.brick-media/);
});

test('A-M: Destacados compactos en Home, catálogo default y misma lógica de producto', async () => {
  const [home, homeHtml, card, catalog, favorites, related, adminProducts, collection] = await Promise.all([
    read('src/app/features/home/home-page.component.css'),
    read('src/app/features/home/home-page.component.html'),
    read('src/app/shared/ui/product-card.component.ts'),
    read('src/app/features/catalog/catalog-page.component.html'),
    read('src/app/features/account/favorites-page.component.html'),
    read('src/app/features/catalog/product-detail-page.component.html'),
    read('src/app/features/admin/admin-products-page.component.html'),
    read('src/app/shared/ui/product-collection.css')
  ]);

  const bestSellers = homeHtml.match(/class="best-sellers"[\s\S]*?<\/section>/);
  assert.ok(bestSellers, 'falta la sección Más vendidos');
  assert.doesNotMatch(bestSellers[0], /Favoritos/i);
  assert.match(bestSellers[0], /bestSellersEyebrow/);
  assert.match(bestSellers[0], /bestSellersTitle/);
  assert.match(bestSellers[0], /density="compact"/);
  assert.match(bestSellers[0], /Ver todos los productos/);

  const catalogMain = catalog.match(/filteredProducts\(\)[\s\S]*?<\/div>/);
  assert.ok(catalogMain);
  assert.doesNotMatch(catalogMain[0], /density="compact"/);
  assert.doesNotMatch(favorites, /density="compact"/);
  assert.match(related, /density="compact"/);

  assert.match(card, /:host\.is-compact \{[^}]*max-width:\s*160px/s);
  assert.match(card, /:host\.is-compact \{[^}]*height:\s*auto/s);
  assert.match(card, /:host\.is-compact \.product-image \{\s*aspect-ratio: 1 \/ 1/);
  assert.match(card, /\.product-image img\s*\{[^}]*object-fit:\s*contain/s);
  assert.match(card, /\.product-image img\s*\{[^}]*object-position:\s*center/s);
  assert.match(card, /:host\.is-compact \.body \{[^}]*padding:\s*\.28rem \.34rem \.3rem/s);
  assert.match(card, /:host\.is-compact \.body \{[^}]*flex:\s*none/s);
  assert.match(card, /:host\.is-compact \.product-name \{\s*min-height:\s*0/);
  assert.match(card, /:host\.is-compact \.meta \{\s*min-height:\s*34px/);
  assert.match(card, /:host\.is-compact \.meta \{\s*[^}]*margin-top:\s*0/s);
  assert.match(card, /:host\.is-compact \.cta \{\s*width:\s*34px/);
  assert.doesNotMatch(card, /:host\.is-compact \.body \{[^}]*flex:\s*1 1 auto/s);
  assert.doesNotMatch(card, /:host\.is-compact \.meta \{\s*margin-top:\s*auto/);
  assert.doesNotMatch(card, /:host\.is-compact \.product-name \{\s*min-height:\s*2\.46em/);
  assert.match(card, /-webkit-line-clamp:\s*2/);
  assert.match(card, /isProductCustomizable|customizable\(\)/);
  assert.match(card, /lucideArrowRight/);
  assert.match(card, /lucidePlus/);
  assert.match(card, /showFavoriteAction = computed\(\(\) => !this\.auth\.isAdminAccount\(\)\)/);
  assert.match(card, /isCompact\(\) \? \[160, 320, 400\]/);
  assert.match(card, /imageWidth = computed\(\(\) => this\.isCompact\(\) \? 360 : 800\)/);
  assert.match(card, /readonly product = input\.required<Product>\(\)/);
  assert.match(card, /isProductOrderable/);
  assert.match(card, /FavoritesService/);

  assert.match(collection, /overflow-x:\s*auto/);
  assert.match(collection, /scroll-snap-type:\s*x proximity/);
  assert.match(collection, /flex:\s*0 0 152px/);
  assert.match(collection, /justify-content:\s*start/);
  assert.doesNotMatch(collection, /\.product-collection\s*\{[^}]*1fr/s);

  assert.match(adminProducts, /1000×1000 px \(1:1\)/);
});
