import { z } from "zod";

/**
 * Castro's complaint validation lives here.
 *
 * The review schemas moved to `verification.validation.ts` (Guades) but are
 * re-exported so any existing import from `admin.validation` keeps working.
 */
export {
  reviewUserVerificationSchema,
  reviewProductApprovalSchema,
} from "./verification.validation";

export const resolveComplaintSchema = z.object({
  params: z.object({
    complaintId: z.string().uuid("Invalid complaint ID"),
  }),
  body: z.object({
    status: z.enum(["UNDER_REVIEW", "RESOLVED", "DISMISSED"]),
    adminResolutionNote: z.string().min(5, "Resolution note is required"),
  }),
});
