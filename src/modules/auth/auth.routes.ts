import { Router } from "express";
import { AuthController } from "./auth.controller";
import { validate } from "../../middlewares/validate.middleware";
import { registerUserSchema } from "./auth.validation";
import { requireAuth } from "../../middlewares/auth.middleware";

const router = Router();

// Subsystem 1: Vizconde & Manuel
router.post(
  "/register",
  validate(registerUserSchema),
  AuthController.register
);

router.get(
  "/profile",
  requireAuth,
  AuthController.getProfile
);

export default router;
