import "dotenv/config";
import express from "express";
import ordersRouter from "./routes/orders.routes.js";
import authRouter from "./routes/auth.routes.js";
import adminRouter from "./routes/admin.routes.js";

const app = express();

app.use(express.json());
app.get("/health", (_req, res) => res.status(200).json({ ok: true }));
app.use("/api", ordersRouter);
app.use("/api/auth", authRouter);
app.use("/api/admin", adminRouter);

const port = process.env.PORT || 3001;
app.listen(port, () => {
  console.log(`Backend running on http://localhost:${port}`);
});
