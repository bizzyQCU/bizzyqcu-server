import { prisma, Prisma, ComplaintStatus, PaymentStatus, PaymentMethod } from "../../config/db";
import { AppError } from "../../utils/AppError";
import { AUDIT_ACTIONS, logAudit, requestIp, AuditSubsystem } from "../../utils/audit";
import { buildPagination, skipTake } from "../../utils/pagination";
import type {
  CreateComplaintInput,
  GetComplaintsQuery,
  ResolveComplaintInput,
  GetAuditLogsQuery,
  GetTransactionLogsQuery,
} from "./admin.validation";

export class AdminService {
  // ---------------------------------------------------------------------------
  // 1. Complaint & Report Ticket CRUD (Duay / Castro)
  // ---------------------------------------------------------------------------

  /**
   * Submit a new complaint ticket.
   * Usable by authenticated BUYERs and SELLERs.
   * If an orderId is provided, verifies that the order exists and the user is a party to it.
   */
  static async createComplaint(data: {
    complainantId: string;
    orderId?: string;
    subject: string;
    description: string;
    evidenceUrls?: string[];
  }) {
    // If orderId is provided, ensure order exists and user is either buyer or seller
    if (data.orderId) {
      const order = await prisma.order.findUnique({
        where: { id: data.orderId },
        select: {
          id: true,
          buyerId: true,
          store: {
            select: {
              sellerProfile: { select: { userId: true } },
            },
          },
        },
      });

      if (!order) {
        throw new AppError("Referenced order not found.", 404);
      }

      const isBuyer = order.buyerId === data.complainantId;
      const isSeller = order.store?.sellerProfile?.userId === data.complainantId;

      if (!isBuyer && !isSeller) {
        throw new AppError(
          "You can only submit a complaint for an order where you are the buyer or seller.",
          403
        );
      }
    }

    return await prisma.complaint.create({
      data: {
        complainantId: data.complainantId,
        orderId: data.orderId ?? null,
        subject: data.subject,
        description: data.description,
        evidenceUrls: data.evidenceUrls ?? [],
        status: "OPEN", // Newly filed tickets start in OPEN state
      },
      include: {
        complainant: {
          select: {
            id: true,
            fullName: true,
            email: true,
            role: true,
            memberType: true,
          },
        },
        order: {
          select: {
            id: true,
            orderNumber: true,
            totalAmount: true,
            orderStatus: true,
          },
        },
      },
    });
  }

