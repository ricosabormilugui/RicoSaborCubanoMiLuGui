import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('el detalle de producto conserva precio dinámico, carrito personalizado y SEO', async () => {
  const source = await read('src/app/features/catalog/product-detail-page.component.ts');

  assert.match(source, /title: `\$\{product\.name\} · \$\{categoryLabel\}`/);
  assert.match(source, /saveToHistory: true/);
  assert.match(source, /hasAllRequiredCustomizations/);
  assert.match(source, /buildCartCustomizationSelections/);
  assert.match(source, /this\.cart\.add\(evaluation\.product, customization, evaluation\.quantity\)/);
  assert.match(source, /calculateFinalUnitPrice/);
  assert.doesNotMatch(source, /loadProducts\(\)/);
  assert.doesNotMatch(source, /sku:\s*product\.id/);
});

test('el detalle rediseñado usa configurador semántico, related cards y sticky mobile', async () => {
  const [source, template, styles] = await Promise.all([
    read('src/app/features/catalog/product-detail-page.component.ts'),
    read('src/app/features/catalog/product-detail-page.component.html'),
    read('src/app/features/catalog/product-detail-page.component.css')
  ]);

  assert.match(source, /ProductCardComponent/);
  assert.match(source, /adjustQuantity\(/);
  assert.match(source, /IntersectionObserver/);
  assert.match(source, /optionPreviewLimit = 8/);
  assert.match(source, /groupLayout\(/);
  assert.match(source, /Selecciona \$\{incomplete\.label\} para continuar/);
  assert.match(template, /app-product-card/);
  assert.match(template, /app-add-to-cart-button/);
  assert.match(template, /<fieldset/);
  assert.match(template, /role]="group.selectionType === 'multiple' \? 'checkbox' : 'radio'/);
  assert.match(template, /class="sticky-buy"/);
  assert.match(template, /class="qty"/);
  assert.doesNotMatch(template, /mini-product/);
  assert.doesNotMatch(template, /type="number"/);
  assert.doesNotMatch(source, /swiper|slick|splide|glightbox/i);
  assert.match(styles, /object-fit: contain/);
  assert.match(styles, /\.thumb img \{[^}]*object-fit: contain/s);
  assert.match(styles, /env\(safe-area-inset-bottom/);
  assert.match(styles, /prefers-reduced-motion: reduce/);
  assert.match(styles, /min-height: 44px/);
  assert.match(styles, /z-index: 40/);
});
