import { Router } from "express";
import { AdminController } from "./admin.controller";
import { VerificationController } from "./verification.controller";
import { AnalyticsController } from "./analytics.controller";
import { DisputesController } from "./disputes.controller";
import { validate } from "../../middlewares/validate.middleware";
import { requireAuth } from "../../middlewares/auth.middleware";
import { requireRole } from "../../middlewares/rbac.middleware";

// Guades – Subsystem 4
import {
  listVerificationsSchema,
  reviewUserVerificationSchema,
  reviewSellerVerificationSchema,
  reviewStoreVerificationSchema,
  reviewProductApprovalSchema,
} from "./verification.validation";
import {
  salesAnalyticsSchema,
  storesAnalyticsSchema,
  demandAnalyticsSchema,
} from "./analytics.validation";
import {
  listDuplicatesSchema,
  rejectDuplicateSchema,
  reopenDisputeSchema,
} from "./disputes.validation";

// Duay & Castro – Subsystem 4
import {
  createComplaintSchema,
  getComplaintsQuerySchema,
  getComplaintByIdSchema,
  resolveComplaintSchema,
  getAuditLogsQuerySchema,
  getTransactionLogsQuerySchema,
  getTransactionByIdSchema,
} from "./admin.validation";

const router = Router();

// Subsystem 4: Requires authenticated session
router.use(requireAuth);

// ---------------------------------------------------------------------------
// Open to all authenticated users (Buyers, Sellers, Admins)
// ---------------------------------------------------------------------------

/** POST /api/v1/admin/complaints - Submit complaint ticket */
router.post(
  "/complaints",
  validate(createComplaintSchema),
  AdminController.createComplaint
);

/** GET /api/v1/admin/complaints/my - View current user's submitted tickets */
router.get(
  "/complaints/my",
  AdminController.getMyComplaints
);

// ---------------------------------------------------------------------------
// Strictly ADMIN-ONLY routes below
// ---------------------------------------------------------------------------
router.use(requireRole("ADMIN"));

// ---------------------------------------------------------------------------
// Phase 2 – Verification queue (Guades)
// GET /verifications?type=user|seller|store|product&page=&limit=
// ---------------------------------------------------------------------------
router.get(
  "/verifications",
  validate(listVerificationsSchema),
  VerificationController.list
);

// ---------------------------------------------------------------------------
// Phase 3 – Review actions (Guades)
// ---------------------------------------------------------------------------
router.patch(
  "/verifications/users/:userId",
  validate(reviewUserVerificationSchema),
  VerificationController.reviewUser
);
router.patch(
  "/verifications/sellers/:sellerProfileId",
  validate(reviewSellerVerificationSchema),
  VerificationController.reviewSeller
);
router.patch(
  "/verifications/stores/:storeId",
  validate(reviewStoreVerificationSchema),
  VerificationController.reviewStore
);

router.patch(
  "/verifications/:userId",
  validate(reviewUserVerificationSchema),
  VerificationController.reviewUser
);

router.patch(
  "/products/:productId",
  validate(reviewProductApprovalSchema),
  VerificationController.reviewProduct
);
router.patch(
  "/verifications/products/:productId",
  validate(reviewProductApprovalSchema),
  VerificationController.reviewProduct
);

// ---------------------------------------------------------------------------
// Phase 4 – Analytics (Guades)
// ---------------------------------------------------------------------------
router.get(
  "/analytics/sales",
  validate(salesAnalyticsSchema),
  AnalyticsController.sales
);
router.get(
  "/analytics/stores",
  validate(storesAnalyticsSchema),
  AnalyticsController.stores
);
router.get(
  "/analytics/demand",
  validate(demandAnalyticsSchema),
  AnalyticsController.demand
);

// ---------------------------------------------------------------------------
// Phase 5 – Duplicates & disputes (Guades)
// ---------------------------------------------------------------------------
router.get(
  "/duplicates",
  validate(listDuplicatesSchema),
  DisputesController.listDuplicates
);
router.patch(
  "/duplicates/:userId",
  validate(rejectDuplicateSchema),
  DisputesController.rejectDuplicate
);
router.post(
  "/disputes/:userId/reopen",
  validate(reopenDisputeSchema),
  DisputesController.reopenDispute
);

// ---------------------------------------------------------------------------
// Complaints Management (Duay & Castro)
// ---------------------------------------------------------------------------

/** GET /api/v1/admin/complaints - List all complaints with pagination & filters */
router.get(
  "/complaints",
  validate(getComplaintsQuerySchema),
  AdminController.getComplaints
);

/** GET /api/v1/admin/complaints/:complaintId - View single complaint details */
router.get(
  "/complaints/:complaintId",
  validate(getComplaintByIdSchema),
  AdminController.getComplaintById
);

/** PATCH /api/v1/admin/complaints/:complaintId - Resolve or dismiss complaint */
router.patch(
  "/complaints/:complaintId",
  validate(resolveComplaintSchema),
  AdminController.resolveComplaint
);

// ---------------------------------------------------------------------------
// System Activity & Audit Logs (Duay & Castro)
// ---------------------------------------------------------------------------

/** GET /api/v1/admin/audit-logs - View audit trail with pagination and filters */
router.get(
  "/audit-logs",
  validate(getAuditLogsQuerySchema),
  AdminController.getAuditLogs
);

// ---------------------------------------------------------------------------
// Transaction Monitoring Logs (Duay & Castro)
// ---------------------------------------------------------------------------

/** GET /api/v1/admin/transactions - View PayMongo split payments & cash logs */
router.get(
  "/transactions",
  validate(getTransactionLogsQuerySchema),
  AdminController.getTransactionLogs
);

/** GET /api/v1/admin/transactions/:transactionId - Inspect single transaction with webhook payload */
router.get(
  "/transactions/:transactionId",
  validate(getTransactionByIdSchema),
  AdminController.getTransactionById
);

export default router;
