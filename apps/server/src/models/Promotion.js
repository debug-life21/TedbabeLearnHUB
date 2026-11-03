import mongoose, { Schema } from "mongoose";

/**
 * A discount code / promotional campaign. Redemption counters are incremented
 * atomically when an order is created so two students cannot overshoot
 * maxRedemptions.
 */
const promotionSchema = new Schema({
    code: { type: String, required: true, unique: true, trim: true, uppercase: true, index: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    discountType: { type: String, enum: ["percent", "fixed"], required: true },
    // percent: 0-100. fixed: an amount in santim.
    discountValue: { type: Number, required: true, min: 0 },
    currency: { type: String, default: "ETB", uppercase: true },
    scope: { type: String, enum: ["all", "courses", "plans"], default: "all", index: true },
    courseIds: [{ type: Schema.Types.ObjectId, ref: "Course" }],
    planIds: [{ type: Schema.Types.ObjectId, ref: "Plan" }],
    startsAt: { type: Date, default: null },
    endsAt: { type: Date, default: null },
    maxRedemptions: { type: Number, default: 0, min: 0 }, // 0 = unlimited
    redemptionCount: { type: Number, default: 0, min: 0 },
    perStudentLimit: { type: Number, default: 1, min: 1 },
    isActive: { type: Boolean, default: true, index: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
}, { timestamps: true });

/** A promotion is usable only when active and inside its optional date window. */
promotionSchema.methods.isRedeemable = function (now = new Date()) {
    if (!this.isActive) {
        return false;
    }
    if (this.startsAt && now < this.startsAt) {
        return false;
    }
    if (this.endsAt && now > this.endsAt) {
        return false;
    }
    if (this.maxRedemptions > 0 && this.redemptionCount >= this.maxRedemptions) {
        return false;
    }
    return true;
};

promotionSchema.methods.appliesToItem = function (itemType, itemId) {
    if (this.scope === "all") {
        return true;
    }
    const id = String(itemId);
    if (this.scope === "courses") {
        return itemType === "course" && this.courseIds.some((entry) => String(entry) === id);
    }
    return itemType === "plan" && this.planIds.some((entry) => String(entry) === id);
};

export const PromotionModel = mongoose.model("Promotion", promotionSchema);
