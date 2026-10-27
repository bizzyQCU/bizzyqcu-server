import { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { VerificationService } from "./verification.service";
import { parseListVerificationsQuery } from "./verification.validation";

const reviewPayload = (req: Request) => ({
  adminId: req.user!.id,
  status: req.body.status,
  rejectionReason: req.body.rejectionReason,
  ipAddress: req.ip,
});

export class VerificationController {
  /** GET /api/v1/admin/verifications?type=&page=&limit= */
  static list = asyncHandler(async (req: Request, res: Response) => {
    const query = parseListVerificationsQuery(req.query);
    const result = await VerificationService.getVerificationQueue(query);
    res.status(200).json({ success: true, ...result });
  });

  /** PATCH /api/v1/admin/verifications/users/:userId */
  static reviewUser = asyncHandler(async (req: Request, res: Response) => {
    const data = await VerificationService.reviewUser(
      req.params.userId as string,
      reviewPayload(req)
    );
    res.status(200).json({
      success: true,
      message: `User verification has been updated to ${req.body.status}.`,
      data,
    });
  });

  /** PATCH /api/v1/admin/verifications/sellers/:sellerProfileId */
  static reviewSeller = asyncHandler(async (req: Request, res: Response) => {
    const data = await VerificationService.reviewSeller(
      req.params.sellerProfileId as string,
      reviewPayload(req)
    );
    res.status(200).json({
      success: true,
      message: `Seller verification has been updated to ${req.body.status}.`,
      data,
    });
  });

  /** PATCH /api/v1/admin/verifications/stores/:storeId */
  static reviewStore = asyncHandler(async (req: Request, res: Response) => {
    const data = await VerificationService.reviewStore(
      req.params.storeId as string,
      reviewPayload(req)
    );
    res.status(200).json({
      success: true,
      message: `Store approval status has been updated to ${req.body.status}.`,
      data,
    });
  });

  /** PATCH /api/v1/admin/products/:productId */
  static reviewProduct = asyncHandler(async (req: Request, res: Response) => {
    const data = await VerificationService.reviewProduct(
      req.params.productId as string,
      reviewPayload(req)
    );
    res.status(200).json({
      success: true,
      message: `Product status has been updated to ${req.body.status}.`,
      data,
    });
  });
}
