
import { Router } from "express";
import { OrdersController } from "./orders.controller";
import { validate } from "../../middlewares/validate.middleware";
import {
  createOrderSchema,
  updateOrderStatusSchema,
} from "./orders.validation";
import { requireAuth } from "../../middlewares/auth.middleware";
import { requireRole } from "../../middlewares/rbac.middleware";

const router = Router();

router.use(requireAuth);

router.get(
  "/my-orders",
  OrdersController.getMyOrders
);

router.post(
  "/",
  requireRole("BUYER"),
  validate(createOrderSchema),
  OrdersController.createOrder
);

router.patch(
  "/:id/status",
  validate(updateOrderStatusSchema),
  OrdersController.updateStatus
);

export default router;
