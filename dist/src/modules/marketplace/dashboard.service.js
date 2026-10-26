import { prisma } from "../../config/db";
import { AppError } from "../../utils/AppError";
const LOW_STOCK_THRESHOLD = 5;
const TOP_PRODUCTS_LIMIT = 5;
export class DashboardService {
    static async getSellerDashboard(userId) {
        const store = await prisma.store.findFirst({
            where: { sellerProfile: { userId } },
            select: { id: true, name: true, isOpen: true, approvalStatus: true },
        });
        if (!store)
            throw new AppError("You do not have a store yet.", 404);
        const storeId = store.id;
        const completed = { storeId, orderStatus: "COMPLETED" };
        const [ordersByStatus, sales, productsByApproval, lowStock, topSelling] = await Promise.all([
            prisma.order.groupBy({
                by: ["orderStatus"],
                where: { storeId },
                _count: { _all: true },
            }),
            prisma.order.aggregate({
                where: completed,
                _sum: { totalAmount: true },
                _count: { _all: true },
            }),
            prisma.product.groupBy({
                by: ["approvalStatus"],
                where: { storeId },
                _count: { _all: true },
            }),
            prisma.product.findMany({
                where: { storeId, stockQuantity: { lte: LOW_STOCK_THRESHOLD } },
                select: { id: true, name: true, stockQuantity: true, isAvailable: true },
                orderBy: { stockQuantity: "asc" },
                take: 10,
            }),
            prisma.orderItem.groupBy({
                by: ["productId"],
                where: { order: completed },
                _sum: { quantity: true, subtotal: true },
                orderBy: { _sum: { quantity: "desc" } },
                take: TOP_PRODUCTS_LIMIT,
            }),
        ]);
        const topNames = await prisma.product.findMany({
            where: { id: { in: topSelling.map((t) => t.productId) } },
            select: { id: true, name: true },
        });
        const nameById = new Map(topNames.map((p) => [p.id, p.name]));
        return {
            store,
            sales: {
                completedOrders: sales._count._all,
                totalRevenue: Number(sales._sum.totalAmount ?? 0),
            },
            ordersByStatus: Object.fromEntries(ordersByStatus.map((o) => [o.orderStatus, o._count._all])),
            productsByApproval: Object.fromEntries(productsByApproval.map((p) => [p.approvalStatus, p._count._all])),
            lowStock: { threshold: LOW_STOCK_THRESHOLD, products: lowStock },
            topSelling: topSelling.map((t) => ({
                productId: t.productId,
                name: nameById.get(t.productId),
                unitsSold: t._sum.quantity ?? 0,
                revenue: Number(t._sum.subtotal ?? 0),
            })),
        };
    }
}
