import { Router } from "express";
import { OrdersController } from "./orders.controller";
import { validate } from "../../middlewares/validate.middleware";
import {
  createOrderSchema,
  updateOrderStatusSchema,
  orderIdParamSchema,
  createOrderMessageSchema,
} from "./orders.validation";
import { requireAuth } from "../../middlewares/auth.middleware";
import { isBuyer, isSeller, isVerified } from "../../middlewares/rbac.middleware";

const router = Router();

// All order operations require authenticated access
router.use(requireAuth);

// 1. Order History
router.get("/my-orders", isBuyer, OrdersController.getMyOrders);
router.get("/seller", isSeller, OrdersController.getSellerOrders);

// 2. Pickup & Campus Delivery Options
router.get("/pickup-locations", OrdersController.getPickupLocations);

// 3. Checkout (Requires verified Buyer account)
router.post(
  "/",
  isBuyer,
  isVerified,
  validate(createOrderSchema),
  OrdersController.createOrder
);

// 4. Single Order Detail
router.get(
  "/:id",
  validate(orderIdParamSchema),
  OrdersController.getOrderById
);

// 5. Order State Machine Transitions
router.patch(
  "/:id/status",
  validate(updateOrderStatusSchema),
  OrdersController.updateStatus
);

// 6. Buyer-Seller Communication & Notes
router.get(
  "/:id/messages",
  validate(orderIdParamSchema),
  OrdersController.getOrderMessages
);

router.post(
  "/:id/messages",
  validate(createOrderMessageSchema),
  OrdersController.createOrderMessage
);

export default router;
