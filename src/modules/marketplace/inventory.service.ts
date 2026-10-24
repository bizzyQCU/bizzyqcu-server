import { prisma, Prisma } from "../../config/db";
import { AppError } from "../../utils/AppError";

export type StockLine = { productId: string; quantity: number };

export class InventoryService {
  // Hook for checkout (Subsystem 3). Call inside the order transaction.
  // Atomic: the stock check and the decrement are one statement, so two buyers cannot oversell.
  static async deductStock(tx: Prisma.TransactionClient, lines: StockLine[]) {
    for (const line of lines) {
      const { count } = await tx.product.updateMany({
        where: { id: line.productId, stockQuantity: { gte: line.quantity } },
        data: { stockQuantity: { decrement: line.quantity } },
      });
      if (count === 0) {
        throw new AppError(`Insufficient stock for product ${line.productId}.`, 409);
      }
    }
  }

  // Hook for cancellation (Subsystem 3). Call inside the cancel transaction, once per order.
  static async restoreOrderStock(tx: Prisma.TransactionClient, orderId: string) {
    const items = await tx.orderItem.findMany({
      where: { orderId },
      select: { productId: true, quantity: true },
    });
    for (const item of items) {
      await tx.product.update({
        where: { id: item.productId },
        data: { stockQuantity: { increment: item.quantity } },
      });
    }
  }

  static async setStock(userId: string, productId: string, stockQuantity: number) {
    await this.assertOwnsProduct(userId, productId);
    return await prisma.product.update({
      where: { id: productId },
      data: { stockQuantity },
      select: { id: true, name: true, stockQuantity: true, isAvailable: true },
    });
  }

  static async setAvailability(userId: string, productId: string, isAvailable: boolean) {
    await this.assertOwnsProduct(userId, productId);
    return await prisma.product.update({
      where: { id: productId },
      data: { isAvailable },
      select: { id: true, name: true, stockQuantity: true, isAvailable: true },
    });
  }

  private static async assertOwnsProduct(userId: string, productId: string) {
    const product = await prisma.product.findFirst({
      where: { id: productId, store: { sellerProfile: { userId } } },
      select: { id: true },
    });
    if (!product) throw new AppError("Product not found in your store.", 404);
  }
}
