
import {
    prisma,
    QcuMemberType,
} from "../../config/db";

import { AppError } from "../../utils/AppError";
import {
    hashPassword,
    comparePassword,
} from "../../utils/password";

import { generateAccessToken } from "../../utils/jwt";
import {
    generateOtp,
    hashOtp,
    verifyOtp,
    OTP_EXPIRY_MINUTES,
} from "../../utils/otp";

import { sendOtpEmail } from "../../utils/email";

export class AuthService {
    // ==========================================
    // USER REGISTRATION (Manuel & Vizconde)
    // ==========================================

    static async register(data: {
        qcuIdNumber: string;
        email: string;
        fullName: string;
        memberType: QcuMemberType;
        qcuIdPhotoUrl: string;
        liveSelfieUrl: string;
        password?: string;
    }) {
        const existing = await prisma.user.findFirst({
            where: {
                OR: [
                    { qcuIdNumber: data.qcuIdNumber },
                    { email: data.email },
                ],
            },
        });

        if (existing) {
            throw new AppError(
                "A user with this QCU ID or email already exists.",
                400
            );
        }

        const passwordHash = data.password
            ? await hashPassword(data.password)
            : undefined;

        return await prisma.user.create({
            data: {
                qcuIdNumber: data.qcuIdNumber,
                email: data.email,
                fullName: data.fullName,
                memberType: data.memberType,
                qcuIdPhotoUrl: data.qcuIdPhotoUrl,
                liveSelfieUrl: data.liveSelfieUrl,
                passwordHash,
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

    // ==========================================
    // PASSWORD LOGIN - REQUEST OTP (Vizconde)
    // ==========================================

    static async requestPasswordOtp(data: {
        qcuIdNumber: string;
        password: string;
    }) {
        const user = await prisma.user.findUnique({
            where: {
                qcuIdNumber: data.qcuIdNumber,
            },
            select: {
                id: true,
                email: true,
                passwordHash: true,
            },
        });

        if (!user || !user.passwordHash) {
            throw new AppError(
                "Invalid QCU ID or password.",
                401
            );
        }

        const passwordIsValid = await comparePassword(
            data.password,
            user.passwordHash
        );

        if (!passwordIsValid) {
            throw new AppError(
                "Invalid QCU ID or password.",
                401
            );
        }

        // Generate a new six-digit OTP
        const otp = generateOtp();

        // Store only the OTP hash
        const otpHash = hashOtp(user.id, otp);

        const otpExpiresAt = new Date(
            Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000
        );

        await prisma.user.update({
            where: {
                id: user.id,
            },
            data: {
                otpCode: otpHash,
                otpExpiresAt,
            },
        });

        try {
            // Send the actual OTP to the registered email
            await sendOtpEmail(user.email, otp);
        } catch {
            // Invalidate the code if email delivery fails
            await prisma.user.update({
                where: {
                    id: user.id,
                },
                data: {
                    otpCode: null,
                    otpExpiresAt: null,
                },
            });

            throw new AppError(
                "Unable to send verification email. Please try again later.",
                503
            );
        }

        return {
            message: "Verification code sent to your registered email.",
        };
    }

    // ==========================================
    // VERIFY EMAIL OTP AND ISSUE JWT
    // ==========================================

    static async verifyPasswordOtp(data: {
        qcuIdNumber: string;
        otp: string;
    }) {
        const user = await prisma.user.findUnique({
            where: {
                qcuIdNumber: data.qcuIdNumber,
            },
            select: {
                id: true,
                email: true,
                role: true,
                verificationStatus: true,
                otpCode: true,
                otpExpiresAt: true,
            },
        });

        if (
            !user ||
            !user.otpCode ||
            !user.otpExpiresAt
        ) {
            throw new AppError(
                "Invalid or expired verification code.",
                401
            );
        }

        const now = new Date();

        if (user.otpExpiresAt <= now) {
            throw new AppError(
                "Invalid or expired verification code.",
                401
            );
        }

        const otpIsValid = verifyOtp(
            user.id,
            data.otp,
            user.otpCode
        );

        if (!otpIsValid) {
            throw new AppError(
                "Invalid or expired verification code.",
                401
            );
        }

        // Atomically consume the OTP so it cannot be reused.
        const consumed = await prisma.user.updateMany({
            where: {
                id: user.id,
                otpCode: user.otpCode,
                otpExpiresAt: {
                    gt: now,
                },
            },
            data: {
                otpCode: null,
                otpExpiresAt: null,
            },
        });

        if (consumed.count !== 1) {
            throw new AppError(
                "Invalid or expired verification code.",
                401
            );
        }

        // Generate JWT only after successful OTP verification
        const accessToken = generateAccessToken(user.id);

        return {
            accessToken,
            tokenType: "Bearer",
            expiresIn: 3600,
            user: {
                id: user.id,
                email: user.email,
                role: user.role,
                verificationStatus: user.verificationStatus,
            },
        };
    }

    // ==========================================
    // GET USER PROFILE (Vizconde)
    // ==========================================

    static async getProfile(userId: string) {
        const user = await prisma.user.findUnique({
            where: {
                id: userId,
            },
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
