import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('the global header keeps the burger before the logo and exposes no global date selector', async () => {
  const source = await read('src/app/app.component.ts');
  const logoPosition = source.indexOf('class="nav-brand"');
  const menuPosition = source.indexOf('id="menu-trigger"');

  assert.ok(menuPosition >= 0 && menuPosition < logoPosition);
  assert.doesNotMatch(source, /openCalendar|Elegir fecha de entrega|badge-date/);
  assert.match(source, /brand-logo-header\{height:clamp\(50px,14vw,54px\)\}/);
  assert.doesNotMatch(source, /\.nav-left\s*>\s*\.nav-brand[\s\S]{0,80}order:/);
});

test('navbar actions share a frameless icon target and keep a 44px mobile hit area', async () => {
  const source = await read('src/app/app.component.ts');

  assert.match(source, /class="icon-btn cart-box"/);
  assert.match(source, /class="icon-btn theme-btn"/);
  assert.doesNotMatch(source, /theme-btn desktop-only/);
  assert.doesNotMatch(source, /\.cart-box\{[^}]*border:1px solid/);
  assert.doesNotMatch(source, /\.theme-btn\{[^}]*border:1px solid/);
  assert.match(source, /\.icon-btn,\.cart-box,\.theme-btn\{width:44px;height:44px;flex:0 0 44px\}/);
  assert.match(source, /aria-label="Carrito"/);
  assert.match(source, /Activar modo claro/);
});

test('home renders the public admin categories at a bounded size and two product cards per row on mobile', async () => {
  const [component, template, styles, card, collection] = await Promise.all([
    read('src/app/features/home/home-page.component.ts'),
    read('src/app/features/home/home-page.component.html'),
    read('src/app/features/home/home-page.component.css'),
    read('src/app/shared/ui/product-card.component.ts'),
    read('src/app/shared/ui/product-collection.css')
  ]);

  assert.doesNotMatch(component, /filter\(\(category\) => Boolean\(category\.imageUrl\)\)/);
  assert.match(component, /productCategories\.categories\(\)\.map/);
  assert.match(component, /const imageUrl = categoryImages\[category\.slug\] \|\| ''/);
  assert.doesNotMatch(component, /products\.find|fallbackImage\s*$/m);
  assert.match(template, /class="collections" \*ngIf="collections\(\)\.length"/);
  assert.match(template, /class="collection-photo" \*ngIf="category\.imageUrl"/);
  assert.match(template, /\[class\.no-image\]="!category\.imageUrl"/);
  assert.match(template, /\[attr\.loading\]="category\.priority \? 'eager' : 'lazy'"/);
  assert.match(template, /app-product-card/);
  assert.match(styles, /flex:\s*0 0 clamp\(168px, 18vw, 240px\)/);
  assert.match(styles, /max-width:\s*240px/);
  assert.match(collection, /\.product-collection\s*\{[^}]*repeat\(auto-fill,\s*160px\)/s);
  assert.match(styles, /\.brick-media\s*\{[^}]*aspect-ratio:\s*16\s*\/\s*10/s);
  assert.match(styles, /\.collection-photo\s*\{[^}]*aspect-ratio:\s*1\s*\/\s*1/s);
  assert.doesNotMatch(styles, /aspect-ratio:\s*16\s*\/\s*9/);
  assert.doesNotMatch(styles, /\.brick-media\s*\{[^}]*aspect-ratio:\s*4\s*\/\s*3/s);
  assert.match(card, /\.product-image\s*\{[^}]*aspect-ratio:\s*1\s*\/\s*1/s);
  assert.match(card, /\.product-image img\s*\{[^}]*height:\s*100%/s);
});

test('catalog product cards stay compact and two-up from the mobile base', async () => {
  const styles = await read('src/app/features/catalog/catalog-page.component.css');
  const template = await read('src/app/features/catalog/catalog-page.component.html');
  const card = await read('src/app/shared/ui/product-card.component.ts');

  assert.match(styles, /\.grid\s*\{[^}]*grid-template-columns:\s*repeat\(2,/s);
  assert.match(styles, /repeat\(4,\s*minmax\(0,\s*260px\)\)/);
  assert.match(card, /density = input<'default' \| 'compact'>/);
  assert.match(card, /:host\.is-compact \{[^}]*max-width:\s*160px/s);
  assert.match(card, /\.product-image\s*\{[^}]*aspect-ratio:\s*1\s*\/\s*1/s);
  assert.match(card, /object-fit:\s*contain/);
  assert.match(card, /-webkit-line-clamp:\s*2/);
  assert.match(card, /@media \(hover: hover\) and \(pointer: fine\)/);
  assert.doesNotMatch(styles, /aspect-ratio:\s*16\s*\/\s*10/);
  assert.doesNotMatch(template, /product-description/);
  assert.doesNotMatch(template, /Ver detalles/);
  assert.match(template, /app-product-card/);
  const catalogMain = template.match(/filteredProducts\(\)[\s\S]*?<\/div>/);
  assert.ok(catalogMain);
  assert.doesNotMatch(catalogMain[0], /density="compact"/);
  assert.doesNotMatch(catalogMain[0], /variant="compact"/);
  assert.match(template, /class="best-sellers"[\s\S]*density="compact"/);
});

test('the mobile footer centers the real brand logo', async () => {
  const source = await read('src/app/app.component.ts');

  assert.match(source, /\.footer-identity\{align-self:center;width:100%;justify-items:center;text-align:center\}/);
  assert.match(source, /\.brand-logo-footer\{height:88px\}/);
});

test('cookie consent remains conditional and the mobile dialog is viewport-safe', async () => {
  const source = await read('src/app/shared/ui/cookie-banner.component.ts');

  assert.match(source, /\*ngIf="!cookies\.hasDecision\(\)"/);
  assert.match(source, /aria-modal="true"/);
  assert.match(source, /max-height:100dvh/);
  assert.match(source, /max-height:calc\(100dvh - 2rem\)/);
  assert.match(source, /cookies\.rejectOptional\(\)/);
  assert.match(source, /cookies\.acceptAll\(\)/);
  assert.match(source, /saveCustom\(\)/);
});
