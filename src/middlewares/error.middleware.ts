import { Request, Response, NextFunction } from "express";
import multer from "multer";
import { AppError } from "../utils/AppError";

export const errorHandler = (
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
) => {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      success: false,
      message: err.message,
    });
  }

  if (err instanceof multer.MulterError) {
    let message = "File upload error.";
    if (err.code === "LIMIT_FILE_SIZE") {
      message = "File exceeds maximum permitted size (5MB).";
    } else if (err.code === "LIMIT_FILE_COUNT") {
      message = "Exceeded maximum number of files allowed in one request (5 files).";
    } else if (err.code === "LIMIT_UNEXPECTED_FILE") {
      message = `Unexpected upload field: '${err.field}'.`;
    }

    return res.status(400).json({
      success: false,
      message,
    });
  }

  console.error("[UNHANDLED ERROR]:", err);
  return res.status(500).json({
    success: false,
    message: "Internal server error",
  });
};
