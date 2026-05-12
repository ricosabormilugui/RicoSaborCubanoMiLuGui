import "dotenv/config";
import express from "express";
import ordersRouter from "./routes/orders.routes.js";
import authRouter from "./routes/auth.routes.js";
import adminRouter from "./routes/admin.routes.js";
import productsRouter from "./routes/products.routes.js";
import contactRouter from "./routes/contact.routes.js";
import newsletterRouter from "./routes/newsletter.routes.js";
import { logger } from "./lib/logger.js";

const app = express();
const corsOrigin = process.env.CORS_ORIGIN || "*";

app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", corsOrigin);
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }

  return next();
});

app.use(express.json());

app.use((req, res, next) => {
  if (!req.path.startsWith("/api")) return next();

  const startedAt = Date.now();
  const path = req.originalUrl ?? req.url;
  logger.info("api.request", { method: req.method, path });
  res.on("finish", () => {
    logger.info("api.response", {
      method: req.method,
      path,
      status: res.statusCode,
      durationMs: Date.now() - startedAt
    });
  });

  return next();
});

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.use("/api", ordersRouter);
app.use("/api", productsRouter);
app.use("/api", contactRouter);
app.use("/api", newsletterRouter);
app.use("/api/auth", authRouter);
app.use("/api/admin", adminRouter);

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`Backend running on port ${PORT}`);
});