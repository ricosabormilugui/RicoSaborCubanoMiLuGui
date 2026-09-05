import assert from "node:assert/strict";
import test from "node:test";
import {
  ALLERGEN_CATALOG,
  ALLERGEN_IDS,
  emptyFoodInformation,
  normalizeFoodInformation
} from "../src/config/allergens.config.js";

test("el catálogo de alérgenos tiene exactamente los 14 identificadores oficiales", () => {
  assert.deepEqual([...ALLERGEN_IDS], [
    "gluten",
    "crustaceans",
    "eggs",
    "fish",
    "peanuts",
    "milk",
    "celery",
    "mustard",
    "sulphites",
    "sesame",
    "molluscs",
    "soy",
    "nuts",
    "lupin"
  ]);
  assert.equal(ALLERGEN_CATALOG.length, 14);
  assert.equal(ALLERGEN_CATALOG.find((item) => item.id === "nuts")?.label, "Frutos de cáscara");
  assert.equal(ALLERGEN_CATALOG.some((item) => item.label === "Frutos secos"), false);
});

test("normaliza foodInformation vacío con defaults seguros", () => {
  assert.deepEqual(normalizeFoodInformation(undefined).value, emptyFoodInformation());
  assert.deepEqual(normalizeFoodInformation(null).value, emptyFoodInformation());
  assert.equal(normalizeFoodInformation({}).unknown.length, 0);
});

test("acepta ingredientes, contains, mayContain y nota, eliminando duplicados", () => {
  const result = normalizeFoodInformation({
    ingredients: "  Harina de trigo, huevo y leche  ",
    allergens: {
      contains: ["gluten", "GLUTEN", "eggs", "milk", "eggs"],
      mayContain: ["nuts", "nuts", "soy"]
    },
    allergenNotes: "  Puede variar según el relleno.  "
  });

  assert.equal(result.error, undefined);
  assert.deepEqual(result.unknown, []);
  assert.equal(result.value.ingredients, "Harina de trigo, huevo y leche");
  assert.deepEqual(result.value.allergens.contains, ["gluten", "eggs", "milk"]);
  assert.deepEqual(result.value.allergens.mayContain, ["nuts", "soy"]);
  assert.equal(result.value.allergenNotes, "Puede variar según el relleno.");
});

test("contains tiene prioridad y elimina el mismo alérgeno de mayContain", () => {
  const result = normalizeFoodInformation({
    allergens: {
      contains: ["gluten", "eggs"],
      mayContain: ["gluten", "nuts"]
    }
  });

  assert.deepEqual(result.value.allergens.contains, ["gluten", "eggs"]);
  assert.deepEqual(result.value.allergens.mayContain, ["nuts"]);
});

test("rechaza identificadores arbitrarios y estructuras inválidas", () => {
  const unknown = normalizeFoodInformation({
    allergens: { contains: ["gluten", "chocolate"], mayContain: ["trazas"] }
  });
  assert.deepEqual(unknown.value.allergens.contains, ["gluten"]);
  assert.deepEqual(unknown.unknown, ["chocolate", "trazas"]);

  const invalid = normalizeFoodInformation(["gluten"]);
  assert.equal(invalid.error, "foodInformation must be an object");
});
