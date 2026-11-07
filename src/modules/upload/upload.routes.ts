import { Router } from "express";
import { UploadController } from "./upload.controller";
import { upload } from "../../middlewares/upload.middleware";
import { requireAuth } from "../../middlewares/auth.middleware";

const router = Router();

// Protect all upload endpoints from anonymous abuse
router.use(requireAuth);

// Single file upload endpoint (e.g. registration ID, selfie, store logo)
router.post(
  "/",
  upload.single("file"),
  UploadController.uploadSingle
);

// Multiple files upload endpoint (e.g. product gallery, evidence photos)
router.post(
  "/multiple",
  upload.array("files", 10),
  UploadController.uploadMultiple
);

export default router;
