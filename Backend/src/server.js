import "dotenv/config";
import express from "express";
import ordersRouter from "./routes/orders.routes.js";
import authRouter from "./routes/auth.routes.js";
import adminRouter from "./routes/admin.routes.js";

const app = express();

app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.use("/api", ordersRouter);
app.use("/api/auth", authRouter);
app.use("/api/admin", adminRouter);

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`Backend running on port ${PORT}`);
});