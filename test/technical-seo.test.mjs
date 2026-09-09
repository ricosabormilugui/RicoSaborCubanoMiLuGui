import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('caso SEO 1: un producto inexistente limpia metadata específica sin canonicar al catálogo', () => {
  const detail = read('src/app/features/catalog/product-detail-page.component.ts');
  const rules = read('shared/seo-page-rules.mjs');
  assert.match(detail, /resolveProductSeoPhase/);
  assert.match(detail, /removeJsonLd\('product'\)/);
  assert.match(detail, /removeJsonLd\('breadcrumb'\)/);
  assert.match(rules, /noindex,follow/);
  assert.doesNotMatch(detail, /canonicalPath:\s*['"]\/productos['"]/);
});

test('caso SEO 2: la ruta 404 muestra UX propia y genera noindex', () => {
  const routes = read('src/app/app.routes.ts');
  const page = read('src/app/features/not-found/not-found-page.component.ts');
  assert.match(routes, /path: '\*\*'/);
  assert.doesNotMatch(routes, /path: '\*\*', redirectTo/);
  assert.match(routes, /robots: 'noindex,follow'/);
  assert.match(page, /Página no encontrada/);
});

test('caso SEO 3: búsqueda, precio y ordenación no alteran el canonical del catálogo', () => {
  const catalog = read('src/app/features/catalog/catalog-page.component.ts');
  const rules = read('shared/seo-page-rules.mjs');
  assert.match(catalog, /resolveCatalogSeo/);
  assert.match(catalog, /routeCategory: this\.routeCategory\(\)/);
  assert.match(rules, /path: '\/productos'/);
  assert.doesNotMatch(catalog, /canonicalPath:\s*.*(?:query|minPrice|maxPrice|sortBy)/);
});

test('caso SEO 4: cada navegación SPA retira el JSON-LD anterior', () => {
  const app = read('src/app/app.component.ts');
  const seo = read('src/app/core/services/seo.service.ts');
  const routes = read('src/app/app.routes.ts');
  assert.match(app, /event instanceof NavigationStart/);
  assert.match(app, /this\.seo\.clearPageMetadata\(\)/);
  assert.match(seo, /removeJsonLd\('product'\)/);
  assert.match(seo, /removeJsonLd\('breadcrumb'\)/);
  assert.match(routes, /productSeoResolver/);
  assert.match(routes, /catalogSeoResolver/);
});

test('caso SEO 5: loading y error de API conservan index,follow en la ficha', () => {
  const detail = read('src/app/features/catalog/product-detail-page.component.ts');
  const rules = read('shared/seo-page-rules.mjs');
  assert.match(detail, /detailStatus/);
  assert.match(detail, /status !== 404/);
  assert.match(rules, /httpStatus === 0 \|\| Number\(httpStatus\) >= 500/);
  assert.match(rules, /phase === 'not-found' \|\| phase === 'unavailable' \? 'noindex,follow' : 'index,follow'/);
});
