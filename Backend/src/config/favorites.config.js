export const MAX_FAVORITES = 200;
export const MAX_FAVORITE_ID_LENGTH = 128;

export function parseFavoriteIds(value) {
  if (!Array.isArray(value)) {
    return { error: "favorites debe ser una lista de identificadores." };
  }
  if (value.length > MAX_FAVORITES) {
    return { error: `No puedes guardar más de ${MAX_FAVORITES} favoritos.` };
  }

  const seen = new Set();
  const ids = [];
  for (const item of value) {
    if (item != null && typeof item !== "string" && typeof item !== "number") {
      return { error: "Cada favorito debe ser un identificador de producto." };
    }
    const id = String(item ?? "").trim();
    if (!id) continue;
    if (id.length > MAX_FAVORITE_ID_LENGTH) {
      return { error: "Un identificador de producto no es válido." };
    }
    if (seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
  }

  return { ids };
}
