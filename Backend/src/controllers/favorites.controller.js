import { parseFavoriteIds } from "../config/favorites.config.js";

export function createFavoritesController(store) {
  return {
    async get(req, res) {
      const favorites = await store.read(req.auth.sub);
      if (favorites == null) {
        return res.status(404).json({ message: "No se encontró la cuenta." });
      }
      return res.json({ favorites });
    },
    async put(req, res) {
      const parsed = parseFavoriteIds(req.body?.favorites);
      if (parsed.error) {
        return res.status(400).json({ message: parsed.error });
      }
      const favorites = await store.write(req.auth.sub, parsed.ids);
      if (favorites == null) {
        return res.status(404).json({ message: "No se encontró la cuenta." });
      }
      return res.json({ favorites });
    }
  };
}
