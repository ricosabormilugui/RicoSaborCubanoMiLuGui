import "dotenv/config";
import { closeMongoConnection, getCollection, getConfiguredDbName } from "../src/lib/mongo.js";
import {
  describePendingReservation,
  historicalOrdersCollectionName,
  HISTORICAL_PENDING_FILTER,
  isHistoricalPendingWithoutExpiry
} from "../src/services/pending-payment-reservation-diagnosis.service.js";

async function diagnosePendingPaymentReservations() {
  const collectionName = historicalOrdersCollectionName();
  const collection = await getCollection(collectionName);
  const documents = await collection
    .find(HISTORICAL_PENDING_FILTER)
    .project({
      orderId: 1,
      createdAt: 1,
      paymentMethod: 1,
      paymentStatus: 1,
      status: 1,
      paymentExpiresAt: 1,
      inventoryReleasedAt: 1,
      "payment.method": 1,
      "payment.status": 1
    })
    .sort({ createdAt: 1 })
    .toArray();

  const now = new Date();
  const orders = documents
    .filter(isHistoricalPendingWithoutExpiry)
    .map((order) => describePendingReservation(order, now));

  console.log(JSON.stringify({
    database: getConfiguredDbName(),
    collection: collectionName,
    scanned: documents.length,
    historicalPendingWithoutExpiry: orders.length,
    holdingInventory: orders.filter((order) => order.holdsInventory).length,
    strategy: "diagnose-only",
    note: "No se modifican pedidos. La cancelación y liberación de stock deben ser revisión manual. Si más adelante se migra expiry, usar createdAt + paymentReservationMinutes, nunca now + 120.",
    orders
  }, null, 2));
}

try {
  await diagnosePendingPaymentReservations();
} finally {
  await closeMongoConnection();
}
