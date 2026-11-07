import express from "express";
import cors from "cors";
import { env } from "./config/env";
import { errorHandler } from "./middlewares/error.middleware";


import paymongoWebhookRoutes from "./modules/orders/paymongo.routes";


import authRoutes from "./modules/auth/auth.routes";             
import marketplaceRoutes from "./modules/marketplace/marketplace.routes"; 
import orderRoutes from "./modules/orders/orders.routes";         
import adminRoutes from "./modules/admin/admin.routes";           
import complaintRoutes from "./modules/admin/complaints.routes"; 
import cartRoutes from "./modules/cart/cart.routes";
import uploadRoutes from "./modules/upload/upload.routes";

const app = express();

app.use(
  cors({
    origin: env.FRONTEND_URL,
    credentials: true,
  })
);


app.use(
  "/api/v1/orders/paymongo",
  paymongoWebhookRoutes
);

app.use(express.json());

app.get("/health", (_req, res) => {
  res.status(200).json({
    status: "ok",
    service: "bizzyqcu-server",
    timestamp: new Date().toISOString(),
  });
});

app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/marketplace", marketplaceRoutes);
app.use("/api/v1/orders", orderRoutes);
app.use("/api/v1/admin", adminRoutes);
app.use("/api/v1/complaints", complaintRoutes);
app.use("/api/v1/cart", cartRoutes);
app.use("/api/v1/upload", uploadRoutes);

app.use(errorHandler);

const PORT = env.PORT;
app.listen(PORT, () => {
  console.log(`🚀 BizzyQCU Server running on http://localhost:${PORT}`);
});

export default app;