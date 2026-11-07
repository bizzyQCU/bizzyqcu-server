import { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { CategoryService } from "./category.service";

export class CategoryController {
  // Create category
  static createCategory = asyncHandler(
    async (req: Request, res: Response) => {
      const category = await CategoryService.createCategory(req.body.name);

      res.status(201).json({
        success: true,
        message: "Category created successfully.",
        data: category,
      });
    }
  );

  // Get all categories
  static getAllCategories = asyncHandler(
    async (req: Request, res: Response) => {
      const categories = await CategoryService.getAllCategories();

      res.status(200).json({
        success: true,
        data: categories,
      });
    }
  );

  // Get category by ID
  static getCategoryById = asyncHandler(
    async (req: Request, res: Response) => {
      const category = await CategoryService.getCategoryById(
        String(req.params.id)
      );

      res.status(200).json({
        success: true,
        data: category,
      });
    }
  );

  // Update category
  static updateCategory = asyncHandler(
    async (req: Request, res: Response) => {
      const category = await CategoryService.updateCategory(
        String(req.params.id),
        req.body.name
      );

      res.status(200).json({
        success: true,
        message: "Category updated successfully.",
        data: category,
      });
    }
  );

  // Delete category
  static deleteCategory = asyncHandler(
    async (req: Request, res: Response) => {
      const result = await CategoryService.deleteCategory(
        String(req.params.id)
      );

      res.status(200).json({
        success: true,
        ...result,
      });
    }
  );
}