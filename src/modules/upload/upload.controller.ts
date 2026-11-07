import { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { AppError } from "../../utils/AppError";
import { UploadService } from "./upload.service";

export class UploadController {
  /**
   * Uploads a single file (e.g. QCU ID photo, selfie, store logo, single product image).
   * Expects multipart/form-data with field name "file".
   */
  static uploadSingle = asyncHandler(async (req: Request, res: Response) => {
    if (!req.file) {
      throw new AppError("No file provided. Please attach a file with field name 'file'.", 400);
    }

    const folder = (req.body.folder || req.query.folder || "uploads") as string;
    const result = await UploadService.uploadBuffer(req.file.buffer, {
      folder,
      filename: req.file.originalname,
      mimetype: req.file.mimetype,
    });

    res.status(201).json({
      success: true,
      message: "File uploaded successfully.",
      data: {
        url: result.secureUrl,
        publicId: result.publicId,
        format: result.format,
        bytes: result.bytes,
      },
    });
  });

  /**
   * Uploads multiple files (e.g. product gallery, complaint evidence).
   * Expects multipart/form-data with field name "files".
   */
  static uploadMultiple = asyncHandler(async (req: Request, res: Response) => {
    const files = req.files as Express.Multer.File[] | undefined;
    if (!files || files.length === 0) {
      throw new AppError("No files provided. Please attach files with field name 'files'.", 400);
    }

    const folder = (req.body.folder || req.query.folder || "uploads") as string;
    const results = [];
    // Process uploads sequentially to bound network concurrency and memory pressure
    for (const file of files) {
      const uploaded = await UploadService.uploadBuffer(file.buffer, {
        folder,
        filename: file.originalname,
        mimetype: file.mimetype,
      });
      results.push(uploaded);
    }

    res.status(201).json({
      success: true,
      message: `${results.length} files uploaded successfully.`,
      data: results.map((r) => ({
        url: r.secureUrl,
        publicId: r.publicId,
        format: r.format,
        bytes: r.bytes,
      })),
      urls: results.map((r) => r.secureUrl),
    });
  });
}
