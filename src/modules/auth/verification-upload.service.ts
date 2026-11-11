import type { Express } from "express";
import { env } from "../../config/env";
import { AppError } from "../../utils/AppError";
import { UploadService } from "../upload/upload.service";

export type VerificationDocumentType =
  | "QCU_ID"
  | "LIVE_SELFIE"
  | "SELLER_ENDORSEMENT";

const PHOTO_MIME_TYPES = new Set(["image/jpeg", "image/png"]);

function hasValidMagicBytes(buffer: Buffer, mimetype: string): boolean {
  if (!buffer || buffer.length < 5) {
    return false;
  }

  if (mimetype === "image/jpeg") {
    return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  }

  if (mimetype === "image/png") {
    return (
      buffer.length >= 8 &&
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47 &&
      buffer[4] === 0x0d &&
      buffer[5] === 0x0a &&
      buffer[6] === 0x1a &&
      buffer[7] === 0x0a
    );
  }

  if (mimetype === "application/pdf") {
    return (
      buffer[0] === 0x25 && // %
      buffer[1] === 0x50 && // P
      buffer[2] === 0x44 && // D
      buffer[3] === 0x46 && // F
      buffer[4] === 0x2d // -
    );
  }

  return false;
}

export class VerificationUploadService {
  static async upload(
    file: Express.Multer.File,
    documentType: VerificationDocumentType
  ) {
    if (
      (documentType === "QCU_ID" || documentType === "LIVE_SELFIE") &&
      !PHOTO_MIME_TYPES.has(file.mimetype)
    ) {
      throw new AppError(
        "QCU ID and selfie uploads must be JPG or PNG images.",
        400
      );
    }

    if (!hasValidMagicBytes(file.buffer, file.mimetype)) {
      throw new AppError(
        "Uploaded file contents do not match the declared JPG, PNG, or PDF format.",
        400
      );
    }

    if (
      !env.CLOUDINARY_CLOUD_NAME ||
      !env.CLOUDINARY_API_KEY ||
      !env.CLOUDINARY_API_SECRET
    ) {
      throw new AppError(
        "Document uploads are not configured. Set the Cloudinary environment variables.",
        503
      );
    }

    try {
      // Routing under "verification/*" stores files in bizzyqcu/sensitive/ as authenticated signed URLs.
      const uploaded = await UploadService.uploadBuffer(file.buffer, {
        folder: `verification/${documentType.toLowerCase()}`,
        filename: file.originalname,
        mimetype: file.mimetype,
      });

      return {
        documentType,
        url: uploaded.secureUrl,
        publicId: uploaded.publicId,
      };
    } catch (error) {
      console.error("[VerificationUpload] Cloudinary upload failed:", error);
      throw new AppError(
        "The document could not be uploaded. Please try again.",
        502
      );
    }
  }
}
