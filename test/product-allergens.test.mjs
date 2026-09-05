import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

const expectedIds = [
  'gluten',
  'crustaceans',
  'eggs',
  'fish',
  'peanuts',
  'milk',
  'celery',
  'mustard',
  'sulphites',
  'sesame',
  'molluscs',
  'soy',
  'nuts',
  'lupin'
];

test('el catálogo frontend de alérgenos es la fuente de verdad de MIXSABOR', async () => {
  const source = await read('src/app/core/config/allergens.config.ts');

  for (const id of expectedIds) {
    assert.match(source, new RegExp(`id: '${id}'`));
  }
  assert.match(source, /label: 'Frutos de cáscara'/);
  assert.doesNotMatch(source, /Frutos secos/);
  assert.match(source, /export function normalizeFoodInformation/);
  assert.match(source, /export function hasFoodInformation/);
});

test('el admin reutiliza el catálogo y evita duplicar contains en mayContain', async () => {
  const [source, template] = await Promise.all([
    read('src/app/features/admin/admin-products-page.component.ts'),
    read('src/app/features/admin/admin-products-page.component.html')
  ]);

  assert.match(source, /ALLERGEN_CATALOG/);
  assert.match(source, /toggleContains\(/);
  assert.match(source, /toggleMayContain\(/);
  assert.match(source, /foodInformation\.allergens\.mayContain = foodInformation\.allergens\.mayContain\.filter/);
  assert.match(source, /if \(foodInformation\.allergens\.contains\.includes\(id\)\) return;/);
  assert.match(template, /Ingredientes y alérgenos/);
  assert.match(template, /Selecciona los alérgenos presentes en el producto/);
  assert.match(template, /Puede contener/);
  assert.match(template, /Nota sobre alérgenos/);
  assert.match(template, /app-allergen-icon/);
  assert.doesNotMatch(template, /<select[^>]*allergen/i);
});

test('el detalle muestra alérgenos compactos y oculta el bloque vacío', async () => {
  const [source, template, styles, icons] = await Promise.all([
    read('src/app/features/catalog/product-detail-page.component.ts'),
    read('src/app/features/catalog/product-detail-page.component.html'),
    read('src/app/features/catalog/product-detail-page.component.css'),
    read('src/app/shared/ui/allergen-icon.component.ts')
  ]);

  assert.match(source, /hasProductFoodInformation/);
  assert.match(source, /showLegacyIngredients/);
  assert.match(template, /Ingredientes y alérgenos/);
  assert.match(template, /\*ngIf="hasProductFoodInformation\(product\(\)!\)"/);
  assert.match(template, /Puede contener trazas de/);
  assert.match(template, /class="allergen-list"/);
  assert.match(template, /class="food-note"/);
  assert.match(styles, /flex-wrap:\s*wrap/);
  assert.match(styles, /overflow-wrap:\s*anywhere/);
  assert.doesNotMatch(icons, /emoji|🥜|🌾|🥚/i);
  for (const id of expectedIds) {
    assert.match(icons, new RegExp(`@case \\('${id}'\\)`));
  }
});
