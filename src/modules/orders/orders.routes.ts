import { Router } from "express";
import { OrdersController } from "./orders.controller";
import { validate } from "../../middlewares/validate.middleware";
import {
  createOrderSchema,
  updateOrderStatusSchema,
  orderIdParamSchema,
  createOrderMessageSchema,
  paymongoOnboardSchema,
} from "./orders.validation";
import { requireAuth } from "../../middlewares/auth.middleware";
import { canPurchase, isSeller, isVerified } from "../../middlewares/rbac.middleware";

const router = Router();

// All order operations require authenticated access
router.use(requireAuth);

// 1. Order History
router.get("/my-orders", canPurchase, OrdersController.getMyOrders);
router.get("/seller", isSeller, OrdersController.getSellerOrders);

// 2. Pickup & Campus Delivery Options
router.get("/pickup-locations", OrdersController.getPickupLocations);

// 3. Checkout (Requires verified account)
router.post(
  "/",
  canPurchase,
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

// 7. Seller PayMongo Sub-Account Onboarding & Status
router.get(
  "/seller/paymongo-status",
  isSeller,
  OrdersController.getPaymongoStatus
);

router.post(
  "/seller/paymongo-onboard",
  isSeller,
  isVerified,
  validate(paymongoOnboardSchema),
  OrdersController.onboardPaymongo
);

export default router;
