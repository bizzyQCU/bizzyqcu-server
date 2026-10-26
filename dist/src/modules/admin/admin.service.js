import { prisma } from "../../config/db";
import { AppError } from "../../utils/AppError";
/**
 * Castro's slice of Subsystem 4: complaint/report ticket CRUD.
 *
 * Guades' verification, analytics and dispute logic lives in
 * `verification.service.ts`, `analytics.service.ts` and `disputes.service.ts`
 * so the two owners never edit the same file.
 */
export class AdminService {
    static async getComplaints() {
        return await prisma.complaint.findMany({
            include: {
                complainant: { select: { fullName: true, email: true, qcuIdNumber: true } },
                order: { select: { orderNumber: true, totalAmount: true } },
            },
            orderBy: { createdAt: "desc" },
        });
    }
    static async resolveComplaint(data) {
        const complaint = await prisma.complaint.findUnique({ where: { id: data.complaintId } });
        if (!complaint)
            throw new AppError("Complaint not found.", 404);
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
