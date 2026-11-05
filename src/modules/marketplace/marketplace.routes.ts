import { Router } from "express";
import { MarketplaceController } from "./marketplace.controller";
import { StoreController } from "./store.controller";
import { validate } from "../../middlewares/validate.middleware";
import {
  createProductSchema,
  createStoreSchema,
  updateStoreSchema,
  productIdSchema,
  updateProductSchema,
} from "./marketplace.validation";
import { requireAuth } from "../../middlewares/auth.middleware";
import { isSeller, isVerified } from "../../middlewares/rbac.middleware";
import catalogRoutes from "./catalog.routes";
import categoryRoutes from "./category.routes";

const router = Router();

// Verified seller access
const sellerAccess = [requireAuth, isSeller, isVerified];

// ==========================================
// STORE REGISTRATION AND PROFILE MANAGEMENT
// ==========================================

// Register a store
router.post(
  "/stores",
  ...sellerAccess,
  validate(createStoreSchema),
  StoreController.createStore
);

// Get the authenticated seller's store
router.get(
  "/stores/me",
  ...sellerAccess,
  StoreController.getMyStore
);

// Update the authenticated seller's store
router.patch(
  "/stores/me",
  ...sellerAccess,
  validate(updateStoreSchema),
  StoreController.updateMyStore
);

// Delete the authenticated seller's store
router.delete(
  "/stores/me",
  ...sellerAccess,
  StoreController.deleteMyStore
);

// ==========================================
// PRODUCT LISTING
// ==========================================

// Create a product listing
router.post(
  "/products",
  ...sellerAccess,
  validate(createProductSchema),
  MarketplaceController.createProduct
);

// Product Listing CRUD
router.get(
  "/products/:id",
  ...sellerAccess,
  validate(productIdSchema),
  MarketplaceController.getProduct
);

router.patch(
  "/products/:id",
  ...sellerAccess,
  validate(updateProductSchema),
  MarketplaceController.updateProduct
);

router.delete(
  "/products/:id",
  ...sellerAccess,
  validate(productIdSchema),
  MarketplaceController.deleteProduct
);

router.use("/categories", categoryRoutes);
// Existing catalog routes (Karl's implementation)
router.use(catalogRoutes);

export default router;
