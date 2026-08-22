import assert from "node:assert/strict";
import test from "node:test";
import { createCategoryHandlers } from "../src/controllers/categories.controller.js";
import { requireAdmin } from "../src/middleware/auth.middleware.js";

function mockResponse() {
  return {
    statusCode: 200,
    body: undefined,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    }
  };
}

function createFakeRepository({ exists = true, productCount = 0 } = {}) {
  const state = {
    category: exists ? { _id: "category-1", slug: "postres", label: "Postres" } : null,
    products: Array.from({ length: productCount }, (_, index) => ({ _id: `product-${index + 1}`, category: "postres" })),
    deleted: false
  };

  return {
    state,
    async findCategoryById() {
      return state.category;
    },
    async countProductsForCategory(slug) {
      return state.products.filter((product) => product.category === slug).length;
    },
    async deleteCategoryById() {
      if (!state.category) return false;
      state.category = null;
      state.deleted = true;
      return true;
    }
  };
}

test("elimina una categoría existente sin productos", async () => {
  const repository = createFakeRepository();
  const response = mockResponse();
  await createCategoryHandlers(repository).remove({ params: { id: "category-1" } }, response);
  assert.equal(response.statusCode, 200);
  assert.equal(response.body.deleted, true);
  assert.equal(repository.state.deleted, true);
});

test("rechaza eliminar una categoría con productos y conserva los productos", async () => {
  const repository = createFakeRepository({ productCount: 2 });
  const productsBefore = repository.state.products.map((product) => ({ ...product }));
  const response = mockResponse();
  await createCategoryHandlers(repository).remove({ params: { id: "category-1" } }, response);
  assert.equal(response.statusCode, 409);
  assert.equal(response.body.productCount, 2);
  assert.equal(repository.state.deleted, false);
  assert.deepEqual(repository.state.products, productsBefore);
});

test("responde 404 al eliminar una categoría inexistente", async () => {
  const repository = createFakeRepository({ exists: false });
  const response = mockResponse();
  await createCategoryHandlers(repository).remove({ params: { id: "missing" } }, response);
  assert.equal(response.statusCode, 404);
  assert.match(response.body.message, /no existe/i);
});

test("una llamada manual a la API tampoco puede borrar una categoría referenciada", async () => {
  const repository = createFakeRepository({ productCount: 1 });
  const response = mockResponse();
  await createCategoryHandlers(repository).remove({ params: { id: "category-1" }, body: { force: true } }, response);
  assert.equal(response.statusCode, 409);
  assert.equal(repository.state.deleted, false);
  assert.equal(repository.state.products.length, 1);
});

test("una categoría puede eliminarse cuando otro flujo permitido deja de referenciarla", async () => {
  const repository = createFakeRepository({ productCount: 1 });
  repository.state.products = [];
  const response = mockResponse();
  await createCategoryHandlers(repository).remove({ params: { id: "category-1" } }, response);
  assert.equal(response.statusCode, 200);
  assert.equal(repository.state.deleted, true);
});

test("la ruta administrativa rechaza llamadas públicas sin token", () => {
  const response = mockResponse();
  let continued = false;
  requireAdmin({ headers: {} }, response, () => { continued = true; });
  assert.equal(response.statusCode, 401);
  assert.equal(continued, false);
});

test("rechaza nombres duplicados aunque cambien mayúsculas y espacios", async () => {
  const repository = {
    async findCategoryByNormalizedName(name) {
      return name.toLowerCase().includes("tartas") ? { _id: "existing", slug: "tartas" } : null;
    },
    async createCategory() {
      throw new Error("No debería crear una categoría duplicada");
    }
  };
  const response = mockResponse();
  await createCategoryHandlers(repository).create({ body: { label: "  TARTAS  " } }, response);
  assert.equal(response.statusCode, 409);
  assert.match(response.body.message, /ya existe/i);
});
