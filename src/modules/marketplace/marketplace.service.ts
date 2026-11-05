
import { prisma } from "../../config/db";
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

export class MarketplaceService {
  // Create Product (Subject to Admin Approval)
  static async createProduct(userId: string, data: CreateProductData) {
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
    });
  }

  // Retrieve a product belonging to the authenticated seller
  static async getProduct(userId: string, productId: string) {
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

  // Update a product belonging to the authenticated seller
  static async updateProduct(
    userId: string,
    productId: string,
    data: UpdateProductData
  ) {
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

  // Delete a product belonging to the authenticated seller
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
