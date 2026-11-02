import { randomUUID } from "node:crypto";
import {
  prisma,
  DeliveryMethod,
  PaymentMethod,
  OrderStatus,
  UserRole,
} from "../../config/db";
import { AppError } from "../../utils/AppError";
import { InventoryService } from "../marketplace/inventory.service";
import {
  assertRoleCanSetStatus,
  assertValidTransition,
} from "./order.state";
import { PayMongoService } from "./paymongo.service";
import { env } from "../../config/env";

export class OrdersService {
  static async getUserOrders(buyerId: string) {
    return prisma.order.findMany({
      where: { buyerId },
      include: {
        store: {
          select: { name: true, pickupLocation: true },
        },
        items: true,
        payment: {
          select: {
            id: true,
            amount: true,
            method: true,
            status: true,
            paidAt: true,
            createdAt: true,
            updatedAt: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  static async createOrder(data: {
    buyerId: string;
    storeId: string;
    deliveryMethod: DeliveryMethod;
    paymentMethod: PaymentMethod;
    campusBuilding?: string;
    campusRoomNumber?: string;
    pickupInstructions?: string;
    deliveryNotes?: string;
    items: { productId: string; quantity: number }[];
  }) {
    const productIds = data.items.map((item) => item.productId);

    if (new Set(productIds).size !== productIds.length) {
      throw new AppError("Each product may only appear once in an order.", 400);
    }

    const store = await prisma.store.findUnique({
      where: { id: data.storeId },
      select: { id: true, isOpen: true, approvalStatus: true },
    });

    if (!store || store.approvalStatus !== "VERIFIED" || !store.isOpen) {
      throw new AppError("This store is unavailable for checkout.", 400);
    }

    const products = await prisma.product.findMany({
      where: {
        id: { in: productIds },
        storeId: data.storeId,
        approvalStatus: "VERIFIED",
        isAvailable: true,
      },
    });

    if (products.length !== productIds.length) {
      throw new AppError("One or more selected products are invalid or unavailable.", 400);
    }

    const productMap = new Map(products.map((product) => [product.id, product]));

    let totalAmount = 0;
    
    // FIX: Explicitly type the array
    const lineItemsForPayMongo: { name: string; amount: number; quantity: number }[] = [];

    const orderItemsData = data.items.map((item) => {
      const product = productMap.get(item.productId);

      if (!product) {
        throw new AppError("Selected product could not be found.", 400);
      }

      const unitPrice = Number(product.price);
      const subtotal = Number((unitPrice * item.quantity).toFixed(2));

      totalAmount = Number((totalAmount + subtotal).toFixed(2));

      lineItemsForPayMongo.push({
        name: product.name,
        amount: Math.round(unitPrice * 100),
        quantity: item.quantity,
      });

      return {
        productId: product.id,
        productNameSnapshot: product.name,
        unitPriceSnapshot: product.price,
        quantity: item.quantity,
        subtotal,
      };
    });

    const orderNumber = `BZQ-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${randomUUID().slice(0, 8).toUpperCase()}`;

    const order = await prisma.$transaction(async (tx) => {
      await InventoryService.deductStock(tx, data.items);

      return tx.order.create({
        data: {
          orderNumber,
          buyerId: data.buyerId,
          storeId: data.storeId,
          deliveryMethod: data.deliveryMethod,
          paymentMethod: data.paymentMethod,
          campusBuilding: data.campusBuilding || null,
          campusRoomNumber: data.campusRoomNumber || null,
          pickupInstructions: data.pickupInstructions || null,
          deliveryNotes: data.deliveryNotes || null,
          totalAmount,
          orderStatus:
            data.paymentMethod === "GCASH_PAYMONGO"
              ? "PENDING_PAYMENT"
              : "PENDING_CONFIRMATION",
          items: {
            create: orderItemsData,
          },
          payment: {
            create: {
              amount: totalAmount,
              method: data.paymentMethod,
              status: "PENDING",
            },
          },
        },
        include: {
          items: true,
          payment: true,
        },
      });
    });

    let checkoutUrl: string | undefined = undefined;

    if (data.paymentMethod === "GCASH_PAYMONGO") {
      try {
        const session = await PayMongoService.createCheckoutSession({
          orderId: order.id,
          orderNumber: order.orderNumber,
          items: lineItemsForPayMongo,
          successUrl: `${env.FRONTEND_URL}/checkout/success`,
          cancelUrl: `${env.FRONTEND_URL}/checkout/cancel`,
        });

        checkoutUrl = session.checkoutUrl;

        await prisma.paymentTransaction.update({
          where: { orderId: order.id },
          data: { paymongoCheckoutId: session.checkoutSessionId },
        });
      } catch (error) {
        await prisma.$transaction(async (tx) => {
          await tx.order.update({
            where: { id: order.id },
            data: { orderStatus: "CANCELLED" },
          });
          await InventoryService.restoreOrderStock(tx, order.id);
          await tx.paymentTransaction.update({
            where: { orderId: order.id },
            data: { status: "FAILED" },
          });
        });
        throw new AppError("Payment session creation failed. Order cancelled.", 502);
      }
    }

    return { ...order, checkoutUrl };
  }

  static async updateStatus(
    orderId: string,
    status: OrderStatus,
    actor: { id: string; role: UserRole }
  ) {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        store: { select: { sellerProfile: { select: { userId: true } } } },
        payment: { select: { status: true } },
      },
    });

    if (!order) throw new AppError("Order not found.", 404);

    assertRoleCanSetStatus(actor.role, status);
    assertValidTransition(order.orderStatus, status);

    if (actor.role === "BUYER") {
      if (order.buyerId !== actor.id) {
        throw new AppError("You are not allowed to modify this order.", 403);
      }

      if (
        status !== "CANCELLED" ||
        !["PENDING_PAYMENT", "PENDING_CONFIRMATION"].includes(order.orderStatus)
      ) {
        throw new AppError("Buyers may only cancel orders awaiting payment or confirmation.", 409);
      }
    }

    if (actor.role === "SELLER") {
      if (order.store.sellerProfile?.userId !== actor.id) {
        throw new AppError("You are not allowed to modify orders from this store.", 403);
      }
    }

    if (
      status === "PENDING_CONFIRMATION" &&
      order.orderStatus === "PENDING_PAYMENT" &&
      order.payment?.status !== "PAID"
    ) {
      throw new AppError("Payment must be confirmed before the order can proceed.", 409);
    }

    if (status === "CANCELLED" && order.payment?.status === "PAID") {
      throw new AppError("Paid orders require an approved refund process before cancellation.", 409);
    }

    return prisma.$transaction(async (tx) => {
      const changed = await tx.order.updateMany({
        where: {
          id: orderId,
          orderStatus: order.orderStatus,
        },
        data: {
          orderStatus: status,
        },
      });

      if (changed.count !== 1) {
        throw new AppError("Order status changed. Refresh and try again.", 409);
      }

      if (status === "CANCELLED") {
        await InventoryService.restoreOrderStock(tx, orderId);

        await tx.paymentTransaction.updateMany({
          where: {
            orderId,
            status: "PENDING",
          },
          data: {
            status: "CANCELLED",
          },
        });
      }

      return tx.order.findUniqueOrThrow({
        where: { id: orderId },
        include: {
          items: true,
          payment: {
            select: {
              id: true, amount: true, method: true, status: true, paidAt: true,
            },
          },
        },
      });
    });
  }
}