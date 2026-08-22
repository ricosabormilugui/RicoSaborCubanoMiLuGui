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

export function getProductCategoryLabel(value) {
  const raw = String(value ?? "").trim();
  const slug = normalizeCategorySlug(raw);
  const category = PRODUCT_CATEGORIES.find((item) => item.slug === slug);

  if (category) return category.label;
  if (!raw) return "";

  return raw
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1)}`)
    .join(" ");
}
