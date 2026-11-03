import crypto from "node:crypto";
import { env } from "../config.js";
import { ApiError } from "../lib/http.js";
import { toMajorUnits } from "../lib/money.js";

/**
 * Telebirr (Ethio Telecom) adapter.
 *
 * Telebirr's merchant API is issued during onboarding, so nothing here is
 * guessed: `TELEBIRR_BASE_URL` must be the endpoint Ethio Telecom provides, and
 * every identifier/key below comes from the merchant contract. Until those are
 * present `isConfigured()` is false and initialize/verify fail with a 503 rather
 * than pretending to work.
 *
 * Structural facts used by this adapter (per the Telebirr merchant API spec):
 *   - `sign_type: SHA256WithRSA`, signature is base64 over the serialized request.
 *   - `biz_content` is a JSON *string* nested inside the outer envelope.
 *   - Currency is always ETB; `payee_type: "5000"` and
 *     `payee_identifier_type: "04"` denote a merchant short code.
 *   - The merchant server IP must be whitelisted by Ethio Telecom, and the
 *     notify URL must be HTTPS with a certificate registered with them.
 *   - Trade status arrives as `TRADE_SUCCESS` / `TRADE_CLOSED` / `WAIT_BUYER_PAY`.
 */
export const id = "telebirr";
export const label = "Telebirr";
export const feePercent = env.TELEBIRR_FEE_PERCENT;
export const capabilities = {
    initialize: true,
    verify: true,
    webhook: true,
    // Telebirr refund support is contract-dependent and not documented publicly.
    refund: false,
    // The Cross-App flow requires the payer to confirm in the Telebirr app each
    // time; there is no merchant-initiated recurring debit.
    recurring: false,
};

const PREORDER_PATH = "/payment/v1/merchant/preOrder";
const QUERY_PATH = "/payment/v1/merchant/order/query";

function pem(value) {
    return String(value || "").replace(/\\n/g, "\n").trim();
}

export function isConfigured() {
    return Boolean(
        env.TELEBIRR_BASE_URL.trim()
        && env.TELEBIRR_MERCHANT_APP_ID.trim()
        && env.TELEBIRR_MERCHANT_CODE.trim()
        && pem(env.TELEBIRR_PRIVATE_KEY),
    );
}

function endpoint(path) {
    const base = env.TELEBIRR_BASE_URL.replace(/\/+$/, "");
    if (!base) {
        return "";
    }
    return base.includes("preOrder") || base.includes("order/query") ? base : `${base}${path}`;
}

function signPayload(serialized) {
    return crypto.sign("RSA-SHA256", Buffer.from(serialized, "utf8"), pem(env.TELEBIRR_PRIVATE_KEY)).toString("base64");
}

/** Verify a base64 SHA256WithRSA signature using the Telebirr public key. */
export function verifySignature(serialized, signature) {
    const publicKey = pem(env.TELEBIRR_PUBLIC_KEY);
    if (!publicKey || !signature) {
        return false;
    }
    try {
        return crypto.verify(
            "RSA-SHA256",
            Buffer.from(serialized, "utf8"),
            publicKey,
            Buffer.from(String(signature), "base64"),
        );
    }
    catch {
        return false;
    }
}

function safeJson(value) {
    if (!value) {
        return null;
    }
    if (typeof value === "object") {
        return value;
    }
    try {
        return JSON.parse(value);
    }
    catch {
        return null;
    }
}

function isSuccessCode(code) {
    return code === 0 || code === "0";
}

function merchantAppId() {
    return env.TELEBIRR_MERCHANT_APP_ID || env.TELEBIRR_FABRIC_APP_ID;
}

function buildEnvelope() {
    return {
        appid: merchantAppId(),
        sign_type: "SHA256WithRSA",
        timestamp: String(Math.floor(Date.now() / 1000)),
        nonce: crypto.randomBytes(16).toString("hex"),
    };
}

async function telebirrRequest(url, payload) {
    const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    });
    const text = await response.text();
    return { ok: response.ok, statusCode: response.status, payload: safeJson(text) ?? { raw: text } };
}

