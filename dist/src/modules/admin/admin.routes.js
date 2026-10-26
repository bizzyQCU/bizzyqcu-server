import { Router } from "express";
import { AdminController } from "./admin.controller";
import { VerificationController } from "./verification.controller";
import { AnalyticsController } from "./analytics.controller";
import { DisputesController } from "./disputes.controller";
import { validate } from "../../middlewares/validate.middleware";
import { requireAuth } from "../../middlewares/auth.middleware";
import { requireRole } from "../../middlewares/rbac.middleware";
// Guades – Subsystem 4
import { listVerificationsSchema, reviewUserVerificationSchema, reviewSellerVerificationSchema, reviewStoreVerificationSchema, reviewProductApprovalSchema, } from "./verification.validation";
import { salesAnalyticsSchema, storesAnalyticsSchema, demandAnalyticsSchema, } from "./analytics.validation";
import { listDuplicatesSchema, rejectDuplicateSchema, reopenDisputeSchema, } from "./disputes.validation";
// Castro – Subsystem 4
import { resolveComplaintSchema } from "./admin.validation";
const router = Router();
// Subsystem 4: Guades & Castro (Admin Only)
router.use(requireAuth, requireRole("ADMIN"));
// ---------------------------------------------------------------------------
// Phase 2 – Verification queue (Guades)
// GET /verifications?type=user|seller|store|product&page=&limit=
// ---------------------------------------------------------------------------
router.get("/verifications", validate(listVerificationsSchema), VerificationController.list);
// ---------------------------------------------------------------------------
// Phase 3 – Review actions (Guades)
// ---------------------------------------------------------------------------
router.patch("/verifications/users/:userId", validate(reviewUserVerificationSchema), VerificationController.reviewUser);
router.patch("/verifications/sellers/:sellerProfileId", validate(reviewSellerVerificationSchema), VerificationController.reviewSeller);
router.patch("/verifications/stores/:storeId", validate(reviewStoreVerificationSchema), VerificationController.reviewStore);
// Backwards-compatible alias for the scaffold route (PATCH /verifications/:userId).
router.patch("/verifications/:userId", validate(reviewUserVerificationSchema), VerificationController.reviewUser);
router.patch("/products/:productId", validate(reviewProductApprovalSchema), VerificationController.reviewProduct);
// ---------------------------------------------------------------------------
// Phase 4 – Analytics (Guades)
// ---------------------------------------------------------------------------
router.get("/analytics/sales", validate(salesAnalyticsSchema), AnalyticsController.sales);
router.get("/analytics/stores", validate(storesAnalyticsSchema), AnalyticsController.stores);
router.get("/analytics/demand", validate(demandAnalyticsSchema), AnalyticsController.demand);
// ---------------------------------------------------------------------------
// Phase 5 – Duplicates & disputes (Guades)
// ---------------------------------------------------------------------------
router.get("/duplicates", validate(listDuplicatesSchema), DisputesController.listDuplicates);
router.patch("/duplicates/:userId", validate(rejectDuplicateSchema), DisputesController.rejectDuplicate);
router.post("/disputes/:userId/reopen", validate(reopenDisputeSchema), DisputesController.reopenDispute);
// ---------------------------------------------------------------------------
// Castro – Complaints
// ---------------------------------------------------------------------------
router.get("/complaints", AdminController.getComplaints);
router.patch("/complaints/:complaintId", validate(resolveComplaintSchema), AdminController.resolveComplaint);
export default router;
