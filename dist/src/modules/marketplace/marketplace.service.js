import { prisma } from "../../config/db";
import { AppError } from "../../utils/AppError";
export class MarketplaceService {
    // Support Member (Ojeda): Create Product (Subject to Admin Approval)
    static async createProduct(data) {
        const store = await prisma.store.findUnique({
            where: { id: data.storeId },
        });
        if (!store || store.approvalStatus !== "VERIFIED") {
            throw new AppError("Store does not exist or is not yet verified by an Admin.", 403);
        }
        return await prisma.product.create({
            data: {
                ...data,
                approvalStatus: "PENDING",
            },
        });
    }
}
