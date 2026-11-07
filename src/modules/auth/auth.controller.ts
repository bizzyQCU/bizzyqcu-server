import { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { AuthService } from "./auth.service";
import { WebAuthnService } from "./webauthn.service";
import { AppError } from "../../utils/AppError";
import { VerificationUploadService } from "./verification-upload.service";

export class AuthController {
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

    // ==========================================
    // 1. REGISTRATION (Manuel & Vizconde)
    // ==========================================

    static register = asyncHandler(async (req: Request, res: Response) => {
        const user = await AuthService.register(req.body);

        res.status(201).json({
            success: true,
            message: "Registration submitted. Pending administrator verification.",
            data: user,
        });
    });

    // Dedicated seller endorsement application
    static applyForSeller = asyncHandler(async (req: Request, res: Response) => {
        const sellerProfile = await AuthService.applyForSeller(
            req.user!.id,
            req.body
        );

        res.status(201).json({
            success: true,
            message: "Seller endorsement documents submitted for administrator review.",
            data: sellerProfile,
        });
    });

    // ==========================================
    // 2. ACCOUNT STATUS TRACKING CRUD (Manuel)
    // ==========================================

    // Authenticated user checks account and seller status
    static getAccountStatus = asyncHandler(async (req: Request, res: Response) => {
        const status = await AuthService.getAccountStatus(req.user!.id);

        res.status(200).json({
            success: true,
            data: status,
        });
    });

    // Pre-login public check of registration status (RA 10173 compliant)
    static checkPublicAccountStatus = asyncHandler(
        async (req: Request, res: Response) => {
            const status = await AuthService.checkPublicAccountStatus(
                req.body.identifier
            );

            res.status(200).json({
                success: true,
                data: status,
            });
        }
    );

    // Resubmit rejected user verification documents
    static resubmitUserVerification = asyncHandler(
        async (req: Request, res: Response) => {
            const updated = await AuthService.resubmitUserVerification(
                req.user!.id,
                req.body
            );

            res.status(200).json({
                success: true,
                message: "Verification documents resubmitted and awaiting administrator review.",
                data: updated,
            });
        }
    );

    // Resubmit rejected seller endorsement documents
    static resubmitSellerVerification = asyncHandler(
        async (req: Request, res: Response) => {
            const updated = await AuthService.resubmitSellerVerification(
                req.user!.id,
                req.body
            );

            res.status(200).json({
                success: true,
                message: "Seller endorsement documents resubmitted and awaiting administrator review.",
                data: updated,
            });
        }
    );

    // Admin: List users by verification status
    static adminListUsersStatus = asyncHandler(
        async (req: Request, res: Response) => {
            const result = await AuthService.adminListUsersStatus(
                req.query as any
            );

            res.status(200).json({
                success: true,
                ...result,
            });
        }
    );

    // Admin: Update user verification status
    static adminUpdateUserStatus = asyncHandler(
        async (req: Request, res: Response) => {
            const updated = await AuthService.adminUpdateUserStatus(
                req.user!.id,
                String(req.params.id),
                req.body.status,
                req.body.rejectionReason
            );

            res.status(200).json({
                success: true,
                message: `Account verification status updated to ${req.body.status}.`,
                data: updated,
            });
        }
    );

    // ==========================================
    // 3. REGISTERED DEVICE MANAGEMENT CRUD (Manuel)
    // ==========================================

    // List all registered devices
    static listDevices = asyncHandler(async (req: Request, res: Response) => {
        const devices = await WebAuthnService.listPasskeys(req.user!.id);

        res.status(200).json({
            success: true,
            data: devices,
        });
    });

    // Get single registered device details
    static getDevice = asyncHandler(async (req: Request, res: Response) => {
        const device = await WebAuthnService.getPasskey(
            req.user!.id,
            String(req.params.id)
        );

        res.status(200).json({
            success: true,
            data: device,
        });
    });

    // Update registered device nickname
    static updateDevice = asyncHandler(async (req: Request, res: Response) => {
        const updated = await WebAuthnService.updatePasskeyDeviceName(
            req.user!.id,
            String(req.params.id),
            req.body.deviceName
        );

        res.status(200).json({
            success: true,
            message: "Device name updated successfully.",
            data: updated,
        });
    });

    // Revoke / delete registered device
    static deleteDevice = asyncHandler(async (req: Request, res: Response) => {
        const result = await WebAuthnService.deletePasskey(
            req.user!.id,
            String(req.params.id)
        );

        res.status(200).json({
            success: true,
            message: result.message,
        });
    });

    // ==========================================
    // 4. PASSWORD LOGIN & OTP (Vizconde)
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
    // 5. PROFILE & WEBAUTHN PASSKEYS
    // ==========================================

    static getProfile = asyncHandler(async (req: Request, res: Response) => {
        const user = await AuthService.getProfile(req.user!.id);

        res.status(200).json({
            success: true,
            data: user,
        });
    });

    static generateRegistrationOptions = asyncHandler(
        async (req: Request, res: Response) => {
            const userId = req.user?.id || req.body?.userId;

            if (!userId) {
                throw new AppError(
                    "User ID is required to generate registration options.",
                    400
                );
            }

            const options = await WebAuthnService.generateRegistrationOptions(userId);

            res.status(200).json({
                success: true,
                data: options,
            });
        }
    );

    static verifyRegistration = asyncHandler(
        async (req: Request, res: Response) => {
            const userId = req.user?.id || req.body?.userId;

            if (!userId) {
                throw new AppError(
                    "User ID is required to verify passkey registration.",
                    400
                );
            }

            const result = await WebAuthnService.verifyRegistration(
                userId,
                req.body.response,
                req.body.deviceName
            );

            res.status(200).json({
                success: true,
                message: result.message,
                data: result.passkey,
            });
        }
    );

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
}
