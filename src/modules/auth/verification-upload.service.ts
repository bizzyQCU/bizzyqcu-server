import { Readable } from "node:stream";
import type { Express } from "express";
import { cloudinary } from "../../config/cloudinary";
import { env } from "../../config/env";
import { AppError } from "../../utils/AppError";

export type VerificationDocumentType =
  | "QCU_ID"
  | "LIVE_SELFIE"
  | "SELLER_ENDORSEMENT";

export class VerificationUploadService {
  static async upload(
    file: Express.Multer.File,
    documentType: VerificationDocumentType
  ) {
    if (
      (documentType === "QCU_ID" || documentType === "LIVE_SELFIE") &&
      !["image/jpeg", "image/png"].includes(file.mimetype)
    ) {
      throw new AppError("QCU ID and selfie uploads must be JPG or PNG images.", 400);
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

    const resourceType = file.mimetype === "application/pdf" ? "raw" : "image";
    const folder = `bizzyqcu/verification/${documentType.toLowerCase()}`;

    const uploaded = await new Promise<{ secure_url: string; public_id: string }>(
      (resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          {
            folder,
            resource_type: resourceType,
            use_filename: false,
            unique_filename: true,
            overwrite: false,
          },
          (error, result) => {
            if (error) return reject(error);
            if (!result?.secure_url || !result.public_id) {
              return reject(new Error("Cloudinary returned an incomplete upload result."));
            }
            resolve({ secure_url: result.secure_url, public_id: result.public_id });
          }
        );

        Readable.from([file.buffer]).pipe(stream);
      }
    ).catch(() => {
      throw new AppError("The document could not be uploaded. Please try again.", 502);
    });

    return {
      documentType,
      url: uploaded.secure_url,
      publicId: uploaded.public_id,
    };
  }
}
