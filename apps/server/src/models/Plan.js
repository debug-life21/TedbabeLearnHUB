import mongoose, { Schema } from "mongoose";

/**
 * A monetization plan: any sellable offering that is not a bare course purchase.
 * Course pricing itself lives on the Course document (isFree / priceSantim).
 *
 * kinds:
 *  - package      premium learning package bundling several courses
 *  - tutoring     private one-to-one tutoring
 *  - live_class   paid live class / workshop seat
 *  - resource     digital learning resource
 *  - certificate  paid certificate issuance
 *  - subscription recurring access plan (interval required)
 */
export const planKinds = ["package", "tutoring", "live_class", "resource", "certificate", "subscription"];
export const planIntervals = ["none", "month", "quarter", "year"];

const planSchema = new Schema({
    code: { type: String, required: true, unique: true, trim: true, uppercase: true, index: true },
    name: { type: String, required: true, trim: true },
    kind: { type: String, enum: planKinds, required: true, index: true },
    description: { type: String, default: "" },
    priceSantim: { type: Number, required: true, min: 0, default: 0 },
    currency: { type: String, default: "ETB", uppercase: true },
    // Recurring plans only. "none" means a one-time purchase.
    interval: { type: String, enum: planIntervals, default: "none" },
    gracePeriodDays: { type: Number, default: 0, min: 0 },
    // Bundled entitlements
    courseIds: [{ type: Schema.Types.ObjectId, ref: "Course" }],
    resourceIds: [{ type: Schema.Types.ObjectId, ref: "LearningResource" }],
    certificateEligible: { type: Boolean, default: false },
    benefits: { type: [String], default: [] },
    // Number of seats / sessions for tutoring and live class plans.
    sessionCount: { type: Number, default: 0, min: 0 },
    isActive: { type: Boolean, default: true, index: true },
    sortOrder: { type: Number, default: 0 },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
}, { timestamps: true });

planSchema.index({ kind: 1, isActive: 1, sortOrder: 1 });

/** Recurring plans recur; everything else is a one-time purchase. */
planSchema.virtual("isRecurring").get(function () {
    return this.interval && this.interval !== "none";
});

export const PlanModel = mongoose.model("Plan", planSchema);
