import {
  prisma,
  DeliveryMethod,
  PaymentMethod,
  OrderStatus,
} from "../../config/db";
import { AppError } from "../../utils/AppError";
import { InventoryService } from "../marketplace/inventory.service";

export class OrdersService {
  // Support Member (Ponce): Get User's Orders
  static async getUserOrders(buyerId: string) {
    return await prisma.order.findMany({
      where: { buyerId },
      include: {
        store: { select: { name: true, pickupLocation: true } },
        items: true,
        payment: true,
      },
      orderBy: { createdAt: "desc" },
    });
  }

  // Notable Member (Reyes): Create Order with Stock Check & Order Number Generation
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
    // 1. Fetch product prices and verify availability
    const productIds = data.items.map((i) => i.productId);
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

    const productMap = new Map<string, (typeof products)[number]>(
      products.map((p: any) => [p.id, p])
    );

    let totalAmount = 0;
    const orderItemsData = data.items.map((item) => {
      const prod = productMap.get(item.productId)!;
      const unitPrice = Number(prod.price);
      const subtotal = unitPrice * item.quantity;
      totalAmount += subtotal;

      return {
        productId: prod.id,
        productNameSnapshot: prod.name,
        unitPriceSnapshot: prod.price,
        quantity: item.quantity,
        subtotal,
      };
    });

    const orderNumber = `BZQ-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${Math.floor(
      1000 + Math.random() * 9000
    )}`;

    // 2. Transaction: Atomically deduct stock via Subsystem 2 InventoryService and create order
    return await prisma.$transaction(async (tx: any) => {
      await InventoryService.deductStock(tx, data.items);

      return await tx.order.create({
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
  }

  // Update status (Restores stock if order is cancelled)
  static async updateStatus(orderId: string, status: OrderStatus) {
    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new AppError("Order not found.", 404);

    if (
      status === "CANCELLED" &&
      order.orderStatus !== "CANCELLED" &&
      order.orderStatus !== "COMPLETED"
    ) {
      return await prisma.$transaction(async (tx: any) => {
        await InventoryService.restoreOrderStock(tx, orderId);
        return await tx.order.update({
          where: { id: orderId },
          data: { orderStatus: status },
        });
      });
    }

    return await prisma.order.update({
      where: { id: orderId },
      data: { orderStatus: status },
    });
  }
}
