import { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { OrdersService } from "./orders.service";
import { PayMongoService } from "./paymongo.service";

export class OrdersController {
  /**
   * GET /api/v1/orders/my-orders
   * Retrieves all orders placed by the authenticated buyer.
   */
  static getMyOrders = asyncHandler(async (req: Request, res: Response) => {
    const orders = await OrdersService.getUserOrders(req.user!.id);

    res.status(200).json({
      success: true,
      count: orders.length,
      data: orders,
    });
  });

  /**
   * GET /api/v1/orders/seller
   * Retrieves all incoming orders placed to the authenticated seller's store.
   */
  static getSellerOrders = asyncHandler(async (req: Request, res: Response) => {
    const orders = await OrdersService.getSellerOrders(req.user!.id);

    res.status(200).json({
      success: true,
      count: orders.length,
      data: orders,
    });
  });

  /**
   * GET /api/v1/orders/pickup-locations
   * Lists verified campus store pickup locations and official campus delivery buildings.
   */
  static getPickupLocations = asyncHandler(async (_req: Request, res: Response) => {
    const locations = await OrdersService.getPickupLocations();

    res.status(200).json({
      success: true,
      data: locations,
    });
  });

  /**
   * GET /api/v1/orders/:id
   * Retrieves a single order by ID for the authorized buyer, seller, or admin.
   */
  static getOrderById = asyncHandler(async (req: Request, res: Response) => {
    const order = await OrdersService.getOrderById(
      req.params.id as string,
      {
        id: req.user!.id,
        role: req.user!.role,
      }
    );

    res.status(200).json({
      success: true,
      data: order,
    });
  });

  /**
   * POST /api/v1/orders
   * Checks out the buyer's cart and generates orders (and PayMongo sessions if GCash).
   */
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

  /**
   * PATCH /api/v1/orders/:id/status
   * Updates an order's status along the state machine.
   */
  static updateStatus = asyncHandler(async (req: Request, res: Response) => {
    const order = await OrdersService.updateStatus(
      req.params.id as string,
      req.body.status,
      {
        id: req.user!.id,
        role: req.user!.role,
      }
    );

    res.status(200).json({
      success: true,
      message: "Order status updated successfully.",
      data: order,
    });
  });

  /**
   * GET /api/v1/orders/:id/messages
   * Retrieves the communication/notes history between buyer and seller for an order.
   */
  static getOrderMessages = asyncHandler(async (req: Request, res: Response) => {
    const messages = await OrdersService.getOrderMessages(
      req.params.id as string,
      {
        id: req.user!.id,
        role: req.user!.role,
      }
    );

    res.status(200).json({
      success: true,
      count: messages.length,
      data: messages,
    });
  });

  /**
   * POST /api/v1/orders/:id/messages
   * Sends a message or communication note on an order.
   */
  static createOrderMessage = asyncHandler(async (req: Request, res: Response) => {
    const message = await OrdersService.createOrderMessage(
      req.params.id as string,
      req.user!.id,
      req.body.message,
      {
        id: req.user!.id,
        role: req.user!.role,
      }
    );

    res.status(201).json({
      success: true,
      message: "Order message sent successfully.",
      data: message,
    });
  });

  /**
   * POST /api/v1/orders/seller/paymongo-onboard
   * Onboards or updates seller PayMongo sub-account for GCash acceptance.
   */
  static onboardPaymongo = asyncHandler(async (req: Request, res: Response) => {
    const result = await PayMongoService.onboardSeller(req.user!.id, {
      accountName: req.body.accountName,
      gcashNumber: req.body.gcashNumber,
      bankCode: req.body.bankCode,
    });

    res.status(200).json({
      success: true,
      message: result.message,
      data: result,
    });
  });

  /**
   * GET /api/v1/orders/seller/paymongo-status
   * Checks the authenticated seller's PayMongo account status.
   */
  static getPaymongoStatus = asyncHandler(async (req: Request, res: Response) => {
    const status = await PayMongoService.getSellerPaymongoStatus(req.user!.id);

    res.status(200).json({
      success: true,
      data: status,
    });
  });
}
