import mongoose, { Schema } from "mongoose";

export const orderStatuses = [
    "pending",
    "processing",
    "paid",
    "failed",
    "cancelled",
    "expired",
    "refunded",
    "partially_refunded",
];

/**
 * Every order line points at either a Course (one-time course purchase) or a
 * Plan (package, tutoring, live class, resource, certificate, subscription).
 * Prices are snapshotted so later catalogue edits never rewrite history.
 */
const orderItemSchema = new Schema({
    itemType: { type: String, enum: ["course", "plan"], required: true },
    itemId: { type: Schema.Types.ObjectId, required: true },
    title: { type: String, required: true, trim: true },
    unitPriceSantim: { type: Number, required: true, min: 0 },
    quantity: { type: Number, required: true, min: 1, default: 1 },
    subtotalSantim: { type: Number, required: true, min: 0 },
}, { _id: false });

const orderSchema = new Schema({
    // Human-readable, unique reference used as the gateway `tx_ref` as well.
    reference: { type: String, required: true, unique: true, trim: true, index: true },
    student: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    items: { type: [orderItemSchema], default: [] },
    subtotalSantim: { type: Number, required: true, min: 0 },
    discountSantim: { type: Number, default: 0, min: 0 },
    totalSantim: { type: Number, required: true, min: 0 },
    currency: { type: String, default: "ETB", uppercase: true },
    promotion: {
        promotionId: { type: Schema.Types.ObjectId, ref: "Promotion", default: null },
        code: { type: String, default: "" },
    },
    status: { type: String, enum: orderStatuses, default: "pending", index: true },
    provider: { type: String, default: "", index: true },
    // Entitlements are only granted when a payment is verified server-side.
    paidAt: { type: Date, default: null, index: true },
    cancelledAt: { type: Date, default: null },
    expiresAt: { type: Date, default: null },
    // Set once entitlements have been granted, guaranteeing single fulfilment.
    fulfilledAt: { type: Date, default: null },
    fulfillmentStartedAt: { type: Date, default: null },
    environment: { type: String, enum: ["sandbox", "live"], default: "sandbox", index: true },
    notes: { type: String, default: "" },
}, { timestamps: true });

orderSchema.index({ student: 1, createdAt: -1 });
orderSchema.index({ status: 1, createdAt: -1 });

export const OrderModel = mongoose.model("Order", orderSchema);
