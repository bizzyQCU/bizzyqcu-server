
import {
    generateRegistrationOptions,
    verifyRegistrationResponse,
    generateAuthenticationOptions,
    verifyAuthenticationResponse,
    type RegistrationResponseJSON,
    type AuthenticationResponseJSON,
} from "@simplewebauthn/server";

import { prisma } from "../../config/db";
import { AppError } from "../../utils/AppError";
import { generateAccessToken } from "../../utils/jwt";
import { webAuthnConfig } from "../../config/webauthn";

// ==========================================
// CHALLENGE CONFIGURATION
// ==========================================

// A WebAuthn challenge expires after five minutes.
const CHALLENGE_TTL_MS = 5 * 60 * 1000;

// The database field stores the challenge and its expiration.
// This avoids needing another database field or migration.
interface StoredChallenge {
    challenge: string;
    expiresAt: number;
}

const storeChallenge = async (
    userId: string,
    challenge: string
): Promise<void> => {
    const stored: StoredChallenge = {
        challenge,
        expiresAt: Date.now() + CHALLENGE_TTL_MS,
    };

    await prisma.user.update({
        where: { id: userId },
        data: {
            currentChallenge: JSON.stringify(stored),
        },
    });
};

const readChallenge = (
    storedValue: string | null
): string | null => {
    if (!storedValue) {
        return null;
    }

    try {
        const stored = JSON.parse(storedValue) as StoredChallenge;

        if (
            typeof stored.challenge !== "string" ||
            typeof stored.expiresAt !== "number" ||
            stored.expiresAt <= Date.now()
        ) {
            return null;
        }

        return stored.challenge;
    } catch {
        return null;
    }
};

// ==========================================
// WEBAUTHN SERVICE
// ==========================================

export class WebAuthnService {

    // ========================================
    // 1. GENERATE REGISTRATION OPTIONS
    // ========================================

