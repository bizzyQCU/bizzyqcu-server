import express from "express";
import cors from "cors";
import { env } from "./config/env";
import { errorHandler } from "./middlewares/error.middleware";

// Subsystem Routers
import authRoutes from "./modules/auth/auth.routes";             // Subsystem 1 (Vizconde & Manuel)
import marketplaceRoutes from "./modules/marketplace/marketplace.routes"; // Subsystem 2 (Luarca & Ojeda)
import orderRoutes from "./modules/orders/orders.routes";         // Subsystem 3 (Reyes & Ponce)
import adminRoutes from "./modules/admin/admin.routes";           // Subsystem 4 (Guades & Castro)

const app = express();

app.use(
  cors({
    origin: env.FRONTEND_URL,
    credentials: true,
  })
);
app.use(express.json());

// Health Check
app.get("/health", (_req, res) => {
  res.status(200).json({
    status: "ok",
    service: "bizzyqcu-server",
    timestamp: new Date().toISOString(),
  });
});

// Mount Subsystem APIs
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/marketplace", marketplaceRoutes);
app.use("/api/v1/orders", orderRoutes);
app.use("/api/v1/admin", adminRoutes);

// Global Error Handler
app.use(errorHandler);

const PORT = env.PORT;
app.listen(PORT, () => {
  console.log(`🚀 BizzyQCU Server running on http://localhost:${PORT}`);
});

export default app;
