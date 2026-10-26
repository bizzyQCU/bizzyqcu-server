import { z } from "zod";
import { paginationSchema } from "../../utils/pagination";

export const VERIFICATION_TYPES = ["user", "seller", "store", "product"] as const;
export type VerificationType = (typeof VERIFICATION_TYPES)[number];

/**
 * GET /admin/verifications?type=user|seller|store|product&page=&limit=
 * `type` defaults to `user` so the old scaffold call keeps working.
 */
export const listVerificationsSchema = z.object({
  query: paginationSchema.extend({
    type: z.enum(VERIFICATION_TYPES).default("user"),
  }),
});

export const parseListVerificationsQuery = (query: unknown) =>
  listVerificationsSchema.shape.query.parse(query);

const rejectionReason = z
  .string()
  .trim()
  .min(5, "Rejection reason must be at least 5 characters")
  .max(500, "Rejection reason must be at most 500 characters");

/** Shared review body: rejectionReason is required when status = REJECTED. */
const reviewBody = z
  .object({
    status: z.enum(["VERIFIED", "REJECTED"]),
    rejectionReason: rejectionReason.optional(),
  })
  .superRefine((body, ctx) => {
    if (body.status === "REJECTED" && !body.rejectionReason) {
      ctx.addIssue({
        code: "custom",
        path: ["rejectionReason"],
        message: "rejectionReason is required when status is REJECTED",
      });
    }
  });

export const reviewUserVerificationSchema = z.object({
  params: z.object({ userId: z.string().uuid("Invalid user ID") }),
  body: reviewBody,
});

export const reviewSellerVerificationSchema = z.object({
  params: z.object({ sellerProfileId: z.string().uuid("Invalid seller profile ID") }),
  body: reviewBody,
});

export const reviewStoreVerificationSchema = z.object({
  params: z.object({ storeId: z.string().uuid("Invalid store ID") }),
  body: reviewBody,
});

export const reviewProductApprovalSchema = z.object({
  params: z.object({ productId: z.string().uuid("Invalid product ID") }),
  body: reviewBody,
});
