import { z } from "zod";
import { paginationSchema } from "../../utils/pagination";

/**
 * Castro & Duay's complaint, audit log, and transaction monitoring validation schemas.
 *
 * Review schemas from Guades are re-exported for backwards compatibility.
 */
export {
  reviewUserVerificationSchema,
  reviewProductApprovalSchema,
} from "./verification.validation";

export const COMPLAINT_STATUSES = [
  "OPEN",
  "UNDER_REVIEW",
  "RESOLVED",
  "DISMISSED",
] as const;

export const createComplaintSchema = z.object({
  body: z.object({
    orderId: z.string().uuid("Invalid order ID").optional(),
    subject: z
      .string()
      .trim()
      .min(5, "Subject must be at least 5 characters")
      .max(150, "Subject must be at most 150 characters"),
    description: z
      .string()
      .trim()
      .min(10, "Description must be at least 10 characters")
      .max(2000, "Description must be at most 2000 characters"),
    evidenceUrls: z
      .array(z.string().url("Evidence URL must be a valid URL"))
      .max(10, "Maximum of 10 evidence URLs allowed")
      .default([]),
  }),
});

export const getComplaintsQuerySchema = z.object({
  query: paginationSchema.extend({
    status: z.enum(COMPLAINT_STATUSES).optional(),
    orderId: z.string().uuid("Invalid order ID").optional(),
    complainantId: z.string().uuid("Invalid complainant ID").optional(),
  }),
});

export const getComplaintByIdSchema = z.object({
  params: z.object({
    complaintId: z.string().uuid("Invalid complaint ID"),
  }),
});

export const resolveComplaintSchema = z.object({
  params: z.object({
    complaintId: z.string().uuid("Invalid complaint ID"),
  }),
  body: z.object({
    status: z.enum(["UNDER_REVIEW", "RESOLVED", "DISMISSED"]),
    adminResolutionNote: z
      .string()
      .trim()
      .min(5, "Resolution note must be at least 5 characters")
      .max(1000, "Resolution note must be at most 1000 characters"),
  }),
});

export const getAuditLogsQuerySchema = z.object({
  query: paginationSchema.extend({
    subsystem: z.enum(["AUTH", "MARKETPLACE", "ORDERS", "ADMIN"]).optional(),
    action: z.string().trim().optional(),
    actorId: z.string().uuid("Invalid actor ID").optional(),
  }),
});

export const getTransactionLogsQuerySchema = z.object({
  query: paginationSchema.extend({
    status: z.enum(["PENDING", "PAID", "FAILED", "CANCELLED"]).optional(),
    method: z.enum(["CASH", "GCASH_PAYMONGO"]).optional(),
    orderId: z.string().uuid("Invalid order ID").optional(),
    search: z.string().trim().optional(),
  }),
});

export const getTransactionByIdSchema = z.object({
  params: z.object({
    transactionId: z.string().uuid("Invalid transaction ID"),
  }),
});

export type CreateComplaintInput = z.infer<typeof createComplaintSchema>["body"];
export type GetComplaintsQuery = z.infer<typeof getComplaintsQuerySchema>["query"];
export type ResolveComplaintInput = z.infer<typeof resolveComplaintSchema>["body"];
export type GetAuditLogsQuery = z.infer<typeof getAuditLogsQuerySchema>["query"];
export type GetTransactionLogsQuery = z.infer<typeof getTransactionLogsQuerySchema>["query"];
