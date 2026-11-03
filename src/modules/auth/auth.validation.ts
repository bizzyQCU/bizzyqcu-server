import { z } from "zod";

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
    }),
});

// Password login validation
export const passwordLoginSchema = z.object({
    body: z.object({
        qcuIdNumber: z.string().min(1, "QCU ID is required"),
        password: z.string().min(8, "Password is required"),
    }),
});

// OTP verification validation
export const verifyPasswordOtpSchema = z.object({
    body: z.object({
        qcuIdNumber: z.string().min(1, "QCU ID is required"),
        otp: z.string().regex(/^\d{6}$/, "OTP must contain exactly 6 digits"),
    }),
});

// Existing login schema, retained for compatibility
export const loginUserSchema = z.object({
    body: z.object({
        qcuIdNumber: z.string().min(1, "QCU ID is required"),
        password: z.string().optional(),
    }),
});

// ==========================================
// WEBAUTHN VALIDATION SCHEMAS
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
