import { z } from "zod";
import { env } from "../../config/env";

const isTrustedDocumentUrl = (value: string): boolean => {
    try {
        const parsed = new URL(value);
        if (parsed.protocol !== "https:" || parsed.hostname !== "res.cloudinary.com") {
            return false;
        }
        if (env.NODE_ENV === "production" && env.CLOUDINARY_CLOUD_NAME) {
            return parsed.pathname.startsWith(`/${env.CLOUDINARY_CLOUD_NAME}/`);
        }
        return true;
    } catch {
        return false;
    }
};

const trustedDocumentUrl = (message: string) =>
    z
        .string()
        .trim()
        .url(message)
        .refine(isTrustedDocumentUrl, "Document URL must point to an uploaded verification asset.");

const SELLER_TYPE_ENUM = z.enum([
    "STUDENT_ENTERPRISE",
    "RECOGNIZED_ORGANIZATION",
    "INDEPENDENT_SELLER",
]);

// ==========================================
// REGISTRATION SCHEMAS (Manuel & Vizconde)
// ==========================================

export const registerUserSchema = z.object({
    body: z.object({
        qcuIdNumber: z.string().trim().regex(
            /^\d{2}-\d{4}$/,
            "QCU ID format must be YY-NNNN (e.g., 24-0001)"
        ),
        email: z.string().trim().email("Invalid email address").transform((v) => v.toLowerCase()),
        fullName: z.string().trim().min(2, "Full name must be at least 2 characters"),
        memberType: z.enum(["STUDENT", "FACULTY", "STAFF"]),
        qcuIdPhotoUrl: trustedDocumentUrl("Valid QCU ID photo URL required"),
        liveSelfieUrl: trustedDocumentUrl("Valid live selfie photo URL required"),
        password: z.string().min(8, "Password must be at least 8 characters").optional(),
        role: z.enum(["BUYER", "SELLER"]).optional().default("BUYER"),
        sellerType: SELLER_TYPE_ENUM.optional(),
        supportingDocumentUrl: trustedDocumentUrl("Valid supporting document URL required").optional(),
    }).superRefine((data, ctx) => {
        if (data.role === "SELLER") {
            if (data.memberType !== "STUDENT") {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: "Only students can register as campus sellers. Faculty and staff must be buyers.",
                    path: ["memberType"],
                });
            }
            if (!data.sellerType) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: "Seller type (STUDENT_ENTERPRISE, RECOGNIZED_ORGANIZATION, or INDEPENDENT_SELLER) is required for seller registration.",
                    path: ["sellerType"],
                });
            }
            if (!data.supportingDocumentUrl) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: "Supporting endorsement document URL (OJT endorsement, org recognition, or enrollment proof) is required for seller registration.",
                    path: ["supportingDocumentUrl"],
                });
            }
        }
    }),
});

export const registerSellerSchema = z.object({
    body: z.object({
        sellerType: SELLER_TYPE_ENUM,
        supportingDocumentUrl: trustedDocumentUrl(
            "Valid supporting document URL required (e.g., OJT endorsement, org recognition, or enrollment proof)"
        ),
    }),
});

export const resubmitUserVerificationSchema = z.object({
    body: z.object({
        qcuIdPhotoUrl: trustedDocumentUrl("Valid QCU ID photo URL required").optional(),
        liveSelfieUrl: trustedDocumentUrl("Valid live selfie photo URL required").optional(),
    }).refine(
        (data) => Boolean(data.qcuIdPhotoUrl || data.liveSelfieUrl),
        { message: "At least one verification document (QCU ID photo or live selfie) must be provided." }
    ),
});

export const resubmitSellerVerificationSchema = z.object({
    body: z.object({
        sellerType: SELLER_TYPE_ENUM.optional(),
        supportingDocumentUrl: trustedDocumentUrl("Valid supporting document URL required"),
    }),
});

export const verificationUploadSchema = z.object({
    body: z.object({
        documentType: z.enum(["QCU_ID", "LIVE_SELFIE", "SELLER_ENDORSEMENT"]),
    }),
});

// ==========================================
// REGISTERED DEVICE MANAGEMENT SCHEMAS
// ==========================================

export const deviceIdSchema = z.object({
    params: z.object({
        id: z.string().min(1, "Device ID is required"),
    }),
});

export const updateDeviceSchema = z.object({
    params: z.object({
        id: z.string().min(1, "Device ID is required"),
    }),
    body: z.object({
        deviceName: z
            .string()
            .trim()
            .min(1, "Device name cannot be empty")
            .max(100, "Device name cannot exceed 100 characters"),
    }),
});

// ==========================================
// PASSWORD LOGIN & OTP SCHEMAS (Vizconde)
// ==========================================

export const passwordLoginSchema = z.object({
    body: z.object({
        qcuIdNumber: z.string().trim().min(1, "QCU ID is required"),
        password: z.string().min(8, "Password is required"),
    }),
});

export const verifyPasswordOtpSchema = z.object({
    body: z.object({
        qcuIdNumber: z.string().trim().min(1, "QCU ID is required"),
        otp: z.string().trim().regex(/^\d{6}$/, "OTP must contain exactly 6 digits"),
    }),
});

export const loginUserSchema = z.object({
    body: z.object({
        qcuIdNumber: z.string().trim().min(1, "QCU ID is required"),
        password: z.string().optional(),
    }),
});

// ==========================================
// WEBAUTHN / PASSKEY SCHEMAS
// ==========================================

export const webauthnRegisterOptionsSchema = z.object({
    body: z.object({
        userId: z.string().uuid("Invalid user ID").optional(),
    }).optional(),
});

export const webauthnRegisterVerifySchema = z.object({
    body: z.object({
        userId: z.string().uuid("Invalid user ID").optional(),
        response: z.record(z.string(), z.any()),
        deviceName: z.string().trim().max(100).optional(),
    }),
});

export const webauthnLoginOptionsSchema = z.object({
    body: z.object({
        qcuIdNumber: z.string().trim().min(1, "QCU ID is required"),
    }),
});

export const webauthnLoginVerifySchema = z.object({
    body: z.object({
        qcuIdNumber: z.string().trim().min(1, "QCU ID is required"),
        response: z.record(z.string(), z.any()),
    }),
});

export const deletePasskeySchema = z.object({
    params: z.object({
        id: z.string().min(1, "Passkey ID is required"),
    }),
});

export const changePasswordSchema = z.object({
    body: z.object({
        currentPassword: z.string().min(1, "Current password is required"),
        newPassword: z.string().min(8, "New password must be at least 8 characters"),
    }),
});

export const updateEmailSchema = z.object({
    body: z.object({
        email: z.string().trim().email("Invalid email address").transform((v) => v.toLowerCase()),
    }),
});
