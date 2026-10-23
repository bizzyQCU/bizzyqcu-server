import { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { AdminService } from "./admin.service";

export class AdminController {
  static getPendingVerifications = asyncHandler(async (_req: Request, res: Response) => {
    const list = await AdminService.getPendingVerifications();
    res.status(200).json({
      success: true,
      count: list.length,
      data: list,
    });
  });

  static reviewUser = asyncHandler(async (req: Request, res: Response) => {
    const result = await AdminService.reviewUser({
      adminId: req.user!.id,
      userId: req.params.userId as string,
      status: req.body.status,
      rejectionReason: req.body.rejectionReason,
    });
    res.status(200).json({
      success: true,
      message: `User verification has been updated to ${req.body.status}.`,
      data: result,
    });
  });

  static reviewProduct = asyncHandler(async (req: Request, res: Response) => {
    const result = await AdminService.reviewProduct({
      adminId: req.user!.id,
      productId: req.params.productId as string,
      status: req.body.status,
      rejectionReason: req.body.rejectionReason,
    });
    res.status(200).json({
      success: true,
      message: `Product status has been updated to ${req.body.status}.`,
      data: result,
    });
  });

  static getComplaints = asyncHandler(async (_req: Request, res: Response) => {
    const complaints = await AdminService.getComplaints();
    res.status(200).json({
      success: true,
      count: complaints.length,
      data: complaints,
    });
  });

  static resolveComplaint = asyncHandler(async (req: Request, res: Response) => {
    const result = await AdminService.resolveComplaint({
      adminId: req.user!.id,
      complaintId: req.params.complaintId as string,
      status: req.body.status,
      adminResolutionNote: req.body.adminResolutionNote,
    });
    res.status(200).json({
      success: true,
      message: "Complaint resolution recorded.",
      data: result,
    });
  });
}
