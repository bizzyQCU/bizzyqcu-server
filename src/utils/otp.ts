
import {
    createHmac,
    randomInt,
    randomUUID,
    timingSafeEqual,
} from "node:crypto";

import { env } from "../config/env";

// OTP configuration
export const OTP_EXPIRY_MINUTES = 5;
export const REG_EMAIL_TOKEN_EXPIRY_MINUTES = 15;

const MAX_REG_OTP_ATTEMPTS = 5;
const REG_OTP_DOMAIN = "bizzyqcu-reg-otp:";
const REG_VERIFIED_DOMAIN = "bizzyqcu-reg-verified:";

interface RegistrationOtpPayload {
    kind: "reg_otp";
    nonce: string;
    email: string;
    otpHash: string;
    exp: number;
}

interface RegistrationEmailVerifiedPayload {
    kind: "reg_email_verified";
    nonce: string;
    email: string;
    exp: number;
}

// Track single-use nonces and failed attempts until expiry to prevent replay & brute force
const consumedRegOtpNonces = new Map<string, number>();
const failedRegOtpAttempts = new Map<string, { count: number; exp: number }>();
const consumedRegEmailTokenNonces = new Map<string, number>();

function pruneExpiredEntries<T>(
    map: Map<string, T>,
    getExp: (value: T) => number,
    now: number
): void {
    for (const [key, value] of map.entries()) {
        if (getExp(value) <= now) {
            map.delete(key);
        }
    }
}

function signChallengePayload(domain: string, payload: object): string {
    const payloadB64 = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
    const sigB64 = createHmac("sha256", env.JWT_SECRET)
        .update(`${domain}${payloadB64}`)
        .digest("base64url");
    return `${payloadB64}.${sigB64}`;
}

function verifySignedChallengePayload<T>(domain: string, token: string): T | null {
    const parts = token.split(".");
    if (parts.length !== 2 || !parts[0] || !parts[1]) {
        return null;
    }

    const [payloadB64, providedSigB64] = parts;
    const expectedSigB64 = createHmac("sha256", env.JWT_SECRET)
        .update(`${domain}${payloadB64}`)
        .digest("base64url");

    const expectedBuf = Buffer.from(expectedSigB64, "utf8");
    const providedBuf = Buffer.from(providedSigB64, "utf8");
    if (providedBuf.length !== expectedBuf.length || !timingSafeEqual(expectedBuf, providedBuf)) {
        return null;
    }

    try {
        return JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf8")) as T;
    } catch {
        return null;
    }
}

function hashRegistrationOtp(nonce: string, normalizedEmail: string, otp: string): string {
    return createHmac("sha256", env.JWT_SECRET)
        .update(`${REG_OTP_DOMAIN}${nonce}:${normalizedEmail}:${otp}`)
        .digest("hex");
}

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

function timingSafeHexEqual(expectedHex: string, actualHex: string): boolean {
    const expectedBuf = Buffer.from(expectedHex, "hex");
    let actualBuf: Buffer;

    try {
        actualBuf = Buffer.from(actualHex, "hex");
    } catch {
        return false;
    }

    if (actualBuf.length !== expectedBuf.length || actualBuf.length === 0) {
        return false;
    }

    return timingSafeEqual(expectedBuf, actualBuf);
}

/**
 * Checks whether the submitted login OTP matches
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

    return timingSafeHexEqual(hashOtp(userId, otp), storedHash);
};

/**
 * Creates a stateless, HMAC-signed 6-digit OTP challenge for pre-registration email verification.
 */
export function createRegistrationOtpChallenge(email: string): {
    otp: string;
    otpToken: string;
    expiresInSeconds: number;
} {
    const normalizedEmail = email.trim().toLowerCase();
    const otp = generateOtp();
    const nonce = randomUUID();
    const exp = Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000;

    const payload: RegistrationOtpPayload = {
        kind: "reg_otp",
        nonce,
        email: normalizedEmail,
        otpHash: hashRegistrationOtp(nonce, normalizedEmail, otp),
        exp,
    };

    return {
        otp,
        otpToken: signChallengePayload(REG_OTP_DOMAIN, payload),
        expiresInSeconds: OTP_EXPIRY_MINUTES * 60,
    };
}

