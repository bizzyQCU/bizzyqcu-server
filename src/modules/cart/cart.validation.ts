import { z } from "zod";

export const addToCartSchema = z.object({
  body: z.object({
    productId: z.string().uuid("Invalid product ID format"),
    quantity: z.coerce
      .number()
      .int("Quantity must be an integer")
      .min(1, "Quantity must be at least 1")
      .max(99, "Quantity cannot exceed 99 items per line"),
  }),
});

export const updateCartItemSchema = z.object({
  params: z.object({
    cartItemId: z.string().uuid("Invalid cart item ID format"),
  }),
  body: z.object({
    quantity: z.coerce
      .number()
      .int("Quantity must be an integer")
      .min(0, "Quantity cannot be negative")
      .max(99, "Quantity cannot exceed 99 items"),
  }),
});

export const cartItemIdParamSchema = z.object({
  params: z.object({
    cartItemId: z.string().uuid("Invalid cart item ID format"),
  }),
});
