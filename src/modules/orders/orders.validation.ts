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
