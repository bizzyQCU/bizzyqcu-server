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

function normalizePagination(page: number = 1, limit: number = 20) {
  const safePage = Math.max(1, Math.trunc(Number(page)) || 1);
  const safeLimit = Math.min(100, Math.max(1, Math.trunc(Number(limit)) || 20));
  return { page: safePage, limit: safeLimit };
}

export function buildPagination(
  page: number = 1,
  limit: number = 20,
  total: number = 0
): PaginationMeta {
  const { page: p, limit: l } = normalizePagination(page, limit);
  const totalPages = total === 0 ? 0 : Math.ceil(total / l);
  return {
    page: p,
    limit: l,
    total,
    totalPages,
    hasNextPage: p < totalPages,
    hasPrevPage: p > 1,
  };
}

/** Prisma skip/take for a validated page/limit pair. */
export function skipTake(page: number = 1, limit: number = 20) {
  const { page: p, limit: l } = normalizePagination(page, limit);
  return { skip: (p - 1) * l, take: l };
}
