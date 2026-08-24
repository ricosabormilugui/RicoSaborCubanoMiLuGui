import { readFileSync } from "node:fs";

export const BRAND_CONFIG = Object.freeze(JSON.parse(
  readFileSync(new URL("../../../shared/brand.config.json", import.meta.url), "utf8")
));
