import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('the global header keeps the logo before the burger and exposes no global date selector', async () => {
  const source = await read('src/app/app.component.ts');
  const logoPosition = source.indexOf('class="nav-brand"');
  const menuPosition = source.indexOf('id="menu-trigger"');

  assert.ok(logoPosition >= 0 && logoPosition < menuPosition);
  assert.doesNotMatch(source, /openCalendar|Elegir fecha de entrega|badge-date/);
  assert.match(source, /brand-logo-header\{height:clamp\(50px,14vw,54px\)\}/);
});

test('home renders the public admin categories at a bounded size and keeps favorites scrollable', async () => {
  const [component, template, styles] = await Promise.all([
    read('src/app/features/home/home-page.component.ts'),
    read('src/app/features/home/home-page.component.html'),
    read('src/app/features/home/home-page.component.css')
  ]);

  assert.doesNotMatch(component, /filter\(\(category\) => Boolean\(category\.imageUrl\)\)/);
  assert.match(component, /productCategories\.categories\(\)\.map/);
  assert.match(component, /const imageUrl = categoryImages\[category\.slug\] \|\| ''/);
  assert.doesNotMatch(component, /products\.find|fallbackImage\s*$/m);
  assert.match(template, /class="collections" \*ngIf="collections\(\)\.length"/);
  assert.match(template, /class="collection-photo" \*ngIf="category\.imageUrl"/);
  assert.match(template, /\[class\.no-image\]="!category\.imageUrl"/);
  assert.match(template, /\[attr\.loading\]="category\.priority \? 'eager' : 'lazy'"/);
  assert.match(styles, /flex:\s*0 0 clamp\(168px, 18vw, 240px\)/);
  assert.match(styles, /max-width:\s*240px/);
  assert.match(styles, /\.product-image\s*\{[^}]*aspect-ratio:\s*4\s*\/\s*3/s);
  assert.match(styles, /\.product-image img\s*\{[^}]*height:\s*100%/s);
  assert.match(styles, /\.product-grid\s*\{[^}]*overflow-x:\s*auto/s);
  assert.match(styles, /flex:\s*0 0 min\(68vw, 220px\)/);
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
