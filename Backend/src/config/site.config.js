import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const siteConfig = require("../../../shared/site.config.json");

export const PRODUCTION_SITE_URL = String(siteConfig.productionSiteUrl).replace(/\/$/, "");

export function getPublicSiteUrl() {
  return PRODUCTION_SITE_URL;
}
