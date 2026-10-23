import { prisma, SellerType } from "../../config/db";
import { AppError } from "../../utils/AppError";

export class MarketplaceService {
  // Support Member (Ojeda): Create Product (Subject to Admin Approval)
  static async createProduct(data: {
    storeId: string;
    categoryId: string;
    name: string;
    description: string;
    price: number;
    stockQuantity: number;
    imageUrls: string[];
  }) {
    const store = await prisma.store.findUnique({
      where: { id: data.storeId },
    });

    if (!store || store.approvalStatus !== "VERIFIED") {
      throw new AppError(
        "Store does not exist or is not yet verified by an Admin.",
        403
      );
    }

    return await prisma.product.create({
      data: {
        ...data,
        approvalStatus: "PENDING",
      },
    });
  }

  // Notable Member (Luarca): Dynamic Search & Multi-Parameter Filtering
  static async getActiveProducts(filters: {
    search?: string;
    categoryId?: string;
    sellerType?: SellerType;
  }) {
    return await prisma.product.findMany({
      where: {
        approvalStatus: "VERIFIED",
        isAvailable: true,
        stockQuantity: { gt: 0 },
        ...(filters.categoryId && { categoryId: filters.categoryId }),
        ...(filters.search && {
          OR: [
            { name: { contains: filters.search, mode: "insensitive" } },
            { description: { contains: filters.search, mode: "insensitive" } },
          ],
        }),
        ...(filters.sellerType && {
          store: {
            sellerProfile: {
              sellerType: filters.sellerType,
            },
          },
        }),
      },
      include: {
        category: { select: { name: true, slug: true } },
        store: {
          select: {
            name: true,
            slug: true,
            pickupLocation: true,
            sellerProfile: {
              select: { sellerType: true, isPaymongoVerified: true },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });
  }
}
