import mongoose, { Schema } from "mongoose";

export const refundStatuses = ["requested", "approved", "rejected", "processing", "processed", "failed"];

/**
 * A refund record. Chapa exposes a payout/refund API; Telebirr refund support is
 * merchant-contract dependent, so `providerCapable` records whether the gateway
 * call was possible. When it is not, the refund is still recorded and settled
 * out of band, and that fact is explicit rather than silently ignored.
 */
const refundSchema = new Schema({
    order: { type: Schema.Types.ObjectId, ref: "Order", required: true, index: true },
    transaction: { type: Schema.Types.ObjectId, ref: "Transaction", default: null, index: true },
    student: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    amountSantim: { type: Number, required: true, min: 0 },
    currency: { type: String, default: "ETB", uppercase: true },
    reason: { type: String, required: true, trim: true },
    status: { type: String, enum: refundStatuses, default: "requested", index: true },
    providerCapable: { type: Boolean, default: false },
    providerRefundReference: { type: String, default: "", trim: true },
    providerResponse: { type: Schema.Types.Mixed, default: null },
    requestedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    processedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    processedAt: { type: Date, default: null, index: true },
    notes: { type: String, default: "" },
}, { timestamps: true });

refundSchema.index({ createdAt: -1 });

export const RefundModel = mongoose.model("Refund", refundSchema);
