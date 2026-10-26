import { AppError } from "../utils/AppError";
/**
 * RBAC Middleware (Dalupang & Vizconde)
 * Restricts access to specified roles (BUYER, SELLER, ADMIN).
 */
export const requireRole = (...allowedRoles) => {
    return (req, _res, next) => {
        if (!req.user) {
            return next(new AppError("Authentication required.", 401));
        }
        if (!allowedRoles.includes(req.user.role)) {
            return next(new AppError(`Forbidden: Access restricted to roles: ${allowedRoles.join(", ")}`, 403));
        }
        next();
    };
};