export async function initialize({ order, transaction, returnUrl, notifyUrl }) {
    if (!isConfigured()) {
        throw new ApiError(503, "Telebirr is not configured. Merchant credentials from Ethio Telecom are required.");
    }
    const bizContent = {
        appid: merchantAppId(),
        merch_code: env.TELEBIRR_MERCHANT_CODE,
        notify_url: env.TELEBIRR_NOTIFY_URL || notifyUrl,
        total_amount: toMajorUnits(order.totalSantim),
        merch_order_id: transaction.reference,
        trans_currency: "ETB",
        payee_type: "5000",
        trade_type: "Cross-App",
        business_type: "BuyGoods",
        payee_identifier: env.TELEBIRR_MERCHANT_CODE,
        payee_identifier_type: "04",
        timeout_express: "30m",
    };
    const envelope = buildEnvelope();
    const unsigned = { ...envelope, biz_content: JSON.stringify(bizContent) };
    const payload = { ...unsigned, sign: signPayload(JSON.stringify(unsigned)) };
    const { ok, payload: response } = await telebirrRequest(endpoint(PREORDER_PATH), payload);
    if (!ok || !isSuccessCode(response?.code)) {
        throw new ApiError(502, response?.msg || "Telebirr rejected the payment initialization.");
    }
    const biz = safeJson(response.biz_content) ?? {};
    // The Cross-App flow returns a prepay id and a receive code that the payer
    // enters in the Telebirr app. Some deployments additionally return a hosted
    // pay URL, which we prefer when present.
    const checkoutUrl = biz.toPayUrl || biz.payUrl || biz.h5PayUrl || "";
    return {
        checkoutUrl,
        providerReference: String(biz.prepay_id ?? transaction.reference),
        providerTransactionId: String(biz.prepay_id ?? ""),
        instructions: biz.receiveCode
            ? { type: "telebirr_app", receiveCode: String(biz.receiveCode), prepayId: String(biz.prepay_id ?? "") }
            : null,
        returnUrl,
        raw: response,
    };
}

export async function verify({ transaction }) {
    if (!isConfigured()) {
        throw new ApiError(503, "Telebirr is not configured. Merchant credentials from Ethio Telecom are required.");
    }
    const bizContent = {
        appid: merchantAppId(),
        merch_code: env.TELEBIRR_MERCHANT_CODE,
        merch_order_id: transaction.reference,
    };
    const envelope = buildEnvelope();
    const unsigned = { ...envelope, biz_content: JSON.stringify(bizContent) };
    const payload = { ...unsigned, sign: signPayload(JSON.stringify(unsigned)) };
    const { ok, payload: response } = await telebirrRequest(endpoint(QUERY_PATH), payload);
    if (!ok) {
        return { status: "pending", amountSantim: null, currency: "ETB", feeSantim: null, providerReference: transaction.reference, providerTransactionId: "", message: "Telebirr order query failed.", raw: response };
    }
    const biz = safeJson(response.biz_content) ?? {};
    const tradeStatus = String(biz.trade_status ?? "").toUpperCase();
    let status = "pending";
    if (tradeStatus === "TRADE_SUCCESS") {
        status = "success";
    }
    else if (tradeStatus === "TRADE_CLOSED" || tradeStatus === "TRADE_FINISHED") {
        status = "failed";
    }
    const numericAmount = Number(biz.total_amount);
    return {
        status,
        amountSantim: Number.isFinite(numericAmount) && numericAmount >= 0 ? Math.round(numericAmount * 100) : null,
        currency: "ETB",
        feeSantim: null,
        providerReference: String(biz.prepay_id ?? transaction.reference ?? ""),
        providerTransactionId: String(biz.payment_order_id ?? ""),
        message: String(response?.msg ?? ""),
        raw: response,
    };
}

export function parseWebhook({ headers, rawBody, body }) {
    const payload = body ?? {};
    const providedSignature = payload.sign || headers?.["x-telebirr-signature"] || "";
    // Telebirr signs the envelope without the `sign` field itself.
    const { sign: _omitted, ...unsigned } = payload;
    const signatureValid = verifySignature(JSON.stringify(unsigned), providedSignature);
    const biz = safeJson(payload.biz_content) ?? {};
    const tradeStatus = String(biz.trade_status ?? "").toUpperCase();
    let status = "pending";
    if (tradeStatus === "TRADE_SUCCESS") {
        status = "success";
    }
    else if (tradeStatus === "TRADE_CLOSED" || tradeStatus === "TRADE_FINISHED") {
        status = "failed";
    }
    const numericAmount = Number(biz.total_amount);
    return {
        signatureValid,
        reference: String(biz.merch_order_id ?? ""),
        providerReference: String(biz.prepay_id ?? ""),
        providerEventId: String(biz.payment_order_id ?? biz.merch_order_id ?? ""),
        status,
        amountSantim: Number.isFinite(numericAmount) && numericAmount >= 0 ? Math.round(numericAmount * 100) : null,
        currency: "ETB",
        raw: payload,
    };
}

export async function refund() {
    // Contract dependent; not publicly documented. Recorded out of band.
    return { supported: false, providerRefundReference: "", raw: null };
}
