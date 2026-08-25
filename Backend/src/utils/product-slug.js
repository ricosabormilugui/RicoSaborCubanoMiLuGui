export function normalizeProductSlug(value) {
  return String(value ?? "")
    .trim()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-")
    .slice(0, 120)
    .replace(/-+$/g, "");
}

export async function allocateUniqueProductSlug(value, isTaken) {
  const base = normalizeProductSlug(value) || "producto";
  let candidate = base;
  let suffix = 2;

  while (await isTaken(candidate)) {
    const suffixText = `-${suffix}`;
    candidate = `${base.slice(0, 120 - suffixText.length).replace(/-+$/g, "")}${suffixText}`;
    suffix += 1;
  }

  return candidate;
}

export async function planProductSlugMigration(products = []) {
  const reserved = new Set();
  const plan = [];

  for (const product of products) {
    const current = String(product.slug ?? "").trim();
    const normalized = normalizeProductSlug(current);
    const canPreserve = current === normalized && normalized && !reserved.has(normalized);
    const slug = canPreserve
      ? normalized
      : await allocateUniqueProductSlug(normalized || product.name, async (candidate) => reserved.has(candidate));
    reserved.add(slug);
    plan.push({ product, current, slug, changed: slug !== current });
  }

  return plan;
}
