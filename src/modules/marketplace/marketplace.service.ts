import { prisma, Prisma, VerificationStatus } from "../../config/db";
import { AppError } from "../../utils/AppError";

type CreateProductData = {
  storeId: string;
  categoryId: string;
  name: string;
  description: string;
  price: number;
  stockQuantity: number;
  imageUrls: string[];
};

type UpdateProductData = {
  categoryId?: string;
  name?: string;
  description?: string;
  price?: number;
  stockQuantity?: number;
  imageUrls?: string[];
};

type SellerProductsQuery = {
  page?: number;
  limit?: number;
  approvalStatus?: VerificationStatus;
};

export class MarketplaceService {
  // Create Product (Subject to Admin Approval)
  static async createProduct(userId: string, data: CreateProductData) {
    const category = await prisma.category.findUnique({
      where: { id: data.categoryId },
      select: { id: true },
    });

    if (!category) {
      throw new AppError("Specified category does not exist.", 404);
    }

    const store = await prisma.store.findFirst({
      where: {
        id: data.storeId,
        sellerProfile: { userId },
        approvalStatus: "VERIFIED",
      },
      select: { id: true },
    });

    if (!store) {
      throw new AppError(
        "Store does not exist, is not verified, or does not belong to you.",
        403
      );
    }

    return prisma.product.create({
      data: {
        ...data,
        approvalStatus: "PENDING",
      },
      include: {
        category: {
          select: { id: true, name: true, slug: true },
        },
      },
    });
  }

  // Public: Retrieve an approved product detail for buyers and visitors
  static async getPublicProduct(productId: string) {
    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: {
        category: {
          select: { id: true, name: true, slug: true },
        },
        store: {
          select: {
            id: true,
            name: true,
            slug: true,
            pickupLocation: true,
            isOpen: true,
            sellerProfile: {
              select: { sellerType: true, isPaymongoVerified: true },
            },
          },
        },
      },
    });

    if (
      !product ||
      product.approvalStatus !== "VERIFIED" ||
      !product.isAvailable
    ) {
      throw new AppError("Product not found or currently unavailable.", 404);
    }

    return product;
  }

  // Seller: Retrieve all products belonging to the seller's store (with pagination and status filters)
  static async getSellerProducts(userId: string, query: SellerProductsQuery) {
    const page = query.page && query.page > 0 ? Number(query.page) : 1;
    const limit = query.limit && query.limit > 0 ? Number(query.limit) : 20;

    const store = await prisma.store.findFirst({
      where: { sellerProfile: { userId } },
      select: { id: true },
    });

    if (!store) {
      throw new AppError("You have not registered a store yet.", 404);
    }

    const where: Prisma.ProductWhereInput = {
      storeId: store.id,
      ...(query.approvalStatus ? { approvalStatus: query.approvalStatus } : {}),
    };

    const [items, total] = await Promise.all([
      prisma.product.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          category: {
            select: { id: true, name: true, slug: true },
          },
        },
      }),
      prisma.product.count({ where }),
    ]);

    return {
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // Seller: Retrieve a specific product belonging to the authenticated seller (including unapproved)
  static async getSellerProduct(userId: string, productId: string) {
    const product = await prisma.product.findFirst({
      where: {
        id: productId,
        store: { sellerProfile: { userId } },
      },
      include: {
        category: {
          select: { id: true, name: true, slug: true },
        },
        store: {
          select: { id: true, name: true, slug: true },
        },
      },
    });

    if (!product) {
      throw new AppError("Product not found in your store.", 404);
    }

    return product;
  }

  // Seller: Update a product belonging to the authenticated seller
  static async updateProduct(
    userId: string,
    productId: string,
    data: UpdateProductData
  ) {
    if (data.categoryId) {
      const category = await prisma.category.findUnique({
        where: { id: data.categoryId },
        select: { id: true },
      });

      if (!category) {
        throw new AppError("Specified category does not exist.", 404);
      }
    }

    const product = await prisma.product.findFirst({
      where: {
        id: productId,
        store: { sellerProfile: { userId } },
      },
      select: { id: true },
    });

    if (!product) {
      throw new AppError("Product not found in your store.", 404);
    }

    return prisma.product.update({
      where: { id: product.id },
      data: {
        ...data,
        approvalStatus: "PENDING",
        rejectionReason: null,
      },
    });
  }

  // Seller: Delete a product belonging to the authenticated seller
  static async deleteProduct(userId: string, productId: string) {
    const product = await prisma.product.findFirst({
      where: {
        id: productId,
        store: { sellerProfile: { userId } },
      },
      select: {
        id: true,
        _count: {
          select: { orderItems: true },
        },
      },
    });

    if (!product) {
      throw new AppError("Product not found in your store.", 404);
    }

    if (product._count.orderItems > 0) {
      throw new AppError(
        "This product cannot be deleted because it has existing order records.",
        409
      );
    }

    await prisma.product.delete({
      where: { id: product.id },
    });

    return { message: "Product deleted successfully." };
  }
}
