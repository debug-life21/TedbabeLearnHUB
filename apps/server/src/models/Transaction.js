import mongoose, { Schema } from "mongoose";

export const transactionStatuses = [
    "initialized",
    "pending",
    "success",
    "failed",
    "cancelled",
    "expired",
    "refunded",
    "partially_refunded",
];

/**
 * A payment attempt against an order. One order may have several transactions
 * (a student can retry after a failure), but a successful transaction is
 * terminal: `idempotencyKey` is unique so a replayed callback can never create
 * a second charge record, and `providerReference` is unique per provider so a
 * webhook cannot be applied twice.
 *
 * Status is only ever written by server-side verification or a signature-valid
 * webhook. Client-supplied status is never persisted.
 */
const transactionSchema = new Schema({
    order: { type: Schema.Types.ObjectId, ref: "Order", required: true, index: true },
    student: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    provider: { type: String, required: true, trim: true, index: true },
    environment: { type: String, enum: ["sandbox", "live"], default: "sandbox", index: true },
    // The reference we send to the gateway (mirrors Order.reference for the
    // first attempt; retries append a suffix).
    reference: { type: String, required: true, trim: true },
    idempotencyKey: { type: String, required: true, unique: true, trim: true },
    // Gateway-side identifiers. Empty until the gateway responds.
    providerReference: { type: String, default: "", trim: true },
    providerTransactionId: { type: String, default: "", trim: true },
    checkoutUrl: { type: String, default: "" },
    // Provider-specific instructions when there is no hosted checkout URL
    // (e.g. Telebirr Cross-App returns a receive code for the Telebirr app).
    instructions: { type: Schema.Types.Mixed, default: null },
    amountSantim: { type: Number, required: true, min: 0 },
    feeSantim: { type: Number, default: 0, min: 0 },
    netSantim: { type: Number, default: 0, min: 0 },
    currency: { type: String, default: "ETB", uppercase: true },
    status: { type: String, enum: transactionStatuses, default: "initialized", index: true },
    failureReason: { type: String, default: "" },
    attempt: { type: Number, default: 1, min: 1 },
    initializedAt: { type: Date, default: Date.now },
    verifiedAt: { type: Date, default: null },
    paidAt: { type: Date, default: null, index: true },
    // Raw gateway payloads, kept for reconciliation and dispute handling.
    rawInitialize: { type: Schema.Types.Mixed, default: null },
    rawVerification: { type: Schema.Types.Mixed, default: null },
    verificationSource: { type: String, enum: ["", "verify_api", "webhook", "admin"], default: "" },
}, { timestamps: true });

transactionSchema.index({ student: 1, createdAt: -1 });
transactionSchema.index({ status: 1, paidAt: -1 });
// A gateway reference must identify at most one transaction per provider.
transactionSchema.index(
    { provider: 1, providerReference: 1 },
    { unique: true, partialFilterExpression: { providerReference: { $type: "string", $ne: "" } } },
);

export const TransactionModel = mongoose.model("Transaction", transactionSchema);
