import "dotenv/config";
import express from "express";
import ordersRouter from "./routes/orders.routes.js";

const app = express();

app.use(express.json());
app.use("/api", ordersRouter);

const port = process.env.PORT || 3001;
app.listen(port, () => {
  console.log(`Backend running on http://localhost:${port}`);
});
