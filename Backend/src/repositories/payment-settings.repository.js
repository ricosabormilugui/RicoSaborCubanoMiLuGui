import { getCollection } from "../lib/mongo.js";

export const PAYMENT_SETTINGS_ID = "payment";

function getPaymentCollectionName() {
  return process.env.MONGODB_PAYMENT_COLLECTION ?? "payment_settings";
}

async function getPaymentCollection() {
  return getCollection(getPaymentCollectionName());
}

export async function findPaymentSettingsDocument() {
  const collection = await getPaymentCollection();
  return collection.findOne({ _id: PAYMENT_SETTINGS_ID });
}

export async function savePaymentSettingsDocument(settings, { updatedBy } = {}) {
  const collection = await getPaymentCollection();
  const updatedAt = new Date();
  const document = {
    ...settings,
    updatedAt,
    updatedBy: updatedBy ?? null
  };

  await collection.updateOne(
    { _id: PAYMENT_SETTINGS_ID },
    { $set: document },
    { upsert: true }
  );

  return { ...document, _id: PAYMENT_SETTINGS_ID };
}

export function createMemoryPaymentSettingsRepository(initial = null) {
  const state = { document: initial };

  return {
    state,
    async findPaymentSettingsDocument() {
      return state.document;
    },
    async savePaymentSettingsDocument(settings, { updatedBy } = {}) {
      const updatedAt = new Date();
      state.document = {
        _id: PAYMENT_SETTINGS_ID,
        ...settings,
        updatedAt,
        updatedBy: updatedBy ?? null
      };
      return state.document;
    }
  };
}
