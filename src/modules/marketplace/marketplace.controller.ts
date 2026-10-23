import { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { MarketplaceService } from "./marketplace.service";

export class MarketplaceController {
  static createProduct = asyncHandler(async (req: Request, res: Response) => {
    const product = await MarketplaceService.createProduct(req.body);
    res.status(201).json({
      success: true,
      message: "Product submitted and awaiting administrator approval.",
      data: product,
    });
  });

  static getProducts = asyncHandler(async (req: Request, res: Response) => {
    const products = await MarketplaceService.getActiveProducts(
      req.query as any
    );
    res.status(200).json({
      success: true,
      count: products.length,
      data: products,
    });
  });
}
