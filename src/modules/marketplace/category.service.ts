import { prisma } from "../../config/db";
import { AppError } from "../../utils/AppError";

export class CategoryService {
  // Generate a URL-friendly unique slug
  static async generateUniqueSlug(name: string, excludeId?: string) {
    const baseSlug = name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

    let slug = baseSlug;
    let counter = 1;

    while (true) {
      const existingCategory = await prisma.category.findFirst({
        where: {
          slug,
          ...(excludeId ? { NOT: { id: excludeId } } : {}),
        },
        select: { id: true },
      });

      if (!existingCategory) {
        return slug;
      }

      slug = `${baseSlug}-${counter}`;
      counter++;
    }
  }

  // Create category
  static async createCategory(name: string) {
    const existingCategory = await prisma.category.findUnique({
      where: { name },
    });

    if (existingCategory) {
      throw new AppError("Category name already exists.", 409);
    }

    const slug = await this.generateUniqueSlug(name);

    return prisma.category.create({
      data: {
        name,
        slug,
      },
    });
  }

  // Get all categories
  static async getAllCategories() {
    return prisma.category.findMany({
      orderBy: {
        name: "asc",
      },
      include: {
        _count: {
          select: {
            products: true,
          },
        },
      },
    });
  }

  // Get category by ID
  static async getCategoryById(id: string) {
    const category = await prisma.category.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            products: true,
          },
        },
      },
    });

    if (!category) {
      throw new AppError("Category not found.", 404);
    }

    return category;
  }

  // Update category
  static async updateCategory(id: string, name: string) {
    const category = await prisma.category.findUnique({
      where: { id },
    });

    if (!category) {
      throw new AppError("Category not found.", 404);
    }

    const existingCategory = await prisma.category.findUnique({
      where: { name },
    });

    if (existingCategory && existingCategory.id !== id) {
      throw new AppError("Category name already exists.", 409);
    }

    const slug = await this.generateUniqueSlug(name, id);

    return prisma.category.update({
      where: { id },
      data: {
        name,
        slug,
      },
    });
  }

  // Delete category
  static async deleteCategory(id: string) {
    const category = await prisma.category.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            products: true,
          },
        },
      },
    });

    if (!category) {
      throw new AppError("Category not found.", 404);
    }

    if (category._count.products > 0) {
      throw new AppError(
        "Cannot delete a category that has existing products.",
        409
      );
    }

    await prisma.category.delete({
      where: { id },
    });

    return {
      message: "Category deleted successfully.",
    };
  }
}