  /**
   * View all complaints with pagination and filtering (Admin only).
   */
  static async getComplaints(query: GetComplaintsQuery) {
    const { page, limit, status, orderId, complainantId } = query;
    const { skip, take } = skipTake(page, limit);

    const where: Prisma.ComplaintWhereInput = {
      ...(status && { status }),
      ...(orderId && { orderId }),
      ...(complainantId && { complainantId }),
    };

    const [items, total] = await Promise.all([
      prisma.complaint.findMany({
        where,
        include: {
          complainant: {
            select: {
              id: true,
              fullName: true,
              email: true,
              qcuIdNumber: true,
              memberType: true,
              role: true,
            },
          },
          order: {
            select: {
              id: true,
              orderNumber: true,
              totalAmount: true,
              orderStatus: true,
              store: { select: { id: true, name: true, slug: true } },
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take,
      }),
      prisma.complaint.count({ where }),
    ]);

    return {
      items,
      pagination: buildPagination(page, limit, total),
    };
  }

  /**
   * View complaints submitted by the requesting user (Buyer / Seller self-service).
   */
  static async getMyComplaints(
    userId: string,
    query: { page: number; limit: number; status?: ComplaintStatus }
  ) {
    const { page, limit, status } = query;
    const { skip, take } = skipTake(page, limit);

    const where: Prisma.ComplaintWhereInput = {
      complainantId: userId,
      ...(status && { status }),
    };

    const [items, total] = await Promise.all([
      prisma.complaint.findMany({
        where,
        include: {
          order: {
            select: {
              id: true,
              orderNumber: true,
              totalAmount: true,
              orderStatus: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take,
      }),
      prisma.complaint.count({ where }),
    ]);

    return {
      items,
      pagination: buildPagination(page, limit, total),
    };
  }

  /**
   * Get single complaint details.
   * Admins can view any complaint; users can only view their own.
   */
  static async getComplaintById(
    complaintId: string,
    requestingUser: { id: string; role: string }
  ) {
    const complaint = await prisma.complaint.findUnique({
      where: { id: complaintId },
      include: {
        complainant: {
          select: {
            id: true,
            fullName: true,
            email: true,
            qcuIdNumber: true,
            memberType: true,
            role: true,
          },
        },
        order: {
          select: {
            id: true,
            orderNumber: true,
            totalAmount: true,
            orderStatus: true,
            store: { select: { id: true, name: true, slug: true } },
          },
        },
      },
    });

    if (!complaint) {
      throw new AppError("Complaint not found.", 404);
    }

    if (
      requestingUser.role !== "ADMIN" &&
      complaint.complainantId !== requestingUser.id
    ) {
      throw new AppError("Access denied.", 403);
    }

    return complaint;
  }

  /**
   * Resolve or update status of a complaint (Admin only).
   * Wrapped in a transaction to guarantee an AuditLog record is written.
   */
  static async resolveComplaint(data: {
    adminId: string;
    complaintId: string;
    status: "UNDER_REVIEW" | "RESOLVED" | "DISMISSED";
    adminResolutionNote: string;
    ipAddress?: string | null;
  }) {
    const complaint = await prisma.complaint.findUnique({
      where: { id: data.complaintId },
      select: { id: true, status: true, complainantId: true },
    });
    if (!complaint) throw new AppError("Complaint not found.", 404);

    return await prisma.$transaction(async (tx: any) => {
      const isFinal = data.status === "RESOLVED" || data.status === "DISMISSED";

      const updated = await tx.complaint.update({
        where: { id: data.complaintId },
        data: {
          status: data.status,
          adminResolutionNote: data.adminResolutionNote,
          resolvedByAdminId: data.adminId,
          resolvedAt: isFinal ? new Date() : null,
        },
        include: {
          complainant: {
            select: { id: true, fullName: true, email: true },
          },
          order: {
            select: { id: true, orderNumber: true },
          },
        },
      });

      const auditAction =
        data.status === "RESOLVED"
          ? AUDIT_ACTIONS.RESOLVED_COMPLAINT
          : data.status === "DISMISSED"
          ? AUDIT_ACTIONS.DISMISSED_COMPLAINT
          : AUDIT_ACTIONS.REVIEWED_COMPLAINT;

      await logAudit(tx, {
        actorId: data.adminId,
        subsystem: "ADMIN",
        action: auditAction,
        targetId: data.complaintId,
        ipAddress: requestIp(data.ipAddress),
        details: {
          targetType: "COMPLAINT",
          complainantId: complaint.complainantId,
          previousStatus: complaint.status,
          newStatus: data.status,
          adminResolutionNote: data.adminResolutionNote,
        },
      });

      return updated;
    });
  }

  // ---------------------------------------------------------------------------
  // 2. System Activity / Audit Log Endpoints (Admin only)
  // ---------------------------------------------------------------------------

  /**
   * View system activity & audit logs with pagination and filters.
   */
  static async getAuditLogs(query: GetAuditLogsQuery) {
    const { page, limit, subsystem, action, actorId } = query;
    const { skip, take } = skipTake(page, limit);

    const where: Prisma.AuditLogWhereInput = {
      ...(subsystem && { subsystem }),
      ...(action && { action: { contains: action, mode: "insensitive" } }),
      ...(actorId && { actorId }),
    };

    const [items, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        include: {
          actor: {
            select: {
              id: true,
              fullName: true,
              email: true,
              role: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take,
      }),
      prisma.auditLog.count({ where }),
    ]);

    return {
      items,
      pagination: buildPagination(page, limit, total),
    };
  }

  // ---------------------------------------------------------------------------
  // 3. Transaction Monitoring Logs (PayMongo & Cash) (Admin only)
  // ---------------------------------------------------------------------------

  /**
   * View transaction monitoring logs, including raw PayMongo webhook payloads,
   * split payment sub-accounts, and transaction status.
   */
  static async getTransactionLogs(query: GetTransactionLogsQuery) {
    const { page, limit, status, method, orderId, search } = query;
    const { skip, take } = skipTake(page, limit);

    const where: Prisma.PaymentTransactionWhereInput = {
      ...(status && { status }),
      ...(method && { method }),
      ...(orderId && { orderId }),
      ...(search && {
        OR: [
          { paymongoCheckoutId: { contains: search, mode: "insensitive" } },
          { paymongoPaymentIntentId: { contains: search, mode: "insensitive" } },
          { order: { orderNumber: { contains: search, mode: "insensitive" } } },
        ],
      }),
    };

    const [transactions, total] = await Promise.all([
      prisma.paymentTransaction.findMany({
        where,
        include: {
          order: {
            select: {
              id: true,
              orderNumber: true,
              orderStatus: true,
              buyer: {
                select: { id: true, fullName: true, email: true },
              },
              store: {
                select: { id: true, name: true, slug: true },
              },
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take,
      }),
      prisma.paymentTransaction.count({ where }),
    ]);

    return {
      items: transactions.map((t: any) => ({
        ...t,
        amount: Number(t.amount),
      })),
      pagination: buildPagination(page, limit, total),
    };
  }

  /**
   * Inspect a specific transaction log with full raw webhook details.
   */
  static async getTransactionById(transactionId: string) {
    const transaction = await prisma.paymentTransaction.findUnique({
      where: { id: transactionId },
      include: {
        order: {
          include: {
            buyer: {
              select: {
                id: true,
                fullName: true,
                email: true,
                qcuIdNumber: true,
              },
            },
            store: {
              select: {
                id: true,
                name: true,
                slug: true,
                sellerProfile: {
                  select: {
                    id: true,
                    sellerType: true,
                    paymongoSubAccountId: true,
                  },
                },
              },
            },
            items: true,
          },
        },
      },
    });

    if (!transaction) {
      throw new AppError("Transaction log not found.", 404);
    }

    return {
      ...transaction,
      amount: Number(transaction.amount),
    };
  }
}
