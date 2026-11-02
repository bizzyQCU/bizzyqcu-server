import { createHmac, timingSafeEqual } from "node:crypto";
import type { Request, Response } from "express";
import { prisma } from "../../config/db";
import { env } from "../../config/env";
import { InventoryService } from "../marketplace/inventory.service";

type PayMongoEvent = {
  data?: {
    attributes?: {
      type?: string;
      livemode?: boolean;
      data?: {
        id?: string;
        attributes?: {
          reference_number?: string;
          payment_intent?: { id?: string };
          payments?: Array<{ id?: string; attributes?: { status?: string } }>;
        };
      };
    };
  };
};

function verifyPayMongoSignature(rawBody: Buffer, signatureHeader: string, livemode: boolean) {
  const parts = signatureHeader.split(",").reduce<Record<string, string>>((result, part) => {
    const [key, value] = part.split("=");
    if (key && value) result[key.trim()] = value.trim();
    return result;
  }, {});
  const timestamp = parts.t;
  const receivedSignature = livemode ? parts.li : parts.te;
  const secret = env.PAYMONGO_WEBHOOK_SECRET;
  if (!timestamp || !/^\d+$/.test(timestamp) || !receivedSignature || !/^[a-f\d]+$/i.test(receivedSignature) || !secret) return false;
  // Reject stale signed requests to limit replay of captured webhook payloads.
  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) return false;
  const expected = createHmac("sha256", secret).update(`${timestamp}.${rawBody.toString("utf8")}`).digest();
  const received = Buffer.from(receivedSignature, "hex");
  return expected.length === received.length && timingSafeEqual(expected, received);
}

export async function handlePayMongoWebhook(req: Request, res: Response): Promise<void> {
  if (!Buffer.isBuffer(req.body)) {
    res.status(400).json({ success: false, message: "Invalid webhook body." });
    return;
  }
  const signature = req.header("Paymongo-Signature");
  if (!signature) {
    res.status(401).json({ success: false, message: "Missing PayMongo signature." });
    return;
  }
  let event: PayMongoEvent;
  try {
    event = JSON.parse(req.body.toString("utf8")) as PayMongoEvent;
  } catch {
    res.status(400).json({ success: false, message: "Invalid webhook JSON." });
    return;
  }
  const attributes = event.data?.attributes;
  if (typeof attributes?.livemode !== "boolean" || !verifyPayMongoSignature(req.body, signature, attributes.livemode)) {
    res.status(401).json({ success: false, message: "Invalid PayMongo signature." });
    return;
  }

  const eventType = attributes.type ?? "";
  const session = attributes.data;
  const sessionId = session?.id;
  const referenceNumber = session?.attributes?.reference_number;
  if (!sessionId || !referenceNumber) {
    res.status(400).json({ success: false, message: "Incomplete payment event." });
    return;
  }

  const isPaid = eventType === "checkout_session.payment.paid" && session?.attributes?.payments?.some((p) => p.attributes?.status === "paid");
  const isFailed = [
    "checkout_session.payment.failed",
    "checkout_session.payment.cancelled",
    "checkout_session.expired",
    "payment.failed",
    "payment_intent.payment_failed",
  ].includes(eventType);
  if (!isPaid && !isFailed) {
    res.status(200).json({ received: true, ignored: true });
    return;
  }

  try {
    const order = await prisma.order.findFirst({
      where: { orderNumber: referenceNumber, payment: { is: { paymongoCheckoutId: sessionId, status: "PENDING", method: "GCASH_PAYMONGO" } } },
      select: { id: true },
    });
    if (!order) {
      res.status(200).json({ received: true, processed: false, duplicate: true });
      return;
    }

    const processed = await prisma.$transaction(async (tx) => {
      if (isPaid) {
        const orderChanged = await tx.order.updateMany({ where: { id: order.id, orderStatus: "PENDING_PAYMENT" }, data: { orderStatus: "PENDING_CONFIRMATION" } });
        if (orderChanged.count !== 1) return false;
        const paymentChanged = await tx.paymentTransaction.updateMany({
          where: { orderId: order.id, status: "PENDING", paymongoCheckoutId: sessionId },
          data: { status: "PAID", paidAt: new Date(), paymongoPaymentIntentId: session?.attributes?.payment_intent?.id ?? null, webhookPayload: JSON.parse(req.body.toString("utf8")) },
        });
        if (paymentChanged.count !== 1) throw new Error("Payment was not pending during confirmation.");
        return true;
      }

      const cancelled = await tx.order.updateMany({ where: { id: order.id, orderStatus: "PENDING_PAYMENT" }, data: { orderStatus: "CANCELLED" } });
      if (cancelled.count !== 1) return false;
      await InventoryService.restoreOrderStock(tx, order.id);
      const failed = await tx.paymentTransaction.updateMany({
        where: { orderId: order.id, status: "PENDING", paymongoCheckoutId: sessionId },
        data: {
          status: eventType.includes("cancel") || eventType.endsWith("expired") ? "CANCELLED" : "FAILED",
          webhookPayload: JSON.parse(req.body.toString("utf8")),
        },
      });
      if (failed.count !== 1) throw new Error("Payment was not pending during rollback.");
      return true;
    });
    res.status(200).json({ received: true, processed });
  } catch (error) {
    console.error("[PayMongo Webhook] Processing error:", error);
    res.status(500).json({ received: true, processed: false });
  }
}
