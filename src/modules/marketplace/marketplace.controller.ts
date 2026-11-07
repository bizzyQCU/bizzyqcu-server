import { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { MarketplaceService } from "./marketplace.service";

export class MarketplaceController {
  // Create a product listing
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

  // Public: Retrieve product details
  static getPublicProduct = asyncHandler(async (req: Request, res: Response) => {
    const productId = String(req.params.id);
    const product = await MarketplaceService.getPublicProduct(productId);

    res.status(200).json({
      success: true,
      data: product,
    });
  });

  // Seller: List own products
  static getSellerProducts = asyncHandler(async (req: Request, res: Response) => {
    const result = await MarketplaceService.getSellerProducts(
      req.user!.id,
      req.query as any
    );

    res.status(200).json({
      success: true,
      ...result,
    });
  });

  // Seller: Retrieve own product details (even if pending or rejected)
  static getSellerProduct = asyncHandler(async (req: Request, res: Response) => {
    const productId = String(req.params.id);
    const product = await MarketplaceService.getSellerProduct(
      req.user!.id,
      productId
    );

    res.status(200).json({
      success: true,
      data: product,
    });
  });

  // Seller: Update product
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

  // Seller: Delete product
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
