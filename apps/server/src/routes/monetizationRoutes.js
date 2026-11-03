import mongoose from "mongoose";
import { Router } from "express";
import { z } from "zod";
import { requireAuth, requireRole } from "../auth.js";
import { writeAudit } from "../lib/audit.js";
import { ApiError, asyncHandler } from "../lib/http.js";
import { PLATFORM_CURRENCY } from "../lib/money.js";
import { CourseModel } from "../models/Course.js";
import { EnrollmentModel } from "../models/Enrollment.js";
import { LearningResourceModel } from "../models/LearningResource.js";
import { PlanModel, planIntervals, planKinds } from "../models/Plan.js";
import { PromotionModel } from "../models/Promotion.js";
import { OrderModel } from "../models/Order.js";
import { SubscriptionModel } from "../models/Subscription.js";

/**
 * Monetization administration (Module 2).
 *
 * Mounted at /api/admin/monetization, ahead of the main admin router, so this
 * router authenticates itself rather than relying on that router's middleware.
 * Prices are integer santim (1 ETB = 100 santim) end to end.
 */
export const monetizationRouter = Router();
monetizationRouter.use(requireAuth, requireRole("hub_admin"));

const objectId = z.string().trim().regex(/^[a-f\d]{24}$/i, "Enter a valid ID.");
const optionalDate = z.union([z.null(), z.date(), z.string().trim().min(1)])
    .refine(
        (value) => value === null || value instanceof Date || !Number.isNaN(new Date(value).getTime()),
        "Enter a valid date.",
    )
    .transform((value) => (value === null ? null : value instanceof Date ? value : new Date(value)))
    .optional();

/**
 * Build an "every field optional" variant of a Zod shape.
 *
 * Zod applies `.default()` values even inside partial/optional schemas, which
 * would silently overwrite a stored value when the field is simply omitted from
 * a PATCH body. Unwrapping the default first keeps omitted fields omitted.
 */
function partialOf(shape) {
    return z.object(Object.fromEntries(Object.entries(shape).map(([key, type]) => {
        const unwrapped = typeof type.unwrap === "function" ? type.unwrap() : type;
        return [key, unwrapped.optional()];
    })));
}

/** Reject any ID that does not resolve to an existing document. */
async function assertIdsExist(Model, ids, label) {
    if (!ids || ids.length === 0) {
        return;
    }
    const found = await Model.countDocuments({ _id: { $in: ids } });
    if (found !== ids.length) {
        throw new ApiError(400, `One or more selected ${label} no longer exist.`);
    }
}

async function assertCoursesExist(ids) {
    return assertIdsExist(CourseModel, ids, "courses");
}

async function assertResourcesExist(ids) {
    return assertIdsExist(LearningResourceModel, ids, "learning resources");
}

// ---------------------------------------------------------------------------
// Plans
// ---------------------------------------------------------------------------

const planFields = {
    code: z.string().trim().min(3).max(40).regex(/^[A-Za-z0-9_-]+$/, "Use letters, numbers, hyphens and underscores only."),
    name: z.string().trim().min(3).max(120),
    kind: z.enum(planKinds),
    description: z.string().trim().max(2000).default(""),
    priceSantim: z.number().int().min(0),
    currency: z.string().trim().length(3).default(PLATFORM_CURRENCY),
    interval: z.enum(planIntervals).default("none"),
    gracePeriodDays: z.number().int().min(0).max(365).default(0),
    courseIds: z.array(objectId).max(200).default([]),
    resourceIds: z.array(objectId).max(200).default([]),
    certificateEligible: z.boolean().default(false),
    benefits: z.array(z.string().trim().min(1).max(200)).max(30).default([]),
    sessionCount: z.number().int().min(0).max(1000).default(0),
    isActive: z.boolean().default(true),
    sortOrder: z.number().int().min(0).max(9999).default(0),
};

const planObjectSchema = z.object(planFields);

/** Creation validates the object plus the cross-field rules. */
const createPlanSchema = planObjectSchema.superRefine((value, ctx) => {
    const recurring = value.interval && value.interval !== "none";
    if (value.kind === "subscription" && !recurring) {
        ctx.addIssue({ code: "custom", path: ["interval"], message: "Subscription plans must recur monthly, quarterly or annually." });
    }
    if (value.kind !== "subscription" && recurring) {
        ctx.addIssue({ code: "custom", path: ["interval"], message: "Only subscription plans can use a recurring interval." });
    }
});

/** Partial updates are validated on the merged document, not in isolation. */
const updatePlanSchema = partialOf(planFields);

