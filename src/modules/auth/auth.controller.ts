import { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { AuthService } from "./auth.service";

export class AuthController {
  static register = asyncHandler(async (req: Request, res: Response) => {
    const user = await AuthService.register(req.body);
    res.status(201).json({
      success: true,
      message: "Registration submitted. Pending administrator verification.",
      data: user,
    });
  });

  static getProfile = asyncHandler(async (req: Request, res: Response) => {
    const user = await AuthService.getProfile(req.user!.id);
    res.status(200).json({
      success: true,
      data: user,
    });
  });
}
