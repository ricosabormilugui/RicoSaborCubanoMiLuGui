import { getCollection } from "../lib/mongo.js";

const HOME_SETTINGS_ID = "home";

function getHomeCollectionName() {
  return process.env.MONGODB_HOME_COLLECTION ?? "home_settings";
}

async function getHomeCollection() {
  return getCollection(getHomeCollectionName());
}

export function toHomeContent(document) {
  const categoryImages = document?.categoryImages && typeof document.categoryImages === "object"
    ? document.categoryImages
    : {};

  return {
    heroImageUrl: String(document?.heroImageUrl ?? "").trim(),
    cubanImageUrl: String(document?.cubanImageUrl ?? "").trim(),
    cakesImageUrl: String(document?.cakesImageUrl ?? "").trim(),
    spanishImageUrl: String(document?.spanishImageUrl ?? "").trim(),
    categoryImages: Object.fromEntries(
      Object.entries(categoryImages).map(([slug, value]) => [slug, String(value ?? "").trim()])
    )
  };
}

export async function getHomeContent() {
  const collection = await getHomeCollection();
  const document = await collection.findOne({ _id: HOME_SETTINGS_ID });
  return toHomeContent(document);
}

export async function saveHomeContent(payload) {
  const collection = await getHomeCollection();
  const content = toHomeContent(payload);
  const updatedAt = new Date();

  await collection.updateOne(
    { _id: HOME_SETTINGS_ID },
    { $set: { ...content, updatedAt } },
    { upsert: true }
  );

  return content;
}
