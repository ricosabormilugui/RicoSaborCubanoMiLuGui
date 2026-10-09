import "dotenv/config";
import { closeMongoConnection, getCollection } from "../src/lib/mongo.js";
import { getProductsCollectionName } from "../src/repositories/products.repository.js";

const apply = process.argv.includes("--apply");
const slug = "tarta-personalizada";

async function run() {
  const collection = await getCollection(getProductsCollectionName());
  const product = await collection.findOne(
    { slug },
    { projection: { _id: 1, slug: 1, category: 1, "customizationOptions.decorations": 1, "customizationOptions.groupSettings.decorations": 1 } }
  );
  if (!product) throw new Error(`No se encontró el producto ${slug}.`);
  if (String(product.category ?? "").trim().toLowerCase() !== "tartas") {
    throw new Error(`El producto ${slug} no pertenece a la categoría estructurada tartas.`);
  }

  const decorations = product.customizationOptions?.decorations;
  if (!Array.isArray(decorations) || decorations.length === 0) {
    throw new Error(`El producto ${slug} no tiene opciones de Decoración; no se modificó.`);
  }

  const current = product.customizationOptions?.groupSettings?.decorations ?? {};
  const alreadyCorrect = current.required === false && current.selectionType === "single";
  console.log(JSON.stringify({
    mode: apply ? "apply" : "dry-run",
    productId: String(product._id),
    slug,
    current,
    decorationOptions: decorations.map((option) => ({ name: option.name, priceModifier: option.priceModifier ?? option.price ?? 0 })),
    alreadyCorrect
  }, null, 2));

  if (!apply || alreadyCorrect) return;
  await collection.updateOne(
    { _id: product._id },
    { $set: {
      "customizationOptions.groupSettings.decorations.required": false,
      "customizationOptions.groupSettings.decorations.selectionType": "single",
      updatedAt: new Date().toISOString()
    } }
  );

  const verified = await collection.findOne(
    { _id: product._id },
    { projection: { "customizationOptions.groupSettings.decorations": 1 } }
  );
  const settings = verified?.customizationOptions?.groupSettings?.decorations;
  if (settings?.required !== false || settings?.selectionType !== "single") {
    throw new Error("La verificación posterior falló.");
  }
  console.log("Verificación OK: Decoración es opcional y admite como máximo una opción.");
}

try {
  await run();
} finally {
  await closeMongoConnection();
}
