import assert from "node:assert/strict";
import test from "node:test";
import { createPublicProductHandler } from "../src/controllers/products.controller.js";
import { buildIndexableProductQuery } from "../src/repositories/products.repository.js";
import { allocateUniqueProductSlug, normalizeProductSlug, planProductSlugMigration } from "../src/utils/product-slug.js";

function response() {
  return {
    statusCode: 200,
    body: undefined,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; }
  };
}

test("normaliza acentos, espacios y caracteres especiales", () => {
  assert.equal(normalizeProductSlug("  Tarta de cumpleaños cubana!!!  "), "tarta-de-cumpleanos-cubana");
  assert.equal(normalizeProductSlug("Café & Coco / 100%"), "cafe-coco-100");
});

test("resuelve colisiones sin cambiar un slug libre", async () => {
  const reserved = new Set(["tarta-cubana", "tarta-cubana-2"]);
  assert.equal(await allocateUniqueProductSlug("Tarta cubana", async (slug) => reserved.has(slug)), "tarta-cubana-3");
  assert.equal(await allocateUniqueProductSlug("Flan casero", async (slug) => reserved.has(slug)), "flan-casero");
});

test("la planificación de migración es determinista e idempotente", async () => {
  const input = [
    { _id: "1", name: "Tarta cubana" },
    { _id: "2", name: "Tarta cubana" },
    { _id: "3", name: "Flan", slug: "flan" }
  ];
  const first = await planProductSlugMigration(input);
  assert.deepEqual(first.map((item) => item.slug), ["tarta-cubana", "tarta-cubana-2", "flan"]);
  const second = await planProductSlugMigration(first.map(({ product, slug }) => ({ ...product, slug })));
  assert.equal(second.every((item) => !item.changed), true);
});

test("el endpoint directo devuelve producto y relacionados por slug", async () => {
  const product = { _id: "p1", slug: "tarta-cubana", published: true, available: true };
  const handler = createPublicProductHandler({
    findProduct: async (identifier) => identifier === product.slug ? product : null,
    listRelated: async () => [{ _id: "p2", slug: "flan" }]
  });
  const res = response();
  await handler({ params: { identifier: "tarta-cubana" } }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.product.slug, "tarta-cubana");
  assert.equal(res.body.relatedProducts.length, 1);
});

test("el endpoint mantiene compatibilidad temporal con Mongo ID y devuelve 404 para no públicos", async () => {
  const legacyId = "507f1f77bcf86cd799439011";
  const handler = createPublicProductHandler({
    findProduct: async (identifier) => identifier === legacyId ? { _id: legacyId, slug: "tarta-legacy", published: true, available: true } : null,
    listRelated: async () => []
  });
  const legacyResponse = response();
  await handler({ params: { identifier: legacyId } }, legacyResponse);
  assert.equal(legacyResponse.statusCode, 200);
  assert.equal(legacyResponse.body.product.slug, "tarta-legacy");

  const missingResponse = response();
  await handler({ params: { identifier: "borrador-no-publico" } }, missingResponse);
  assert.equal(missingResponse.statusCode, 404);
});

test("la política indexable conserva agotados publicados y excluye despublicados mediante el filtro Mongo", () => {
  assert.deepEqual(buildIndexableProductQuery(), {
    published: true,
    $or: [{ available: true }, { trackStock: true, stock: { $lte: 0 } }]
  });
});
