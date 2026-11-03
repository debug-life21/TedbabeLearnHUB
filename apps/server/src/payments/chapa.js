import crypto from "node:crypto";
import { env } from "../config.js";
import { ApiError } from "../lib/http.js";
import { toMajorUnits } from "../lib/money.js";

/**
 * Chapa payment adapter.
 *
 * Verified against the public Chapa API documentation:
 *   initialize  POST {base}/transaction/initialize   (Bearer secret key)
 *   verify      GET  {base}/transaction/verify/<tx_ref>
 *   webhook     header `x-chapa-signature` = HMAC-SHA256(raw body, webhook secret), lowercase hex
 *
 * Chapa does NOT publish a public refund API, so `refund` is reported as an
 * unsupported capability rather than being faked. Refunds are recorded in the
 * platform and settled through the Chapa dashboard / merchant support.
 */
export const id = "chapa";
export const label = "Chapa";
export const feePercent = env.CHAPA_FEE_PERCENT;
export const capabilities = {
    initialize: true,
    verify: true,
    webhook: true,
    refund: false,
    // Chapa has no universally available merchant-initiated recurring debit, so
    // the platform never auto-charges: renewals are new student-paid orders.
    recurring: false,
};

/** Chapa treats amounts as major units (e.g. 100.00 ETB), not minor units. */
function safeSantim(value) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric < 0) {
        return null;
    }
    return Math.round(numeric * 100);
}

function timingSafeEqualText(expected, provided) {
    const a = Buffer.from(String(expected), "utf8");
    const b = Buffer.from(String(provided), "utf8");
    if (a.length !== b.length) {
        return false;
    }
    return crypto.timingSafeEqual(a, b);
}

function baseUrl() {
    return env.CHAPA_BASE_URL.replace(/\/+$/, "");
}

export function isConfigured() {
    return Boolean(env.CHAPA_SECRET_KEY.trim());
}

async function chapaRequest(path, { method = "GET", body } = {}) {
    const response = await fetch(`${baseUrl()}${path}`, {
        method,
        headers: {
            Authorization: `Bearer ${env.CHAPA_SECRET_KEY}`,
            "Content-Type": "application/json",
        },
        body: body ? JSON.stringify(body) : undefined,
    });
    const text = await response.text();
    let payload = null;
    try {
        payload = text ? JSON.parse(text) : null;
    }
    catch {
        payload = { raw: text };
    }
    return { ok: response.ok, statusCode: response.status, payload };
}

/** Return the response header regardless of the casing Express used. */
function headerValue(headers, names) {
    for (const name of names) {
        const value = headers?.[name];
        if (value) {
            return String(value);
        }
    }
    return "";
}

export async function initialize({ order, transaction, student, returnUrl, notifyUrl }) {
    if (!isConfigured()) {
        throw new ApiError(503, "Chapa is not configured. Set CHAPA_SECRET_KEY before accepting payments.");
    }
    const fullName = String(student?.fullName || "TedbabeLearnHUB Student").trim();
    const [firstName, ...rest] = fullName.split(/\s+/);
    const body = {
        amount: toMajorUnits(order.totalSantim),
        currency: order.currency,
        email: student?.email || "",
        first_name: firstName || "Student",
        last_name: rest.join(" ") || "Learner",
        tx_ref: transaction.reference,
        callback_url: notifyUrl,
        return_url: returnUrl,
        customization: {
            title: "TedbabeLearnHUB",
            description: order.items.map((item) => item.title).join(", ").slice(0, 120),
        },
    };
    if (student?.phoneNumber) {
        body.phone_number = student.phoneNumber;
    }
    const { ok, payload } = await chapaRequest("/transaction/initialize", { method: "POST", body });
    const checkoutUrl = payload?.data?.checkout_url;
    if (!ok || payload?.status !== "success" || !checkoutUrl) {
        throw new ApiError(502, payload?.message || "Chapa rejected the payment initialization.");
    }
    return {
        checkoutUrl,
        // Chapa keys the transaction by the tx_ref we sent.
        providerReference: transaction.reference,
        providerTransactionId: String(payload?.data?.reference ?? ""),
        raw: payload,
    };
}

export async function verify({ transaction }) {
    const { ok, payload } = await chapaRequest(`/transaction/verify/${encodeURIComponent(transaction.reference)}`);
    const data = payload?.data ?? null;
    const envelopeOk = ok && payload?.status === "success" && data;
    const rawStatus = String(data?.status ?? "").toLowerCase();
    let status = "pending";
    if (envelopeOk) {
        if (rawStatus === "success") {
            status = "success";
        }
        else if (rawStatus === "failed") {
            status = "failed";
        }
        else if (rawStatus === "cancelled" || rawStatus === "canceled") {
            status = "cancelled";
        }
    }
    return {
        status,
        amountSantim: safeSantim(data?.amount),
        currency: data?.currency ?? null,
        feeSantim: safeSantim(data?.charge),
        providerReference: String(data?.reference ?? transaction.reference ?? ""),
        providerTransactionId: String(data?.reference ?? ""),
        message: payload?.message ?? "",
        raw: payload,
    };
}

export function parseWebhook({ headers, rawBody, body }) {
    const secret = env.CHAPA_WEBHOOK_SECRET.trim();
    const provided = headerValue(headers, ["x-chapa-signature", "chapa-signature"]).trim().toLowerCase();
    let signatureValid = false;
    if (secret && provided && rawBody) {
        const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
        signatureValid = timingSafeEqualText(expected, provided);
    }
    const payload = body ?? {};
    const rawStatus = String(payload.status ?? "").toLowerCase();
    let status = "pending";
    if (rawStatus === "success") {
        status = "success";
    }
    else if (rawStatus === "failed") {
        status = "failed";
    }
    else if (rawStatus === "cancelled" || rawStatus === "canceled") {
        status = "cancelled";
    }
    return {
        signatureValid,
        reference: String(payload.tx_ref ?? ""),
        providerReference: String(payload.reference ?? ""),
        providerEventId: String(payload.reference ?? payload.tx_ref ?? ""),
        status,
        amountSantim: safeSantim(payload.amount),
        currency: payload.currency ?? null,
        raw: payload,
    };
}

export async function refund() {
    // Deliberately unimplemented: Chapa does not document a public refund API.
    return { supported: false, providerRefundReference: "", raw: null };
}
