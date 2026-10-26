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
const withRangeCheck = (schema) => schema.refine((value) => {
    if (!value.from || !value.to)
        return true;
    return Date.parse(value.from) <= Date.parse(value.to);
}, { message: "`from` must be earlier than or equal to `to`", path: ["from"] });
export const salesAnalyticsSchema = z.object({
    query: withRangeCheck(z.object({
        ...rangeShape,
        groupBy: z.enum(["day", "week", "month"]).default("day"),
    })),
});
export const storesAnalyticsSchema = z.object({
    query: withRangeCheck(z.object({ ...rangeShape })),
});
export const demandAnalyticsSchema = z.object({
    query: withRangeCheck(z.object({
        ...rangeShape,
        limit: z.coerce.number().int().positive().max(50).default(10),
    })),
});
export const parseSalesQuery = (query) => salesAnalyticsSchema.shape.query.parse(query);
export const parseStoresQuery = (query) => storesAnalyticsSchema.shape.query.parse(query);
export const parseDemandQuery = (query) => demandAnalyticsSchema.shape.query.parse(query);
