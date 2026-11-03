/**
 * Money utilities.
 *
 * All monetary values are stored in the database as integer minor units
 * ("santim", 1 ETB = 100 santim). Floating point arithmetic is never performed
 * on money: conversion happens only at the edges (parsing admin input, building
 * a gateway payload, formatting for display).
 */
export const PLATFORM_CURRENCY = "ETB";
const MINOR_UNITS_PER_MAJOR = 100;

/** Throw unless `value` is a non-negative integer number of santim. */
export function assertSantim(value, label = "amount") {
    if (!Number.isInteger(value) || value < 0) {
        throw new Error(`${label} must be a non-negative integer number of santim.`);
    }
    return value;
}

/** Convert a major-unit amount (e.g. 1200.5 ETB) to integer santim. */
export function toSantim(amountInMajorUnits) {
    const numeric = typeof amountInMajorUnits === "string"
        ? Number(amountInMajorUnits.replace(/,/g, "").trim())
        : Number(amountInMajorUnits);
    if (!Number.isFinite(numeric) || numeric < 0) {
        throw new Error("Amount must be a non-negative number.");
    }
    return Math.round(numeric * MINOR_UNITS_PER_MAJOR);
}

/** Convert integer santim to a 2-decimal major-unit string for gateway payloads. */
export function toMajorUnits(santim) {
    assertSantim(santim);
    return (santim / MINOR_UNITS_PER_MAJOR).toFixed(2);
}

/** Human-readable display value, e.g. "ETB 1,200.00". Display only. */
export function formatSantim(santim, currency = PLATFORM_CURRENCY) {
    assertSantim(santim);
    const formatted = (santim / MINOR_UNITS_PER_MAJOR).toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
    return `${currency} ${formatted}`;
}

export function sumSantim(values = []) {
    return values.reduce((total, value) => total + (Number.isInteger(value) ? value : 0), 0);
}

/** Integer percent of a santim amount, rounded to the nearest santim. */
export function percentOfSantim(santim, percent) {
    assertSantim(santim);
    const numericPercent = Number(percent);
    if (!Number.isFinite(numericPercent) || numericPercent < 0) {
        return 0;
    }
    return Math.round((santim * numericPercent) / 100);
}

/**
 * Resolve the santim discount produced by a promotion for a given subtotal.
 * Pure function: takes a plain { discountType, discountValue } object.
 * The result can never exceed the subtotal.
 */
export function computeDiscountSantim(subtotalSantim, promotion) {
    assertSantim(subtotalSantim, "subtotalSantim");
    if (!promotion || subtotalSantim <= 0) {
        return 0;
    }
    const value = Number(promotion.discountValue);
    if (!Number.isFinite(value) || value <= 0) {
        return 0;
    }
    const raw = promotion.discountType === "percent"
        ? percentOfSantim(subtotalSantim, value)
        : Math.round(value);
    return Math.min(Math.max(raw, 0), subtotalSantim);
}

/** Net revenue for a single settled transaction: gross - gateway fee. */
export function computeNetSantim(grossSantim, feeSantim = 0) {
    assertSantim(grossSantim, "grossSantim");
    assertSantim(feeSantim, "feeSantim");
    return Math.max(grossSantim - feeSantim, 0);
}
