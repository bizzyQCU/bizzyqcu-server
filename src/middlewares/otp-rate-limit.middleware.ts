
import { rateLimit, type Options } from "express-rate-limit";
import { isDevTestAccountDirectLoginEnabled } from "../config/test-accounts";

const FIFTEEN_MINUTES_MS = 15 * 60 * 1000;

function createAuthLimiter(
    limit: number,
    message: string,
    skip?: Options["skip"]
) {
    return rateLimit({
        windowMs: FIFTEEN_MINUTES_MS,
        limit,
        skip,
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
    "Too many OTP requests. Please try again later.",
    (req) => isDevTestAccountDirectLoginEnabled(String(req.body?.qcuIdNumber ?? ""))
);

export const verifyOtpLimiter = createAuthLimiter(
    5,
    "Too many OTP attempts. Please try again later."
);

export const verificationUploadLimiter = createAuthLimiter(
    20,
    "Too many verification uploads. Please try again later."
);

export const webauthnLimiter = createAuthLimiter(
    30,
    "Too many passkey requests. Please try again later."
);
