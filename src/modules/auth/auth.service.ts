import {
    prisma,
    QcuMemberType,
    UserRole,
    SellerType,
    VerificationStatus,
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
    createRegistrationOtpChallenge,
    verifyRegistrationOtpChallenge,
    claimRegistrationEmailToken,
} from "../../utils/otp";

import { sendOtpEmail } from "../../utils/email";

// Dummy bcrypt hash to neutralize user enumeration timing attacks
const DUMMY_HASH = "$2a$12$e8uq0e1gYq03e.sT2c7GPe7wBskrJ9rMh7g8tE0o8J7H7B.d4B8eq";

export class AuthService {
    // ==========================================
    // USER & SELLER REGISTRATION (Manuel & Vizconde)
    // ==========================================

    static async requestRegistrationOtp(data: {
        email: string;
        qcuIdNumber?: string;
    }) {
        const normalizedEmail = data.email.trim().toLowerCase();
        const cleanQcuId = data.qcuIdNumber?.trim();

        const existing = await prisma.user.findFirst({
            where: {
                OR: [
                    { email: { equals: normalizedEmail, mode: "insensitive" } },
                    ...(cleanQcuId ? [{ qcuIdNumber: cleanQcuId }] : []),
                ],
            },
            select: { id: true },
        });

        if (existing) {
            throw new AppError(
                "A user with this QCU ID or email already exists.",
                400
            );
        }

        const { otp, otpToken, expiresInSeconds } =
            createRegistrationOtpChallenge(normalizedEmail);

        try {
            await sendOtpEmail(normalizedEmail, otp, "registration");
        } catch (err) {
            if (err instanceof AppError) {
                throw err;
            }
            throw new AppError(
                "Unable to send verification email. Please try again later.",
                503
            );
        }

        return {
            message: "Verification code sent to your email address.",
            otpToken,
            expiresInSeconds,
        };
    }

    static async verifyRegistrationOtp(data: {
        email: string;
        otp: string;
        otpToken: string;
    }) {
        const result = verifyRegistrationOtpChallenge(data);

        if (!result.ok) {
            if (result.reason === "too_many_attempts") {
                throw new AppError(
                    "Too many incorrect verification attempts. Please request a new code.",
                    400
                );
            }

            if (result.reason === "expired") {
                throw new AppError(
                    "Verification code has expired. Please request a new code.",
                    400
                );
            }

            throw new AppError("Invalid verification code.", 400);
        }

        return {
            message: "Email verified successfully.",
            emailVerificationToken: result.emailVerificationToken,
            expiresInSeconds: result.expiresInSeconds,
        };
    }