/** Flatten a stored plan into the exact shape createPlanSchema expects. */
function planToInput(plan) {
    return {
        code: plan.code,
        name: plan.name,
        kind: plan.kind,
        description: plan.description ?? "",
        priceSantim: plan.priceSantim ?? 0,
        currency: plan.currency ?? PLATFORM_CURRENCY,
        interval: plan.interval ?? "none",
        gracePeriodDays: plan.gracePeriodDays ?? 0,
        courseIds: (plan.courseIds ?? []).map((id) => String(id)),
        resourceIds: (plan.resourceIds ?? []).map((id) => String(id)),
        certificateEligible: Boolean(plan.certificateEligible),
        benefits: plan.benefits ?? [],
        sessionCount: plan.sessionCount ?? 0,
        isActive: Boolean(plan.isActive),
        sortOrder: plan.sortOrder ?? 0,
    };
}

monetizationRouter.get("/overview", asyncHandler(async (_req, res) => {
    const [activePlans, plansByKind, activePromotions, activeSubscriptions, paidEnrollments, freeCourses, paidCourses] = await Promise.all([
        PlanModel.countDocuments({ isActive: true }),
        PlanModel.aggregate([{ $group: { _id: "$kind", total: { $sum: 1 }, active: { $sum: { $cond: ["$isActive", 1, 0] } } } }]),
        PromotionModel.countDocuments({ isActive: true }),
        SubscriptionModel.countDocuments({ status: { $in: ["active", "grace_period"] } }),
        EnrollmentModel.countDocuments({ source: "payment" }),
        CourseModel.countDocuments({ isFree: { $ne: false }, status: "published" }),
        CourseModel.countDocuments({ isFree: false, status: "published" }),
    ]);
    res.json({
        currency: PLATFORM_CURRENCY,
        plans: {
            active: activePlans,
            byKind: plansByKind.map((row) => ({ kind: row._id, total: row.total, active: row.active })),
        },
        promotions: { active: activePromotions },
        subscriptions: { active: activeSubscriptions },
        courses: { free: freeCourses, paid: paidCourses },
        enrollments: { paid: paidEnrollments },
    });
}));

monetizationRouter.get("/plans", asyncHandler(async (req, res) => {
    const query = z.object({
        kind: z.enum(planKinds).optional(),
        isActive: z.enum(["true", "false"]).optional(),
    }).parse(req.query);
    const match = {};
    if (query.kind) match.kind = query.kind;
    if (query.isActive) match.isActive = query.isActive === "true";
    const plans = await PlanModel.find(match)
        .populate("courseIds", "title slug isFree priceSantim")
        .sort({ sortOrder: 1, createdAt: -1 })
        .lean();
    res.json({ plans });
}));

monetizationRouter.post("/plans", asyncHandler(async (req, res) => {
    const data = createPlanSchema.parse(req.body);
    await assertCoursesExist(data.courseIds);
    await assertResourcesExist(data.resourceIds);
    if (await PlanModel.exists({ code: data.code.toUpperCase() })) {
        throw new ApiError(409, `A plan with the code "${data.code.toUpperCase()}" already exists.`);
    }
    const plan = await PlanModel.create({ ...data, code: data.code.toUpperCase(), createdBy: req.user.id });
    await writeAudit(req.user.id, "plan_created", "Plan", plan._id.toString(), { code: plan.code, kind: plan.kind });
    res.status(201).json({ plan });
}));

monetizationRouter.patch("/plans/:planId", asyncHandler(async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.planId)) throw new ApiError(400, "Invalid plan ID.");
    const plan = await PlanModel.findById(req.params.planId);
    if (!plan) throw new ApiError(404, "Plan not found.");
    const patch = updatePlanSchema.parse(req.body);
    // Validate the merged document so cross-field rules (e.g. subscription
    // interval) still hold after a partial update.
    const merged = createPlanSchema.parse({ ...planToInput(plan), ...patch });
    if (merged.code.toUpperCase() !== plan.code && await PlanModel.exists({ code: merged.code.toUpperCase() })) {
        throw new ApiError(409, `A plan with the code "${merged.code.toUpperCase()}" already exists.`);
    }
    await assertCoursesExist(patch.courseIds);
    await assertResourcesExist(patch.resourceIds);
    Object.assign(plan, { ...merged, code: merged.code.toUpperCase() });
    await plan.save();
    await writeAudit(req.user.id, "plan_updated", "Plan", plan._id.toString(), { code: plan.code });
    res.json({ plan });
}));

