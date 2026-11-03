import { randomBytes } from "node:crypto";
import { z } from "zod";

export const recurrenceSchema = z.object({
    pattern: z.enum(["none", "weekly"]).default("none"),
    intervalWeeks: z.number().int().min(1).max(8).default(1),
    occurrences: z.number().int().min(1).max(52).default(1),
}).default({ pattern: "none", intervalWeeks: 1, occurrences: 1 });

export const MAX_RECURRENCE_OCCURRENCES = 52;

/**
 * Expand a start/end pair into the concrete list of sessions for a weekly series.
 * Time-of-day is preserved using UTC date arithmetic so weekly slots stay stable.
 */
export function buildRecurringSessions({ startsAt, endsAt, recurrence }) {
    const pattern = recurrence?.pattern === "weekly" ? "weekly" : "none";
    const intervalWeeks = Math.min(Math.max(recurrence?.intervalWeeks ?? 1, 1), 8);
    const occurrences = pattern === "weekly"
        ? Math.min(Math.max(recurrence?.occurrences ?? 1, 1), MAX_RECURRENCE_OCCURRENCES)
        : 1;
    const durationMs = endsAt.getTime() - startsAt.getTime();
    const seriesId = occurrences > 1 ? randomBytes(8).toString("hex") : "";
    return Array.from({ length: occurrences }, (_, index) => {
        const start = new Date(startsAt.getTime());
        if (index > 0) {
            start.setUTCDate(start.getUTCDate() + index * intervalWeeks * 7);
        }
        return {
            startsAt: start,
            endsAt: new Date(start.getTime() + durationMs),
            seriesId,
            recurrencePattern: pattern,
            recurrenceIntervalWeeks: intervalWeeks,
            recurrenceCount: occurrences,
            recurrenceIndex: index,
        };
    });
}
