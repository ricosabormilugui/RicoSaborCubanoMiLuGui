import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const siteConfig = require("../../../shared/site.config.json");

export const PRODUCTION_SITE_URL = String(siteConfig.productionSiteUrl).replace(/\/$/, "");

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "0.0.0.0", "::1"]);

export function isPublicHttpsOrigin(value) {
  try {
    const url = new URL(String(value ?? "").trim());
    if (url.protocol !== "https:") return false;
    if (LOCAL_HOSTS.has(url.hostname.toLowerCase())) return false;
    if (url.username || url.password) return false;
    return Boolean(url.hostname);
  } catch {
    return false;
  }
}

export function resolvePublicWebOrigin(env = process.env) {
  const configured = String(env.FRONTEND_URL ?? "").trim();
  if (isPublicHttpsOrigin(configured)) return new URL(configured).origin;
  return PRODUCTION_SITE_URL;
}

export function joinPublicAssetUrl(pathname, env = process.env) {
  const origin = resolvePublicWebOrigin(env);
  const path = `/${String(pathname ?? "").replace(/^\/+/, "")}`;
  return new URL(path, `${origin}/`).toString();
}

export function getPublicSiteUrl() {
  return PRODUCTION_SITE_URL;
}
