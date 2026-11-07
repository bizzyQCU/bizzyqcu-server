import { z } from "zod";

export const createProductSchema = z.object({
  body: z.object({
    storeId: z.string().uuid("Invalid store ID"),
    categoryId: z.string().uuid("Invalid category ID"),
    name: z.string().min(3, "Product name must be at least 3 characters"),
    description: z.string().min(10, "Description is too short"),
    price: z.number().positive("Price must be greater than 0"),
    stockQuantity: z.number().int().nonnegative("Stock cannot be negative"),
    imageUrls: z
      .array(z.string().url())
      .min(1, "At least 1 product image is required"),
  }),
});

export const createStoreSchema = z.object({
  body: z.object({
    name: z.string().trim().min(3, "Store name must be at least 3 characters"),
    description: z.string().trim().min(10, "Description must be at least 10 characters"),
    logoUrl: z.string().url("Invalid logo URL").optional(),
    bannerUrl: z.string().url("Invalid banner URL").optional(),
    pickupLocation: z.string().trim().optional(),
  }),
});

export const updateStoreSchema = z.object({
  body: z.object({
    name: z.string().trim().min(3).optional(),
    description: z.string().trim().min(10).optional(),
    logoUrl: z.string().url().nullable().optional(),
    bannerUrl: z.string().url().nullable().optional(),
    pickupLocation: z.string().trim().nullable().optional(),
    isOpen: z.boolean().optional(),
  }).refine(
    (data) => Object.keys(data).length > 0,
    { message: "At least one field must be provided." }
  ),
});

export const storeIdSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid store ID"),
  }),
});

// ==========================================
// PRODUCT LISTING CRUD VALIDATION
// ==========================================

// Validate product ID from URL parameters
export const productIdSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid product ID"),
  }),
});

// Validate product updates
export const updateProductSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid product ID"),
  }),
  body: z.object({
    categoryId: z.string().uuid("Invalid category ID").optional(),
    name: z.string().trim().min(3, "Product name must be at least 3 characters").optional(),
    description: z.string().trim().min(10, "Description is too short").optional(),
    price: z.number().positive("Price must be greater than 0").optional(),
    stockQuantity: z.number().int().nonnegative("Stock cannot be negative").optional(),
    imageUrls: z.array(z.string().url()).min(1, "At least 1 product image is required").optional(),
  }).refine(
    (data) => Object.keys(data).length > 0,
    { message: "At least one field must be provided." }
  ),
});

// Validate seller product list query parameters
export const sellerProductsQuerySchema = z.object({
  query: z.object({
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().max(100).optional(),
    approvalStatus: z.enum(["PENDING", "VERIFIED", "REJECTED"]).optional(),
  }).optional(),
});
