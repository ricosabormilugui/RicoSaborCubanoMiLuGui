import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('caso SEO 1: un producto inexistente limpia toda la metadata específica', () => {
  const detail = read('src/app/features/catalog/product-detail-page.component.ts');
  assert.match(detail, /robots: 'noindex,follow'/);
  assert.match(detail, /removeJsonLd\('product'\)/);
  assert.match(detail, /removeJsonLd\('breadcrumb'\)/);
});

test('caso SEO 2: la ruta 404 muestra UX propia y genera noindex', () => {
  const routes = read('src/app/app.routes.ts');
  const page = read('src/app/features/not-found/not-found-page.component.ts');
  assert.match(routes, /path: '\*\*'/);
  assert.doesNotMatch(routes, /path: '\*\*', redirectTo/);
  assert.match(routes, /robots: 'noindex,follow'/);
  assert.match(page, /Página no encontrada/);
});

test('caso SEO 3: búsqueda, precio y ordenación no alteran el canonical', () => {
  const catalog = read('src/app/features/catalog/catalog-page.component.ts');
  assert.match(catalog, /const path = category \? `\/categoria\/\$\{encodeURIComponent\(category\)\}` : '\/productos'/);
  assert.match(catalog, /canonicalPath: path/);
  assert.doesNotMatch(catalog, /canonicalPath:\s*.*(?:query|minPrice|maxPrice|sortBy)/);
});

test('caso SEO 4: cada navegación SPA retira el JSON-LD anterior', () => {
  const app = read('src/app/app.component.ts');
  const seo = read('src/app/core/services/seo.service.ts');
  assert.match(app, /event instanceof NavigationStart/);
  assert.match(app, /this\.seo\.clearPageMetadata\(\)/);
  assert.match(seo, /removeJsonLd\('product'\)/);
  assert.match(seo, /removeJsonLd\('breadcrumb'\)/);
});
