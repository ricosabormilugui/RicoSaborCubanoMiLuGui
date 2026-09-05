export const ALLERGEN_IDS = Object.freeze([
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

export const ALLERGEN_CATALOG = Object.freeze([
  { id: "gluten", label: "Gluten" },
  { id: "crustaceans", label: "Crustáceos" },
  { id: "eggs", label: "Huevos" },
  { id: "fish", label: "Pescado" },
  { id: "peanuts", label: "Cacahuetes" },
  { id: "milk", label: "Leche" },
  { id: "celery", label: "Apio" },
  { id: "mustard", label: "Mostaza" },
  { id: "sulphites", label: "Sulfitos" },
  { id: "sesame", label: "Sésamo" },
  { id: "molluscs", label: "Moluscos" },
  { id: "soy", label: "Soja" },
  { id: "nuts", label: "Frutos de cáscara" },
  { id: "lupin", label: "Altramuces" }
]);

const ALLERGEN_ID_SET = new Set(ALLERGEN_IDS);

export function emptyFoodInformation() {
  return {
    ingredients: "",
    allergens: {
      contains: [],
      mayContain: []
    },
    allergenNotes: ""
  };
}

function normalizeAllergenList(value) {
  const values = Array.isArray(value) ? value : (value == null || value === "" ? [] : [value]);
  const seen = new Set();
  const ids = [];
  const unknown = [];

  for (const item of values) {
    const id = String(item ?? "").trim().toLowerCase();
    if (!id) continue;
    if (!ALLERGEN_ID_SET.has(id)) {
      unknown.push(id);
      continue;
    }
    if (seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
  }

  return { ids, unknown };
}

export function normalizeFoodInformation(value) {
  if (value == null) {
    return { value: emptyFoodInformation(), unknown: [] };
  }

  if (typeof value !== "object" || Array.isArray(value)) {
    return { error: "foodInformation must be an object", unknown: [] };
  }

  const containsResult = normalizeAllergenList(value.allergens?.contains);
  const mayContainResult = normalizeAllergenList(value.allergens?.mayContain);
  const containsSet = new Set(containsResult.ids);

  return {
    value: {
      ingredients: String(value.ingredients ?? "").trim(),
      allergens: {
        contains: containsResult.ids,
        mayContain: mayContainResult.ids.filter((id) => !containsSet.has(id))
      },
      allergenNotes: String(value.allergenNotes ?? "").trim()
    },
    unknown: [...new Set([...containsResult.unknown, ...mayContainResult.unknown])]
  };
}
