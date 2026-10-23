import { Request, Response, NextFunction } from "express";
import { AppError } from "../utils/AppError";
import { prisma, UserRole } from "../config/db";

export interface AuthenticatedUser {
  id: string;
  qcuIdNumber: string;
  email: string;
  role: UserRole;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

/**
 * Auth Middleware (Dalupang & Vizconde)
 * Validates request authentication (e.g., Bearer token or session header).
 */
export const requireAuth = async (
  req: Request,
  _res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      throw new AppError("Authentication required. Please log in.", 401);
    }

    const token = authHeader.split(" ")[1];
    if (!token) {
      throw new AppError("Malformed authentication token.", 401);
    }

    // In local development / mock token support: allows user ID directly or JWT
    // Vizconde & Manuel will plug in full JWT / WebAuthn session verification here
    const user = await prisma.user.findFirst({
      where: { id: token },
      select: { id: true, qcuIdNumber: true, email: true, role: true },
    });

    if (!user) {
      throw new AppError("Invalid or expired session.", 401);
    }

    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
};
