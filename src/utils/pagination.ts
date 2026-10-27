import { z } from "zod";

/** Reusable page/limit query schema. Every admin list endpoint extends this. */
export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export type PaginationQuery = z.infer<typeof paginationSchema>;

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export function buildPagination(
  page: number,
  limit: number,
  total: number
): PaginationMeta {
  const totalPages = total === 0 ? 0 : Math.ceil(total / limit);
  return {
    page,
    limit,
    total,
    totalPages,
    hasNextPage: page < totalPages,
    hasPrevPage: page > 1,
  };
}

/** Prisma skip/take for a validated page/limit pair. */
export function skipTake(page: number, limit: number) {
  return { skip: (page - 1) * limit, take: limit };
}
