
import { Request, Response, NextFunction } from "express";
import {
    UserRole,
    VerificationStatus,
} from "../config/db";
import { AppError } from "../utils/AppError";

// ==========================================
// GENERIC ROLE-BASED ACCESS CONTROL
// ==========================================

/**
 * Checks whether the authenticated user has
 * one of the allowed roles.
 */

export const requireRole = (...allowedRoles: UserRole[]) => {
    return (
        req: Request,
        _res: Response,
        next: NextFunction
    ) => {
        if (!req.user) {
            return next(
                new AppError("Authentication required.", 401)
            );
        }

        if (!allowedRoles.includes(req.user.role)) {
            return next(
                new AppError(
                    `Forbidden: Access restricted to roles: ${allowedRoles.join(", ")}`,
                    403
                )
            );
        }

        next();
    };
};

// ==========================================
// BUYER ACCESS
// ==========================================

/**
 * Allows access to BUYER accounts only.
 */

export const isBuyer = requireRole(UserRole.BUYER);

/**
 * Allows purchasing access to BUYER and SELLER accounts.
 * Sellers on campus can also purchase goods from other campus stores.
 */
export const canPurchase = requireRole(UserRole.BUYER, UserRole.SELLER);

// ==========================================
// SELLER ACCESS
// ==========================================

/**
 * Allows access to SELLER accounts only.
 */

export const isSeller = requireRole(UserRole.SELLER);

// ==========================================
// ADMIN ACCESS
// ==========================================

/**
 * Allows access to ADMIN accounts only.
 */

export const isAdmin = requireRole(UserRole.ADMIN);

// ==========================================
// VERIFIED ACCOUNT ACCESS
// ==========================================

/**
 * Allows access only to users whose account
 * verification status is VERIFIED.
 */

export const isVerified = (
    req: Request,
    _res: Response,
    next: NextFunction
) => {
    if (!req.user) {
        return next(
            new AppError("Authentication required.", 401)
        );
    }

    if (
        req.user.verificationStatus !==
        VerificationStatus.VERIFIED
    ) {
        return next(
            new AppError(
                "Your account is not yet verified.",
                403
            )
        );
    }

    next();
};
