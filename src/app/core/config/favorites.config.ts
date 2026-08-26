/** Defensive cap shared with the backend. A real wishlist stays far below this;
 *  an unbounded array would let a client grow a user document without checking
 *  that each ID exists. The server rejects over-limit writes instead of truncating. */
export const MAX_FAVORITES = 200;
export const MAX_FAVORITE_ID_LENGTH = 128;
export const FAVORITES_LIMIT_MESSAGE = `Has alcanzado el límite de ${MAX_FAVORITES} favoritos.`;

export function uniqueFavoriteIds(groups: Iterable<Iterable<unknown>>): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const group of groups) {
    for (const value of group) {
      const id = String(value ?? '').trim();
      if (!id || id.length > MAX_FAVORITE_ID_LENGTH || seen.has(id)) continue;
      seen.add(id);
      result.push(id);
    }
  }
  return result;
}
