/**
 * Money display/parse helpers.
 *
 * All monetary values travel between the API and the UI as integer minor units
 * ("santim", 1 ETB = 100 santim). Conversion happens only at the input and
 * display edges so the UI never does float arithmetic on money.
 */
export const PLATFORM_CURRENCY = "ETB";
const MINOR_UNITS_PER_MAJOR = 100;

/** Parse an admin/user-entered major-unit amount (e.g. "1,200.50") to integer santim. */
export function toSantim(amountInMajorUnits) {
    const numeric = typeof amountInMajorUnits === "string"
        ? Number(amountInMajorUnits.replace(/,/g, "").trim())
        : Number(amountInMajorUnits);
    if (!Number.isFinite(numeric) || numeric < 0) {
        return null;
    }
    return Math.round(numeric * MINOR_UNITS_PER_MAJOR);
}

/** Integer santim to a plain 2-decimal string, suitable for a form input. */
export function toMajorUnits(santim) {
    const value = Number(santim);
    if (!Number.isFinite(value)) {
        return "0.00";
    }
    return (value / MINOR_UNITS_PER_MAJOR).toFixed(2);
}

/** Human-readable display value, e.g. "ETB 1,200.00". */
export function formatSantim(santim, currency = PLATFORM_CURRENCY) {
    const value = Number(santim);
    const safe = Number.isFinite(value) ? value : 0;
    const formatted = (safe / MINOR_UNITS_PER_MAJOR).toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
    return `${currency} ${formatted}`;
}
