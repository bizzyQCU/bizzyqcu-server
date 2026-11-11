import { Request, Response, NextFunction } from "express";
import { ZodType, ZodError } from "zod";

/** Returns the Zod-validated query when `validate` ran, falling back to `req.query`. */
export const getValidatedQuery = <T = Record<string, unknown>>(
  req: Request,
  res: Response
): T => (res.locals.validatedQuery ?? req.query) as T;

export const validate =
  (schema: ZodType) =>
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = (await schema.parseAsync({
        body: req.body,
        query: req.query,
        params: req.params,
      })) as {
        body?: unknown;
        query?: unknown;
        params?: Record<string, string>;
      };

      if (parsed.body !== undefined) {
        req.body = parsed.body;
      }
      // Express 5 exposes req.query as a computed getter; store transformed query in res.locals.
      if (parsed.query !== undefined) {
        res.locals.validatedQuery = parsed.query;
      }
      if (parsed.params !== undefined && req.params) {
        Object.assign(req.params, parsed.params);
      }

      next();
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          success: false,
          message: "Validation failed",
          errors: error.issues.map((issue) => ({
            field: issue.path.join("."),
            message: issue.message,
          })),
        });
      }
      next(error);
    }
  };
