import { prisma, Prisma } from "../../config/db";
import { AppError } from "../../utils/AppError";
import type {
    DemandAnalyticsQuery,
    SalesAnalyticsQuery,
    StoresAnalyticsQuery,
} from "./analytics.validation";

const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_RANGE_DAYS = 30;
const MANILA_TZ = "Asia/Manila";

interface DateRange {
    from: Date;
    to: Date;
}

interface SalesBucketRow {
    bucket: Date;
    orderCount: number;
    revenue: number;
}

interface StoreTopProductRow {
    storeId: string;
    productId: string;
    name: string;
    unitsSold: number;
    revenue: number;
}

interface CategoryRow {
    id: string;
    name: string;
    slug: string;
    unitsSold: number;
    revenue: number;
}

interface HourRow {
    hour: number;
    orderCount: number;
    revenue: number;
}

interface StoreRow {
    id: string;
    name: string;
    slug: string;
    approvalStatus: string;
    sellerProfile: { sellerType: string };
}

const round2 = (value: number) => Math.round(value * 100) / 100;

const isDateOnly = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value);

/**
 * Normalises `from`/`to` into a half-open range [from, to).
 * - Date-only `from` starts at 00:00:00Z; date-only `to` covers the whole day
 *   (exclusive end = next day 00:00Z).
 * - Missing values default to the last 30 days ending now.
 */
function resolveRange(from?: string, to?: string): DateRange {
    const now = new Date();

    const toMs: number = to
        ? isDateOnly(to)
            ? new Date(`${to}T00:00:00.000Z`).getTime() + DAY_MS
            : new Date(to).getTime()
        : now.getTime();

    const fromMs: number = from
        ? isDateOnly(from)
            ? new Date(`${from}T00:00:00.000Z`).getTime()
            : new Date(from).getTime()
        : toMs - DEFAULT_RANGE_DAYS * DAY_MS;

    if (Number.isNaN(fromMs) || Number.isNaN(toMs)) {
        throw new AppError("Invalid date range.", 400);
    }
    if (fromMs > toMs) {
        throw new AppError("`from` must be earlier than or equal to `to`.", 400);
    }

    return { from: new Date(fromMs), to: new Date(toMs) };
}

/** Only COMPLETED orders count as sales; CANCELLED/PENDING are excluded. */
const completedInRange = (range: DateRange): Prisma.OrderWhereInput => ({
    orderStatus: "COMPLETED",
    createdAt: { gte: range.from, lt: range.to },
});

export class AnalyticsService {
    // ---------------------------------------------------------------------------
    // GET /admin/analytics/sales?from=&to=&groupBy=day|week|month
    // ---------------------------------------------------------------------------
    static async getSales(query: SalesAnalyticsQuery) {
        const range = resolveRange(query.from, query.to);
        const unit = query.groupBy; // whitelisted by Zod: day | week | month

        const [summary, buckets] = await Promise.all([
            prisma.order.aggregate({
                where: completedInRange(range),
                _count: { _all: true },
                _sum: { totalAmount: true },
                _avg: { totalAmount: true },
            }),
            prisma.$queryRaw<SalesBucketRow[]>`
        SELECT date_trunc(${unit}::text, o."createdAt") AS bucket,
               COUNT(*)::int AS "orderCount",
               COALESCE(SUM(o."totalAmount"), 0)::float8 AS revenue
        FROM "Order" o
        WHERE o."orderStatus"::text = 'COMPLETED'
          AND o."createdAt" >= ${range.from}
          AND o."createdAt" < ${range.to}
        GROUP BY 1
        ORDER BY 1 ASC
      `,
        ]);

        const totalRevenue = Number(summary._sum.totalAmount ?? 0);
        const orderCount = summary._count._all;

        return {
            range: { from: range.from, to: range.to, groupBy: unit, timezone: "UTC" },
            summary: {
                totalRevenue: round2(totalRevenue),
                orderCount,
                averageOrderValue: round2(orderCount === 0 ? 0 : totalRevenue / orderCount),
                // Kept for parity with the Prisma aggregate; identical to the computed AOV.
                averageOrderValueFromDb: round2(Number(summary._avg.totalAmount ?? 0)),
            },
            series: (buckets as SalesBucketRow[]).map((row: SalesBucketRow) => ({
                bucket: row.bucket,
                revenue: round2(Number(row.revenue)),
                orderCount: Number(row.orderCount),
                averageOrderValue: round2(
                    Number(row.orderCount) === 0 ? 0 : Number(row.revenue) / Number(row.orderCount)
                ),
            })),
        };
    }

