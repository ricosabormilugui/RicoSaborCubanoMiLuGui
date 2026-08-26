import "dotenv/config";
import { prepareNotifications } from "../repositories/notifications.repository.js";
import { closeMongoConnection } from "../lib/mongo.js";

try {
  await prepareNotifications();
  console.log("Notification indexes ready.");
} finally {
  await closeMongoConnection();
}
