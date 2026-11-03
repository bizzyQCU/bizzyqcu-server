import { Router } from "express";
import { MarketplaceController } from "./marketplace.controller";
import { validate } from "../../middlewares/validate.middleware";
import { createProductSchema } from "./marketplace.validation";
import { requireAuth } from "../../middlewares/auth.middleware";
import { isSeller, isVerified } from "../../middlewares/rbac.middleware";
import catalogRoutes from "./catalog.routes";

const router = Router();

// Subsystem 2: Only verified sellers can create product listings
router.post(
  "/products",
  requireAuth,
  isSeller,
  isVerified,
  validate(createProductSchema),
  MarketplaceController.createProduct
);

router.use(catalogRoutes);

export default router;
