import { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { DisputesService } from "./disputes.service";
import { parseListDuplicatesQuery } from "./disputes.validation";

export class DisputesController {
  /** GET /api/v1/admin/duplicates?page=&limit= */
  static listDuplicates = asyncHandler(async (req: Request, res: Response) => {
    const query = parseListDuplicatesQuery(req.query);
    const result = await DisputesService.getDuplicates(query);
    res.status(200).json({ success: true, ...result });
  });

  /** PATCH /api/v1/admin/duplicates/:userId */
  static rejectDuplicate = asyncHandler(async (req: Request, res: Response) => {
    const data = await DisputesService.rejectDuplicate({
      adminId: req.user!.id,
      userId: req.params.userId as string,
      rejectionReason: req.body.rejectionReason,
      duplicateOfUserId: req.body.duplicateOfUserId,
      ipAddress: req.ip,
    });
    res.status(200).json({
      success: true,
      message: "Duplicate account rejected.",
      data,
    });
  });

  /** POST /api/v1/admin/disputes/:userId/reopen */
  static reopenDispute = asyncHandler(async (req: Request, res: Response) => {
    const data = await DisputesService.reopenDispute({
      adminId: req.user!.id,
      userId: req.params.userId as string,
      reason: req.body?.reason,
      ipAddress: req.ip,
    });
    res.status(200).json({
      success: true,
      message: "Disputed account reopened and returned to the verification queue.",
      data,
    });
  });
}
