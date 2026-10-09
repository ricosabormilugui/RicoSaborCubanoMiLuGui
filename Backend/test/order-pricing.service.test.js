import assert from "node:assert/strict";
import test from "node:test";
import { calculateCanonicalOrderItems, OrderPricingError } from "../src/services/order-pricing.service.js";

const products = new Map([
  ["normal", { _id: "normal", name: "Pastelito", description: "Guayaba", price: 2.5, available: true, published: true }],
  ["commercial-variant", { _id: "commercial-variant", name: "Tarta de queso", category: "tartas", price: 18, available: true, published: true }],
  ["configurable-normal", {
    _id: "configurable-normal",
    name: "Pack configurable",
    category: "combos",
    price: 12,
    available: true,
    published: true,
    customizationOptions: { sizes: [{ name: "Mediano" }] }
  }],
  ["custom", {
    _id: "custom",
    name: "Tarta personalizada",
    category: "tartas",
    description: "A medida",
    price: 35,
    available: true,
    published: true,
    customizationOptions: {
      sizes: [{ name: "Pequeña" }, { name: "Mediana", priceModifier: 10 }, { name: "Grande", priceModifier: 20 }],
      fillings: [{ name: "Chocolate" }, { name: "Premium", priceModifier: 5 }],
      decorations: [
        { name: "Imagen papel fotografico", priceModifier: 5 },
        { name: "Topper premium y flores artificiales", priceModifier: 10 },
        { name: "Flores naturales", priceModifier: 15 }
      ],
      groupSettings: {
        sizes: { selectionType: "single", required: true },
        fillings: { selectionType: "single", required: false },
        decorations: { selectionType: "single", required: false }
      }
    }
  }],
  ["legacy", {
    _id: "legacy",
    name: "Tarta antigua",
    price: 20,
    customizationOptions: { sizes: [{ name: "Única" }, { name: "Grande", price: 7 }] }
  }],
  ["precision", {
    _id: "precision",
    name: "Precio preciso",
    price: 39.99,
    customizationOptions: { sizes: [{ name: "Ajuste", priceModifier: 0.01 }] }
  }]
]);

const productFinder = async (id) => products.get(id) ?? null;
const selection = (groupKey, value) => ({ groupKey, value, label: groupKey });
const price = async (item) => (await calculateCanonicalOrderItems([item], { productFinder }))[0];

test("recalcula el precio de un producto normal e ignora el precio enviado", async () => {
  const item = await price({ productId: "normal", unitPrice: 1, quantity: 2 });
  assert.equal(item.basePrice, 2.5);
  assert.equal(item.unitPrice, 2.5);
});

test("solo la configuración real identifica un producto personalizado", async () => {
  const normal = await price({ productId: "normal", quantity: 1 });
  const commercialVariant = await price({ productId: "commercial-variant", quantity: 1 });
  const custom = await price({ productId: "custom", quantity: 1, customization: [selection("sizes", "Pequeña")] });
  assert.equal(normal.requiresAdvancePayment, false);
  assert.equal(commercialVariant.requiresAdvancePayment, false);
  assert.equal(custom.requiresAdvancePayment, true);
  assert.equal(normal.preparationNoticeHours, 24);
  assert.equal(commercialVariant.preparationNoticeHours, 48);
  assert.equal(custom.preparationNoticeHours, 48);
});

test("un producto normal configurable mantiene 24 horas", async () => {
  const item = await price({ productId: "configurable-normal", quantity: 1, customization: [selection("sizes", "Mediano")] });
  assert.equal(item.requiresAdvancePayment, true);
  assert.equal(item.preparationNoticeHours, 24);
});

test("producto personalizado sin extras conserva el precio base", async () => {
  const item = await price({ productId: "custom", unitPrice: 1, quantity: 1, customization: [selection("sizes", "Pequeña")] });
  assert.equal(item.unitPrice, 35);
});

test("suma una opción con incremento desde el producto almacenado", async () => {
  const item = await price({ productId: "custom", unitPrice: 1, quantity: 1, customization: [selection("sizes", "Mediana")] });
  assert.equal(item.unitPrice, 45);
  assert.equal(item.customization[0].priceModifier, 10);
});

