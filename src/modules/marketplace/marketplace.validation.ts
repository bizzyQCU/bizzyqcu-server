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