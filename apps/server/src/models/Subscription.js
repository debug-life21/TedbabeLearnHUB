import mongoose, { Schema } from "mongoose";

export const subscriptionStatuses = ["pending", "active", "grace_period", "expired", "cancelled"];

const subscriptionEventSchema = new Schema({
    type: {
        type: String,
        enum: ["created", "activated", "renewed", "cancelled", "expired", "reinstated", "upgraded", "downgraded", "payment_failed"],
        required: true,
    },
    at: { type: Date, default: Date.now },
    note: { type: String, default: "" },
    fromPlan: { type: Schema.Types.ObjectId, ref: "Plan", default: null },
    toPlan: { type: Schema.Types.ObjectId, ref: "Plan", default: null },
    order: { type: Schema.Types.ObjectId, ref: "Order", default: null },
}, { _id: false });

/**
 * A recurring access plan held by a student.
 *
 * The platform never charges a card or wallet automatically. Every renewal is a
 * new Order that the student pays for through the provider, because Telebirr and
 * Chapa do not offer universally available merchant-initiated recurring debits.
 * A configurable grace period keeps access alive between period end and renewal.
 */
const subscriptionSchema = new Schema({
    student: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    plan: { type: Schema.Types.ObjectId, ref: "Plan", required: true, index: true },
    planCode: { type: String, default: "", trim: true },
    interval: { type: String, enum: ["month", "quarter", "year"], required: true },
    status: { type: String, enum: subscriptionStatuses, default: "pending", index: true },
    provider: { type: String, default: "", trim: true },
    startedAt: { type: Date, default: null },
    currentPeriodStart: { type: Date, default: null },
    currentPeriodEnd: { type: Date, default: null, index: true },
    gracePeriodDays: { type: Number, default: 0, min: 0 },
    gracePeriodEndsAt: { type: Date, default: null, index: true },
    cancelAtPeriodEnd: { type: Boolean, default: false },
    cancelledAt: { type: Date, default: null },
    cancelledReason: { type: String, default: "" },
    renewalCount: { type: Number, default: 0, min: 0 },
    lastOrder: { type: Schema.Types.ObjectId, ref: "Order", default: null },
    lastReminderSentAt: { type: Date, default: null },
    history: { type: [subscriptionEventSchema], default: [] },
}, { timestamps: true });

subscriptionSchema.index({ student: 1, status: 1 });
// One live subscription per student per plan; historical rows are expired first.
subscriptionSchema.index(
    { student: 1, plan: 1 },
    { unique: true, partialFilterExpression: { status: { $in: ["pending", "active", "grace_period"] } } },
);

/** The timestamp at which access ends, accounting for a configured grace period. */
subscriptionSchema.methods.accessEndsAt = function () {
    if (this.gracePeriodEndsAt) {
        return this.gracePeriodEndsAt;
    }
    return this.currentPeriodEnd;
};

export const SubscriptionModel = mongoose.model("Subscription", subscriptionSchema);
