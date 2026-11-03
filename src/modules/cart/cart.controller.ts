import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { CartService } from "./cart.service";

export class CartController {
  static getCart = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const cart = await CartService.getOrCreateCart(userId);

    const totalItems = cart.items.reduce((sum, item) => sum + item.quantity, 0);
    const estimatedTotal = cart.items.reduce(
      (sum, item) => sum + Number(item.product.price) * item.quantity,
      0
    );

    res.status(200).json({
      success: true,
      data: {
        ...cart,
        totalItems,
        estimatedTotal: Number(estimatedTotal.toFixed(2)),
      },
    });
  });

  static addItem = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const { productId, quantity } = req.body;
    const item = await CartService.addItem(userId, productId, quantity);

    res.status(201).json({
      success: true,
      message: "Item added to cart successfully.",
      data: item,
    });
  });

  static updateQuantity = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const cartItemId = req.params.cartItemId as string;
    const { quantity } = req.body;
    const item = await CartService.updateQuantity(userId, cartItemId, quantity);

    res.status(200).json({
      success: true,
      message: quantity === 0 ? "Item removed from cart." : "Cart item quantity updated.",
      data: item,
    });
  });

  static removeItem = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const cartItemId = req.params.cartItemId as string;
    await CartService.removeItem(userId, cartItemId);

    res.status(200).json({
      success: true,
      message: "Item removed from cart successfully.",
    });
  });

  static clearCart = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    await CartService.clearCart(userId);

    res.status(200).json({
      success: true,
      message: "Cart cleared successfully.",
    });
  });
}
