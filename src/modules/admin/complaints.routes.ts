import { Router } from "express";
import { AdminController } from "./admin.controller";
import { validate } from "../../middlewares/validate.middleware";
import { requireAuth } from "../../middlewares/auth.middleware";
import {
  createComplaintSchema,
  getComplaintByIdSchema,
  getComplaintsQuerySchema,
} from "./admin.validation";

const router = Router();

// User-facing Complaints API (Buyers, Sellers, Admins)
router.use(requireAuth);

/** POST /api/v1/complaints - Submit a complaint */
router.post(
  "/",
  validate(createComplaintSchema),
  AdminController.createComplaint
);

/** GET /api/v1/complaints/my - List user's submitted complaints */
router.get(
  "/my",
  AdminController.getMyComplaints
);

/** GET /api/v1/complaints/:complaintId - View a specific complaint (complainant or admin) */
router.get(
  "/:complaintId",
  validate(getComplaintByIdSchema),
  AdminController.getComplaintById
);

export default router;

