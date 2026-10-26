import { AppError } from "../utils/AppError";
export const errorHandler = (err, _req, res, _next) => {
    if (err instanceof AppError) {
        return res.status(err.statusCode).json({
            success: false,
            message: err.message,
        });
    }
    console.error("[UNHANDLED ERROR]:", err);
    return res.status(500).json({
        success: false,
        message: "Internal server error",
    });
};
