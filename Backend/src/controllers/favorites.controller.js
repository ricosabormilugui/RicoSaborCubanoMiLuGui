import { parseFavoriteId, parseFavoriteIds } from "../config/favorites.config.js";

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
    },
    async add(req, res) {
      const parsed = parseFavoriteId(req.params.productId);
      if (parsed.error) {
        return res.status(400).json({ message: parsed.error });
      }
      const favorites = await store.add(req.auth.sub, parsed.id);
      if (favorites == null) {
        return res.status(404).json({ message: "No se encontró la cuenta." });
      }
      return res.json({ favorites });
    },
    async remove(req, res) {
      const parsed = parseFavoriteId(req.params.productId);
      if (parsed.error) {
        return res.status(400).json({ message: parsed.error });
      }
      const favorites = await store.remove(req.auth.sub, parsed.id);
      if (favorites == null) {
        return res.status(404).json({ message: "No se encontró la cuenta." });
      }
      return res.json({ favorites });
    },
    async removeMany(req, res) {
      const parsed = parseFavoriteIds(req.body?.ids);
      if (parsed.error) {
        return res.status(400).json({ message: parsed.error });
      }
      const favorites = await store.removeMany(req.auth.sub, parsed.ids);
      if (favorites == null) {
        return res.status(404).json({ message: "No se encontró la cuenta." });
      }
      return res.json({ favorites });
    }
  };
}
