import { prisma, Prisma, SellerType } from "../../config/db";

export type ProductSort = "newest" | "price_asc" | "price_desc";

export type ProductSearch = {
  search?: string;
  categoryId?: string;
  sellerType?: SellerType;
  minPrice?: number;
  maxPrice?: number;
  sort: ProductSort;
  page: number;
  limit: number;
};

const ORDER_BY: Record<ProductSort, Prisma.ProductOrderByWithRelationInput> = {
  newest: { createdAt: "desc" },
  price_asc: { price: "asc" },
  price_desc: { price: "desc" },
};

export class CatalogService {
  static async searchProducts(q: ProductSearch) {
    // Prisma ignores undefined values, so unset filters simply drop out.
    const where: Prisma.ProductWhereInput = {
      approvalStatus: "VERIFIED",
      isAvailable: true,
      stockQuantity: { gt: 0 },
      categoryId: q.categoryId,
      price: { gte: q.minPrice, lte: q.maxPrice },
      OR: q.search
        ? [
            { name: { contains: q.search, mode: "insensitive" } },
            { description: { contains: q.search, mode: "insensitive" } },
          ]
        : undefined,
      store: {
        approvalStatus: "VERIFIED",
        sellerProfile: q.sellerType ? { sellerType: q.sellerType } : undefined,
      },
    };

    const [items, total] = await Promise.all([
      prisma.product.findMany({
        where,
        orderBy: ORDER_BY[q.sort],
        skip: (q.page - 1) * q.limit,
        take: q.limit,
        include: {
          category: { select: { name: true, slug: true } },
          store: {
            select: {
              name: true,
              slug: true,
              pickupLocation: true,
              sellerProfile: { select: { sellerType: true, isPaymongoVerified: true } },
            },
          },
        },
      }),
      prisma.product.count({ where }),
    ]);

    return {
      items,
      pagination: {
        page: q.page,
        limit: q.limit,
        total,
        totalPages: Math.ceil(total / q.limit),
      },
    };
  }
}
