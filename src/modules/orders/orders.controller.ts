import { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { OrdersService } from "./orders.service";

export class OrdersController {
  static getMyOrders = asyncHandler(async (req: Request, res: Response) => {
    const orders = await OrdersService.getUserOrders(req.user!.id);
    res.status(200).json({
      success: true,
      count: orders.length,
      data: orders,
    });
  });

  static createOrder = asyncHandler(async (req: Request, res: Response) => {
    const order = await OrdersService.createOrder({
      ...req.body,
      buyerId: req.user!.id,
    });
    res.status(201).json({
      success: true,
      message: "Order placed successfully.",
      data: order,
    });
  });

  static updateStatus = asyncHandler(async (req: Request, res: Response) => {
    const order = await OrdersService.updateStatus(
      req.params.id as string,
      req.body.status
    );
    res.status(200).json({
      success: true,
      message: "Order status updated.",
      data: order,
    });
  });
}
