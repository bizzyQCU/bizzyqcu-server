import { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { MarketplaceService } from "./marketplace.service";

export class MarketplaceController {
  static createProduct = asyncHandler(async (req: Request, res: Response) => {
    const product = await MarketplaceService.createProduct(
      req.user!.id,
      req.body
    );

    res.status(201).json({
      success: true,
      message: "Product submitted and awaiting administrator approval.",
      data: product,
    });
  });

  static getProduct = asyncHandler(async (req: Request, res: Response) => {
    const productId = String(req.params.id);

    const product = await MarketplaceService.getProduct(
      req.user!.id,
      productId
    );

    res.status(200).json({
      success: true,
      data: product,
    });
  });

  static updateProduct = asyncHandler(async (req: Request, res: Response) => {
    const productId = String(req.params.id);

    const product = await MarketplaceService.updateProduct(
      req.user!.id,
      productId,
      req.body
    );

    res.status(200).json({
      success: true,
      message: "Product updated and submitted for administrator approval.",
      data: product,
    });
  });

  static deleteProduct = asyncHandler(async (req: Request, res: Response) => {
    const productId = String(req.params.id);

    const result = await MarketplaceService.deleteProduct(
      req.user!.id,
      productId
    );

    res.status(200).json({
      success: true,
      ...result,
    });
  });
}