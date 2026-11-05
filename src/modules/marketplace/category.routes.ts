import { Router } from "express";
import { CategoryController } from "./category.controller";
import { validate } from "../../middlewares/validate.middleware";
import {
  createCategorySchema,
  updateCategorySchema,
  categoryIdSchema,
} from "./category.validation";
import { requireAuth } from "../../middlewares/auth.middleware";
import { isAdmin } from "../../middlewares/rbac.middleware";

const router = Router();

// Public routes
router.get("/", CategoryController.getAllCategories);
router.get(
  "/:id",
  validate(categoryIdSchema),
  CategoryController.getCategoryById
);

// Admin-only routes
router.post(
  "/",
  requireAuth,
  isAdmin,
  validate(createCategorySchema),
  CategoryController.createCategory
);

router.patch(
  "/:id",
  requireAuth,
  isAdmin,
  validate(updateCategorySchema),
  CategoryController.updateCategory
);

router.delete(
  "/:id",
  requireAuth,
  isAdmin,
  validate(categoryIdSchema),
  CategoryController.deleteCategory
);

export default router;