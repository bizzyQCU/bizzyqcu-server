import { asyncHandler } from "../../utils/asyncHandler";
import { MarketplaceService } from "./marketplace.service";
export class MarketplaceController {
    static createProduct = asyncHandler(async (req, res) => {
        const product = await MarketplaceService.createProduct(req.body);
        res.status(201).json({
            success: true,
            message: "Product submitted and awaiting administrator approval.",
            data: product,
        });
    });
}
