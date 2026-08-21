import { logger } from "../lib/logger.js";
import { getHomeContent, saveHomeContent } from "../repositories/home.repository.js";
import { PRODUCT_CATEGORIES } from "../config/product-categories.config.js";

const IMAGE_FIELDS = ["heroImageUrl", "cubanImageUrl", "cakesImageUrl", "spanishImageUrl"];
const MAX_IMAGE_URL_LENGTH = 2000;

function normalizeImageUrl(value) {
  const url = String(value ?? "").trim();
  if (!url) return "";
  if (url.length > MAX_IMAGE_URL_LENGTH) return null;
  if (!/^https?:\/\//i.test(url)) return null;
  return url;
}

function buildPayload(body = {}) {
  const payload = {};
  const invalidFields = [];

  for (const field of IMAGE_FIELDS) {
    const url = normalizeImageUrl(body[field]);
    if (url === null) invalidFields.push(field);
    else payload[field] = url;
  }

  const categorySource = body.categoryImages && typeof body.categoryImages === "object"
    ? body.categoryImages
    : {};
  const categoryImages = {};

  for (const category of PRODUCT_CATEGORIES) {
    const url = normalizeImageUrl(categorySource[category.slug]);
    if (url === null) invalidFields.push(`categoryImages.${category.slug}`);
    else categoryImages[category.slug] = url;
  }

  payload.categoryImages = categoryImages;
  return { payload, invalidFields };
}

export async function getPublicHomeContent(_req, res) {
  try {
    const home = await getHomeContent();
    return res.status(200).json({ home });
  } catch (error) {
    logger.error("home.public.failed", { error: error.message ?? "Unexpected error" });
    return res.status(500).json({ error: error.message ?? "Unexpected error" });
  }
}

export async function getHomeContentForAdmin(_req, res) {
  try {
    const home = await getHomeContent();
    return res.status(200).json({ home });
  } catch (error) {
    logger.error("home.admin.get.failed", { error: error.message ?? "Unexpected error" });
    return res.status(500).json({ error: error.message ?? "Unexpected error" });
  }
}

export async function updateHomeContentForAdmin(req, res) {
  try {
    const { payload, invalidFields } = buildPayload(req.body);
    if (invalidFields.length) {
      return res.status(400).json({
        error: "Cada imagen debe ser una URL http o https, o quedar vacía.",
        fields: invalidFields
      });
    }

    const home = await saveHomeContent(payload);
    return res.status(200).json({ home });
  } catch (error) {
    logger.error("home.admin.update.failed", { error: error.message ?? "Unexpected error" });
    return res.status(500).json({ error: error.message ?? "Unexpected error" });
  }
}
