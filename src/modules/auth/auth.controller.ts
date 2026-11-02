
import { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { AuthService } from "./auth.service";

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
}
