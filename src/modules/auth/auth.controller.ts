import { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { AuthService } from "./auth.service";
import { WebAuthnService } from "./webauthn.service";
import { AppError } from "../../utils/AppError";
import { VerificationUploadService } from "./verification-upload.service";

function resolveWebAuthnRegistrationTarget(req: Request): {
    userId: string;
    isAuthenticated: boolean;
} {
    if (req.user) {
        if (req.body?.userId && req.body.userId !== req.user.id) {
            throw new AppError(
                "You can only register passkeys for your own account.",
                403
            );
        }
        return { userId: req.user.id, isAuthenticated: true };
    }

    if (!req.body?.userId) {
        throw new AppError("User ID is required for passkey registration.", 400);
    }

    return { userId: req.body.userId, isAuthenticated: false };
}

export class AuthController {
    // ==========================================
    // 1. REGISTRATION & SELLER APPLICATIONS (Manuel & Vizconde)
    // ==========================================

    static uploadVerificationDocument = asyncHandler(async (req: Request, res: Response) => {
        if (!req.file) {
            throw new AppError("Choose a file to upload.", 400);
        }

        const data = await VerificationUploadService.upload(
            req.file,
            req.body.documentType
        );

        res.status(201).json({ success: true, data });
    });

    static requestRegistrationOtp = asyncHandler(
        async (req: Request, res: Response) => {
            const result = await AuthService.requestRegistrationOtp(req.body);

            res.status(200).json({
                success: true,
                message: result.message,
                data: {
                    otpToken: result.otpToken,
                    expiresInSeconds: result.expiresInSeconds,
                },
            });
        }
    );

    static verifyRegistrationOtp = asyncHandler(
        async (req: Request, res: Response) => {
            const result = await AuthService.verifyRegistrationOtp(req.body);

            res.status(200).json({
                success: true,
                message: result.message,
                data: {
                    emailVerificationToken: result.emailVerificationToken,
                    expiresInSeconds: result.expiresInSeconds,
                },
            });
        }
    );

    static register = asyncHandler(async (req: Request, res: Response) => {
        const user = await AuthService.register(req.body);

        res.status(201).json({
            success: true,
            message: "Registration submitted. Pending administrator verification.",
            data: user,
        });
    });

    static applyForSeller = asyncHandler(async (req: Request, res: Response) => {
        const sellerProfile = await AuthService.applyForSeller(
            req.user!.id,
            req.body
        );

        res.status(201).json({
            success: true,
            message: "Seller endorsement application submitted. Pending administrator verification.",
            data: sellerProfile,
        });
    });

    // ==========================================
    // 2. ACCOUNT STATUS TRACKING CRUD (Manuel)
    // ==========================================

    static getAccountStatus = asyncHandler(async (req: Request, res: Response) => {
        const status = await AuthService.getAccountStatus(req.user!.id);

        res.status(200).json({
            success: true,
            data: status,
        });
    });

    static resubmitUserVerification = asyncHandler(async (req: Request, res: Response) => {
        const updated = await AuthService.resubmitUserVerification(
            req.user!.id,
            req.body
        );

        res.status(200).json({
            success: true,
            message: "Verification documents resubmitted. Your account is now pending review.",
            data: updated,
        });
    });

    static resubmitSellerVerification = asyncHandler(async (req: Request, res: Response) => {
        const updated = await AuthService.resubmitSellerVerification(
            req.user!.id,
            req.body
        );

        res.status(200).json({
            success: true,
            message: "Seller endorsement document resubmitted. Pending administrator verification.",
            data: updated,
        });
    });

    // ==========================================
    // 3. REGISTERED DEVICE MANAGEMENT CRUD (Manuel)
    // ==========================================

    static listDevices = asyncHandler(async (req: Request, res: Response) => {
        const devices = await WebAuthnService.listPasskeys(req.user!.id);

        res.status(200).json({
            success: true,
            data: devices,
        });
    });

    static getDevice = asyncHandler(async (req: Request, res: Response) => {
        const deviceId = Array.isArray(req.params.id)
            ? req.params.id[0]
            : req.params.id;

        const device = await WebAuthnService.getPasskey(req.user!.id, deviceId);

        res.status(200).json({
            success: true,
            data: device,
        });
    });

    static updateDevice = asyncHandler(async (req: Request, res: Response) => {
        const deviceId = Array.isArray(req.params.id)
            ? req.params.id[0]
            : req.params.id;

        const device = await WebAuthnService.updatePasskeyDeviceName(
            req.user!.id,
            deviceId,
            req.body.deviceName
        );

        res.status(200).json({
            success: true,
            message: "Registered device updated successfully.",
            data: device,
        });
    });

    static deleteDevice = asyncHandler(async (req: Request, res: Response) => {
        const deviceId = Array.isArray(req.params.id)
            ? req.params.id[0]
            : req.params.id;

        const result = await WebAuthnService.deletePasskey(
            req.user!.id,
            deviceId
        );

        res.status(200).json({
            success: true,
            message: result.message,
        });
    });

    // ==========================================
    // 4. PASSWORD + OTP FALLBACK (Vizconde)
    // ==========================================

    static requestPasswordOtp = asyncHandler(
        async (req: Request, res: Response) => {
            const result = await AuthService.requestPasswordOtp(req.body);

            res.status(200).json({
                success: true,
                message: result.message,
            });
        }
    );

    static verifyPasswordOtp = asyncHandler(
        async (req: Request, res: Response) => {
            const result = await AuthService.verifyPasswordOtp(req.body);

            res.status(200).json({
                success: true,
                message: "Login successful.",
                data: result,
            });
        }
    );

    // ==========================================
    // 5. GET PROFILE
    // ==========================================

    static getProfile = asyncHandler(async (req: Request, res: Response) => {
        const user = await AuthService.getProfile(req.user!.id);

        res.status(200).json({
            success: true,
            data: user,
        });
    });

    // ==========================================
    // 6. WEBAUTHN / PASSKEY REGISTRATION
    // ==========================================

    static generateRegistrationOptions = asyncHandler(
        async (req: Request, res: Response) => {
            const { userId, isAuthenticated } =
                resolveWebAuthnRegistrationTarget(req);

            const options = await WebAuthnService.generateRegistrationOptions(
                userId,
                { isAuthenticated }
            );

            res.status(200).json({
                success: true,
                data: options,
            });
        }
    );

    static verifyRegistration = asyncHandler(
        async (req: Request, res: Response) => {
            const { userId, isAuthenticated } =
                resolveWebAuthnRegistrationTarget(req);

            const result = await WebAuthnService.verifyRegistration(
                userId,
                req.body.response,
                req.body.deviceName,
                { isAuthenticated }
            );

            res.status(200).json({
                success: true,
                message: result.message,
                data: result.passkey,
            });
        }
    );

    // ==========================================
    // WEBAUTHN / PASSKEY AUTHENTICATION (LOGIN)
    // ==========================================

    static generateAuthenticationOptions = asyncHandler(
        async (req: Request, res: Response) => {
            const options = await WebAuthnService.generateAuthenticationOptions(
                req.body.qcuIdNumber
            );

            res.status(200).json({
                success: true,
                data: options,
            });
        }
    );

    static verifyAuthentication = asyncHandler(
        async (req: Request, res: Response) => {
            const result = await WebAuthnService.verifyAuthentication(
                req.body.qcuIdNumber,
                req.body.response
            );

            res.status(200).json({
                success: true,
                message: "Passkey authentication successful.",
                data: result,
            });
        }
    );

    // ==========================================
    // PASSKEY CREDENTIAL MANAGEMENT
    // ==========================================

    static listPasskeys = asyncHandler(async (req: Request, res: Response) => {
        const passkeys = await WebAuthnService.listPasskeys(req.user!.id);

        res.status(200).json({
            success: true,
            data: passkeys,
        });
    });

    static deletePasskey = asyncHandler(async (req: Request, res: Response) => {
        const passkeyId = Array.isArray(req.params.id)
            ? req.params.id[0]
            : req.params.id;

        const result = await WebAuthnService.deletePasskey(
            req.user!.id,
            passkeyId
        );

        res.status(200).json({
            success: true,
            message: result.message,
        });
    });

    // ==========================================
    // CHANGE PASSWORD
    // ==========================================

    static changePassword = asyncHandler(async (req: Request, res: Response) => {
        const result = await AuthService.changePassword(
            req.user!.id,
            req.body
        );

        res.status(200).json({
            success: true,
            message: result.message,
        });
    });

    // ==========================================
    // UPDATE EMAIL
    // ==========================================

    static updateEmail = asyncHandler(async (req: Request, res: Response) => {
        const result = await AuthService.updateEmail(
            req.user!.id,
            req.body.email
        );

        res.status(200).json({
            success: true,
            message: "Email updated successfully.",
            data: result,
        });
    });
}