    static async register(data: {
        qcuIdNumber: string;
        email: string;
        emailVerificationToken: string;
        fullName: string;
        memberType?: QcuMemberType;
        qcuIdPhotoUrl: string;
        liveSelfieUrl: string;
        password?: string;
        role?: "BUYER" | "SELLER";
        sellerType?: SellerType;
        supportingDocumentUrl?: string;
    }) {
        const cleanQcuId = data.qcuIdNumber.trim();
        const normalizedEmail = data.email.trim().toLowerCase();
        const memberType = data.memberType ?? QcuMemberType.STUDENT;

        if (memberType !== QcuMemberType.STUDENT) {
            throw new AppError(
                "Only QCU students can register. Faculty and staff registration is not allowed.",
                400
            );
        }

        const emailClaim = claimRegistrationEmailToken(
            normalizedEmail,
            data.emailVerificationToken
        );

        if (!emailClaim) {
            throw new AppError(
                "Email verification is invalid or expired. Please verify your email again.",
                400
            );
        }

        try {
            const existing = await prisma.user.findFirst({
                where: {
                    OR: [
                        { qcuIdNumber: cleanQcuId },
                        { email: { equals: normalizedEmail, mode: "insensitive" } },
                    ],
                },
                select: { id: true },
            });

            if (existing) {
                throw new AppError(
                    "A user with this QCU ID or email already exists.",
                    400
                );
            }

            const isSellerRegistration = data.role === "SELLER";

            if (isSellerRegistration) {
                if (!data.sellerType || !data.supportingDocumentUrl) {
                    throw new AppError(
                        "Seller registration requires seller type and supporting endorsement document URL.",
                        400
                    );
                }
            }

            const passwordHash = data.password
                ? await hashPassword(data.password)
                : undefined;

            return await prisma.$transaction(async (tx) => {
                // Keep UserRole.BUYER until an admin approves the seller endorsement (PROMOTE_SELLER_ROLE_ON_APPROVAL).
                const user = await tx.user.create({
                    data: {
                        qcuIdNumber: cleanQcuId,
                        email: normalizedEmail,
                        fullName: data.fullName.trim(),
                        memberType,
                        qcuIdPhotoUrl: data.qcuIdPhotoUrl,
                        liveSelfieUrl: data.liveSelfieUrl,
                        passwordHash,
                        role: UserRole.BUYER,
                        verificationStatus: VerificationStatus.PENDING,
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

                let sellerProfile = null;
                if (isSellerRegistration) {
                    sellerProfile = await tx.sellerProfile.create({
                        data: {
                            userId: user.id,
                            sellerType: data.sellerType!,
                            supportingDocumentUrl: data.supportingDocumentUrl!,
                            verificationStatus: VerificationStatus.PENDING,
                        },
                        select: {
                            id: true,
                            sellerType: true,
                            supportingDocumentUrl: true,
                            verificationStatus: true,
                            createdAt: true,
                        },
                    });
                }

                return {
                    ...user,
                    sellerProfile,
                };
            });
        } catch (err) {
            emailClaim.release();
            throw err;
        }
    }

    // ==========================================
    // SELLER ENDORSEMENT APPLICATION (Manuel)
    // ==========================================

    static async applyForSeller(
        userId: string,
        data: {
            sellerType: SellerType;
            supportingDocumentUrl: string;
        }
    ) {
        return await prisma.$transaction(async (tx) => {
            const user = await tx.user.findUnique({
                where: { id: userId },
                select: { id: true, memberType: true, role: true },
            });

            if (!user) {
                throw new AppError("User account not found.", 404);
            }

            if (user.role === UserRole.ADMIN) {
                throw new AppError(
                    "Administrator accounts cannot apply as campus sellers.",
                    403
                );
            }

            if (user.memberType !== "STUDENT") {
                throw new AppError(
                    "Only students can apply as campus sellers. Faculty and staff must remain buyers.",
                    400
                );
            }

            const existingProfile = await tx.sellerProfile.findUnique({
                where: { userId },
            });

            if (existingProfile) {
                if (existingProfile.verificationStatus === VerificationStatus.VERIFIED) {
                    throw new AppError("You already have an approved seller profile.", 409);
                }

                if (existingProfile.verificationStatus === VerificationStatus.PENDING) {
                    throw new AppError(
                        "Your seller application is currently pending administrator verification.",
                        409
                    );
                }

                return tx.sellerProfile.update({
                    where: { id: existingProfile.id },
                    data: {
                        sellerType: data.sellerType,
                        supportingDocumentUrl: data.supportingDocumentUrl,
                        verificationStatus: VerificationStatus.PENDING,
                        rejectionReason: null,
                    },
                });
            }

            return tx.sellerProfile.create({
                data: {
                    userId,
                    sellerType: data.sellerType,
                    supportingDocumentUrl: data.supportingDocumentUrl,
                    verificationStatus: VerificationStatus.PENDING,
                },
            });
        });
    }

    // ==========================================
    // ACCOUNT STATUS TRACKING CRUD (Manuel)
    // ==========================================

    static async getAccountStatus(userId: string) {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                qcuIdNumber: true,
                fullName: true,
                email: true,
                memberType: true,
                role: true,
                verificationStatus: true,
                rejectionReason: true,
                verifiedAt: true,
                createdAt: true,
                sellerProfile: {
                    select: {
                        id: true,
                        sellerType: true,
                        supportingDocumentUrl: true,
                        verificationStatus: true,
                        rejectionReason: true,
                        isPaymongoVerified: true,
                        createdAt: true,
                        updatedAt: true,
                    },
                },
                _count: {
                    select: { passkeys: true },
                },
            },
        });

        if (!user) {
            throw new AppError("User account not found.", 404);
        }

        const canAccessMarketplace =
            user.verificationStatus === VerificationStatus.VERIFIED;
        const canSell =
            user.role === UserRole.SELLER &&
            user.sellerProfile?.verificationStatus === VerificationStatus.VERIFIED;

        return {
            userId: user.id,
            qcuIdNumber: user.qcuIdNumber,
            fullName: user.fullName,
            email: user.email,
            memberType: user.memberType,
            role: user.role,
            accountStatus: user.verificationStatus,
            accountRejectionReason: user.rejectionReason,
            accountVerifiedAt: user.verifiedAt,
            sellerStatus: user.sellerProfile?.verificationStatus ?? null,
            sellerProfile: user.sellerProfile,
            registeredDeviceCount: user._count.passkeys,
            canAccessMarketplace,
            canSell,
        };
    }

