import { logger } from "../lib/logger.js";
import { listCategories } from "../repositories/categories.repository.js";
import { listPublicProducts } from "../repositories/products.repository.js";
import { buildSitemap } from "../services/sitemap.service.js";

export const SITEMAP_CACHE_TTL_MS = 10 * 60_000;
const DEFAULT_SITE_URL = "https://ricosaborcubano.com";

function configuredSiteUrl() {
  return String(process.env.FRONTEND_URL ?? DEFAULT_SITE_URL).trim();
}

export function createSitemapHandler({
  loadProducts = listPublicProducts,
  loadCategories = listCategories,
  siteUrl = configuredSiteUrl(),
  now = () => Date.now()
} = {}) {
  let cache;

  return async function getSitemap(_req, res) {
    try {
      const timestamp = now();
      if (!cache || timestamp - cache.createdAt >= SITEMAP_CACHE_TTL_MS) {
        const [products, categories] = await Promise.all([loadProducts(), loadCategories()]);
        cache = {
          createdAt: timestamp,
          xml: buildSitemap({ siteUrl, products, categories })
        };
      }

      res.set("Content-Type", "application/xml; charset=utf-8");
      res.set("Cache-Control", "public, max-age=600, stale-if-error=3600");
      return res.status(200).send(cache.xml);
    } catch (error) {
      if (cache?.xml) {
        logger.warn("sitemap.refresh.failed_serving_stale", { error: error.message ?? "Unexpected error" });
        res.set("Content-Type", "application/xml; charset=utf-8");
        res.set("Cache-Control", "public, max-age=60, stale-if-error=3600");
        res.set("Warning", '110 - "Response is stale"');
        return res.status(200).send(cache.xml);
      }
      logger.error("sitemap.generate.failed", { error: error.message ?? "Unexpected error" });
      return res.status(503).type("text/plain").send("Unable to generate sitemap");
    }
  };
}

export const getSitemap = createSitemapHandler();
