import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const brand = JSON.parse(read('shared/brand.config.json'));

test('caso 1: la configuración central devuelve MIXSABOR y el slogan oficial', () => {
  assert.equal(brand.name, 'MIXSABOR');
  assert.equal(brand.slogan, 'Sabores que se encuentran');
});

test('caso 2: el tema claro selecciona el logo para fondo claro', () => {
  const source = read('src/app/core/config/brand.config.ts');
  assert.equal(brand.logos.light, '/assets/branding/logo_mixsabor_light_256.png');
  assert.match(source, /theme === 'dark' \? BRAND_CONFIG\.logos\.dark : BRAND_CONFIG\.logos\.light/);
});

test('caso 3: el tema oscuro selecciona el logo para fondo oscuro', () => {
  assert.equal(brand.logos.dark, '/assets/branding/logo_mixsabor_dark_256.png');
  assert.notEqual(brand.logos.dark, brand.logos.light);
});

test('caso 3.1: la pestaña del navegador utiliza el logo dark como favicon', () => {
  const index = read('src/index.html');
  assert.match(index, /<link rel="icon" type="image\/png" sizes="232x232" href="\/assets\/branding\/favicon_mixsabor_dark\.png" \/>/);
});

test('caso 4: Home genera el title de MIXSABOR con el slogan', () => {
  const source = read('src/app/features/home/home-page.component.ts');
  assert.match(source, /title: `\$\{this\.brand\.name\} \| \$\{this\.brand\.slogan\}`/);
});

test('caso 5: producto genera title dinámico y SeoService añade MIXSABOR', () => {
  const detail = read('src/app/features/catalog/product-detail-page.component.ts');
  const seoConfig = read('src/app/core/config/seo.config.ts');
  assert.match(detail, /title: `\$\{product\.name\} · \$\{categoryLabel\}`/);
  assert.match(seoConfig, /titleSuffix: BRAND_CONFIG\.name/);
});

test('caso 6: rutas privadas generan noindex y robots las excluye', () => {
  const routes = read('src/app/app.routes.ts');
  const robots = read('public/robots.txt');
  assert.match(routes, /robots: 'noindex,nofollow'/);
  for (const path of ['/admin', '/login', '/registro', '/recuperar-contrasena', '/reset-password', '/carrito', '/checkout', '/mis-pedidos']) {
    assert.match(routes, new RegExp(`['\"]${path.replace('/', '\\/')}['\"]`));
    assert.match(robots, new RegExp(`Disallow: ${path.replace('/', '\\/')}`));
  }
});

test('caso 7: canonical usa la URL configurada y actualiza el link único', () => {
  const seo = read('src/app/core/services/seo.service.ts');
  const seoConfig = read('src/app/core/config/seo.config.ts');
  assert.match(seoConfig, /siteUrl: environment\.siteUrl/);
  assert.match(seo, /querySelector<HTMLLinkElement>\('link\[rel="canonical"\]'\)/);
  assert.match(seo, /link\.setAttribute\('href', href\)/);
});

test('caso 8: structured data usa MIXSABOR y su slogan', () => {
  const seo = read('src/app/core/services/seo.service.ts');
  assert.match(seo, /name: this\.site\.business\.name/);
  assert.match(seo, /slogan: BRAND_CONFIG\.slogan/);
  assert.equal(brand.name, 'MIXSABOR');
});

test('caso 9: la navegación SPA limpia metadata anterior', () => {
  const app = read('src/app/app.component.ts');
  const seo = read('src/app/core/services/seo.service.ts');
  assert.match(app, /event instanceof NavigationStart/);
  assert.match(app, /this\.seo\.clearPageMetadata\(\)/);
  assert.match(seo, /removeJsonLd\('product'\)/);
  assert.match(seo, /removeJsonLd\('breadcrumb'\)/);
});

test('caso 10: los emails activos no contienen branding antiguo', () => {
  const email = read('Backend/src/services/email.service.js');
  const replies = read('Backend/src/controllers/admin-contacts.controller.js');
  assert.match(email, /BRAND_CONFIG\.name/);
  assert.doesNotMatch(`${email}\n${replies}`, /Rico Sabor|MiLuGui/i);
});

test('Open Graph, Twitter Cards, sitemap dinámico y robots están presentes', () => {
  const seo = read('src/app/core/services/seo.service.ts');
  const sitemap = read('Backend/src/services/sitemap.service.js');
  const netlify = read('netlify.toml');
  const robots = read('public/robots.txt');
  assert.match(seo, /og:site_name/);
  assert.match(seo, /twitter:card/);
  assert.match(sitemap, /"\/productos"/);
  assert.doesNotMatch(sitemap, /"\/(admin|login|registro|checkout|carrito|mis-pedidos)"/);
  assert.match(netlify, /from = "\/sitemap\.xml"/);
  assert.match(robots, /Sitemap: https:\/\/ricosaborcubano\.com\/sitemap\.xml/);
});