    static async resubmitUserVerification(
        userId: string,
        data: { qcuIdPhotoUrl?: string; liveSelfieUrl?: string }
    ) {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { id: true, verificationStatus: true },
        });

        if (!user) {
            throw new AppError("User account not found.", 404);
        }

        if (user.verificationStatus === VerificationStatus.VERIFIED) {
            throw new AppError("Your account is already verified.", 400);
        }

        return prisma.user.update({
            where: { id: userId },
            data: {
                ...(data.qcuIdPhotoUrl ? { qcuIdPhotoUrl: data.qcuIdPhotoUrl } : {}),
                ...(data.liveSelfieUrl ? { liveSelfieUrl: data.liveSelfieUrl } : {}),
                verificationStatus: VerificationStatus.PENDING,
                rejectionReason: null,
                verifiedByAdminId: null,
                verifiedAt: null,
            },
            select: {
                id: true,
                qcuIdNumber: true,
                fullName: true,
                verificationStatus: true,
                updatedAt: true,
            },
        });
    }

    static async resubmitSellerVerification(
        userId: string,
        data: { sellerType?: SellerType; supportingDocumentUrl: string }
    ) {
        const sellerProfile = await prisma.sellerProfile.findUnique({
            where: { userId },
        });

        if (!sellerProfile) {
            throw new AppError(
                "No seller profile found. Please register as a seller first.",
                404
            );
        }

        if (sellerProfile.verificationStatus === VerificationStatus.VERIFIED) {
            throw new AppError("Your seller profile is already verified.", 400);
        }

        return prisma.sellerProfile.update({
            where: { id: sellerProfile.id },
            data: {
                ...(data.sellerType ? { sellerType: data.sellerType } : {}),
                supportingDocumentUrl: data.supportingDocumentUrl,
                verificationStatus: VerificationStatus.PENDING,
                rejectionReason: null,
            },
            select: {
                id: true,
                sellerType: true,
                supportingDocumentUrl: true,
                verificationStatus: true,
                updatedAt: true,
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
            // Mitigate timing attack with dummy hash comparison
            await comparePassword(data.password, DUMMY_HASH);
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

        // Store only the OTP hash bound to the user id
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
            // Send the OTP to the registered email (or mock console log in dev)
            await sendOtpEmail(user.email, otp);
        } catch {
            // Invalidate the code if delivery fails
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
                qcuIdNumber: true,
                fullName: true,
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
            token: accessToken, // Compatible with client expects
            accessToken,
            tokenType: "Bearer",
            expiresIn: 3600,
            user: {
                id: user.id,
                qcuIdNumber: user.qcuIdNumber,
                fullName: user.fullName,
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

    // ==========================================
    // CHANGE PASSWORD
    // ==========================================

    static async changePassword(
        userId: string,
        data: { currentPassword: string; newPassword: string }
    ) {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { id: true, passwordHash: true },
        });

        if (!user) {
            throw new AppError("User not found.", 404);
        }

        if (user.passwordHash) {
            const isValid = await comparePassword(
                data.currentPassword,
                user.passwordHash
            );
            if (!isValid) {
                throw new AppError("Current password is incorrect.", 400);
            }
        }

        const passwordHash = await hashPassword(data.newPassword);

        await prisma.user.update({
            where: { id: userId },
            data: { passwordHash },
        });

        return { message: "Password updated successfully." };
    }

    // ==========================================
    // UPDATE EMAIL
    // ==========================================

    static async updateEmail(userId: string, email: string) {
        const normalizedEmail = email.trim().toLowerCase();

        const existing = await prisma.user.findFirst({
            where: {
                email: { equals: normalizedEmail, mode: "insensitive" },
                NOT: { id: userId },
            },
            select: { id: true },
        });

        if (existing) {
            throw new AppError("Email is already taken.", 409);
        }

        const updated = await prisma.user.update({
            where: { id: userId },
            data: { email: normalizedEmail },
            select: {
                id: true,
                email: true,
                fullName: true,
            },
        });

        return updated;
    }
}
