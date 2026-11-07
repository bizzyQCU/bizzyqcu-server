import { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { OrganizationService } from "./organization.service";

export class OrganizationController {
  /**
   * GET /api/v1/organization/profile
   */
  static getProfile = asyncHandler(async (req: Request, res: Response) => {
    const profile = await OrganizationService.getProfile(req.user!.id);

    res.status(200).json({
      success: true,
      data: profile,
    });
  });

  /**
   * PUT/PATCH /api/v1/organization/profile
   */
  static updateProfile = asyncHandler(async (req: Request, res: Response) => {
    const result = await OrganizationService.updateProfile(req.user!.id, req.body);

    res.status(200).json({
      success: true,
      message: result.message,
      data: result,
    });
  });

  /**
   * POST /api/v1/organization/change-password
   */
  static changePassword = asyncHandler(async (req: Request, res: Response) => {
    const result = await OrganizationService.changePassword(req.user!.id, req.body);

    res.status(200).json({
      success: true,
      message: result.message,
    });
  });
}