    static async generateRegistrationOptions(
        userId: string
    ) {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                qcuIdNumber: true,
                fullName: true,
                passkeys: {
                    select: {
                        id: true,
                        transports: true,
                    },
                },
            },
        });

        if (!user) {
            throw new AppError("User account not found.", 404);
        }

        const options = await generateRegistrationOptions({
            rpName: webAuthnConfig.rpName,
            rpID: webAuthnConfig.rpID,

            userID: new TextEncoder().encode(user.id),
            userName: user.qcuIdNumber,
            userDisplayName: user.fullName,

            attestationType: "none",

            excludeCredentials: user.passkeys.map((passkey) => ({
                id: passkey.id,
                transports: passkey.transports,
            })),

            authenticatorSelection: {
                residentKey: "preferred",
                userVerification: "required",
            },

            timeout: 60_000,
        });

        await storeChallenge(user.id, options.challenge);

        return options;
    }

    // ========================================
    // 2. VERIFY REGISTRATION RESPONSE
    // ========================================

    static async verifyRegistration(
        userId: string,
        response: RegistrationResponseJSON,
        deviceName?: string
    ) {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                currentChallenge: true,
            },
        });

        if (!user) {
            throw new AppError("User account not found.", 404);
        }

        const expectedChallenge = readChallenge(
            user.currentChallenge
        );

        if (!expectedChallenge) {
            throw new AppError(
                "Registration challenge is missing or expired. Please try again.",
                400
            );
        }

        let verification;

        try {
            verification = await verifyRegistrationResponse({
                response,
                expectedChallenge,
                expectedOrigin: webAuthnConfig.origin,
                expectedRPID: webAuthnConfig.rpID,
                requireUserVerification: true,
            });
        } catch {
            throw new AppError(
                "Passkey registration verification failed.",
                400
            );
        }

        if (
            !verification.verified ||
            !verification.registrationInfo
        ) {
            throw new AppError(
                "Passkey registration was not verified.",
                400
            );
        }

        const {
            credential,
            credentialDeviceType,
            credentialBackedUp,
        } = verification.registrationInfo;

        const transports =
            response.response.transports ??
            credential.transports ??
            [];

        // Consume the challenge and save the credential
        // in one transaction.
        const savedPasskey = await prisma.$transaction(
            async (tx) => {
                const consumed = await tx.user.updateMany({
                    where: {
                        id: user.id,
                        currentChallenge: user.currentChallenge,
                    },
                    data: {
                        currentChallenge: null,
                    },
                });

                if (consumed.count !== 1) {
                    throw new AppError(
                        "Registration challenge has already been used.",
                        400
                    );
                }

                return tx.passkeyCredential.create({
                    data: {
                        id: credential.id,
                        userId: user.id,
                        publicKey: Buffer.from(credential.publicKey),
                        counter: BigInt(credential.counter),
                        deviceType: credentialDeviceType,
                        backedUp: credentialBackedUp,
                        transports,
                        deviceName: deviceName?.trim() || null,
                    },
                    select: {
                        id: true,
                        deviceName: true,
                        deviceType: true,
                        createdAt: true,
                    },
                });
            }
        );

        return {
            verified: true,
            message: "Passkey registered successfully.",
            passkey: savedPasskey,
        };
    }

    // ========================================
    // 3. GENERATE AUTHENTICATION OPTIONS
    // ========================================

    static async generateAuthenticationOptions(
        qcuIdNumber: string
    ) {
        const user = await prisma.user.findUnique({
            where: { qcuIdNumber },
            select: {
                id: true,
                passkeys: {
                    select: {
                        id: true,
                        transports: true,
                    },
                },
            },
        });

        if (!user || user.passkeys.length === 0) {
            throw new AppError(
                "No registered passkey found for this account.",
                404
            );
        }

        const options = await generateAuthenticationOptions({
            rpID: webAuthnConfig.rpID,

            allowCredentials: user.passkeys.map((passkey) => ({
                id: passkey.id,
                transports: passkey.transports,
            })),

            userVerification: "required",
            timeout: 60_000,
        });

        await storeChallenge(user.id, options.challenge);

        return options;
    }

    // ========================================
    // 4. VERIFY AUTHENTICATION RESPONSE
    // ========================================

    static async verifyAuthentication(
        qcuIdNumber: string,
        response: AuthenticationResponseJSON
    ) {
        const user = await prisma.user.findUnique({
            where: { qcuIdNumber },
            include: {
                passkeys: true,
            },
        });

        if (!user) {
            throw new AppError(
                "Invalid passkey authentication.",
                401
            );
        }

        const expectedChallenge = readChallenge(
            user.currentChallenge
        );

        if (!expectedChallenge) {
            throw new AppError(
                "Authentication challenge is missing or expired. Please try again.",
                401
            );
        }

        // Find the credential submitted by the browser.
        const passkey = user.passkeys.find(
            (item) => item.id === response.id
        );

        if (!passkey) {
            throw new AppError(
                "Invalid passkey authentication.",
                401
            );
        }

        let verification;

        try {
            verification = await verifyAuthenticationResponse({
                response,
                expectedChallenge,
                expectedOrigin: webAuthnConfig.origin,
                expectedRPID: webAuthnConfig.rpID,

                credential: {
                    id: passkey.id,
                    publicKey: Uint8Array.from(passkey.publicKey),
                    counter: Number(passkey.counter),
                    transports: passkey.transports,
                },

                requireUserVerification: true,
            });
        } catch {
            throw new AppError(
                "Passkey authentication verification failed.",
                401
            );
        }

        if (
            !verification.verified ||
            !verification.authenticationInfo
        ) {
            throw new AppError(
                "Passkey authentication was not verified.",
                401
            );
        }

        const { newCounter } = verification.authenticationInfo;

        // Consume the challenge and update the credential counter
        // atomically to prevent challenge reuse.
        await prisma.$transaction(async (tx) => {
            const consumed = await tx.user.updateMany({
                where: {
                    id: user.id,
                    currentChallenge: user.currentChallenge,
                },
                data: {
                    currentChallenge: null,
                },
            });

            if (consumed.count !== 1) {
                throw new AppError(
                    "Authentication challenge has already been used.",
                    401
                );
            }

            const updated = await tx.passkeyCredential.updateMany({
                where: {
                    id: passkey.id,
                    userId: user.id,
                    counter: passkey.counter,
                },
                data: {
                    counter: BigInt(newCounter),
                    lastUsedAt: new Date(),
                },
            });

            if (updated.count !== 1) {
                throw new AppError(
                    "Passkey credential could not be updated.",
                    401
                );
            }
        });

        // Issue JWT only after successful passkey verification.
        const accessToken = generateAccessToken(user.id);

        return {
            accessToken,
            tokenType: "Bearer",
            expiresIn: 3600,
            user: {
                id: user.id,
                qcuIdNumber: user.qcuIdNumber,
                email: user.email,
                role: user.role,
                verificationStatus: user.verificationStatus,
            },
        };
    }
}
