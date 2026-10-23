import { Router } from "express";
import { MarketplaceController } from "./marketplace.controller";
import { validate } from "../../middlewares/validate.middleware";
import {
  createProductSchema,
  getProductsQuerySchema,
} from "./marketplace.validation";

const router = Router();

router.get(
  "/products",
  validate(getProductsQuerySchema),
  MarketplaceController.getProducts
);

router.post(
  "/products",
  validate(createProductSchema),
  MarketplaceController.createProduct
);

export default router;
