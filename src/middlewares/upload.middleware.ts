import multer from "multer";
import { AppError } from "../utils/AppError";

const storage = multer.memoryStorage();

export const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new AppError("Only image files are allowed", 400) as any, false);
    }
  },
});

/** Verification uploads allow PDFs for endorsements, but keep ID/selfie rules narrower in the route service. */
export const verificationUpload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 1,
  },
  fileFilter: (_req, file, cb) => {
    if (["image/jpeg", "image/png", "application/pdf"].includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new AppError("Upload a JPG, PNG, or PDF file.", 400) as any, false);
    }
  },
});
