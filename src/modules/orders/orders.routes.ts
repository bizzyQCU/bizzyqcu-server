import { Router } from "express";
import { OrdersController } from "./orders.controller";
import { validate } from "../../middlewares/validate.middleware";
import {
  createOrderSchema,
  updateOrderStatusSchema,
} from "./orders.validation";
import { requireAuth } from "../../middlewares/auth.middleware";

const router = Router();

// Subsystem 3: Reyes & Ponce
router.use(requireAuth);

router.get("/my-orders", OrdersController.getMyOrders);
router.post("/", validate(createOrderSchema), OrdersController.createOrder);
router.patch("/:id/status", validate(updateOrderStatusSchema), OrdersController.updateStatus);

export default router;
