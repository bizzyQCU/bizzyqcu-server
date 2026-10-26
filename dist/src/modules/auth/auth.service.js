import { prisma } from "../../config/db";
import { AppError } from "../../utils/AppError";
export class AuthService {
    // Support Member (Manuel): User Registration & Verification Submission
    static async register(data) {
        const existing = await prisma.user.findFirst({
            where: {
                OR: [{ qcuIdNumber: data.qcuIdNumber }, { email: data.email }],
            },
        });
        if (existing) {
            throw new AppError("A user with this QCU ID or email already exists.", 400);
        }
        return await prisma.user.create({
            data: {
                qcuIdNumber: data.qcuIdNumber,
                email: data.email,
                fullName: data.fullName,
                memberType: data.memberType,
                qcuIdPhotoUrl: data.qcuIdPhotoUrl,
                liveSelfieUrl: data.liveSelfieUrl,
                verificationStatus: "PENDING",
            },
            select: {
                id: true,
                qcuIdNumber: true,
                email: true,
                fullName: true,
                memberType: true,
                role: true,
                verificationStatus: true,
                createdAt: true,
            },
        });
    }
    // Notable Member (Vizconde): Get Profile & WebAuthn Session verification
    static async getProfile(userId) {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                qcuIdNumber: true,
                email: true,
                fullName: true,
                memberType: true,
                role: true,
                verificationStatus: true,
                sellerProfile: true,
                passkeys: {
                    select: {
                        id: true,
                        deviceName: true,
                        deviceType: true,
                        createdAt: true,
                        lastUsedAt: true,
                    },
                },
            },
        });
        if (!user) {
            throw new AppError("User not found.", 404);
        }
        return user;
    }
}
