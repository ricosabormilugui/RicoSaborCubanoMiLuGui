import assert from "node:assert/strict";
import test from "node:test";
import { createSitemapHandler, SITEMAP_CACHE_TTL_MS } from "../src/controllers/sitemap.controller.js";
import { buildSitemap, escapeXml } from "../src/services/sitemap.service.js";

const siteUrl = "https://mixsabor.milugui.com";

function sitemap(overrides = {}) {
  return buildSitemap({ siteUrl, products: [], categories: [], ...overrides });
}

function locations(xml) {
  return Array.from(xml.matchAll(/<loc>(.*?)<\/loc>/g), (match) => match[1]);
}

test("caso 1: incluye Home", () => {
  assert.ok(locations(sitemap()).includes(`${siteUrl}/`));
});

test("caso 2: incluye el catálogo", () => {
  assert.ok(locations(sitemap()).includes(`${siteUrl}/productos`));
});

test("caso 3: incluye un producto activo solo por slug y con su lastmod real", () => {
  const xml = sitemap({
    products: [{ _id: "507f1f77bcf86cd799439011", slug: "tarta-cubana", name: "Tarta", category: "tartas", published: true, available: true, updatedAt: "2026-08-20T12:30:00.000Z" }]
  });
  assert.match(xml, /\/producto\/tarta-cubana/);
  assert.doesNotMatch(xml, /507f1f77bcf86cd799439011/);
  assert.match(xml, /<lastmod>2026-08-20T12:30:00\.000Z<\/lastmod>/);
});

test("caso 4: excluye productos inactivos, borradores e incompletos", () => {
  const xml = sitemap({ products: [
    { slug: "inactive", name: "Inactivo", category: "platos", published: true, available: false },
    { slug: "draft", name: "Borrador", category: "platos", published: false, available: true },
    { slug: "incomplete", name: "", category: "platos", published: true, available: true },
    { _id: "507f1f77bcf86cd799439011", name: "Legacy sin slug", category: "platos", published: true, available: true }
  ] });
  assert.doesNotMatch(xml, /inactive|draft|incomplete/);
});

test("caso 5: no incluye rutas privadas", () => {
  const xml = sitemap();
  for (const route of ["admin", "login", "registro", "checkout", "carrito", "mis-pedidos"]) {
    assert.doesNotMatch(xml, new RegExp(`/${route}(?:<|/)`));
  }
});

test("caso 6: elimina URLs duplicadas", () => {
  const xml = sitemap({
    products: [
      { _id: "one", slug: "Tarta Especial", name: "Tarta A", category: "tartas", published: true, available: true },
      { _id: "two", slug: "tarta-especial", name: "Tarta B", category: "tartas", published: true, available: true }
    ],
    categories: [
      { slug: "tartas", label: "Tartas", productCount: 2 },
      { slug: "tartas", label: "Tartas", productCount: 2 }
    ]
  });
  const urls = locations(xml);
  assert.equal(urls.length, new Set(urls).size);
});

test("caso 7: genera un documento XML completo y bien formado", () => {
  const xml = sitemap({ categories: [{ slug: "tartas", label: "Tartas", productCount: 1 }] });
  assert.ok(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>'));
  assert.match(xml, /<urlset xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9">/);
  assert.ok(xml.trimEnd().endsWith("</urlset>"));
  assert.equal((xml.match(/<url>/g) ?? []).length, (xml.match(/<\/url>/g) ?? []).length);
  assert.equal((xml.match(/<loc>/g) ?? []).length, (xml.match(/<\/loc>/g) ?? []).length);
  assert.doesNotMatch(xml, /&(?!amp;|lt;|gt;|quot;|apos;)/);
});

test("caso 8: escapa correctamente caracteres reservados de XML", () => {
  assert.equal(escapeXml(`A&B <Tarta> "especial" 'hoy'`), "A&amp;B &lt;Tarta&gt; &quot;especial&quot; &apos;hoy&apos;");
});

test("incluye solo categorías públicas completas con ruta estable", () => {
  const xml = sitemap({ categories: [
    { slug: "dulces-gourmet", label: "Dulces Gourmet" },
    { slug: "sin-label", label: "", productCount: 1 },
    { slug: "vacia", label: "Vacía", productCount: 0 }
  ] });
  assert.doesNotMatch(xml, /\/categoria\/dulces-gourmet/);
  assert.doesNotMatch(xml, /\/categoria\/sin-label/);
  assert.doesNotMatch(xml, /\/categoria\/vacia/);
});

test("incluye categorías con contenido y productos publicados agotados", () => {
  const xml = sitemap({
    categories: [{ slug: "tartas", label: "Tartas", productCount: 1 }],
    products: [{ slug: "tarta-agotada", name: "Tarta agotada", category: "tartas", published: true, available: false, trackStock: true, stock: 0 }]
  });
  assert.match(xml, /\/categoria\/tartas/);
  assert.match(xml, /\/producto\/tarta-agotada/);
});

test("no publica dominios antiguos ni páginas legales placeholder", () => {
  const xml = sitemap();
  assert.doesNotMatch(xml, /ricosaborcubano\.com|ricosaborcubano\.netlify\.app/);
  assert.doesNotMatch(xml, /\/legal\//);
});

test("el endpoint sirve application/xml y reutiliza la caché durante diez minutos", async () => {
  let reads = 0;
  let timestamp = 1_000;
  const handler = createSitemapHandler({
    siteUrl,
    now: () => timestamp,
    loadProducts: async () => { reads += 1; return []; },
    loadCategories: async () => []
  });
  const response = {
    statusCode: 0,
    headers: {},
    body: "",
    set(name, value) { this.headers[name] = value; return this; },
    status(code) { this.statusCode = code; return this; },
    type(value) { this.headers["Content-Type"] = value; return this; },
    send(value) { this.body = value; return this; }
  };

  await handler({}, response);
  timestamp += SITEMAP_CACHE_TTL_MS - 1;
  await handler({}, response);

  assert.equal(reads, 1);
  assert.equal(response.statusCode, 200);
  assert.equal(response.headers["Content-Type"], "application/xml; charset=utf-8");
  assert.match(response.headers["Cache-Control"], /max-age=600/);
});

test("sirve sitemap stale si Mongo falla después de llenar la caché", async () => {
  let timestamp = 1_000;
  let fail = false;
  const handler = createSitemapHandler({
    siteUrl,
    now: () => timestamp,
    loadProducts: async () => {
      if (fail) throw new Error("mongo unavailable");
      return [];
    },
    loadCategories: async () => []
  });
  const response = {
    statusCode: 0, headers: {}, body: "",
    set(name, value) { this.headers[name] = value; return this; },
    status(code) { this.statusCode = code; return this; },
    type(value) { this.headers["Content-Type"] = value; return this; },
    send(value) { this.body = value; return this; }
  };
  await handler({}, response);
  const cached = response.body;
  timestamp += SITEMAP_CACHE_TTL_MS;
  fail = true;
  await handler({}, response);
  assert.equal(response.statusCode, 200);
  assert.equal(response.body, cached);
  assert.match(response.headers.Warning, /stale/i);
  assert.match(response.headers["Cache-Control"], /stale-if-error=3600/);
});
