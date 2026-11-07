import { prisma } from "../../config/db";
import { AppError } from "../../utils/AppError";

const LOW_STOCK_THRESHOLD = 5;
const TOP_PRODUCTS_LIMIT = 5;

export class DashboardService {
  static async getSellerDashboard(userId: string) {
    const store = await prisma.store.findFirst({
      where: { sellerProfile: { userId } },
      select: { id: true, name: true, isOpen: true, approvalStatus: true },
    });
    if (!store) throw new AppError("You do not have a store yet.", 404);

    const storeId = store.id;
    const completed = { storeId, orderStatus: "COMPLETED" as const };

    const [ordersByStatus, sales, productsByApproval, lowStock, topSelling] =
      await Promise.all([
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
      where: { id: { in: topSelling.map((t: any) => t.productId) } },
      select: { id: true, name: true },
    });
    const nameById = new Map(topNames.map((p: any) => [p.id, p.name]));

    return {
      store,
      sales: {
        completedOrders: sales._count._all,
        totalRevenue: Number(sales._sum.totalAmount ?? 0),
      },
      ordersByStatus: Object.fromEntries(
        ordersByStatus.map((o: any) => [o.orderStatus, o._count._all])
      ),
      productsByApproval: Object.fromEntries(
        productsByApproval.map((p: any) => [p.approvalStatus, p._count._all])
      ),
      lowStock: { threshold: LOW_STOCK_THRESHOLD, products: lowStock },
      topSelling: topSelling.map((t: any) => ({
        productId: t.productId,
        name: nameById.get(t.productId),
        unitsSold: t._sum.quantity ?? 0,
        revenue: Number(t._sum.subtotal ?? 0),
      })),
    };
  }

  /**
   * Generates comprehensive analytics for the seller portal matching frontend charts & KPIs.
   */
  static async getSellerAnalytics(
    userId: string,
    query: {
      from?: string;
      to?: string;
      groupBy?: "day" | "week" | "month";
    }
  ) {
    const store = await prisma.store.findFirst({
      where: { sellerProfile: { userId } },
      select: { id: true, name: true, isOpen: true, approvalStatus: true },
    });
    if (!store) throw new AppError("You do not have a store yet.", 404);

    const storeId = store.id;
    const now = new Date();
    const toMs = query.to ? new Date(query.to).getTime() : now.getTime();
    const fromMs = query.from
      ? new Date(query.from).getTime()
      : toMs - 30 * 24 * 60 * 60 * 1000;

    if (Number.isNaN(fromMs) || Number.isNaN(toMs)) {
      throw new AppError("Invalid date range in query parameters.", 400);
    }

    const range = { from: new Date(fromMs), to: new Date(toMs) };
    const unit = query.groupBy || "day";

    const completedCondition = {
      storeId,
      orderStatus: "COMPLETED" as const,
      createdAt: { gte: range.from, lt: range.to },
    };

    const [
      salesSummary,
      pendingCount,
      criticalStock,
      buckets,
      topSelling,
    ] = await Promise.all([
      prisma.order.aggregate({
        where: completedCondition,
        _sum: { totalAmount: true },
        _count: { _all: true },
        _avg: { totalAmount: true },
      }),
      prisma.order.count({
        where: {
          storeId,
          orderStatus: { in: ["PENDING_CONFIRMATION", "PREPARING"] },
        },
      }),
      prisma.product.findMany({
        where: {
          storeId,
          stockQuantity: { lte: LOW_STOCK_THRESHOLD },
          isAvailable: true,
        },
        select: {
          id: true,
          name: true,
          stockQuantity: true,
          price: true,
          isAvailable: true,
        },
        orderBy: { stockQuantity: "asc" },
        take: 10,
      }),
      prisma.$queryRaw<Array<{ bucket: Date; orderCount: number; revenue: number }>>`
        SELECT date_trunc(${unit}::text, o."createdAt") AS bucket,
               COUNT(*)::int AS "orderCount",
               COALESCE(SUM(o."totalAmount"), 0)::float8 AS revenue
        FROM "Order" o
        WHERE o."storeId" = ${storeId}
          AND o."orderStatus"::text = 'COMPLETED'
          AND o."createdAt" >= ${range.from}
          AND o."createdAt" < ${range.to}
        GROUP BY 1
        ORDER BY 1 ASC
      `,
      prisma.orderItem.groupBy({
        by: ["productId"],
        where: {
          order: completedCondition,
        },
        _sum: { quantity: true, subtotal: true },
        orderBy: { _sum: { subtotal: "desc" } },
        take: TOP_PRODUCTS_LIMIT,
      }),
    ]);

    const topProductNames = await prisma.product.findMany({
      where: { id: { in: topSelling.map((t) => t.productId) } },
      select: { id: true, name: true, stockQuantity: true, price: true },
    });
    const productInfoMap = new Map(topProductNames.map((p) => [p.id, p]));

    const totalRevenue = Number(salesSummary._sum.totalAmount ?? 0);
    const orderCount = salesSummary._count._all;

    return {
      store,
      range: {
        from: range.from,
        to: range.to,
        groupBy: unit,
      },
      kpis: {
        totalRevenue: Math.round(totalRevenue * 100) / 100,
        completedOrders: orderCount,
        averageOrderValue: Math.round(Number(salesSummary._avg.totalAmount ?? 0) * 100) / 100,
        pendingOrders: pendingCount,
        criticalStockCount: criticalStock.length,
      },
      chartSeries: buckets.map((b) => ({
        bucket: b.bucket,
        revenue: Math.round(Number(b.revenue) * 100) / 100,
        orderCount: Number(b.orderCount),
      })),
      topProducts: topSelling.map((t) => {
        const info = productInfoMap.get(t.productId);
        return {
          productId: t.productId,
          name: info?.name ?? "Unknown Product",
          stockQuantity: info?.stockQuantity ?? 0,
          unitPrice: Number(info?.price ?? 0),
          unitsSold: t._sum.quantity ?? 0,
          revenue: Math.round(Number(t._sum.subtotal ?? 0) * 100) / 100,
        };
      }),
      criticalStock: criticalStock.map((p) => ({
        ...p,
        price: Number(p.price),
      })),
    };
  }
}
