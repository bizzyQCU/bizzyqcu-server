import multer from "multer";
import { AppError } from "../utils/AppError";

const storage = multer.memoryStorage();

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/jpg",
  "image/gif",
  "application/pdf",
]);

export const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME_TYPES.has(file.mimetype)) {
      cb(null, true);
    } else {
      cb(
        new AppError(
          "Invalid file type. Only images (JPEG, PNG, WebP, GIF) and PDF documents are allowed.",
          400
        ) as any,
        false
      );
    }
  },
});

const VERIFICATION_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "application/pdf",
]);

/** Verification uploads allow PDFs for endorsements while constraining buffer count and size. */
export const verificationUpload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 1,
  },
  fileFilter: (_req, file, cb) => {
    if (VERIFICATION_MIME_TYPES.has(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new AppError("Upload a JPG, PNG, or PDF file.", 400) as any, false);
    }
  },
});
