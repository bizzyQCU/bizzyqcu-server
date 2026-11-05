
import { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { StoreService } from "./store.service";

export class StoreController {
  // Register a new store
  static createStore = asyncHandler(async (req: Request, res: Response) => {
    const store = await StoreService.createStore(
      req.user!.id,
      req.body
    );

    res.status(201).json({
      success: true,
      message: "Store registered and awaiting administrator approval.",
      data: store,
    });
  });

  // Get the authenticated seller's store
  static getMyStore = asyncHandler(async (req: Request, res: Response) => {
    const store = await StoreService.getMyStore(req.user!.id);

    res.status(200).json({
      success: true,
      data: store,
    });
  });

  // Update the authenticated seller's store
  static updateMyStore = asyncHandler(async (req: Request, res: Response) => {
    const store = await StoreService.updateMyStore(
      req.user!.id,
      req.body
    );

    res.status(200).json({
      success: true,
      message: "Store profile updated successfully.",
      data: store,
    });
  });

  // Delete the authenticated seller's store
  static deleteMyStore = asyncHandler(async (req: Request, res: Response) => {
    const result = await StoreService.deleteMyStore(req.user!.id);

    res.status(200).json({
      success: true,
      ...result,
    });
  });
}
