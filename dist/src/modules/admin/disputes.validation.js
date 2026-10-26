import { z } from "zod";
import { paginationSchema } from "../../utils/pagination";
export const listDuplicatesSchema = z.object({
    query: paginationSchema,
});
export const rejectDuplicateSchema = z.object({
    params: z.object({ userId: z.string().uuid("Invalid user ID") }),
    body: z.object({
        rejectionReason: z
            .string()
            .trim()
            .min(5, "Rejection reason must be at least 5 characters")
            .max(500, "Rejection reason must be at most 500 characters"),
        /** Optional: the original account this one duplicates. */
        duplicateOfUserId: z.string().uuid("Invalid duplicateOfUserId").optional(),
    }),
});
export const reopenDisputeSchema = z.object({
    params: z.object({ userId: z.string().uuid("Invalid user ID") }),
    body: z
        .object({
        reason: z.string().trim().max(500, "Reason must be at most 500 characters").optional(),
    })
        .default({}),
});
export const parseListDuplicatesQuery = (query) => listDuplicatesSchema.shape.query.parse(query);
