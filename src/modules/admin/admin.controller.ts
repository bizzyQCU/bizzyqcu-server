import { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { AdminService } from "./admin.service";

/**
 * Castro's slice of Subsystem 4 (complaints).
 * Guades' handlers live in `verification.controller.ts`,
 * `analytics.controller.ts` and `disputes.controller.ts`.
 */
export class AdminController {
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
