import { asyncHandler } from "../../utils/asyncHandler";
import { CatalogService } from "./catalog.service";
import { InventoryService } from "./inventory.service";
import { DashboardService } from "./dashboard.service";
import { parseSearchProductsQuery } from "./catalog.validation";
export class CatalogController {
    static searchProducts = asyncHandler(async (req, res) => {
        // Express 5 query is read-only, so re-parse to get coerced values and defaults.
        const result = await CatalogService.searchProducts(parseSearchProductsQuery(req.query));
        res.status(200).json({ success: true, ...result });
    });
    static setStock = asyncHandler(async (req, res) => {
        const product = await InventoryService.setStock(req.user.id, req.params.id, req.body.stockQuantity);
        res.status(200).json({ success: true, message: "Stock updated.", data: product });
    });
    static setAvailability = asyncHandler(async (req, res) => {
        const product = await InventoryService.setAvailability(req.user.id, req.params.id, req.body.isAvailable);
        res.status(200).json({ success: true, message: "Availability updated.", data: product });
    });
    static getSellerDashboard = asyncHandler(async (req, res) => {
        const data = await DashboardService.getSellerDashboard(req.user.id);
        res.status(200).json({ success: true, data });
    });
}
