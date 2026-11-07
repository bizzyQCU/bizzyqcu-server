import { z } from "zod";

// ==========================================
// REGISTRATION SCHEMAS (Manuel & Vizconde)
// ==========================================

export const registerUserSchema = z.object({
    body: z.object({
        qcuIdNumber: z.string().regex(
            /^\d{2}-\d{4}$/,
            "QCU ID format must be YY-NNNN (e.g., 24-0001)"
        ),
        email: z.string().email("Invalid email address"),
        fullName: z.string().min(2, "Full name must be at least 2 characters"),
        memberType: z.enum(["STUDENT", "FACULTY", "STAFF"]),
        qcuIdPhotoUrl: z.string().url("Valid QCU ID photo URL required"),
        liveSelfieUrl: z.string().url("Valid live selfie photo URL required"),
        password: z.string().min(8, "Password must be at least 8 characters").optional(),
        role: z.enum(["BUYER", "SELLER"]).optional().default("BUYER"),
        sellerType: z.enum(["STUDENT_ENTERPRISE", "RECOGNIZED_ORGANIZATION", "INDEPENDENT_SELLER"]).optional(),
        supportingDocumentUrl: z.string().url("Valid supporting document URL required").optional(),
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

// Dedicated Seller Registration / Application Schema
export const registerSellerSchema = z.object({
    body: z.object({
        sellerType: z.enum(["STUDENT_ENTERPRISE", "RECOGNIZED_ORGANIZATION", "INDEPENDENT_SELLER"]),
        supportingDocumentUrl: z.string().url("Valid supporting document URL required (e.g., OJT endorsement, org recognition, or enrollment proof)"),
    }),
});

// Resubmit User Verification (ID / Selfie)
export const resubmitUserVerificationSchema = z.object({
    body: z.object({
        qcuIdPhotoUrl: z.string().url("Valid QCU ID photo URL required").optional(),
        liveSelfieUrl: z.string().url("Valid live selfie photo URL required").optional(),
    }).refine(
        (data) => Boolean(data.qcuIdPhotoUrl || data.liveSelfieUrl),
        { message: "At least one verification document (QCU ID photo or live selfie) must be provided." }
    ),
});

// Resubmit Seller Verification (Endorsement Doc)
export const resubmitSellerVerificationSchema = z.object({
    body: z.object({
        sellerType: z.enum(["STUDENT_ENTERPRISE", "RECOGNIZED_ORGANIZATION", "INDEPENDENT_SELLER"]).optional(),
        supportingDocumentUrl: z.string().url("Valid supporting document URL required"),
    }),
});

// Public Check Account Status Schema
export const checkAccountStatusSchema = z.object({
    body: z.object({
        identifier: z.string().trim().min(1, "QCU ID or email is required"),
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
        deviceName: z.string().trim().min(1, "Device name cannot be empty").max(100, "Device name cannot exceed 100 characters"),
    }),
});

// ==========================================
// ADMIN ACCOUNT STATUS MANAGEMENT SCHEMAS
// ==========================================

export const adminUpdateUserStatusSchema = z.object({
    params: z.object({
        id: z.string().uuid("Invalid user ID"),
    }),
    body: z.object({
        status: z.enum(["VERIFIED", "REJECTED"]),
        rejectionReason: z.string().trim().optional(),
    }).superRefine((data, ctx) => {
        if (data.status === "REJECTED" && (!data.rejectionReason || data.rejectionReason.length < 3)) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: "A rejection reason of at least 3 characters is required when rejecting an account.",
                path: ["rejectionReason"],
            });
        }
    }),
});

export const adminListUsersStatusQuerySchema = z.object({
    query: z.object({
        status: z.enum(["PENDING", "VERIFIED", "REJECTED"]).optional(),
        role: z.enum(["BUYER", "SELLER", "ADMIN"]).optional(),
        memberType: z.enum(["STUDENT", "FACULTY", "STAFF"]).optional(),
        page: z.coerce.number().int().positive().optional(),
        limit: z.coerce.number().int().positive().max(100).optional(),
    }).optional(),
});

// ==========================================
// PASSWORD LOGIN & OTP SCHEMAS (Vizconde)
// ==========================================

export const passwordLoginSchema = z.object({
    body: z.object({
        qcuIdNumber: z.string().min(1, "QCU ID is required"),
        password: z.string().min(8, "Password is required"),
    }),
});

export const verifyPasswordOtpSchema = z.object({
    body: z.object({
        qcuIdNumber: z.string().min(1, "QCU ID is required"),
        otp: z.string().regex(/^\d{6}$/, "OTP must contain exactly 6 digits"),
    }),
});

export const loginUserSchema = z.object({
    body: z.object({
        qcuIdNumber: z.string().min(1, "QCU ID is required"),
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
        deviceName: z.string().max(100).optional(),
    }),
});

export const webauthnLoginOptionsSchema = z.object({
    body: z.object({
        qcuIdNumber: z.string().min(1, "QCU ID is required"),
    }),
});

export const webauthnLoginVerifySchema = z.object({
    body: z.object({
        qcuIdNumber: z.string().min(1, "QCU ID is required"),
        response: z.record(z.string(), z.any()),
    }),
});

export const deletePasskeySchema = z.object({
    params: z.object({
        id: z.string().min(1, "Passkey ID is required"),
    }),
});
