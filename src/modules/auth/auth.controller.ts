import { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { AuthService } from "./auth.service";
import { WebAuthnService } from "./webauthn.service";
import { AppError } from "../../utils/AppError";

export class AuthController {
    // ==========================================
    // REGISTER
    // ==========================================

    static register = asyncHandler(async (req: Request, res: Response) => {
        const user = await AuthService.register(req.body);

        res.status(201).json({
            success: true,
            message: "Registration submitted. Pending administrator verification.",
            data: user,
        });
    });

    // ==========================================
    // REQUEST PASSWORD LOGIN OTP
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

    // ==========================================
    // VERIFY OTP AND LOGIN
    // ==========================================

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
    // GET PROFILE
    // ==========================================

    static getProfile = asyncHandler(async (req: Request, res: Response) => {
        const user = await AuthService.getProfile(req.user!.id);

        res.status(200).json({
            success: true,
            data: user,
        });
    });

    // ==========================================
    // WEBAUTHN / PASSKEY REGISTRATION
    // ==========================================

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
