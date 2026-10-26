import { Router } from "express";
import { MarketplaceController } from "./marketplace.controller";
import { validate } from "../../middlewares/validate.middleware";
import { createProductSchema } from "./marketplace.validation";
import catalogRoutes from "./catalog.routes";
const router = Router();
router.post("/products", validate(createProductSchema), MarketplaceController.createProduct);
router.use(catalogRoutes);
export default router;