export type VerifyRegistrationOtpResult =
    | { ok: true; emailVerificationToken: string; expiresInSeconds: number }
    | { ok: false; reason: "invalid" | "expired" | "too_many_attempts" };

/**
 * Verifies a registration OTP challenge, enforces 5-attempt lockout + single-use nonce consumption,
 * and mints a short-lived emailVerificationToken bound to the verified email.
 */
export function verifyRegistrationOtpChallenge(params: {
    email: string;
    otp: string;
    otpToken: string;
}): VerifyRegistrationOtpResult {
    const now = Date.now();
    pruneExpiredEntries(consumedRegOtpNonces, (exp) => exp, now);
    pruneExpiredEntries(failedRegOtpAttempts, (entry) => entry.exp, now);

    const payload = verifySignedChallengePayload<RegistrationOtpPayload>(
        REG_OTP_DOMAIN,
        params.otpToken
    );

    if (
        !payload ||
        payload.kind !== "reg_otp" ||
        typeof payload.nonce !== "string" ||
        typeof payload.email !== "string" ||
        typeof payload.otpHash !== "string" ||
        typeof payload.exp !== "number"
    ) {
        return { ok: false, reason: "invalid" };
    }

    const normalizedEmail = params.email.trim().toLowerCase();
    if (payload.email !== normalizedEmail) {
        return { ok: false, reason: "invalid" };
    }

    if (payload.exp <= now) {
        return { ok: false, reason: "expired" };
    }

    if (consumedRegOtpNonces.has(payload.nonce)) {
        return { ok: false, reason: "invalid" };
    }

    const attempts = failedRegOtpAttempts.get(payload.nonce);
    if (attempts && attempts.count >= MAX_REG_OTP_ATTEMPTS) {
        return { ok: false, reason: "too_many_attempts" };
    }

    const candidateHash = /^\d{6}$/.test(params.otp)
        ? hashRegistrationOtp(payload.nonce, normalizedEmail, params.otp)
        : "";

    if (!candidateHash || !timingSafeHexEqual(candidateHash, payload.otpHash)) {
        const nextCount = (attempts?.count ?? 0) + 1;
        failedRegOtpAttempts.set(payload.nonce, {
            count: nextCount,
            exp: payload.exp,
        });
        if (nextCount >= MAX_REG_OTP_ATTEMPTS) {
            consumedRegOtpNonces.set(payload.nonce, payload.exp);
            return { ok: false, reason: "too_many_attempts" };
        }
        return { ok: false, reason: "invalid" };
    }

    consumedRegOtpNonces.set(payload.nonce, payload.exp);
    failedRegOtpAttempts.delete(payload.nonce);

    const verifiedPayload: RegistrationEmailVerifiedPayload = {
        kind: "reg_email_verified",
        nonce: randomUUID(),
        email: normalizedEmail,
        exp: now + REG_EMAIL_TOKEN_EXPIRY_MINUTES * 60 * 1000,
    };

    return {
        ok: true,
        emailVerificationToken: signChallengePayload(REG_VERIFIED_DOMAIN, verifiedPayload),
        expiresInSeconds: REG_EMAIL_TOKEN_EXPIRY_MINUTES * 60,
    };
}

/**
 * Atomically claims a registration email verification token before user creation.
 * Call `release()` in catch blocks if registration fails before DB persistence so valid retries succeed.
 */
export function claimRegistrationEmailToken(
    email: string,
    emailVerificationToken: string
): { release: () => void } | null {
    const now = Date.now();
    pruneExpiredEntries(consumedRegEmailTokenNonces, (exp) => exp, now);

    const payload = verifySignedChallengePayload<RegistrationEmailVerifiedPayload>(
        REG_VERIFIED_DOMAIN,
        emailVerificationToken
    );

    if (
        !payload ||
        payload.kind !== "reg_email_verified" ||
        typeof payload.nonce !== "string" ||
        typeof payload.email !== "string" ||
        typeof payload.exp !== "number"
    ) {
        return null;
    }

    if (payload.email !== email.trim().toLowerCase() || payload.exp <= now) {
        return null;
    }

    if (consumedRegEmailTokenNonces.has(payload.nonce)) {
        return null;
    }

    consumedRegEmailTokenNonces.set(payload.nonce, payload.exp);
    return {
        release: () => {
            consumedRegEmailTokenNonces.delete(payload.nonce);
        },
    };
}
