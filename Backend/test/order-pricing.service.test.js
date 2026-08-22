import assert from "node:assert/strict";
import test from "node:test";
import { calculateCanonicalOrderItems, OrderPricingError } from "../src/services/order-pricing.service.js";

const products = new Map([
  ["normal", { _id: "normal", name: "Pastelito", description: "Guayaba", price: 2.5, available: true, published: true }],
  ["custom", {
    _id: "custom",
    name: "Tarta personalizada",
    description: "A medida",
    price: 35,
    available: true,
    published: true,
    customizationOptions: {
      sizes: [{ name: "Pequeña" }, { name: "Mediana", priceModifier: 10 }, { name: "Grande", priceModifier: 20 }],
      fillings: [{ name: "Chocolate" }, { name: "Premium", priceModifier: 5 }],
      decorations: [{ name: "Especial", priceModifier: 8 }, { name: "Topper", priceModifier: 5 }],
      groupSettings: {
        sizes: { selectionType: "single", required: true },
        fillings: { selectionType: "single", required: false },
        decorations: { selectionType: "multiple", required: false }
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
      { ...selection("decorations", "Especial"), priceModifier: 0 }
    ]
  });
  assert.equal(item.unitPrice, 63);
});

test("cambiar una opción reemplaza su incremento", async () => {
  const medium = await price({ productId: "custom", quantity: 1, customization: [selection("sizes", "Mediana")] });
  const large = await price({ productId: "custom", quantity: 1, customization: [selection("sizes", "Grande")] });
  assert.equal(medium.unitPrice, 45);
  assert.equal(large.unitPrice, 55);
});

test("las opciones múltiples suman todas las selecciones", async () => {
  const item = await price({
    productId: "custom",
    quantity: 1,
    customization: [selection("sizes", "Pequeña"), selection("decorations", "Especial"), selection("decorations", "Topper")]
  });
  assert.equal(item.unitPrice, 48);
});

test("configuraciones distintas tienen identificadores distintos y las iguales coinciden", async () => {
  const first = await price({ productId: "custom", quantity: 1, customization: [selection("sizes", "Grande"), selection("decorations", "Topper")] });
  const reordered = await price({ productId: "custom", quantity: 1, customization: [selection("decorations", "Topper"), selection("sizes", "Grande")] });
  const different = await price({ productId: "custom", quantity: 1, customization: [selection("sizes", "Mediana"), selection("decorations", "Topper")] });
  assert.equal(first.configurationId, reordered.configurationId);
  assert.notEqual(first.configurationId, different.configurationId);
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
