
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
        qcuIdNumber: z.string(),
        password: z.string().optional(),
    }),
});
