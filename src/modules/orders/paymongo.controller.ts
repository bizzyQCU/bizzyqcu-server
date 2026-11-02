import { createHmac, timingSafeEqual } from "crypto";
import type { Request, Response } from "express";
import { prisma } from "../../config/db";
import { env } from "../../config/env";

type PayMongoEvent = {
  data?: {
    attributes?: {
      type?: string;
      livemode?: boolean;
      data?: {
        id?: string;
        attributes?: {
          reference_number?: string;
          payment_intent?: {
            id?: string;
          };
          payments?: Array<{
            id?: string;
            attributes?: {
              status?: string;
            };
          }>;
        };
      };
    };
  };
};

function verifyPayMongoSignature(
  rawBody: Buffer,
  signatureHeader: string,
  livemode: boolean
): boolean {
  const parts = signatureHeader.split(",").reduce<Record<string, string>>(
    (result, part) => {
      const [key, value] = part.split("=");
      if (key && value) result[key.trim()] = value.trim();
      return result;
    },
    {}
  );

  const timestamp = parts.t;
  const receivedSignature = livemode ? parts.li : parts.te;
  const webhookSecret = env.PAYMONGO_WEBHOOK_SECRET;

  if (!timestamp || !receivedSignature || !webhookSecret) {
    return false;
  }

  const signedPayload = `${timestamp}.${rawBody.toString("utf8")}`;
  const expectedSignature = createHmac("sha256", webhookSecret)
    .update(signedPayload)
    .digest("hex");

  const expected = Buffer.from(expectedSignature, "hex");
  const received = Buffer.from(receivedSignature, "hex");

  return (
    expected.length === received.length &&
    timingSafeEqual(expected, received)
  );
}

export async function handlePayMongoWebhook(
  req: Request,
  res: Response
): Promise<void> {
  if (!Buffer.isBuffer(req.body)) {
    res.status(400).json({ message: "Invalid webhook body." });
    return;
  }

  const signatureHeader = req.header("Paymongo-Signature");

  if (!signatureHeader) {
    res.status(401).json({ message: "Missing PayMongo signature." });
    return;
  }

  let event: PayMongoEvent;

  try {
    event = JSON.parse(req.body.toString("utf8")) as PayMongoEvent;
  } catch {
    res.status(400).json({ message: "Invalid webhook JSON." });
    return;
  }

  const attributes = event.data?.attributes;
  const livemode = attributes?.livemode;

  if (typeof livemode !== "boolean") {
    res.status(400).json({ message: "Invalid webhook event." });
    return;
  }

  if (!verifyPayMongoSignature(req.body, signatureHeader, livemode)) {
    res.status(401).json({ message: "Invalid PayMongo signature." });
    return;
  }

  if (attributes?.type !== "checkout_session.payment.paid") {
    res.status(200).json({ received: true, ignored: true });
    return;
  }

  const session = attributes.data;
  const sessionId = session?.id;
  const referenceNumber = session?.attributes?.reference_number;
  const paymentIntentId = session?.attributes?.payment_intent?.id;
  const paidPayment = session?.attributes?.payments?.find(
    (payment) => payment.attributes?.status === "paid"
  );

  if (!sessionId || !referenceNumber || !paidPayment) {
    res.status(400).json({ message: "Incomplete payment event." });
    return;
  }

  try {
    const order = await prisma.order.findFirst({
      where: {
        orderNumber: referenceNumber,
        payment: {
          is: {
            paymongoCheckoutId: sessionId,
            status: "PENDING",
            method: "GCASH_PAYMONGO",
          },
        },
      },
      select: {
        id: true,
        orderStatus: true,
      },
    });

    if (!order) {
      res.status(200).json({ received: true, processed: false });
      return;
    }

    await prisma.$transaction(async (tx) => {
      const orderUpdate = await tx.order.updateMany({
        where: {
          id: order.id,
          orderStatus: "PENDING_PAYMENT",
        },
        data: {
          orderStatus: "PENDING_CONFIRMATION",
        },
      });

      if (orderUpdate.count === 0) {
        return;
      }

      const paymentUpdate = await tx.paymentTransaction.updateMany({
        where: {
          orderId: order.id,
          status: "PENDING",
        },
        data: {
          status: "PAID",
          paidAt: new Date(),
          paymongoPaymentIntentId: paymentIntentId ?? null,
        },
      });

      if (paymentUpdate.count !== 1) {
        throw new Error("Payment record could not be updated.");
      }
    });

    res.status(200).json({ received: true, processed: true });
  } catch (error) {
    console.error("[PayMongo Webhook] Processing error:", error);
    // Return 200 to stop PayMongo from retrying endlessly
    res.status(200).json({ received: true, processed: false, error: "internal_error" });
  }
}