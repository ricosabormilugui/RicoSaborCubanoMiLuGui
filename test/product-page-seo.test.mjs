import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import ts from 'typescript';

const source = readFileSync(new URL('../src/app/core/seo/seo-page-rules.ts', import.meta.url), 'utf8');
const js = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 }
}).outputText;
const {
  isProductOrderable,
  isPublicIndexableProduct,
  productPathFromIdentifier,
  resolveCatalogSeo,
  resolveProductCanonicalPath,
  resolveProductRobots,
  resolveProductSeoPhase
} = await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);

const validProduct = {
  name: 'Tarta Capuchino Cubano',
  slug: 'tarta-capuchino-cubano',
  published: true,
  available: true,
  trackStock: false,
  stock: 0,
  price: 28
};

test('producto válido: index,follow y canonical por slug', () => {
  const phase = resolveProductSeoPhase({
    identifier: 'tarta-capuchino-cubano',
    loading: false,
    product: validProduct
  });
  assert.equal(phase, 'ready');
  assert.equal(resolveProductRobots(phase), 'index,follow');
  assert.equal(
    resolveProductCanonicalPath({ identifier: 'tarta-capuchino-cubano', product: validProduct }),
    '/producto/tarta-capuchino-cubano'
  );
});

test('producto inexistente: noindex y canonical propio, nunca /productos', () => {
  const phase = resolveProductSeoPhase({
    identifier: 'tarta-capuchino-cubano',
    loading: false,
    product: null,
    httpStatus: 404
  });
  assert.equal(phase, 'not-found');
  assert.equal(resolveProductRobots(phase), 'noindex,follow');
  assert.equal(
    resolveProductCanonicalPath({ identifier: 'tarta-capuchino-cubano', product: null }),
    '/producto/tarta-capuchino-cubano'
  );
  assert.notEqual(resolveProductCanonicalPath({ identifier: 'tarta-capuchino-cubano', product: null }), '/productos');
});

test('producto no publicado: noindex', () => {
  const phase = resolveProductSeoPhase({
    identifier: 'tarta-borrador',
    loading: false,
    product: { ...validProduct, slug: 'tarta-borrador', published: false }
  });
  assert.equal(phase, 'unavailable');
  assert.equal(resolveProductRobots(phase), 'noindex,follow');
  assert.equal(isPublicIndexableProduct({ ...validProduct, published: false }), false);
});

test('producto oculto manualmente: noindex', () => {
  const hidden = { ...validProduct, available: false, trackStock: false, stock: 0 };
  assert.equal(isPublicIndexableProduct(hidden), false);
  assert.equal(resolveProductSeoPhase({
    identifier: hidden.slug,
    loading: false,
    product: hidden
  }), 'unavailable');
});

test('producto agotado público: index,follow y no orderable', () => {
  const soldOut = { ...validProduct, available: false, trackStock: true, stock: 0 };
  const phase = resolveProductSeoPhase({
    identifier: soldOut.slug,
    loading: false,
    product: soldOut
  });
  assert.equal(isPublicIndexableProduct(soldOut), true);
  assert.equal(isProductOrderable(soldOut), false);
  assert.equal(phase, 'ready');
  assert.equal(resolveProductRobots(phase), 'index,follow');
});

test('loading y error de API no aplican noindex ni canonical de catálogo', () => {
  const loading = resolveProductSeoPhase({
    identifier: 'tarta-clasica-cubana',
    loading: true,
    product: null
  });
  const failed = resolveProductSeoPhase({
    identifier: 'tarta-clasica-cubana',
    loading: false,
    product: null,
    httpStatus: 0,
    loadError: 'timeout'
  });
  assert.equal(loading, 'loading');
  assert.equal(failed, 'error');
  assert.equal(resolveProductRobots(loading), 'index,follow');
  assert.equal(resolveProductRobots(failed), 'index,follow');
  assert.equal(productPathFromIdentifier('tarta-clasica-cubana'), '/producto/tarta-clasica-cubana');
});

test('navegación SPA de catálogo a producto y de producto A a B cambia el canonical', () => {
  const fromCatalog = resolveCatalogSeo({ routeCategory: '' });
  assert.equal(fromCatalog.canonicalPath, '/productos');
  const first = resolveProductCanonicalPath({ identifier: 'tarta-capuchino-cubano', product: validProduct });
  const second = resolveProductCanonicalPath({
    identifier: 'tarta-clasica-cubana',
    product: { ...validProduct, slug: 'tarta-clasica-cubana' }
  });
  assert.equal(first, '/producto/tarta-capuchino-cubano');
  assert.equal(second, '/producto/tarta-clasica-cubana');
  assert.notEqual(first, fromCatalog.canonicalPath);
  assert.notEqual(first, second);
});

test('categoría válida con productos es indexable; inválida y vacía no', () => {
  const valid = resolveCatalogSeo({
    routeCategory: 'tartas',
    invalidCategory: false,
    emptyCategory: false,
    categoriesReady: true
  });
  const empty = resolveCatalogSeo({
    routeCategory: 'tartas',
    invalidCategory: false,
    emptyCategory: true,
    categoriesReady: true
  });
  const invalid = resolveCatalogSeo({
    routeCategory: 'no-existe',
    invalidCategory: true,
    emptyCategory: false,
    categoriesReady: true
  });
  assert.equal(valid.robots, 'index,follow');
  assert.equal(valid.canonicalPath, '/categoria/tartas');
  assert.equal(empty.robots, 'noindex,follow');
  assert.equal(empty.canonicalPath, '/categoria/tartas');
  assert.equal(invalid.robots, 'noindex,follow');
  assert.equal(invalid.canonicalPath, '/productos');
});

test('filtros de /productos no cambian el canonical', () => {
  const catalog = resolveCatalogSeo({ routeCategory: '', categoriesReady: true });
  assert.equal(catalog.canonicalPath, '/productos');
  assert.equal(catalog.robots, 'index,follow');
});

test('el canonical de producto prioriza slug y no un Mongo ID', () => {
  const path = resolveProductCanonicalPath({
    identifier: '507f1f77bcf86cd799439011',
    product: { ...validProduct, slug: 'tarta-capuchino-cubano' }
  });
  assert.equal(path, '/producto/tarta-capuchino-cubano');
  assert.doesNotMatch(path, /507f1f77bcf86cd799439011/);
});
