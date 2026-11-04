import { randomBytes } from "node:crypto";
import { z } from "zod";

// Supported cadences. "weekly"/"biweekly" keep a stable day-of-week slot;
// "monthly" keeps a stable day-of-month (clamped to the last day of shorter
// months); "daily" repeats every N days.
export const RECURRENCE_PATTERNS = [
    "none",
    "daily",
    "weekly",
    "biweekly",
    "monthly",
];

export const RECURRENCE_LABELS = {
    none: "Does not repeat",
    daily: "Every day",
    weekly: "Every week",
    biweekly: "Every 2 weeks",
    monthly: "Every month",
};

export const MAX_RECURRENCE_OCCURRENCES = 120;

export const recurrenceSchema = z
    .object({
        pattern: z.enum(RECURRENCE_PATTERNS).default("none"),
        // Number of days / weeks / months between occurrences, based on pattern.
        interval: z.number().int().min(1).max(12).optional(),
        // Legacy field kept so older clients continue to work.
        intervalWeeks: z.number().int().min(1).max(8).optional(),
        occurrences: z.number().int().min(1).max(MAX_RECURRENCE_OCCURRENCES).default(1),
    })
    .default({ pattern: "none", occurrences: 1 });

function clamp(value, min, max) {
    const number = Number(value);
    if (!Number.isFinite(number)) return min;
    return Math.min(Math.max(Math.trunc(number), min), max);
}

/**
 * Add whole months to a UTC date while keeping the time-of-day stable. If the
 * target month is shorter than the starting day (e.g. Jan 31 + 1 month), the
 * date clamps to that month's final day.
 */
function addUtcMonths(date, months) {
    const result = new Date(date.getTime());
    const targetDay = result.getUTCDate();
    result.setUTCDate(1);
    result.setUTCMonth(result.getUTCMonth() + months);
    const lastDay = new Date(
        Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0),
    ).getUTCDate();
    result.setUTCDate(Math.min(targetDay, lastDay));
    return result;
}

/**
 * Expand a start/end pair into the concrete list of sessions for a recurring
 * series. Time-of-day is preserved using UTC date arithmetic so recurring
 * slots stay stable regardless of server time zone.
 */
export function buildRecurringSessions({ startsAt, endsAt, recurrence }) {
    const pattern = RECURRENCE_PATTERNS.includes(recurrence?.pattern)
        ? recurrence.pattern
        : "none";
    const interval = clamp(
        recurrence?.interval ?? recurrence?.intervalWeeks ?? 1,
        1,
        12,
    );
    const occurrences =
        pattern === "none"
            ? 1
            : clamp(recurrence?.occurrences ?? 1, 1, MAX_RECURRENCE_OCCURRENCES);
    const durationMs = endsAt.getTime() - startsAt.getTime();
    const seriesId = occurrences > 1 ? randomBytes(8).toString("hex") : "";
    // Normalise the legacy week-based field for backwards compatibility with
    // any code still reading recurrenceIntervalWeeks.
    const intervalWeeks =
        pattern === "weekly" ? interval : pattern === "biweekly" ? interval * 2 : 1;

    return Array.from({ length: occurrences }, (_, index) => {
        let start;
        if (index === 0) {
            start = new Date(startsAt.getTime());
        } else if (pattern === "monthly") {
            start = addUtcMonths(startsAt, index * interval);
        } else {
            const daysPerStep =
                pattern === "daily"
                    ? interval
                    : pattern === "weekly"
                        ? interval * 7
                        : pattern === "biweekly"
                            ? interval * 14
                            : 0;
            start = new Date(startsAt.getTime());
            start.setUTCDate(start.getUTCDate() + index * daysPerStep);
        }
        return {
            startsAt: start,
            endsAt: new Date(start.getTime() + durationMs),
            seriesId,
            recurrencePattern: pattern,
            recurrenceInterval: interval,
            recurrenceIntervalWeeks: intervalWeeks,
            recurrenceCount: occurrences,
            recurrenceIndex: index,
        };
    });
}
