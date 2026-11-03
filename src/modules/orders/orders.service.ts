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
  store: { select: { id: true, name: true, pickupLocation: true } },
} as const;

export class OrdersService {
  private static activeCheckouts = new Set<string>();

  /**
   * Asserts whether an actor (buyer, seller of the store, or admin) has permission
   * to access or interact with an order.
   */
  static async assertCanAccessOrder(
    orderId: string,
    actor: { id: string; role: UserRole }
  ) {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        store: {
          select: {
            id: true,
            name: true,
            sellerProfile: { select: { userId: true } },
          },
        },
      },
    });

    if (!order) {
      throw new AppError("Order not found.", 404);
    }

    if (actor.role === "ADMIN") return order;
    if (actor.role === "BUYER" && order.buyerId === actor.id) return order;
    if (
      actor.role === "SELLER" &&
      order.store.sellerProfile?.userId === actor.id
    ) {
      return order;
    }

    throw new AppError(
      "You do not have permission to view or manage this order.",
      403
    );
  }

  /**
   * Fetches the order history for the authenticated buyer.
   */
  static async getUserOrders(buyerId: string) {
    return prisma.order.findMany({
      where: { buyerId },
      include: {
        store: { select: { id: true, name: true, pickupLocation: true } },
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
        _count: { select: { messages: true } },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  /**
   * Fetches incoming orders received by the authenticated seller's store.
   */
  static async getSellerOrders(sellerUserId: string) {
    const store = await prisma.store.findFirst({
      where: { sellerProfile: { userId: sellerUserId } },
      select: { id: true, name: true },
    });

    if (!store) {
      throw new AppError("No registered store found for this seller account.", 404);
    }

    return prisma.order.findMany({
      where: { storeId: store.id },
      include: {
        buyer: {
          select: {
            id: true,
            fullName: true,
            email: true,
            qcuIdNumber: true,
          },
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
        _count: { select: { messages: true } },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  /**
   * Fetches a single order by ID with authorization check.
   */
  static async getOrderById(
    orderId: string,
    actor: { id: string; role: UserRole }
  ) {
    await this.assertCanAccessOrder(orderId, actor);

    return prisma.order.findUniqueOrThrow({
      where: { id: orderId },
      include: {
        store: {
          select: {
            id: true,
            name: true,
            pickupLocation: true,
            sellerProfile: { select: { userId: true, sellerType: true } },
          },
        },
        buyer: {
          select: {
            id: true,
            fullName: true,
            email: true,
            qcuIdNumber: true,
            memberType: true,
          },
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
        messages: {
          include: {
            sender: {
              select: {
                id: true,
                fullName: true,
                role: true,
              },
            },
          },
          orderBy: { createdAt: "asc" },
        },
      },
    });
  }

  /**
   * Retrieves designated campus pickup locations and list of campus buildings.
   */
  static async getPickupLocations() {
    const stores = await prisma.store.findMany({
      where: {
        approvalStatus: "VERIFIED",
        isOpen: true,
        pickupLocation: { not: null },
      },
      select: {
        id: true,
        name: true,
        pickupLocation: true,
      },
    });

    const campusBuildings = [
      "Belmonte Hall (Academic Building 1)",
      "Bautista Hall (Academic Building 2)",
      "TechVoc Building",
      "Administration Building",
      "Student Center / Lobby",
      "University Library Building",
      "San Bartolome Gymnasium",
    ];

    return {
      pickupStores: stores,
      campusBuildings,
    };
  }

  /**
   * Fetches the messages/notes communication log for an order.
   */
  static async getOrderMessages(
    orderId: string,
    actor: { id: string; role: UserRole }
  ) {
    await this.assertCanAccessOrder(orderId, actor);

    return prisma.orderMessage.findMany({
      where: { orderId },
      include: {
        sender: {
          select: {
            id: true,
            fullName: true,
            role: true,
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });
  }

  /**
   * Appends an order message or note between buyer and seller.
   */
  static async createOrderMessage(
    orderId: string,
    senderId: string,
    messageText: string,
    actor: { id: string; role: UserRole }
  ) {
    await this.assertCanAccessOrder(orderId, actor);

    return prisma.orderMessage.create({
      data: {
        orderId,
        senderId,
        message: messageText,
      },
      include: {
        sender: {
          select: {
            id: true,
            fullName: true,
            role: true,
          },
        },
      },
    });
  }

  /**
   * Checks out the buyer's persisted cart. A separate order is created for each seller.
   */
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
      include: {
        items: {
          include: {
            product: {
              include: {
                store: {
                  include: {
                    sellerProfile: {
                      select: {
                        isPaymongoVerified: true,
                        paymongoSubAccountId: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
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

    // Validate every seller, product status, stock, and PayMongo readiness
    for (const items of byStore.values()) {
      const store = items[0].product.store;
      if (!store.isOpen || store.approvalStatus !== "VERIFIED") {
        throw new AppError(
          `Store "${store.name}" is currently unavailable for checkout.`,
          409
        );
      }

      // SIA Rule: Sellers without verified PayMongo linked account accept Cash only
      if (
        data.paymentMethod === "GCASH_PAYMONGO" &&
        !store.sellerProfile?.isPaymongoVerified
      ) {
        throw new AppError(
          `Store "${store.name}" has not completed PayMongo sub-account verification to accept GCash. Please select CASH or order separately.`,
          400
        );
      }

      for (const item of items) {
        const product = item.product;
        if (!product.isAvailable || product.approvalStatus !== "VERIFIED") {
          throw new AppError(
            `Product "${product.name}" is no longer available for purchase.`,
            409
          );
        }
        if (product.stockQuantity < item.quantity) {
          throw new AppError(
            `Insufficient stock for "${product.name}". Available: ${product.stockQuantity}.`,
            409
          );
        }
      }
    }

    // Perform atomic transaction: deduct stock, create orders and payments
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
        const totalAmount = Number(
          lines.reduce((sum, line) => sum + line.subtotal, 0).toFixed(2)
        );
        const orderNumber = `BZQ-${new Date()
          .toISOString()
          .slice(0, 10)
          .replace(/-/g, "")}-${randomUUID().slice(0, 8).toUpperCase()}`;

        await InventoryService.deductStock(
          tx,
          items.map(({ productId, quantity }) => ({ productId, quantity }))
        );

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
            orderStatus:
              data.paymentMethod === "GCASH_PAYMONGO"
                ? "PENDING_PAYMENT"
                : "PENDING_CONFIRMATION",
            items: { create: lines },
            payment: {
              create: {
                amount: totalAmount,
                method: data.paymentMethod,
                status: "PENDING",
              },
            },
          },
          include: orderDetails,
        });
        orders.push(order);
      }

      if (data.paymentMethod === "CASH") {
        // Clear checked-out items from cart
        await tx.cartItem.deleteMany({
          where: {
            cartId: cart.id,
            OR: cart.items.map((item) => ({
              id: item.id,
              productId: item.productId,
              quantity: item.quantity,
            })),
          },
        });
      }
      return orders;
    });

    const orderIds = createdOrders.map((order) => order.id);

    if (data.paymentMethod === "GCASH_PAYMONGO") {
      try {
        const results = await Promise.allSettled(
          createdOrders.map(async (order) => {
            const items = order.items.map((item) => ({
              name: item.productNameSnapshot,
              amount: Math.round(Number(item.unitPriceSnapshot) * 100),
              quantity: item.quantity,
            }));
            const session = await PayMongoService.createCheckoutSession({
              orderId: order.id,
              orderNumber: order.orderNumber,
              items,
              successUrl: `${env.FRONTEND_URL}/checkout/success?order=${order.orderNumber}`,
              cancelUrl: `${env.FRONTEND_URL}/checkout/cancel?order=${order.orderNumber}`,
            });

            await prisma.paymentTransaction.update({
              where: { orderId: order.id },
              data: { paymongoCheckoutId: session.checkoutSessionId },
            });

            return { ...order, checkoutUrl: session.checkoutUrl };
          })
        );

        const failedSessionCreation = results.some(
          (result) => result.status === "rejected"
        );

        if (failedSessionCreation) {
          await this.cancelUnpaidOrders(orderIds, "FAILED");
          throw new AppError(
            "Payment session creation failed. The cart was kept for retry.",
            502
          );
        }

        const withCheckout = results.map(
          (result) =>
            (
              result as PromiseFulfilledResult<
                (typeof createdOrders)[number] & { checkoutUrl: string }
              >
            ).value
        );

        // Clear cart items only after PayMongo sessions are initialized
        await prisma.cartItem.deleteMany({
          where: {
            cartId: cart.id,
            OR: cart.items.map((item) => ({
              id: item.id,
              productId: item.productId,
              quantity: item.quantity,
            })),
          },
        });

        return { orders: withCheckout };
      } catch (error) {
        if (error instanceof AppError) throw error;
        await this.cancelUnpaidOrders(orderIds, "FAILED");
        throw new AppError(
          "Payment session creation failed. The cart was kept for retry.",
          502
        );
      }
    }

    return { orders: createdOrders };
  }

  /**
   * Atomic rollback for unpaid orders; safely cancels order and restores inventory.
   */
  static async cancelUnpaidOrders(
    orderIds: string[],
    paymentStatus: "FAILED" | "CANCELLED"
  ) {
    for (const orderId of orderIds) {
      const existingPayment = await prisma.paymentTransaction.findUnique({
        where: { orderId },
        select: { status: true, method: true, paymongoCheckoutId: true },
      });
      if (!existingPayment || existingPayment.status !== "PENDING") continue;

      if (
        existingPayment.method === "GCASH_PAYMONGO" &&
        existingPayment.paymongoCheckoutId
      ) {
        try {
          await PayMongoService.expireCheckoutSession(
            existingPayment.paymongoCheckoutId
          );
        } catch {
          // Keep stock reserved if the session may already be paid or processing.
          continue;
        }
      }

      await prisma.$transaction(async (tx) => {
        const payment = await tx.paymentTransaction.findUnique({
          where: { orderId },
          select: { status: true },
        });
        if (!payment || payment.status !== "PENDING") return;

        const changed = await tx.order.updateMany({
          where: { id: orderId, orderStatus: "PENDING_PAYMENT" },
          data: { orderStatus: "CANCELLED" },
        });
        if (changed.count !== 1) return;

        await InventoryService.restoreOrderStock(tx, orderId);
        await tx.paymentTransaction.updateMany({
          where: { orderId, status: "PENDING" },
          data: { status: paymentStatus },
        });
      });
    }
  }

  /**
   * Updates an order's status with delivery method and role constraints.
   */
  static async updateStatus(
    orderId: string,
    status: OrderStatus,
    actor: { id: string; role: UserRole }
  ) {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        store: { select: { sellerProfile: { select: { userId: true } } } },
        payment: {
          select: { status: true, method: true, paymongoCheckoutId: true },
        },
      },
    });

    if (!order) throw new AppError("Order not found.", 404);

    assertRoleCanSetStatus(actor.role, status);
    assertValidTransition(order.orderStatus, status, order.deliveryMethod);

    if (
      actor.role === "BUYER" &&
      (order.buyerId !== actor.id ||
        status !== "CANCELLED" ||
        !["PENDING_PAYMENT", "PENDING_CONFIRMATION"].includes(order.orderStatus))
    ) {
      throw new AppError(
        "Buyers may only cancel their own orders awaiting payment or confirmation.",
        403
      );
    }

    if (
      actor.role === "SELLER" &&
      order.store.sellerProfile?.userId !== actor.id
    ) {
      throw new AppError(
        "You are not allowed to modify orders from this store.",
        403
      );
    }

    if (
      order.payment?.method === "GCASH_PAYMONGO" &&
      order.payment.status !== "PAID" &&
      status !== "CANCELLED"
    ) {
      throw new AppError(
        "GCash payment must be confirmed before order fulfillment.",
        409
      );
    }

    if (status === "CANCELLED" && order.payment?.status === "PAID") {
      throw new AppError(
        "Paid orders require an approved dispute or refund process before cancellation.",
        409
      );
    }

    if (
      status === "CANCELLED" &&
      order.payment?.method === "GCASH_PAYMONGO" &&
      order.payment.status === "PENDING"
    ) {
      if (!order.payment.paymongoCheckoutId) {
        throw new AppError(
          "Payment session is not ready to be cancelled.",
          409
        );
      }
      await PayMongoService.expireCheckoutSession(
        order.payment.paymongoCheckoutId
      );
    }

    return prisma.$transaction(async (tx) => {
      const changed = await tx.order.updateMany({
        where: { id: orderId, orderStatus: order.orderStatus },
        data: { orderStatus: status },
      });

      if (changed.count !== 1) {
        throw new AppError("Order status changed concurrently. Refresh and try again.", 409);
      }

      if (status === "CANCELLED") {
        await InventoryService.restoreOrderStock(tx, orderId);
        await tx.paymentTransaction.updateMany({
          where: { orderId, status: "PENDING" },
          data: { status: "CANCELLED" },
        });
      } else if (status === "COMPLETED") {
        await tx.paymentTransaction.updateMany({
          where: { orderId, status: "PENDING", method: "CASH" },
          data: { status: "PAID", paidAt: new Date() },
        });
      }

      return tx.order.findUniqueOrThrow({
        where: { id: orderId },
        include: { items: true, payment: true, store: true },
      });
    });
  }
}
