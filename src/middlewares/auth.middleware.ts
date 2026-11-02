
import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { AppError } from "../utils/AppError";
import {
    prisma,
    UserRole,
    VerificationStatus,
} from "../config/db";
import { env } from "../config/env";

export interface AuthenticatedUser {
    id: string;
    qcuIdNumber: string;
    email: string;
    role: UserRole;
    verificationStatus: VerificationStatus;
}

// Make req.user available throughout the backend
declare global {
    namespace Express {
        interface Request {
            user?: AuthenticatedUser;
        }
    }
}

/**
 * JWT Authentication Middleware
 */
export const requireAuth = async (
    req: Request,
    _res: Response,
    next: NextFunction
) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return next(
            new AppError("Authentication required. Please log in.", 401)
        );
    }

    const token = authHeader.slice(7).trim();

    if (!token) {
        return next(
            new AppError("Malformed authentication token.", 401)
        );
    }

    try {
        const decoded = jwt.verify(token, env.JWT_SECRET, {
            algorithms: ["HS256"],
        });

        if (
            typeof decoded === "string" ||
            typeof decoded.sub !== "string"
        ) {
            throw new AppError("Invalid authentication token.", 401);
        }

        const user = await prisma.user.findUnique({
            where: {
                id: decoded.sub,
            },
            select: {
                id: true,
                qcuIdNumber: true,
                email: true,
                role: true,
                verificationStatus: true,
            },
        });

        if (!user) {
            throw new AppError("User account not found.", 401);
        }

        req.user = user;

        return next();
    } catch (error) {
        if (error instanceof jwt.TokenExpiredError) {
            return next(
                new AppError("Session expired. Please log in again.", 401)
            );
        }

        if (error instanceof jwt.JsonWebTokenError) {
            return next(
                new AppError("Invalid authentication token.", 401)
            );
        }

        return next(error);
    }
};
