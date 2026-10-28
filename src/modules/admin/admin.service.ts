import { prisma, ComplaintStatus } from "../../config/db";
import { AppError } from "../../utils/AppError";

/**
 * Castro's slice of Subsystem 4: complaint/report ticket CRUD & Audit Logs.
 *
 * Guades' verification, analytics and dispute logic lives in
 * `verification.service.ts`, `analytics.service.ts` and `disputes.service.ts`
 * so the two owners never edit the same file.
 */
export class AdminService {
  // Castro: View Complaints
  static async getComplaints() {
    return await prisma.complaint.findMany({
      include: {
        complainant: { select: { fullName: true, email: true, qcuIdNumber: true } },
        order: { select: { orderNumber: true, totalAmount: true } },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  // Castro: Resolve Complaint
  static async resolveComplaint(data: {
    adminId: string;
    complaintId: string;
    status: ComplaintStatus;
    adminResolutionNote: string;
  }) {
    const complaint = await prisma.complaint.findUnique({ where: { id: data.complaintId } });
    if (!complaint) throw new AppError("Complaint not found.", 404);

    return await prisma.complaint.update({
      where: { id: data.complaintId },
      data: {
        status: data.status,
        adminResolutionNote: data.adminResolutionNote,
        resolvedByAdminId: data.adminId,
        resolvedAt: new Date(),
      },
    });
  }

  // Castro: Submit a complaint (For Buyers/Sellers)
  static async createComplaint(data: {
    complainantId: string;
    orderId?: string;
    subject: string;
    description: string;
  }) {
    return await prisma.complaint.create({
      data: {
        complainantId: data.complainantId,
        orderId: data.orderId,
        subject: data.subject,
        description: data.description,
        status: "UNDER_REVIEW", },
    });
  }

  // Castro: View System Activity / Audit Logs
  static async getAuditLogs() {
    return await prisma.auditLog.findMany({
      include: {
        // Assuming the relation to the User model is named 'actor' in your Prisma schema
        // If it's named 'user', change 'actor' to 'user'
        actor: { select: { fullName: true, role: true } }, 
      },
      orderBy: { createdAt: "desc" },
      take: 100, // Limit to recent 100 logs for monitoring
    });
  }
}