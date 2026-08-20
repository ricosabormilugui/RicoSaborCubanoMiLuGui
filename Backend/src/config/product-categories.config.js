export const PRODUCT_CATEGORIES = [
  { slug: "combos", label: "Combos" },
  { slug: "platos", label: "Platos" },
  { slug: "tartas", label: "Tartas" },
  { slug: "dulces-gourmet", label: "Dulces Gourmet" },
  { slug: "aperitivos", label: "Aperitivos" },
  { slug: "bebidas", label: "Bebidas" },
  { slug: "extras", label: "Extras" }
];

export const DEFAULT_PRODUCT_CATEGORY = "platos";

export function normalizeCategorySlug(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, " y ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
