import { prisma, VerificationStatus, ComplaintStatus } from "../../config/db";
import { AppError } from "../../utils/AppError";

export class AdminService {
  // Support Member (Castro): List Pending Verifications & Complaints
  static async getPendingVerifications() {
    return await prisma.user.findMany({
      where: { verificationStatus: "PENDING" },
      select: {
        id: true,
        qcuIdNumber: true,
        email: true,
        fullName: true,
        memberType: true,
        qcuIdPhotoUrl: true,
        liveSelfieUrl: true,
        createdAt: true,
      },
      orderBy: { createdAt: "asc" },
    });
  }

  static async getComplaints() {
    return await prisma.complaint.findMany({
      include: {
        complainant: { select: { fullName: true, email: true, qcuIdNumber: true } },
        order: { select: { orderNumber: true, totalAmount: true } },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  // Notable Member (Guades): Approve/Reject User Verification + Audit Log
  static async reviewUser(data: {
    adminId: string;
    userId: string;
    status: VerificationStatus;
    rejectionReason?: string;
  }) {
    const user = await prisma.user.findUnique({ where: { id: data.userId } });
    if (!user) throw new AppError("User not found.", 404);

    return await prisma.$transaction(async (tx: any) => {
      const updatedUser = await tx.user.update({
        where: { id: data.userId },
        data: {
          verificationStatus: data.status,
          rejectionReason: data.rejectionReason || null,
          verifiedByAdminId: data.adminId,
          verifiedAt: data.status === "VERIFIED" ? new Date() : null,
        },
      });

      await tx.auditLog.create({
        data: {
          actorId: data.adminId,
          subsystem: "AUTH",
          action: data.status === "VERIFIED" ? "APPROVED_USER" : "REJECTED_USER",
          targetId: data.userId,
          details: {
            rejectionReason: data.rejectionReason || null,
          },
        },
      });

      return updatedUser;
    });
  }

  // Notable Member (Guades): Approve/Reject Product + Audit Log
  static async reviewProduct(data: {
    adminId: string;
    productId: string;
    status: VerificationStatus;
    rejectionReason?: string;
  }) {
    const product = await prisma.product.findUnique({ where: { id: data.productId } });
    if (!product) throw new AppError("Product not found.", 404);

    return await prisma.$transaction(async (tx: any) => {
      const updatedProduct = await tx.product.update({
        where: { id: data.productId },
        data: {
          approvalStatus: data.status,
          rejectionReason: data.rejectionReason || null,
        },
      });

      await tx.auditLog.create({
        data: {
          actorId: data.adminId,
          subsystem: "MARKETPLACE",
          action: data.status === "VERIFIED" ? "APPROVED_PRODUCT" : "REJECTED_PRODUCT",
          targetId: data.productId,
          details: {
            rejectionReason: data.rejectionReason || null,
          },
        },
      });

      return updatedProduct;
    });
  }

  // Resolve Complaint
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
}
