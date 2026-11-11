
import { rateLimit } from "express-rate-limit";

const FIFTEEN_MINUTES_MS = 15 * 60 * 1000;

function createAuthLimiter(limit: number, message: string) {
    return rateLimit({
        windowMs: FIFTEEN_MINUTES_MS,
        limit,
        standardHeaders: true,
        legacyHeaders: false,
        message: {
            success: false,
            message,
        },
    });
}

export const requestOtpLimiter = createAuthLimiter(
    5,
    "Too many OTP requests. Please try again later."
);

export const verifyOtpLimiter = createAuthLimiter(
    5,
    "Too many OTP attempts. Please try again later."
);

export const verificationUploadLimiter = createAuthLimiter(
    20,
    "Too many verification uploads. Please try again later."
);

export const statusLookupLimiter = createAuthLimiter(
    15,
    "Too many status check requests. Please try again later."
);

export const webauthnLimiter = createAuthLimiter(
    30,
    "Too many passkey requests. Please try again later."
);