monetizationRouter.delete("/plans/:planId", asyncHandler(async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.planId)) throw new ApiError(400, "Invalid plan ID.");
    const plan = await PlanModel.findById(req.params.planId);
    if (!plan) throw new ApiError(404, "Plan not found.");
    const [orderCount, subscriptionCount] = await Promise.all([
        OrderModel.countDocuments({ "items.itemId": plan._id }),
        SubscriptionModel.countDocuments({ plan: plan._id }),
    ]);
    if (orderCount > 0 || subscriptionCount > 0) {
        throw new ApiError(409, "This plan has purchase or subscription history. Deactivate it instead of deleting it.");
    }
    await PlanModel.deleteOne({ _id: plan._id });
    await writeAudit(req.user.id, "plan_deleted", "Plan", plan._id.toString(), { code: plan.code });
    res.json({ message: "Plan deleted." });
}));

// ---------------------------------------------------------------------------
// Course pricing
// ---------------------------------------------------------------------------

monetizationRouter.patch("/courses/:courseId/pricing", asyncHandler(async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.courseId)) throw new ApiError(400, "Invalid course ID.");
    const data = z.object({
        isFree: z.boolean(),
        priceSantim: z.number().int().min(0).max(100_000_000).optional(),
        currency: z.string().trim().length(3).optional(),
    }).superRefine((value, ctx) => {
        if (!value.isFree && !(value.priceSantim > 0)) {
            ctx.addIssue({ code: "custom", path: ["priceSantim"], message: "A paid course needs a price greater than zero." });
        }
    }).parse(req.body);
    const course = await CourseModel.findById(req.params.courseId);
    if (!course) throw new ApiError(404, "Course not found.");
    // Students who already hold an entitlement keep it; the count is recorded
    // in the audit log so the change is traceable.
    const activeEntitlements = data.isFree
        ? 0
        : await EnrollmentModel.countDocuments({ course: course._id, status: "active" });
    course.isFree = data.isFree;
    course.priceSantim = data.isFree ? 0 : data.priceSantim;
    course.currency = data.currency ?? course.currency ?? PLATFORM_CURRENCY;
    await course.save();
    await writeAudit(req.user.id, "course_pricing_updated", "Course", course._id.toString(), {
        isFree: course.isFree,
        priceSantim: course.priceSantim,
        activeEntitlements,
    });
    res.json({ course });
}));

// ---------------------------------------------------------------------------
// Promotions
// ---------------------------------------------------------------------------

const promotionFields = {
    code: z.string().trim().min(3).max(40).regex(/^[A-Za-z0-9_-]+$/, "Use letters, numbers, hyphens and underscores only."),
    name: z.string().trim().min(3).max(120),
    description: z.string().trim().max(2000).default(""),
    discountType: z.enum(["percent", "fixed"]),
    discountValue: z.number().int().min(0),
    currency: z.string().trim().length(3).default(PLATFORM_CURRENCY),
    scope: z.enum(["all", "courses", "plans"]).default("all"),
    courseIds: z.array(objectId).max(200).default([]),
    planIds: z.array(objectId).max(200).default([]),
    startsAt: optionalDate,
    endsAt: optionalDate,
    maxRedemptions: z.number().int().min(0).max(1_000_000).default(0),
    perStudentLimit: z.number().int().min(1).max(100).default(1),
    isActive: z.boolean().default(true),
};

const promotionObjectSchema = z.object(promotionFields);

const createPromotionSchema = promotionObjectSchema.superRefine((value, ctx) => {
    if (value.discountType === "percent" && value.discountValue > 100) {
        ctx.addIssue({ code: "custom", path: ["discountValue"], message: "A percentage discount cannot exceed 100." });
    }
    if (value.discountType === "fixed" && value.discountValue <= 0) {
        ctx.addIssue({ code: "custom", path: ["discountValue"], message: "A fixed discount must be greater than zero." });
    }
    if (value.scope === "courses" && value.courseIds.length === 0) {
        ctx.addIssue({ code: "custom", path: ["courseIds"], message: "Select at least one course for this scope." });
    }
    if (value.scope === "plans" && value.planIds.length === 0) {
        ctx.addIssue({ code: "custom", path: ["planIds"], message: "Select at least one plan for this scope." });
    }
    if (value.startsAt && value.endsAt && value.endsAt <= value.startsAt) {
        ctx.addIssue({ code: "custom", path: ["endsAt"], message: "The end date must be after the start date." });
    }
});

