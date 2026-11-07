import { z } from "zod";

export const createCategorySchema = z.object({
  body: z.object({
    name: z.string().trim().min(3, "Category name must be at least 3 characters"),
  }),
});

export const updateCategorySchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid category ID"),
  }),
  body: z.object({
    name: z.string().trim().min(3, "Category name must be at least 3 characters"),
  }),
});

export const categoryIdSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid category ID"),
  }),
});