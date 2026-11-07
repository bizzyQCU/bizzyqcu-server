import { z } from "zod";

export const createOrderSchema = z.object({
  body: z
    .object({
      deliveryMethod: z.enum(["ROOM_TO_ROOM", "PICKUP"]),
      campusBuilding: z.string().trim().min(1).max(120).optional(),
      campusRoomNumber: z.string().trim().min(1).max(40).optional(),
      pickupInstructions: z.string().trim().max(500).optional(),
      deliveryNotes: z.string().trim().max(500).optional(),
      paymentMethod: z.enum(["CASH", "GCASH_PAYMONGO"]),
      storeId: z.string().uuid("Invalid store ID").optional(),
      items: z
        .array(
          z.object({
            productId: z.string().uuid("Invalid product ID"),
            quantity: z.number().int().positive("Quantity must be at least 1"),
          })
        )
        .min(1, "Items array must contain at least one product")
        .optional(),
    })
    .superRefine((body, ctx) => {
      if (
        body.deliveryMethod === "ROOM_TO_ROOM" &&
        (!body.campusBuilding || !body.campusRoomNumber)
      ) {
        ctx.addIssue({
          code: "custom",
          path: ["campusBuilding"],
          message:
            "Campus building and room number are required for room-to-room delivery.",
        });
      }
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

export const orderIdParamSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid order ID"),
  }),
});

export const createOrderMessageSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid order ID"),
  }),
  body: z.object({
    message: z
      .string()
      .trim()
      .min(1, "Message cannot be empty")
      .max(1000, "Message cannot exceed 1000 characters"),
  }),
});

export const paymongoOnboardSchema = z.object({
  body: z.object({
    accountName: z.string().trim().min(2, "Account holder name is required"),
    gcashNumber: z
      .string()
      .trim()
      .regex(/^09\d{9}$/, "GCash mobile number must be an 11-digit number starting with 09 (e.g. 09171234567)"),
    bankCode: z.string().trim().default("gcash").optional(),
  }),
});
