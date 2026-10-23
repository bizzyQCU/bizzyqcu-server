import { z } from "zod";

export const createOrderSchema = z.object({
  body: z.object({
    storeId: z.string().uuid("Invalid store ID"),
    deliveryMethod: z.enum(["ROOM_TO_ROOM", "PICKUP"]),
    campusBuilding: z.string().optional(),
    campusRoomNumber: z.string().optional(),
    pickupInstructions: z.string().optional(),
    deliveryNotes: z.string().optional(),
    paymentMethod: z.enum(["CASH", "GCASH_PAYMONGO"]),
    items: z
      .array(
        z.object({
          productId: z.string().uuid("Invalid product ID"),
          quantity: z.number().int().positive("Quantity must be at least 1"),
        })
      )
      .min(1, "Order must contain at least 1 item"),
  }),
});

export const updateOrderStatusSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid order ID"),
  }),
  body: z.object({
    status: z.enum([
      "PENDING_PAYMENT",
      "PENDING_CONFIRMATION",
      "PREPARING",
      "READY_FOR_PICKUP",
      "OUT_FOR_DELIVERY",
      "COMPLETED",
      "CANCELLED",
    ]),
  }),
});
