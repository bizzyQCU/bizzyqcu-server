import { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { AdminService } from "./admin.service";
import type {
  GetComplaintsQuery,
  GetAuditLogsQuery,
  GetTransactionLogsQuery,
} from "./admin.validation";

export class AdminController {
  // ---------------------------------------------------------------------------
  // Complaints CRUD (Duay & Castro)
  // ---------------------------------------------------------------------------

  /** POST /complaints (Submit a ticket - Buyers & Sellers) */
  static createComplaint = asyncHandler(async (req: Request, res: Response) => {
    const result = await AdminService.createComplaint({
      complainantId: req.user!.id,
      orderId: req.body.orderId,
      subject: req.body.subject,
      description: req.body.description,
      evidenceUrls: req.body.evidenceUrls,
    });
    res.status(201).json({
      success: true,
      message: "Complaint submitted successfully.",
      data: result,
    });
  });

  /** GET /admin/complaints (Admin view all tickets) */
  static getComplaints = asyncHandler(async (req: Request, res: Response) => {
    const result = await AdminService.getComplaints(
      req.query as unknown as GetComplaintsQuery
    );
    res.status(200).json({
      success: true,
      ...result,
    });
  });

  /** GET /complaints/my (User view their own tickets) */
  static getMyComplaints = asyncHandler(async (req: Request, res: Response) => {
    const result = await AdminService.getMyComplaints(
      req.user!.id,
      req.query as any
    );
    res.status(200).json({
      success: true,
      ...result,
    });
  });

  /** GET /complaints/:complaintId (View ticket detail) */
  static getComplaintById = asyncHandler(async (req: Request, res: Response) => {
    const complaint = await AdminService.getComplaintById(
      req.params.complaintId as string,
      req.user!
    );
    res.status(200).json({
      success: true,
      data: complaint,
    });
  });

  /** PATCH /admin/complaints/:complaintId (Admin resolve ticket) */
  static resolveComplaint = asyncHandler(async (req: Request, res: Response) => {
    const result = await AdminService.resolveComplaint({
      adminId: req.user!.id,
      complaintId: req.params.complaintId as string,
      status: req.body.status,
      adminResolutionNote: req.body.adminResolutionNote,
      ipAddress: req.ip,
    });
    res.status(200).json({
      success: true,
      message: "Complaint resolution recorded.",
      data: result,
    });
  });

  // ---------------------------------------------------------------------------
  // System Activity & Audit Logs
  // ---------------------------------------------------------------------------

  /** GET /admin/audit-logs */
  static getAuditLogs = asyncHandler(async (req: Request, res: Response) => {
    const result = await AdminService.getAuditLogs(
      req.query as unknown as GetAuditLogsQuery
    );
    res.status(200).json({
      success: true,
      ...result,
    });
  });

  // ---------------------------------------------------------------------------
  // Transaction Monitoring Logs
  // ---------------------------------------------------------------------------

  /** GET /admin/transactions */
  static getTransactionLogs = asyncHandler(async (req: Request, res: Response) => {
    const result = await AdminService.getTransactionLogs(
      req.query as unknown as GetTransactionLogsQuery
    );
    res.status(200).json({
      success: true,
      ...result,
    });
  });

  /** GET /admin/transactions/:transactionId */
  static getTransactionById = asyncHandler(async (req: Request, res: Response) => {
    const result = await AdminService.getTransactionById(
      req.params.transactionId as string
    );
    res.status(200).json({
      success: true,
      data: result,
    });
  });
}
