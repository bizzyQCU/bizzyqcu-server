import { z } from "zod";
const searchProductsQuery = z
    .object({
    search: z.string().trim().min(1).optional(),
    categoryId: z.string().uuid("Invalid category ID").optional(),
    sellerType: z
        .enum(["STUDENT_ENTERPRISE", "RECOGNIZED_ORGANIZATION", "INDEPENDENT_SELLER"])
        .optional(),
    minPrice: z.coerce.number().nonnegative().optional(),
    maxPrice: z.coerce.number().nonnegative().optional(),
    sort: z.enum(["newest", "price_asc", "price_desc"]).default("newest"),
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(50).default(12),
})
    .refine((q) => q.minPrice === undefined || q.maxPrice === undefined || q.minPrice <= q.maxPrice, { message: "minPrice cannot be greater than maxPrice", path: ["minPrice"] });
export const searchProductsSchema = z.object({ query: searchProductsQuery });
export const parseSearchProductsQuery = (query) => searchProductsQuery.parse(query);
export const setStockSchema = z.object({
    params: z.object({ id: z.string().uuid("Invalid product ID") }),
    body: z.object({ stockQuantity: z.number().int().nonnegative("Stock cannot be negative") }),
});
export const setAvailabilitySchema = z.object({
    params: z.object({ id: z.string().uuid("Invalid product ID") }),
    body: z.object({ isAvailable: z.boolean() }),
});