    // ---------------------------------------------------------------------------
    // GET /admin/analytics/stores
    // ---------------------------------------------------------------------------
    static async getStores(query: StoresAnalyticsQuery) {
        const range = resolveRange(query.from, query.to);
        const where = {
            createdAt: { gte: range.from, lt: range.to },
        } satisfies Prisma.OrderWhereInput;

        const [stores, grouped, topProductRows] = await Promise.all([
            prisma.store.findMany({
                select: {
                    id: true,
                    name: true,
                    slug: true,
                    approvalStatus: true,
                    sellerProfile: { select: { sellerType: true } },
                },
                orderBy: { name: "asc" },
            }),
            prisma.order.groupBy({
                by: ["storeId", "orderStatus"],
                where,
                _count: { _all: true },
                _sum: { totalAmount: true },
            }),
            prisma.$queryRaw<StoreTopProductRow[]>`
        SELECT ranked."storeId",
               ranked."productId",
               p."name",
               ranked."unitsSold",
               ranked."revenue"
        FROM (
          SELECT o."storeId",
                 oi."productId",
                 SUM(oi."quantity")::int AS "unitsSold",
                 COALESCE(SUM(oi."subtotal"), 0)::float8 AS revenue,
                 ROW_NUMBER() OVER (
                   PARTITION BY o."storeId"
                   ORDER BY SUM(oi."quantity") DESC, oi."productId"
                 ) AS rn
          FROM "OrderItem" oi
          JOIN "Order" o ON o.id = oi."orderId"
          WHERE o."orderStatus"::text = 'COMPLETED'
            AND o."createdAt" >= ${range.from}
            AND o."createdAt" < ${range.to}
          GROUP BY o."storeId", oi."productId"
        ) ranked
        JOIN "Product" p ON p.id = ranked."productId"
        WHERE ranked.rn <= 5
        ORDER BY ranked."storeId", ranked.rn
      `,
        ]);

        type Metrics = {
            totalOrders: number;
            completedOrders: number;
            cancelledOrders: number;
            completedRevenue: number;
        };
        const metricsByStore = new Map<string, Metrics>();

        for (const row of grouped) {
            const current =
                metricsByStore.get(row.storeId) ??
                ({ totalOrders: 0, completedOrders: 0, cancelledOrders: 0, completedRevenue: 0 } as Metrics);

            current.totalOrders += row._count._all;
            if (row.orderStatus === "COMPLETED") {
                current.completedOrders += row._count._all;
                current.completedRevenue += Number(row._sum.totalAmount ?? 0);
            }
            if (row.orderStatus === "CANCELLED") {
                current.cancelledOrders += row._count._all;
            }
            metricsByStore.set(row.storeId, current);
        }

        const topByStore = new Map<string, StoreTopProductRow[]>();
        for (const row of topProductRows) {
            const list = topByStore.get(row.storeId) ?? [];
            list.push(row);
            topByStore.set(row.storeId, list);
        }

        const storeRows = (stores as StoreRow[]).map((store: StoreRow) => {
            const m =
                metricsByStore.get(store.id) ??
                ({ totalOrders: 0, completedOrders: 0, cancelledOrders: 0, completedRevenue: 0 } as Metrics);

            return {
                storeId: store.id,
                name: store.name,
                slug: store.slug,
                approvalStatus: store.approvalStatus,
                sellerType: store.sellerProfile.sellerType,
                revenue: round2(m.completedRevenue),
                orders: m.completedOrders,
                totalOrders: m.totalOrders,
                cancelledOrders: m.cancelledOrders,
                averageOrderValue: round2(
                    m.completedOrders === 0 ? 0 : m.completedRevenue / m.completedOrders
                ),
                completionRate: round2(
                    m.totalOrders === 0 ? 0 : (m.completedOrders / m.totalOrders) * 100
                ),
                cancellationRate: round2(
                    m.totalOrders === 0 ? 0 : (m.cancelledOrders / m.totalOrders) * 100
                ),
                topProducts: (topByStore.get(store.id) ?? []).map((p) => ({
                    productId: p.productId,
                    name: p.name,
                    unitsSold: Number(p.unitsSold),
                    revenue: round2(Number(p.revenue)),
                })),
            };
        });

        const totals = storeRows.reduce(
            (acc: { totalRevenue: number; totalCompletedOrders: number; totalOrders: number }, s: any) => {
                acc.totalRevenue += s.revenue;
                acc.totalCompletedOrders += s.orders;
                acc.totalOrders += s.totalOrders;
                return acc;
            },
            { totalRevenue: 0, totalCompletedOrders: 0, totalOrders: 0 }
        );

        return {
            range: { from: range.from, to: range.to },
            totals: {
                storeCount: storeRows.length,
                totalRevenue: round2(totals.totalRevenue),
                totalCompletedOrders: totals.totalCompletedOrders,
                totalOrders: totals.totalOrders,
                averageOrderValue: round2(
                    totals.totalCompletedOrders === 0
                        ? 0
                        : totals.totalRevenue / totals.totalCompletedOrders
                ),
            },
            stores: storeRows.sort((a: any, b: any) => b.revenue - a.revenue),
        };
    }

