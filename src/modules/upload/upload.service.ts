import { Readable } from "node:stream";
import { randomUUID } from "node:crypto";
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

    const cleanSubFolder = (options.folder?.trim() || "general").toLowerCase();
    const isSensitive = [
      "verification",
      "document",
      "evidence",
      "dispute",
      "identity",
      "cor",
      "id",
    ].some((keyword) => cleanSubFolder.includes(keyword));

    const subFolder = options.folder?.trim() || "general";
    const prefix = isSensitive ? "bizzyqcu/sensitive" : "bizzyqcu/public";
    const folder = `${prefix}/${subFolder.replace(/^(bizzyqcu\/)?(sensitive\/|public\/)?/, "")}`;
    const resourceType = options.mimetype === "application/pdf" ? "raw" : "auto";

    if (!isCloudinaryConfigured) {
      const mime = options.mimetype || "image/jpeg";
      const base64 = buffer.toString("base64");
      const dataUri = `data:${mime};base64,${base64}`;
      const uniqueSuffix = randomUUID().replace(/-/g, "").slice(0, 10);
      return {
        url: dataUri,
        secureUrl: dataUri,
        publicId: `dev_${Date.now()}_${uniqueSuffix}`,
        format: mime.split("/")[1] || "jpeg",
        bytes: buffer.length,
      };
    }

    return new Promise((resolve, reject) => {
      const uploadOptions: Record<string, any> = {
        folder,
        resource_type: resourceType,
      };

      if (isSensitive) {
        uploadOptions.type = "authenticated";
      }

      const uploadStream = cloudinary.uploader.upload_stream(
        uploadOptions,
        (error, result: UploadApiResponse | undefined) => {
          if (error || !result) {
            return reject(
              new AppError(
                `Upload to Cloudinary failed: ${error?.message || "Unknown error"}`,
                502
              )
            );
          }

          // If sensitive authenticated asset, generate signed secure delivery URL
          const deliveredUrl = isSensitive
            ? cloudinary.url(result.public_id, {
                secure: true,
                sign_url: true,
                type: "authenticated",
                resource_type: result.resource_type,
              })
            : result.secure_url;

          resolve({
            url: deliveredUrl,
            secureUrl: deliveredUrl,
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
