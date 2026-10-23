import { z } from "zod";

export const reviewUserVerificationSchema = z.object({
  params: z.object({
    userId: z.string().uuid("Invalid user ID"),
  }),
  body: z.object({
    status: z.enum(["VERIFIED", "REJECTED"]),
    rejectionReason: z.string().optional(),
  }),
});

export const reviewProductApprovalSchema = z.object({
  params: z.object({
    productId: z.string().uuid("Invalid product ID"),
  }),
  body: z.object({
    status: z.enum(["VERIFIED", "REJECTED"]),
    rejectionReason: z.string().optional(),
  }),
});

export const resolveComplaintSchema = z.object({
  params: z.object({
    complaintId: z.string().uuid("Invalid complaint ID"),
  }),
  body: z.object({
    status: z.enum(["UNDER_REVIEW", "RESOLVED", "DISMISSED"]),
    adminResolutionNote: z.string().min(5, "Resolution note is required"),
  }),
});