    // ---------------------------------------------------------------------------
    // GET /admin/analytics/demand
    // ---------------------------------------------------------------------------
    static async getDemand(query: DemandAnalyticsQuery) {
        const range = resolveRange(query.from, query.to);
        const limit = query.limit;
        const completedWhere = completedInRange(range);

        const [
            topProductGroups,
            categoryRows,
            byBuilding,
            byDeliveryMethod,
            byPaymentMethod,
            hourRows,
            completedOrders,
        ] = await Promise.all([
            prisma.orderItem.groupBy({
                by: ["productId"],
                where: { order: completedWhere },
                _sum: { quantity: true, subtotal: true },
                orderBy: { _sum: { quantity: "desc" } },
                take: limit,
            }),
            prisma.$queryRaw<CategoryRow[]>`
        SELECT c."id", c."name", c."slug",
               SUM(oi."quantity")::int AS "unitsSold",
               COALESCE(SUM(oi."subtotal"), 0)::float8 AS revenue
        FROM "OrderItem" oi
        JOIN "Order" o ON o.id = oi."orderId"
        JOIN "Product" p ON p.id = oi."productId"
        JOIN "Category" c ON c.id = p."categoryId"
        WHERE o."orderStatus"::text = 'COMPLETED'
          AND o."createdAt" >= ${range.from}
          AND o."createdAt" < ${range.to}
        GROUP BY c."id", c."name", c."slug"
        ORDER BY "unitsSold" DESC
        LIMIT ${limit}
      `,
            prisma.order.groupBy({
                by: ["campusBuilding"],
                where: { ...completedWhere, campusBuilding: { not: null } },
                _count: { _all: true },
                _sum: { totalAmount: true },
            }),
            prisma.order.groupBy({
                by: ["deliveryMethod"],
                where: completedWhere,
                _count: { _all: true },
                _sum: { totalAmount: true },
            }),
            prisma.order.groupBy({
                by: ["paymentMethod"],
                where: completedWhere,
                _count: { _all: true },
                _sum: { totalAmount: true },
            }),
            prisma.$queryRaw<HourRow[]>`
        SELECT EXTRACT(HOUR FROM ((o."createdAt" AT TIME ZONE 'UTC') AT TIME ZONE ${MANILA_TZ}::text))::int AS "hour",
               COUNT(*)::int AS "orderCount",
               COALESCE(SUM(o."totalAmount"), 0)::float8 AS revenue
        FROM "Order" o
        WHERE o."orderStatus"::text = 'COMPLETED'
          AND o."createdAt" >= ${range.from}
          AND o."createdAt" < ${range.to}
        GROUP BY 1
        ORDER BY 1 ASC
      `,
            prisma.order.count({ where: completedWhere }),
        ]);

        const productIds = topProductGroups.map((p: any) => p.productId);
        const products = productIds.length
            ? await prisma.product.findMany({
                where: { id: { in: productIds } },
                select: {
                    id: true,
                    name: true,
                    category: { select: { id: true, name: true, slug: true } },
                    store: { select: { id: true, name: true } },
                },
            })
            : [];
        const productById = new Map<string, any>(products.map((p: any) => [p.id, p]));

        const hourByNumber = new Map<number, HourRow>(hourRows.map((h: HourRow) => [Number(h.hour), h]));
        const ordersByHour = Array.from({ length: 24 }, (_, hour) => {
            const row = hourByNumber.get(hour);
            return {
                hour,
                orderCount: row ? Number(row.orderCount) : 0,
                revenue: row ? round2(Number(row.revenue)) : 0,
            };
        });

        return {
            range: { from: range.from, to: range.to },
            summary: { completedOrders },
            topProducts: topProductGroups.map((row: any) => {
                const product = productById.get(row.productId);
                return {
                    productId: row.productId,
                    name: product?.name ?? null,
                    category: product?.category ?? null,
                    store: product?.store ?? null,
                    unitsSold: row._sum.quantity ?? 0,
                    revenue: round2(Number(row._sum.subtotal ?? 0)),
                };
            }),
            topCategories: categoryRows.map((row: CategoryRow) => ({
                categoryId: row.id,
                name: row.name,
                slug: row.slug,
                unitsSold: Number(row.unitsSold),
                revenue: round2(Number(row.revenue)),
            })),
            ordersByCampusBuilding: byBuilding
                .map((row: any) => ({
                    campusBuilding: row.campusBuilding,
                    orderCount: row._count._all,
                    revenue: round2(Number(row._sum.totalAmount ?? 0)),
                }))
                .sort((a: any, b: any) => b.orderCount - a.orderCount),
            ordersByDeliveryMethod: byDeliveryMethod.map((row: any) => ({
                deliveryMethod: row.deliveryMethod,
                orderCount: row._count._all,
                revenue: round2(Number(row._sum.totalAmount ?? 0)),
            })),
            ordersByPaymentMethod: byPaymentMethod.map((row: any) => ({
                paymentMethod: row.paymentMethod,
                orderCount: row._count._all,
                revenue: round2(Number(row._sum.totalAmount ?? 0)),
            })),
            // Hour buckets use Asia/Manila campus time, not UTC.
            ordersByHour,
        };
    }
}