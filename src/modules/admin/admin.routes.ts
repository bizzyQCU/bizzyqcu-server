import { Router } from "express";
import { AdminController } from "./admin.controller";
import { validate } from "../../middlewares/validate.middleware";
import {
  reviewUserVerificationSchema,
  reviewProductApprovalSchema,
  resolveComplaintSchema,
} from "./admin.validation";
import { requireAuth } from "../../middlewares/auth.middleware";
import { requireRole } from "../../middlewares/rbac.middleware";

const router = Router();

// Subsystem 4: Guades & Castro (Admin Only)
router.use(requireAuth, requireRole("ADMIN"));

router.get("/verifications", AdminController.getPendingVerifications);
router.patch("/verifications/:userId", validate(reviewUserVerificationSchema), AdminController.reviewUser);

router.patch("/products/:productId", validate(reviewProductApprovalSchema), AdminController.reviewProduct);

router.get("/complaints", AdminController.getComplaints);
router.patch("/complaints/:complaintId", validate(resolveComplaintSchema), AdminController.resolveComplaint);

export default router;
