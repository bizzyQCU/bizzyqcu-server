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
import { assertRoleCanSetStatus, assertValidTransition } from "./order.state";
import { PayMongoService } from "./paymongo.service";
import { env } from "../../config/env";

type CheckoutData = {
  buyerId: string;
  deliveryMethod: DeliveryMethod;
  paymentMethod: PaymentMethod;
  campusBuilding?: string;
  campusRoomNumber?: string;
  pickupInstructions?: string;
  deliveryNotes?: string;
};

const orderDetails = {
  items: true,
  payment: true,
} as const;

export class OrdersService {
  private static activeCheckouts = new Set<string>();

  static async getUserOrders(buyerId: string) {
    return prisma.order.findMany({
      where: { buyerId },
      include: {
        store: { select: { name: true, pickupLocation: true } },
        items: true,
        payment: {
          select: { id: true, amount: true, method: true, status: true, paidAt: true, createdAt: true, updatedAt: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  /** Checks out the buyer's persisted cart. A separate order is created for each seller. */
  static async createOrder(data: CheckoutData) {
    if (this.activeCheckouts.has(data.buyerId)) {
      throw new AppError("A checkout is already in progress for this cart.", 409);
    }
    this.activeCheckouts.add(data.buyerId);
    try {
      return await this.createOrderFromCart(data);
    } finally {
      this.activeCheckouts.delete(data.buyerId);
    }
  }

  private static async createOrderFromCart(data: CheckoutData) {
    const cart = await prisma.cart.findUnique({
      where: { userId: data.buyerId },
      include: { items: { include: { product: { include: { store: true } } } } },
    });
    if (!cart?.items.length) throw new AppError("Your cart is empty.", 400);

    const byStore = new Map<string, typeof cart.items>();
    for (const item of cart.items) {
      if (!Number.isInteger(item.quantity) || item.quantity < 1) {
        throw new AppError("Cart contains an invalid quantity.", 400);
      }
      const bucket = byStore.get(item.product.storeId) ?? [];
      bucket.push(item);
      byStore.set(item.product.storeId, bucket);
    }

    // Validate every seller and item before reserving any inventory.
    for (const items of byStore.values()) {
      const store = items[0].product.store;
      if (!store.isOpen || store.approvalStatus !== "VERIFIED") {
        throw new AppError(`Store ${store.name} is unavailable for checkout.`, 409);
      }
      for (const item of items) {
        const product = item.product;
        if (!product.isAvailable || product.approvalStatus !== "VERIFIED") {
          throw new AppError(`Product ${product.name} is unavailable.`, 409);
        }
        if (product.stockQuantity < item.quantity) {
          throw new AppError(`Insufficient stock for ${product.name}.`, 409);
        }
      }
    }

    const createdOrders = await prisma.$transaction(async (tx) => {
      const orders = [];
      for (const [storeId, items] of byStore) {
      const lines = items.map(({ product, quantity }) => ({
        productId: product.id,
        quantity,
        productNameSnapshot: product.name,
        unitPriceSnapshot: product.price,
        subtotal: Number((Number(product.price) * quantity).toFixed(2)),
      }));
      const totalAmount = Number(lines.reduce((sum, line) => sum + line.subtotal, 0).toFixed(2));
      const orderNumber = `BZQ-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${randomUUID().slice(0, 8).toUpperCase()}`;

        await InventoryService.deductStock(tx, items.map(({ productId, quantity }) => ({ productId, quantity })));
        const order = await tx.order.create({
          data: {
            orderNumber,
            buyerId: data.buyerId,
            storeId,
            deliveryMethod: data.deliveryMethod,
            paymentMethod: data.paymentMethod,
            campusBuilding: data.campusBuilding || null,
            campusRoomNumber: data.campusRoomNumber || null,
            pickupInstructions: data.pickupInstructions || null,
            deliveryNotes: data.deliveryNotes || null,
            totalAmount,
            orderStatus: data.paymentMethod === "GCASH_PAYMONGO" ? "PENDING_PAYMENT" : "PENDING_CONFIRMATION",
            items: { create: lines },
            payment: { create: { amount: totalAmount, method: data.paymentMethod, status: "PENDING" } },
          },
          include: orderDetails,
        });
        orders.push(order);
      }
      if (data.paymentMethod === "CASH") {
        // Consume only the exact rows checked out. Cart edits made concurrently remain in the cart.
        await tx.cartItem.deleteMany({
          where: {
            cartId: cart.id,
            OR: cart.items.map((item) => ({ id: item.id, productId: item.productId, quantity: item.quantity })),
          },
        });
      }
      return orders;
    });
    const orderIds = createdOrders.map((order) => order.id);

    if (data.paymentMethod === "GCASH_PAYMONGO") {
      try {
        const results = await Promise.allSettled(createdOrders.map(async (order) => {
          const items = order.items.map((item) => ({ name: item.productNameSnapshot, amount: Math.round(Number(item.unitPriceSnapshot) * 100), quantity: item.quantity }));
          const session = await PayMongoService.createCheckoutSession({
            orderId: order.id,
            orderNumber: order.orderNumber,
            items,
            successUrl: `${env.FRONTEND_URL}/checkout/success`,
            cancelUrl: `${env.FRONTEND_URL}/checkout/cancel`,
          });
          await prisma.paymentTransaction.update({ where: { orderId: order.id }, data: { paymongoCheckoutId: session.checkoutSessionId } });
          return { ...order, checkoutUrl: session.checkoutUrl };
        }));
        const failedSessionCreation = results.some((result) => result.status === "rejected");
        if (failedSessionCreation) {
          await this.cancelUnpaidOrders(orderIds, "FAILED");
          throw new AppError("Payment session creation failed. The cart was kept for retry.", 502);
        }
        const withCheckout = results.map((result) => (result as PromiseFulfilledResult<(typeof createdOrders)[number] & { checkoutUrl: string }>).value);
        // Keep cart rows until every required payment session has been created successfully.
        await prisma.cartItem.deleteMany({
          where: {
            cartId: cart.id,
            OR: cart.items.map((item) => ({ id: item.id, productId: item.productId, quantity: item.quantity })),
          },
        });
        return { orders: withCheckout };
      } catch (error) {
        if (error instanceof AppError) throw error;
        await this.cancelUnpaidOrders(orderIds, "FAILED");
        throw new AppError("Payment session creation failed. The cart was kept for retry.", 502);
      }
    }

    return { orders: createdOrders };
  }

  /** Shared atomic rollback for a pending order; status guards make duplicate calls harmless. */
  static async cancelUnpaidOrders(orderIds: string[], paymentStatus: "FAILED" | "CANCELLED") {
    for (const orderId of orderIds) {
      const existingPayment = await prisma.paymentTransaction.findUnique({
        where: { orderId },
        select: { status: true, method: true, paymongoCheckoutId: true },
      });
      if (!existingPayment || existingPayment.status !== "PENDING") continue;
      if (existingPayment.method === "GCASH_PAYMONGO" && existingPayment.paymongoCheckoutId) {
        try {
          await PayMongoService.expireCheckoutSession(existingPayment.paymongoCheckoutId);
        } catch {
          // Keep stock reserved if the session may already be paid or processing.
          continue;
        }
      }
      await prisma.$transaction(async (tx) => {
        const payment = await tx.paymentTransaction.findUnique({ where: { orderId }, select: { status: true } });
        if (!payment || payment.status !== "PENDING") return;
        const changed = await tx.order.updateMany({ where: { id: orderId, orderStatus: "PENDING_PAYMENT" }, data: { orderStatus: "CANCELLED" } });
        if (changed.count !== 1) return;
        await InventoryService.restoreOrderStock(tx, orderId);
        await tx.paymentTransaction.updateMany({ where: { orderId, status: "PENDING" }, data: { status: paymentStatus } });
      });
    }
  }

  static async updateStatus(orderId: string, status: OrderStatus, actor: { id: string; role: UserRole }) {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { store: { select: { sellerProfile: { select: { userId: true } } } }, payment: { select: { status: true, method: true, paymongoCheckoutId: true } } },
    });
    if (!order) throw new AppError("Order not found.", 404);
    assertRoleCanSetStatus(actor.role, status);
    assertValidTransition(order.orderStatus, status);

    if (actor.role === "BUYER" && (order.buyerId !== actor.id || status !== "CANCELLED" || !["PENDING_PAYMENT", "PENDING_CONFIRMATION"].includes(order.orderStatus))) {
      throw new AppError("Buyers may only cancel their own orders awaiting payment or confirmation.", 403);
    }
    if (actor.role === "SELLER" && order.store.sellerProfile?.userId !== actor.id) {
      throw new AppError("You are not allowed to modify orders from this store.", 403);
    }
    if (order.payment?.method === "GCASH_PAYMONGO" && order.payment.status !== "PAID" && status !== "CANCELLED") {
      throw new AppError("Payment must be confirmed before fulfillment.", 409);
    }
    if (status === "CANCELLED" && order.payment?.status === "PAID") {
      throw new AppError("Paid orders require an approved refund process before cancellation.", 409);
    }
    if (status === "CANCELLED" && order.payment?.method === "GCASH_PAYMONGO" && order.payment.status === "PENDING") {
      if (!order.payment.paymongoCheckoutId) throw new AppError("Payment session is not ready to be cancelled.", 409);
      await PayMongoService.expireCheckoutSession(order.payment.paymongoCheckoutId);
    }

    return prisma.$transaction(async (tx) => {
      const changed = await tx.order.updateMany({ where: { id: orderId, orderStatus: order.orderStatus }, data: { orderStatus: status } });
      if (changed.count !== 1) throw new AppError("Order status changed. Refresh and try again.", 409);
      if (status === "CANCELLED") {
        await InventoryService.restoreOrderStock(tx, orderId);
        await tx.paymentTransaction.updateMany({ where: { orderId, status: "PENDING" }, data: { status: "CANCELLED" } });
      } else if (status === "COMPLETED") {
        await tx.paymentTransaction.updateMany({ where: { orderId, status: "PENDING", method: "CASH" }, data: { status: "PAID", paidAt: new Date() } });
      }
      return tx.order.findUniqueOrThrow({ where: { id: orderId }, include: { items: true, payment: true } });
    });
  }
}
