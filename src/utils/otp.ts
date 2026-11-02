
import {
    createHmac,
    randomInt,
    timingSafeEqual,
} from "node:crypto";

import { env } from "../config/env";

// OTP configuration
export const OTP_EXPIRY_MINUTES = 5;

/**
 * Generates a cryptographically random six-digit OTP.
 */
export const generateOtp = (): string => {
    return randomInt(0, 1_000_000)
        .toString()
        .padStart(6, "0");
};

/**
 * Creates a keyed hash of the OTP.
 * The raw OTP is never stored in the database.
 */
export const hashOtp = (
    userId: string,
    otp: string
): string => {
    return createHmac("sha256", env.JWT_SECRET)
        .update(`bizzyqcu-login-otp:${userId}:${otp}`)
        .digest("hex");
};

/**
 * Checks whether the submitted OTP matches
 * the stored hash.
 */
export const verifyOtp = (
    userId: string,
    otp: string,
    storedHash: string
): boolean => {
    if (!/^\d{6}$/.test(otp)) {
        return false;
    }

    const expectedHash = Buffer.from(
        hashOtp(userId, otp),
        "hex"
    );

    let actualHash: Buffer;

    try {
        actualHash = Buffer.from(storedHash, "hex");
    } catch {
        return false;
    }

    if (
        actualHash.length !== expectedHash.length ||
        actualHash.length === 0
    ) {
        return false;
    }

    return timingSafeEqual(expectedHash, actualHash);
};
