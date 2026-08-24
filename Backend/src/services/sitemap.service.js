import { normalizeCategorySlug } from "../config/product-categories.config.js";

const STATIC_PUBLIC_PATHS = [
  "/",
  "/productos",
  "/contacto",
  "/legal/aviso-legal",
  "/legal/privacidad",
  "/legal/cookies",
  "/legal/condiciones-compra",
  "/legal/envios",
  "/legal/devoluciones-cancelaciones"
];

export function escapeXml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function normalizeSiteUrl(siteUrl) {
  const parsed = new URL(String(siteUrl ?? "").trim());
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("Sitemap site URL must use http or https");
  }
  return parsed.origin;
}

function validLastModified(value) {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

function productPath(product) {
  const identifier = normalizeCategorySlug(product?.slug) || String(product?._id ?? product?.id ?? "").trim();
  return identifier ? `/producto/${encodeURIComponent(identifier)}` : "";
}

function categoryPath(category) {
  const slug = normalizeCategorySlug(category?.slug);
  const label = String(category?.label ?? "").trim();
  return slug && label ? `/categoria/${encodeURIComponent(slug)}` : "";
}

export function buildSitemap({ siteUrl, products = [], categories = [] }) {
  const origin = normalizeSiteUrl(siteUrl);
  const entries = new Map();

  const addEntry = (path, lastmod) => {
    if (!path) return;
    const loc = new URL(path, `${origin}/`).href;
    if (!entries.has(loc)) entries.set(loc, { loc, lastmod });
  };

  for (const path of STATIC_PUBLIC_PATHS) addEntry(path);

  for (const category of categories) {
    addEntry(categoryPath(category));
  }

  for (const product of products) {
    const complete = String(product?.name ?? "").trim() && String(product?.category ?? "").trim();
    if (product?.published !== true || product?.available !== true || !complete) continue;
    addEntry(productPath(product), validLastModified(product.updatedAt));
  }

  const rows = Array.from(entries.values()).map(({ loc, lastmod }) => {
    const lastmodXml = lastmod ? `\n    <lastmod>${escapeXml(lastmod)}</lastmod>` : "";
    return `  <url>\n    <loc>${escapeXml(loc)}</loc>${lastmodXml}\n  </url>`;
  });

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...rows,
    "</urlset>",
    ""
  ].join("\n");
}

export { STATIC_PUBLIC_PATHS };
