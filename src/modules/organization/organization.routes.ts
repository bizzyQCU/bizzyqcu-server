import { Router } from "express";
import { OrganizationController } from "./organization.controller";
import { validate } from "../../middlewares/validate.middleware";
import { requireAuth } from "../../middlewares/auth.middleware";
import {
  updateOrganizationProfileSchema,
  changeOrganizationPasswordSchema,
} from "./organization.validation";

const router = Router();

// Protect all organization seller routes with JWT authentication
router.use(requireAuth);

// Profile endpoints
router.get("/profile", OrganizationController.getProfile);
router.put(
  "/profile",
  validate(updateOrganizationProfileSchema),
  OrganizationController.updateProfile
);
router.patch(
  "/profile",
  validate(updateOrganizationProfileSchema),
  OrganizationController.updateProfile
);

// Password change endpoint
router.post(
  "/change-password",
  validate(changeOrganizationPasswordSchema),
  OrganizationController.changePassword
);

export default router;
