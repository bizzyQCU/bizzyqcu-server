import { Router } from "express";
import { CartController } from "./cart.controller";
import { requireAuth } from "../../middlewares/auth.middleware";
import { canPurchase } from "../../middlewares/rbac.middleware";
import { validate } from "../../middlewares/validate.middleware";
import {
  addToCartSchema,
  updateCartItemSchema,
  cartItemIdParamSchema,
} from "./cart.validation";

const router = Router();

// Cart is protected and accessible to BUYER and SELLER accounts
router.use(requireAuth);
router.use(canPurchase);

router.get("/", CartController.getCart);
router.post("/items", validate(addToCartSchema), CartController.addItem);
router.patch(
  "/items/:cartItemId",
  validate(updateCartItemSchema),
  CartController.updateQuantity
);
router.delete(
  "/items/:cartItemId",
  validate(cartItemIdParamSchema),
  CartController.removeItem
);
router.delete("/", CartController.clearCart);

export default router;
