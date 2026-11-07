import { Router } from "express";
import { MarketplaceController } from "./marketplace.controller";
import { StoreController } from "./store.controller";
import { validate } from "../../middlewares/validate.middleware";
import {
  createProductSchema,
  createStoreSchema,
  updateStoreSchema,
  storeIdSchema,
  productIdSchema,
  updateProductSchema,
  sellerProductsQuerySchema,
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

// Public: Get store profile by ID or slug
router.get(
  "/stores/:id",
  validate(storeIdSchema),
  StoreController.getStoreById
);

router.get(
  "/stores/slug/:slug",
  StoreController.getStoreBySlug
);

// ==========================================
// SELLER PRODUCT MANAGEMENT (CRUD)
// ==========================================

// Seller: List all products in own store (with pagination and status filters)
router.get(
  "/seller/products",
  ...sellerAccess,
  validate(sellerProductsQuerySchema),
  MarketplaceController.getSellerProducts
);

// Seller: Get details of own product (including PENDING / REJECTED status)
router.get(
  "/seller/products/:id",
  ...sellerAccess,
  validate(productIdSchema),
  MarketplaceController.getSellerProduct
);

// Seller: Create a product listing
router.post(
  "/products",
  ...sellerAccess,
  validate(createProductSchema),
  MarketplaceController.createProduct
);

// Seller: Update product
router.patch(
  "/products/:id",
  ...sellerAccess,
  validate(updateProductSchema),
  MarketplaceController.updateProduct
);

// Seller: Delete product
router.delete(
  "/products/:id",
  ...sellerAccess,
  validate(productIdSchema),
  MarketplaceController.deleteProduct
);

// ==========================================
// PUBLIC BUYER PRODUCT VIEW
// ==========================================

// Public: Product details for buyers and visitors
router.get(
  "/products/:id",
  validate(productIdSchema),
  MarketplaceController.getPublicProduct
);

// Mount categories
router.use("/categories", categoryRoutes);

// Mount catalog routes (Karl's implementation)
router.use(catalogRoutes);

export default router;
