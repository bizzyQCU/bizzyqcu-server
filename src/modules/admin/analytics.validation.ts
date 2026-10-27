import { z } from "zod";

/** Accepts `YYYY-MM-DD` or a full ISO-8601 timestamp. */
const isoDate = z
  .string()
  .trim()
  .refine((value) => !Number.isNaN(Date.parse(value)), "Invalid date (use YYYY-MM-DD or ISO-8601)");

const rangeShape = {
  from: isoDate.optional(),
  to: isoDate.optional(),
};

const withRangeCheck = <T extends z.ZodTypeAny>(schema: T) =>
  schema.refine(
    (value: any) => {
      if (!value.from || !value.to) return true;
      return Date.parse(value.from) <= Date.parse(value.to);
    },
    { message: "`from` must be earlier than or equal to `to`", path: ["from"] }
  );

export const salesAnalyticsSchema = z.object({
  query: withRangeCheck(
    z.object({
      ...rangeShape,
      groupBy: z.enum(["day", "week", "month"]).default("day"),
    })
  ),
});

export const storesAnalyticsSchema = z.object({
  query: withRangeCheck(z.object({ ...rangeShape })),
});

export const demandAnalyticsSchema = z.object({
  query: withRangeCheck(
    z.object({
      ...rangeShape,
      limit: z.coerce.number().int().positive().max(50).default(10),
    })
  ),
});

export type SalesAnalyticsQuery = z.infer<typeof salesAnalyticsSchema>["query"];
export type StoresAnalyticsQuery = z.infer<typeof storesAnalyticsSchema>["query"];
export type DemandAnalyticsQuery = z.infer<typeof demandAnalyticsSchema>["query"];

export const parseSalesQuery = (query: unknown) => salesAnalyticsSchema.shape.query.parse(query);
export const parseStoresQuery = (query: unknown) =>
  storesAnalyticsSchema.shape.query.parse(query);
export const parseDemandQuery = (query: unknown) =>
  demandAnalyticsSchema.shape.query.parse(query);
