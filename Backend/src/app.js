import express from "express";
import notificationsRouter from "./routes/notifications.routes.js";
import ordersRouter from "./routes/orders.routes.js";
import authRouter from "./routes/auth.routes.js";
import adminRouter from "./routes/admin.routes.js";
import productsRouter from "./routes/products.routes.js";
import homeRouter from "./routes/home.routes.js";
import contactRouter from "./routes/contact.routes.js";
import newsletterRouter from "./routes/newsletter.routes.js";
import sitemapRouter from "./routes/sitemap.routes.js";
import favoritesRouter from "./routes/favorites.routes.js";
import { createHealthRouter } from "./routes/health.routes.js";
import { requestContext, requestLogger } from "./middleware/request-context.middleware.js";
import { cors, securityHeaders } from "./middleware/security.middleware.js";
import { apiNotFound, globalErrorHandler } from "./middleware/error.middleware.js";

export function createApp({ databaseCheck, environment = process.env.NODE_ENV ?? "development", configure } = {}) {
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", 1);
  app.use(requestContext);
  app.use(requestLogger());
  app.use(securityHeaders({ environment }));
  app.use(cors({
    origin: process.env.CORS_ORIGIN || process.env.FRONTEND_URL || (environment === "production" ? "" : "*"),
    environment
  }));
  app.use(express.json({ limit: process.env.JSON_BODY_LIMIT || "1mb" }));
  configure?.(app);

  const healthRouter = createHealthRouter({ databaseCheck });
  app.use("/api", healthRouter);
  app.get("/health", (_req, res) => res.redirect(307, "/api/health"));
  app.use("/api", ordersRouter);
  app.use("/api", productsRouter);
  app.use("/api", homeRouter);
  app.use("/api", contactRouter);
  app.use("/api", newsletterRouter);
  app.use("/api", sitemapRouter);
  app.use("/api/auth", authRouter);
  app.use("/api/notifications", notificationsRouter);
  app.use("/api/customer/favorites", favoritesRouter);
  app.use("/api/admin", adminRouter);
  app.use("/api", apiNotFound);
  app.use(apiNotFound);
  app.use(globalErrorHandler);
  return app;
}
