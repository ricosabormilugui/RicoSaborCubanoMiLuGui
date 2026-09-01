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
  const [home, homeHtml, card, catalog, detail, global] = await Promise.all([
    read('src/app/features/home/home-page.component.css'),
    read('src/app/features/home/home-page.component.html'),
    read('src/app/shared/ui/product-card.component.ts'),
    read('src/app/features/catalog/catalog-page.component.html'),
    read('src/app/features/catalog/product-detail-page.component.css'),
    read('src/styles.scss')
  ]);

  assert.match(home, /\.collection-photo\s*\{[^}]*aspect-ratio:\s*1\s*\/\s*1/s);
  assert.match(home, /\.collection-card\s*\{[^}]*flex:\s*0 0 clamp\(168px, 18vw, 240px\)/s);
  assert.match(home, /\.collection-photo img\s*\{[^}]*object-fit:\s*contain/s);
  assert.match(home, /\.product-grid\s*\{[^}]*repeat\(5,\s*minmax\(0,\s*220px\)\)/s);
  assert.match(home, /flex:\s*0 0 172px/);
  assert.match(homeHtml, /density="compact"/);
  assert.match(homeHtml, /class="collection-card"/);

  assert.match(card, /density = input<'default' \| 'compact'>/);
  assert.match(card, /:host\.is-compact \.product-image \{\s*aspect-ratio: 1 \/ 1/);
  assert.match(card, /\.product-image img\s*\{[^}]*object-fit:\s*contain/s);
  assert.match(card, /\.product-image\s*\{[^}]*aspect-ratio:\s*4\s*\/\s*3/s);
  assert.doesNotMatch(card, /object-fit:\s*cover/);
  assert.match(card, /showFavoriteAction = computed\(\(\) => !this\.auth\.isAdminAccount\(\)\)/);

  assert.doesNotMatch(catalog, /density="compact"/);
  assert.doesNotMatch(catalog, /variant="compact"/);
  assert.match(detail, /object-fit: contain/);
  assert.doesNotMatch(global, /\.brick-media/);
});