function promotionToInput(promotion) {
    return {
        code: promotion.code,
        name: promotion.name,
        description: promotion.description ?? "",
        discountType: promotion.discountType,
        discountValue: promotion.discountValue ?? 0,
        currency: promotion.currency ?? PLATFORM_CURRENCY,
        scope: promotion.scope ?? "all",
        courseIds: (promotion.courseIds ?? []).map((id) => String(id)),
        planIds: (promotion.planIds ?? []).map((id) => String(id)),
        startsAt: promotion.startsAt ?? null,
        endsAt: promotion.endsAt ?? null,
        maxRedemptions: promotion.maxRedemptions ?? 0,
        perStudentLimit: promotion.perStudentLimit ?? 1,
        isActive: Boolean(promotion.isActive),
    };
}

monetizationRouter.get("/promotions", asyncHandler(async (_req, res) => {
    const promotions = await PromotionModel.find()
        .populate("courseIds", "title slug")
        .populate("planIds", "code name kind")
        .sort({ createdAt: -1 })
        .lean();
    const now = new Date();
    res.json({
        promotions: promotions.map((promotion) => ({
            ...promotion,
            // Surfaced so the UI never has to re-implement the redeemability rules.
            isRedeemableNow: promotion.isActive
                && (!promotion.startsAt || now >= new Date(promotion.startsAt))
                && (!promotion.endsAt || now <= new Date(promotion.endsAt))
                && !(promotion.maxRedemptions > 0 && promotion.redemptionCount >= promotion.maxRedemptions),
        })),
    });
}));

monetizationRouter.post("/promotions", asyncHandler(async (req, res) => {
    const data = createPromotionSchema.parse(req.body);
    await assertCoursesExist(data.courseIds);
    await assertIdsExist(PlanModel, data.planIds, "plans");
    if (await PromotionModel.exists({ code: data.code.toUpperCase() })) {
        throw new ApiError(409, `A promotion with the code "${data.code.toUpperCase()}" already exists.`);
    }
    const promotion = await PromotionModel.create({ ...data, code: data.code.toUpperCase(), createdBy: req.user.id });
    await writeAudit(req.user.id, "promotion_created", "Promotion", promotion._id.toString(), { code: promotion.code });
    res.status(201).json({ promotion });
}));

monetizationRouter.patch("/promotions/:promotionId", asyncHandler(async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.promotionId)) throw new ApiError(400, "Invalid promotion ID.");
    const promotion = await PromotionModel.findById(req.params.promotionId);
    if (!promotion) throw new ApiError(404, "Promotion not found.");
    const patch = partialOf(promotionFields).parse(req.body);
    const merged = createPromotionSchema.parse({ ...promotionToInput(promotion), ...patch });
    if (merged.code.toUpperCase() !== promotion.code && await PromotionModel.exists({ code: merged.code.toUpperCase() })) {
        throw new ApiError(409, `A promotion with the code "${merged.code.toUpperCase()}" already exists.`);
    }
    await assertCoursesExist(patch.courseIds);
    await assertIdsExist(PlanModel, patch.planIds, "plans");
    Object.assign(promotion, { ...merged, code: merged.code.toUpperCase() });
    await promotion.save();
    await writeAudit(req.user.id, "promotion_updated", "Promotion", promotion._id.toString(), { code: promotion.code });
    res.json({ promotion });
}));

monetizationRouter.delete("/promotions/:promotionId", asyncHandler(async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.promotionId)) throw new ApiError(400, "Invalid promotion ID.");
    const promotion = await PromotionModel.findById(req.params.promotionId);
    if (!promotion) throw new ApiError(404, "Promotion not found.");
    if (promotion.redemptionCount > 0) {
        throw new ApiError(409, "This promotion has already been redeemed. Deactivate it instead of deleting it.");
    }
    await PromotionModel.deleteOne({ _id: promotion._id });
    await writeAudit(req.user.id, "promotion_deleted", "Promotion", promotion._id.toString(), { code: promotion.code });
    res.json({ message: "Promotion deleted." });
}));

// ---------------------------------------------------------------------------
// Subscriptions (read-only in this phase; lifecycle lands with Module 6)
// ---------------------------------------------------------------------------

monetizationRouter.get("/subscriptions", asyncHandler(async (req, res) => {
    const query = z.object({
        status: z.enum(["pending", "active", "grace_period", "expired", "cancelled"]).optional(),
        limit: z.coerce.number().int().min(1).max(200).optional(),
    }).parse(req.query);
    const match = query.status ? { status: query.status } : {};
    const subscriptions = await SubscriptionModel.find(match)
        .populate("student", "fullName name email")
        .populate("plan", "code name kind interval priceSantim")
        .sort({ createdAt: -1 })
        .limit(query.limit ?? 100)
        .lean();
    res.json({ subscriptions });
}));
