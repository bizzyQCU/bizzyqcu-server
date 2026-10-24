import { Router } from "express";
import { CatalogController } from "./catalog.controller";
import { validate } from "../../middlewares/validate.middleware";
import { requireAuth } from "../../middlewares/auth.middleware";
import { requireRole } from "../../middlewares/rbac.middleware";
import {
  searchProductsSchema,
  setStockSchema,
  setAvailabilitySchema,
} from "./catalog.validation";

const router = Router();

// Public: buyers browse without a role check
router.get("/products", validate(searchProductsSchema), CatalogController.searchProducts);

// Seller-only
const seller = [requireAuth, requireRole("SELLER")];

router.get("/products", validate(searchProductsSchema), CatalogController.searchProducts);
router.patch("/products/:id/stock", ...seller, validate(setStockSchema), CatalogController.setStock);
router.patch(
  "/products/:id/availability",
  ...seller,
  validate(setAvailabilitySchema),
  CatalogController.setAvailability
);
router.get("/seller/dashboard", ...seller, CatalogController.getSellerDashboard);

export default router;
