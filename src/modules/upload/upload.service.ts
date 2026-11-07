import { Readable } from "node:stream";
import type { UploadApiResponse } from "cloudinary";
import { cloudinary } from "../../config/cloudinary";
import { env } from "../../config/env";
import { AppError } from "../../utils/AppError";

export interface UploadResult {
  url: string;
  secureUrl: string;
  publicId: string;
  format: string;
  bytes: number;
}

export class UploadService {
  /**
   * Streams a file buffer directly to Cloudinary or falls back to data URI in offline dev.
   */
  static async uploadBuffer(
    buffer: Buffer,
    options: {
      folder?: string;
      filename?: string;
      mimetype?: string;
    } = {}
  ): Promise<UploadResult> {
    const isCloudinaryConfigured = Boolean(
      env.CLOUDINARY_CLOUD_NAME &&
      env.CLOUDINARY_API_KEY &&
      env.CLOUDINARY_API_SECRET
    );

    const subFolder = options.folder?.trim() || "general";
    const folder = `bizzyqcu/${subFolder.replace(/^bizzyqcu\/?/, "")}`;
    const resourceType = options.mimetype === "application/pdf" ? "raw" : "auto";

    if (!isCloudinaryConfigured) {
      const mime = options.mimetype || "image/jpeg";
      const base64 = buffer.toString("base64");
      const dataUri = `data:${mime};base64,${base64}`;
      return {
        url: dataUri,
        secureUrl: dataUri,
        publicId: `dev_${Date.now()}`,
        format: mime.split("/")[1] || "jpeg",
        bytes: buffer.length,
      };
    }

    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder,
          resource_type: resourceType,
        },
        (error, result: UploadApiResponse | undefined) => {
          if (error || !result) {
            return reject(
              new AppError(
                `Upload to Cloudinary failed: ${error?.message || "Unknown error"}`,
                502
              )
            );
          }
          resolve({
            url: result.url,
            secureUrl: result.secure_url,
            publicId: result.public_id,
            format: result.format || result.resource_type,
            bytes: result.bytes,
          });
        }
      );

      Readable.from(buffer).pipe(uploadStream);
    });
  }
}
