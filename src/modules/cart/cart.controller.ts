import type { Request, Response } from "express";
import { CartService } from "./cart.service";

export class CartController {
  static async getCart(req: Request, res: Response) {
    try {
      const userId = (req as any).user.id;
      const cart = await CartService.getOrCreateCart(userId);
      res.status(200).json(cart);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  static async addItem(req: Request, res: Response) {
    try {
      const userId = (req as any).user.id;
      const { productId, quantity } = req.body;
      const item = await CartService.addItem(userId, productId, quantity);
      res.status(200).json(item);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  static async updateQuantity(req: Request, res: Response) {
    try {
      const userId = (req as any).user.id;
      const cartItemId = req.params.cartItemId as string; // Inayos natin dito
      const { quantity } = req.body;
      const item = await CartService.updateQuantity(userId, cartItemId, quantity);
      res.status(200).json(item);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  static async removeItem(req: Request, res: Response) {
    try {
      const userId = (req as any).user.id;
      const cartItemId = req.params.cartItemId as string; // Inayos natin dito
      await CartService.removeItem(userId, cartItemId);
      res.status(200).json({ message: "Item removed from cart" });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  static async clearCart(req: Request, res: Response) {
    try {
      const userId = (req as any).user.id;
      await CartService.clearCart(userId);
      res.status(200).json({ message: "Cart cleared" });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
}