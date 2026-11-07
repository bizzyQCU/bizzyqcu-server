import { prisma } from "../../config/db";
import { AppError } from "../../utils/AppError";

type CreateStoreData = {
  name: string;
  description: string;
  logoUrl?: string;
  bannerUrl?: string;
  pickupLocation?: string;
};

type UpdateStoreData = {
  name?: string;
  description?: string;
  logoUrl?: string | null;
  bannerUrl?: string | null;
  pickupLocation?: string | null;
  isOpen?: boolean;
};

export class StoreService {
  // Generate a unique URL-friendly store slug
  private static async generateUniqueSlug(name: string, excludeId?: string) {
    const baseSlug =
      name
        .toLowerCase()
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "") || "store";

    let slug = baseSlug;
    let counter = 2;

    while (
      await prisma.store.findFirst({
        where: {
          slug,
          ...(excludeId ? { NOT: { id: excludeId } } : {}),
        },
        select: { id: true },
      })
    ) {
      slug = `${baseSlug}-${counter}`;
      counter++;
    }

    return slug;
  }

  // Register a store for a verified seller
  static async createStore(userId: string, data: CreateStoreData) {
    const sellerProfile = await prisma.sellerProfile.findUnique({
      where: { userId },
      select: {
        id: true,
        verificationStatus: true,
        store: { select: { id: true } },
      },
    });

    if (!sellerProfile || sellerProfile.verificationStatus !== "VERIFIED") {
      throw new AppError(
        "You must have an approved seller profile to register a store.",
        403
      );
    }

    if (sellerProfile.store) {
      throw new AppError("You already have a registered store.", 409);
    }

    const existingName = await prisma.store.findUnique({
      where: { name: data.name },
      select: { id: true },
    });

    if (existingName) {
      throw new AppError("This store name is already taken.", 409);
    }

    const slug = await this.generateUniqueSlug(data.name);

    return prisma.store.create({
      data: {
        ...data,
        slug,
        sellerProfileId: sellerProfile.id,
        approvalStatus: "PENDING",
      },
    });
  }

  // Retrieve the authenticated seller's store
  static async getMyStore(userId: string) {
    const store = await prisma.store.findFirst({
      where: {
        sellerProfile: { userId },
      },
      include: {
        sellerProfile: {
          select: {
            sellerType: true,
            verificationStatus: true,
            isPaymongoVerified: true,
          },
        },
      },
    });

    if (!store) {
      throw new AppError("You have not registered a store yet.", 404);
    }

    return store;
  }

  // Retrieve public store profile by ID
  static async getStoreById(storeId: string) {
    const store = await prisma.store.findUnique({
      where: { id: storeId },
      include: {
        sellerProfile: {
          select: {
            sellerType: true,
            isPaymongoVerified: true,
          },
        },
        products: {
          where: {
            approvalStatus: "VERIFIED",
            isAvailable: true,
          },
          select: {
            id: true,
            name: true,
            price: true,
            stockQuantity: true,
            imageUrls: true,
            category: { select: { id: true, name: true, slug: true } },
          },
        },
      },
    });

    if (!store || store.approvalStatus !== "VERIFIED") {
      throw new AppError("Store not found or not yet approved.", 404);
    }

    return store;
  }

  // Retrieve public store profile by slug
  static async getStoreBySlug(slug: string) {
    const store = await prisma.store.findUnique({
      where: { slug },
      include: {
        sellerProfile: {
          select: {
            sellerType: true,
            isPaymongoVerified: true,
          },
        },
        products: {
          where: {
            approvalStatus: "VERIFIED",
            isAvailable: true,
          },
          select: {
            id: true,
            name: true,
            price: true,
            stockQuantity: true,
            imageUrls: true,
            category: { select: { id: true, name: true, slug: true } },
          },
        },
      },
    });

    if (!store || store.approvalStatus !== "VERIFIED") {
      throw new AppError("Store not found or not yet approved.", 404);
    }

    return store;
  }

  // Update the authenticated seller's store profile
  static async updateMyStore(userId: string, data: UpdateStoreData) {
    const store = await prisma.store.findFirst({
      where: {
        sellerProfile: { userId },
      },
      select: { id: true, name: true },
    });

    if (!store) {
      throw new AppError("You have not registered a store yet.", 404);
    }

    const updateData: any = { ...data };

    if (data.name && data.name !== store.name) {
      const existingName = await prisma.store.findUnique({
        where: { name: data.name },
        select: { id: true },
      });

      if (existingName && existingName.id !== store.id) {
        throw new AppError("This store name is already taken.", 409);
      }

      updateData.name = data.name;
      updateData.slug = await this.generateUniqueSlug(data.name, store.id);
    }

    return prisma.store.update({
      where: { id: store.id },
      data: updateData,
    });
  }

  // Delete a store only if it has no existing orders
  static async deleteMyStore(userId: string) {
    const store = await prisma.store.findFirst({
      where: {
        sellerProfile: { userId },
      },
      select: {
        id: true,
        _count: {
          select: { orders: true },
        },
      },
    });

    if (!store) {
      throw new AppError("You have not registered a store yet.", 404);
    }

    if (store._count.orders > 0) {
      throw new AppError(
        "This store cannot be deleted because it has existing orders.",
        409
      );
    }

    await prisma.store.delete({
      where: { id: store.id },
    });

    return { message: "Store deleted successfully." };
  }
}
