import { prisma } from "../../config/db";
import { AppError } from "../../utils/AppError";

export class CartService {
  /**
   * Retrieves the current user's shopping cart or initializes a new one.
   */
  static async getOrCreateCart(userId: string) {
    let cart = await prisma.cart.findUnique({
      where: { userId },
      include: {
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                price: true,
                imageUrls: true,
                stockQuantity: true,
                isAvailable: true,
                approvalStatus: true,
                store: {
                  select: {
                    id: true,
                    name: true,
                    pickupLocation: true,
                    isOpen: true,
                    approvalStatus: true,
                  },
                },
              },
            },
          },
          orderBy: { id: "asc" },
        },
      },
    });

    if (!cart) {
      cart = await prisma.cart.create({
        data: { userId },
        include: {
          items: {
            include: {
              product: {
                select: {
                  id: true,
                  name: true,
                  price: true,
                  imageUrls: true,
                  stockQuantity: true,
                  isAvailable: true,
                  approvalStatus: true,
                  store: {
                    select: {
                      id: true,
                      name: true,
                      pickupLocation: true,
                      isOpen: true,
                      approvalStatus: true,
                    },
                  },
                },
              },
            },
          },
        },
      });
    }

    return cart;
  }

  /**
   * Adds an item to the user's cart with stock, availability, and self-purchase validation.
   */
  static async addItem(userId: string, productId: string, quantity: number) {
    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: {
        store: {
          select: {
            id: true,
            name: true,
            isOpen: true,
            approvalStatus: true,
            sellerProfile: { select: { userId: true } },
          },
        },
      },
    });

    if (!product) {
      throw new AppError("Product not found.", 404);
    }

    // Business rule: Sellers cannot purchase from their own store
    if (product.store.sellerProfile?.userId === userId) {
      throw new AppError("You cannot add items from your own store to your cart.", 400);
    }

    // Availability and Approval checks
    if (
      product.approvalStatus !== "VERIFIED" ||
      !product.isAvailable ||
      product.store.approvalStatus !== "VERIFIED" ||
      !product.store.isOpen
    ) {
      throw new AppError("This product is currently unavailable for purchase.", 400);
    }

    const cart = await this.getOrCreateCart(userId);
    const existingItem = cart.items.find((item) => item.productId === productId);
    const targetQuantity = existingItem ? existingItem.quantity + quantity : quantity;

    if (targetQuantity > product.stockQuantity) {
      throw new AppError(
        `Insufficient stock for "${product.name}". Available: ${product.stockQuantity}, in cart: ${existingItem?.quantity ?? 0}.`,
        400
      );
    }

    if (existingItem) {
      return prisma.cartItem.update({
        where: { id: existingItem.id },
        data: { quantity: targetQuantity },
        include: { product: true },
      });
    }

    return prisma.cartItem.create({
      data: { cartId: cart.id, productId, quantity },
      include: { product: true },
    });
  }

  /**
   * Updates an item's quantity in the cart with stock and ownership verification.
   */
  static async updateQuantity(userId: string, cartItemId: string, quantity: number) {
    if (quantity <= 0) {
      return this.removeItem(userId, cartItemId);
    }

    const cartItem = await prisma.cartItem.findUnique({
      where: { id: cartItemId },
      include: {
        cart: true,
        product: { select: { id: true, name: true, stockQuantity: true, isAvailable: true } },
      },
    });

    if (!cartItem || cartItem.cart.userId !== userId) {
      throw new AppError("Cart item not found or unauthorized.", 404);
    }

    if (quantity > cartItem.product.stockQuantity) {
      throw new AppError(
        `Requested quantity exceeds available stock (${cartItem.product.stockQuantity}).`,
        400
      );
    }

    return prisma.cartItem.update({
      where: { id: cartItemId },
      data: { quantity },
      include: { product: true },
    });
  }

  /**
   * Removes an item from the user's cart.
   */
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

  /**
   * Clears all items in the user's cart.
   */
  static async clearCart(userId: string) {
    const cart = await prisma.cart.findUnique({ where: { userId } });
    if (!cart) return { count: 0 };

    return prisma.cartItem.deleteMany({ where: { cartId: cart.id } });
  }
}