test("suma varias opciones y nunca confía en los modificadores recibidos", async () => {
  const item = await price({
    productId: "custom",
    unitPrice: 1,
    quantity: 1,
    customization: [
      { ...selection("sizes", "Grande"), priceModifier: 0 },
      { ...selection("decorations", "Imagen papel fotografico"), priceModifier: 0 }
    ]
  });
  assert.equal(item.unitPrice, 60);
  assert.equal(item.preparationNoticeHours, 72);
});

test("cambiar una opción reemplaza su incremento", async () => {
  const medium = await price({ productId: "custom", quantity: 1, customization: [selection("sizes", "Mediana")] });
  const large = await price({ productId: "custom", quantity: 1, customization: [selection("sizes", "Grande")] });
  assert.equal(medium.unitPrice, 45);
  assert.equal(large.unitPrice, 55);
});

test("Decoración opcional admite cero o una opción, nunca varias", async () => {
  const withoutDecoration = await price({ productId: "custom", quantity: 1, customization: [selection("sizes", "Pequeña")] });
  assert.equal(withoutDecoration.preparationNoticeHours, 48);
  await assert.rejects(
    () => price({
      productId: "custom",
      quantity: 1,
      customization: [selection("sizes", "Pequeña"), selection("decorations", "Imagen papel fotografico"), selection("decorations", "Flores naturales")]
    }),
    (error) => error instanceof OrderPricingError && /Solo puede elegirse una opción/.test(error.message)
  );
});

test("cada decoración válida activa 72 horas desde la configuración canónica", async () => {
  for (const value of ["Imagen papel fotografico", "Topper premium y flores artificiales", "Flores naturales"]) {
    const item = await price({
      productId: "custom",
      quantity: 1,
      preparationNoticeHours: 24,
      customization: [selection("sizes", "Pequeña"), selection("decorations", value)]
    });
    assert.equal(item.preparationNoticeHours, 72);
  }
});

test("configuraciones distintas tienen identificadores distintos y las iguales coinciden", async () => {
  const first = await price({ productId: "custom", quantity: 1, preparationNoticeHours: 24, customization: [selection("sizes", "Grande"), selection("decorations", "Topper premium y flores artificiales")] });
  const reordered = await price({ productId: "custom", quantity: 1, preparationNoticeHours: 24, customization: [selection("decorations", "Topper premium y flores artificiales"), selection("sizes", "Grande")] });
  const different = await price({ productId: "custom", quantity: 1, preparationNoticeHours: 24, customization: [selection("sizes", "Mediana"), selection("decorations", "Topper premium y flores artificiales")] });
  assert.equal(first.configurationId, reordered.configurationId);
  assert.notEqual(first.configurationId, different.configurationId);
  assert.equal(first.preparationNoticeHours, 72);
});

test("rechaza opciones inexistentes", async () => {
  await assert.rejects(
    () => price({ productId: "custom", quantity: 1, customization: [selection("sizes", "Gigante")] }),
    (error) => error instanceof OrderPricingError && /no existe/.test(error.message)
  );
});

test("rechaza grupos obligatorios sin selección", async () => {
  await assert.rejects(
    () => price({ productId: "custom", quantity: 1, customization: [] }),
    (error) => error instanceof OrderPricingError && /Tamaño/.test(error.message)
  );
});

test("productos antiguos aceptan price y opciones sin modificador", async () => {
  const base = await price({ productId: "legacy", quantity: 1, customization: [selection("sizes", "Única")] });
  const extra = await price({ productId: "legacy", quantity: 1, customization: [selection("sizes", "Grande")] });
  assert.equal(base.unitPrice, 20);
  assert.equal(extra.unitPrice, 27);
});

test("calcula importes monetarios en céntimos sin residuos flotantes", async () => {
  const item = await price({ productId: "precision", quantity: 1, customization: [selection("sizes", "Ajuste")] });
  assert.equal(item.unitPrice, 40);
});
