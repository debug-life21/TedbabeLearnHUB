import mongoose, { Schema } from "mongoose";

export const enrollmentStatuses = ["active", "expired", "revoked"];
export const enrollmentSources = ["free", "payment", "admin_grant", "subscription"];

/**
 * A paid (or explicitly granted) entitlement.
 *
 * This is deliberately separate from Classroom.students[], which continues to
 * represent the administrator's placement decision. Paying for a course creates
 * an Enrollment and records the student's registration request — it never
 * auto-assigns a classroom. Free courses keep using the existing free
 * registration workflow and are not required to create an Enrollment.
 */
const enrollmentSchema = new Schema({
    student: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    itemType: { type: String, enum: ["course", "plan"], required: true },
    course: { type: Schema.Types.ObjectId, ref: "Course", default: null, index: true },
    plan: { type: Schema.Types.ObjectId, ref: "Plan", default: null, index: true },
    order: { type: Schema.Types.ObjectId, ref: "Order", default: null, index: true },
    subscription: { type: Schema.Types.ObjectId, ref: "Subscription", default: null, index: true },
    source: { type: String, enum: enrollmentSources, required: true },
    status: { type: String, enum: enrollmentStatuses, default: "active", index: true },
    startsAt: { type: Date, default: Date.now },
    // null = never expires (one-time purchases and admin grants).
    expiresAt: { type: Date, default: null, index: true },
    grantedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    revokedAt: { type: Date, default: null },
    revokedReason: { type: String, default: "" },
    metadata: { type: Schema.Types.Mixed, default: {} },
}, { timestamps: true });

// One active entitlement per student per course, and per student per plan.
enrollmentSchema.index(
    { student: 1, course: 1 },
    { unique: true, partialFilterExpression: { course: { $type: "objectId" } } },
);
enrollmentSchema.index(
    { student: 1, plan: 1 },
    { unique: true, partialFilterExpression: { plan: { $type: "objectId" } } },
);

export const EnrollmentModel = mongoose.model("Enrollment", enrollmentSchema);
