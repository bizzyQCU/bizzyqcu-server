import { prisma } from "../../config/db";
import { AppError } from "../../utils/AppError";

export class CartService {
  // 1. Kunin ang cart ng user (o gumawa kung wala pa)
  static async getOrCreateCart(userId: string) {
    let cart = await prisma.cart.findUnique({
      where: { userId },
      include: { items: { include: { product: true } } },
    });

    if (!cart) {
      cart = await prisma.cart.create({
        data: { userId },
        include: { items: { include: { product: true } } },
      });
    }
    return cart;
  }

  // 2. Add Item (Idagdag sa cart)
  static async addItem(userId: string, productId: string, quantity: number) {
    const cart = await this.getOrCreateCart(userId);
    
    // Check kung existing na sa cart
    const existingItem = cart.items.find((item) => item.productId === productId);

    if (existingItem) {
      // Update quantity kung meron na
      return prisma.cartItem.update({
        where: { id: existingItem.id },
        data: { quantity: existingItem.quantity + quantity },
      });
    }

    // Create new item
    return prisma.cartItem.create({
      data: { cartId: cart.id, productId, quantity },
    });
  }

  // 3. Update Quantity
  static async updateQuantity(userId: string, cartItemId: string, quantity: number) {
    if (quantity <= 0) {
      // Kung 0 or negative, i-remove na lang
      return this.removeItem(userId, cartItemId);
    }

    const cartItem = await prisma.cartItem.findUnique({
      where: { id: cartItemId },
      include: { cart: true },
    });

    if (!cartItem || cartItem.cart.userId !== userId) {
      throw new AppError("Cart item not found or unauthorized.", 404);
    }

    return prisma.cartItem.update({
      where: { id: cartItemId },
      data: { quantity },
    });
  }

  // 4. Remove Item
  static async removeItem(userId: string, cartItemId: string) {
    const cartItem = await prisma.cartItem.findUnique({
      where: { id: cartItemId },
      include: { cart: true },
    });

    if (!cartItem || cartItem.cart.userId !== userId) {
      throw new AppError("Cart item not found or unauthorized.", 404);
    }

    return prisma.cartItem.delete({ where: { id: cartItemId } });
  }

  // 5. Clear Cart (Burahin lahat)
  static async clearCart(userId: string) {
    const cart = await prisma.cart.findUnique({ where: { userId } });
    if (!cart) return { count: 0 };

    return prisma.cartItem.deleteMany({ where: { cartId: cart.id } });
  }
}