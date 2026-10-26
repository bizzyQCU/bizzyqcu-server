import { asyncHandler } from "../../utils/asyncHandler";
import { AnalyticsService } from "./analytics.service";
import { parseDemandQuery, parseSalesQuery, parseStoresQuery } from "./analytics.validation";
export class AnalyticsController {
    /** GET /api/v1/admin/analytics/sales?from=&to=&groupBy=day|week|month */
    static sales = asyncHandler(async (req, res) => {
        const data = await AnalyticsService.getSales(parseSalesQuery(req.query));
        res.status(200).json({ success: true, data });
    });
    /** GET /api/v1/admin/analytics/stores?from=&to= */
    static stores = asyncHandler(async (req, res) => {
        const data = await AnalyticsService.getStores(parseStoresQuery(req.query));
        res.status(200).json({ success: true, data });
    });
    /** GET /api/v1/admin/analytics/demand?from=&to=&limit= */
    static demand = asyncHandler(async (req, res) => {
        const data = await AnalyticsService.getDemand(parseDemandQuery(req.query));
        res.status(200).json({ success: true, data });
    });
}
