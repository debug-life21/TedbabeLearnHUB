import crypto from "node:crypto";
import { env } from "../config.js";
import { ApiError } from "../lib/http.js";
import { writeAudit } from "../lib/audit.js";
import {
    PLATFORM_CURRENCY,
    computeDiscountSantim,
    computeNetSantim,
    formatSantim,
    percentOfSantim,
} from "../lib/money.js";
import { CourseModel } from "../models/Course.js";
import { EnrollmentModel } from "../models/Enrollment.js";
import { NOTIFICATION_CAPS, NotificationModel, pruneNotifications } from "../models/Notification.js";
import { OrderModel } from "../models/Order.js";
import { PlanModel } from "../models/Plan.js";
import { PromotionModel } from "../models/Promotion.js";
import { RefundModel } from "../models/Refund.js";
import { SubscriptionModel } from "../models/Subscription.js";
import { TransactionModel } from "../models/Transaction.js";
import { UserModel } from "../models/User.js";
import { WebhookEventModel } from "../models/WebhookEvent.js";
import { getProvider, listProviders } from "../payments/index.js";

/**
 * Payment core: order construction, gateway initialization, server-side
 * verification, idempotent fulfilment and refunds.
 *
 * Two invariants drive everything here:
 *   1. Prices and statuses are decided by the server. A client can choose *what*
 *      to buy, never *how much* it costs or whether it was paid.
 *   2. Fulfilment is idempotent and recoverable. An atomic lease serializes
 *      entitlement writes, and `fulfilledAt` is set only after every write has
 *      completed, so provider callbacks and client verification can safely race.
 */

/** A checkout attempt stays reusable for this long before a retry is created. */
const REUSABLE_TRANSACTION_MS = 30 * 60 * 1000;
/** Abandoned, unpaid orders are expired after this long by reconciliation. */
const ORDER_EXPIRY_MS = 24 * 60 * 60 * 1000;

export function ensurePaymentsEnabled() {
    if (env.PAYMENTS_ENABLED !== "true") {
        throw new ApiError(503, "Payments are not enabled on this environment yet.");
    }
}

/** Public, secret-free payment configuration for the checkout UI. */
export function paymentConfig() {
    return {
        enabled: env.PAYMENTS_ENABLED === "true",
        environment: env.PAYMENT_ENVIRONMENT,
        currency: PLATFORM_CURRENCY,
        // Both gateways require a publicly reachable HTTPS callback URL.
        callbackUrlConfigured: Boolean(env.SERVER_PUBLIC_URL.trim()),
        providers: listProviders(),
    };
}

function generateReference() {
    return `TLH-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
}

/** Only same-origin redirects are accepted, so a caller cannot turn the
 *  post-payment redirect into an open redirect. */
function safeRedirectUrl(candidate, fallback) {
    if (!candidate) {
        return fallback;
    }
    try {
        const url = new URL(String(candidate));
        const allowed = [env.CLIENT_URL, env.ADMIN_CLIENT_URL, env.SERVER_PUBLIC_URL]
            .filter(Boolean)
            .map((item) => new URL(item).origin);
        return allowed.includes(url.origin) ? url.toString() : fallback;
    }
    catch {
        return fallback;
    }
}

function webhookUrl(providerId) {
    const base = env.SERVER_PUBLIC_URL.replace(/\/+$/, "");
    if (!base) {
        throw new ApiError(503, "SERVER_PUBLIC_URL is not configured, so the gateway callback URL cannot be built.");
    }
    return `${base}/api/payments/webhook/${providerId}`;
}

function resultPageUrl(reference) {
    const base = env.CLIENT_URL.replace(/\/+$/, "");
    return `${base}/payment/result?reference=${encodeURIComponent(reference)}`;
}

// ---------------------------------------------------------------------------
// Order construction
// ---------------------------------------------------------------------------

/**
 * Resolve a purchasable item from the catalogue. The price always comes from
 * the database, never from the request body.
 */
async function resolveCatalogItem(itemType, itemId, quantity = 1) {
    if (!/^[a-f\d]{24}$/i.test(String(itemId || ""))) {
        throw new ApiError(400, "One of the selected items is not a valid identifier.");
    }
    if (itemType === "course") {
        const course = await CourseModel.findById(itemId).select("title isFree priceSantim currency status").lean();
        if (!course) {
            throw new ApiError(404, "One of the selected courses could not be found.");
        }
        if (course.status !== "published") {
            throw new ApiError(400, `"${course.title}" is not open for enrolment.`);
        }
        if (course.isFree !== false) {
            throw new ApiError(400, `"${course.title}" is free. Use the free registration flow instead of checkout.`);
        }
        if (!(course.priceSantim > 0)) {
            throw new ApiError(400, `"${course.title}" does not have a price yet.`);
        }
        return {
            itemType: "course",
            itemId: course._id,
            title: course.title,
            unitPriceSantim: course.priceSantim,
            quantity,
            subtotalSantim: course.priceSantim * quantity,
            currency: course.currency || PLATFORM_CURRENCY,
        };
    }
    if (itemType === "plan") {
        const plan = await PlanModel.findById(itemId).lean();
        if (!plan) {
            throw new ApiError(404, "One of the selected plans could not be found.");
        }
        if (!plan.isActive) {
            throw new ApiError(400, `"${plan.name}" is not currently available.`);
        }
        if (!(plan.priceSantim > 0)) {
            throw new ApiError(400, `"${plan.name}" is free and does not require a payment.`);
        }
        return {
            itemType: "plan",
            itemId: plan._id,
            title: plan.name,
            unitPriceSantim: plan.priceSantim,
            quantity,
            subtotalSantim: plan.priceSantim * quantity,
            currency: plan.currency || PLATFORM_CURRENCY,
        };
    }
    throw new ApiError(400, `Unsupported item type "${itemType}".`);
}

/** Validate a promotion against the order lines and return the discount. */
async function resolvePromotion(promotionCode, items) {
    const code = String(promotionCode || "").trim().toUpperCase();
    if (!code) {
        return { promotion: null, discountSantim: 0 };
    }
    const promotion = await PromotionModel.findOne({ code });
    if (!promotion) {
        throw new ApiError(400, "That promotion code is not valid.");
    }
    if (!promotion.isRedeemable()) {
        throw new ApiError(400, "That promotion code is no longer available.");
    }
    const eligible = items.filter((item) => promotion.appliesToItem(item.itemType, item.itemId));
    if (eligible.length === 0) {
        throw new ApiError(400, "That promotion code does not apply to the items in this order.");
    }
    const eligibleSubtotal = eligible.reduce((sum, item) => sum + item.subtotalSantim, 0);
    const discountSantim = computeDiscountSantim(eligibleSubtotal, promotion);
    if (discountSantim <= 0) {
        throw new ApiError(400, "That promotion code produces no discount for this order.");
    }
    return { promotion, discountSantim };
}

/** Create a pending order from client-supplied item references. */
export async function createOrder({ studentId, items = [], promotionCode = "", providerId = "" }) {
    ensurePaymentsEnabled();
    if (!Array.isArray(items) || items.length === 0) {
        throw new ApiError(400, "Select at least one item to purchase.");
    }
    if (items.length > 10) {
        throw new ApiError(400, "An order can contain at most 10 items.");
    }
    const normalized = [];
    for (const raw of items) {
        const quantity = Number.isInteger(raw?.quantity) && raw.quantity > 0 ? Math.min(raw.quantity, 10) : 1;
        normalized.push(await resolveCatalogItem(String(raw?.itemType ?? ""), raw?.itemId, quantity));
    }
    for (const item of normalized) {
        if (item.itemType === "course") {
            const existing = await EnrollmentModel.exists({
                student: studentId,
                course: item.itemId,
                status: "active",
                $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }],
            });
            if (existing) {
                throw new ApiError(409, `You already have access to "${item.title}".`);
            }
        }
    }
    const seen = new Set();
    for (const item of normalized) {
        const key = `${item.itemType}:${String(item.itemId)}`;
        if (seen.has(key)) {
            throw new ApiError(400, "Remove the duplicated item from your order.");
        }
        seen.add(key);
    }
    const subtotalSantim = normalized.reduce((sum, item) => sum + item.subtotalSantim, 0);
    const { promotion, discountSantim } = await resolvePromotion(promotionCode, normalized);
    const totalSantim = Math.max(subtotalSantim - discountSantim, 0);
    if (totalSantim <= 0) {
        throw new ApiError(400, "This order has no payable amount. Use the free registration flow instead.");
    }
    const order = await OrderModel.create({
        reference: generateReference(),
        student: studentId,
        items: normalized.map(({ currency: _currency, ...item }) => item),
        subtotalSantim,
        discountSantim,
        totalSantim,
        currency: normalized[0].currency || PLATFORM_CURRENCY,
        promotion: { promotionId: promotion?._id ?? null, code: promotion?.code ?? "" },
        provider: providerId,
        status: "pending",
        expiresAt: new Date(Date.now() + ORDER_EXPIRY_MS),
        environment: env.PAYMENT_ENVIRONMENT,
    });
    // Reserve the promotion atomically. If another order took the last
    // redemption between validation and here, this fails and the order is rolled
    // back rather than silently over-redeeming the code.
    if (promotion) {
        const redemption = await PromotionModel.updateOne(
            {
                _id: promotion._id,
                $or: [
                    { maxRedemptions: 0 },
                    { $expr: { $lt: ["$redemptionCount", "$maxRedemptions"] } },
                ],
            },
            { $inc: { redemptionCount: 1 } },
        );
        if (redemption.modifiedCount !== 1) {
            await OrderModel.deleteOne({ _id: order._id });
            throw new ApiError(409, "That promotion code has just reached its redemption limit.");
        }
    }
    return order;
}

/** Convenience wrappers used by the catalogue and pricing pages. */
export function createCourseOrder(studentId, courseId) {
    return createOrder({ studentId, items: [{ itemType: "course", itemId: courseId, quantity: 1 }] });
}

export function createPlanOrder(studentId, planId) {
    return createOrder({ studentId, items: [{ itemType: "plan", itemId: planId, quantity: 1 }] });
}

// ---------------------------------------------------------------------------
// Checkout initialization
// ---------------------------------------------------------------------------

/**
 * Start (or resume) a payment attempt for an order.
 *
 * Attempts are idempotent: if a live attempt for the same order and provider
 * exists and is still fresh, it is returned instead of creating a second one.
 * Otherwise the attempt counter increments, which also produces a new gateway
 * reference (retries must not reuse a settled tx_ref).
 */
export async function startCheckout({ studentId, orderId, providerId, returnUrl, cancelUrl }) {
    ensurePaymentsEnabled();
    const provider = getProvider(providerId);
    if (!provider.isConfigured()) {
        throw new ApiError(503, `${provider.label} is not configured yet. Please choose another payment method.`);
    }
    const order = await OrderModel.findOne({ _id: orderId, student: studentId });
    if (!order) {
        throw new ApiError(404, "Order not found.");
    }
    if (order.fulfilledAt || order.status === "paid") {
        throw new ApiError(409, "This order has already been paid.");
    }
    if (["cancelled", "refunded", "partially_refunded"].includes(order.status)) {
        throw new ApiError(409, "This order can no longer be paid.");
    }
    if (order.expiresAt && order.expiresAt < new Date()) {
        order.status = "expired";
        await order.save();
        throw new ApiError(409, "This order has expired. Please build it again.");
    }

    const notifyUrl = webhookUrl(provider.id);
    const resolvedReturnUrl = safeRedirectUrl(returnUrl, resultPageUrl(order.reference));
    const resolvedCancelUrl = safeRedirectUrl(cancelUrl, resolvedReturnUrl);

    let transaction = await TransactionModel.findOne({
        order: order._id,
        provider: provider.id,
        status: { $in: ["initialized", "pending"] },
        createdAt: { $gte: new Date(Date.now() - REUSABLE_TRANSACTION_MS) },
    }).sort({ createdAt: -1 });

    if (transaction?.checkoutUrl) {
        return { order, transaction, checkoutUrl: transaction.checkoutUrl, instructions: transaction.instructions ?? null, reused: true };
    }

    if (!transaction) {
        const attempt = (await TransactionModel.countDocuments({ order: order._id, provider: provider.id })) + 1;
        const idempotencyKey = crypto
            .createHash("sha256")
            .update(`${String(order._id)}:${provider.id}:${attempt}`)
            .digest("hex");
        transaction = await TransactionModel.create({
            order: order._id,
            student: studentId,
            provider: provider.id,
            environment: env.PAYMENT_ENVIRONMENT,
            reference: attempt === 1 ? order.reference : `${order.reference}-R${attempt}`,
            idempotencyKey,
            amountSantim: order.totalSantim,
            currency: order.currency,
            status: "initialized",
            attempt,
        });
    }

    const student = await UserModel.findById(studentId).select("fullName email phoneNumber").lean();
    let result;
    try {
        result = await provider.initialize({ order, transaction, student, returnUrl: resolvedReturnUrl, cancelUrl: resolvedCancelUrl, notifyUrl });
    }
    catch (error) {
        transaction.status = "failed";
        transaction.failureReason = error instanceof Error ? error.message : "Payment initialization failed.";
        await transaction.save();
        order.status = "processing";
        order.provider = provider.id;
        await order.save();
        throw error;
    }

    transaction.checkoutUrl = result.checkoutUrl || "";
    transaction.providerReference = result.providerReference || transaction.reference;
    transaction.providerTransactionId = result.providerTransactionId || "";
    transaction.instructions = result.instructions ?? null;
    transaction.rawInitialize = result.raw ?? null;
    transaction.status = "pending";
    await transaction.save();

    if (order.status === "pending") {
        order.status = "processing";
    }
    order.provider = provider.id;
    await order.save();

    return { order, transaction, checkoutUrl: transaction.checkoutUrl, instructions: transaction.instructions ?? null, reused: false };
}

export async function cancelOrder({ orderId, studentId }) {
    const order = await OrderModel.findOne({ _id: orderId, student: studentId });
    if (!order) {
        throw new ApiError(404, "Order not found.");
    }
    if (order.fulfilledAt) {
        throw new ApiError(409, "This order is already paid and cannot be cancelled.");
    }
    order.status = "cancelled";
    order.cancelledAt = new Date();
    await order.save();
    await TransactionModel.updateMany(
        { order: order._id, status: { $in: ["initialized", "pending"] } },
        { $set: { status: "cancelled" } },
    );
    return order;
}

// ---------------------------------------------------------------------------
// Entitlements and fulfilment (Module 7 access control)
// ---------------------------------------------------------------------------

function addInterval(date, interval) {
    const result = new Date(date.getTime());
    const months = interval === "month" ? 1 : interval === "quarter" ? 3 : interval === "year" ? 12 : 0;
    if (months === 0) {
        return result;
    }
    result.setMonth(result.getMonth() + months);
    return result;
}

async function grantCourseEntitlement({ student, courseId, orderId, source }) {
    try {
        await EnrollmentModel.updateOne(
            { student, course: courseId },
            {
                $set: {
                    student,
                    itemType: "course",
                    course: courseId,
                    order: orderId,
                    source,
                    status: "active",
                    expiresAt: null,
                    revokedAt: null,
                    revokedReason: "",
                    startsAt: new Date(),
                },
                $unset: { subscription: "" },
            },
            { upsert: true },
        );
    }
    catch (error) {
        // A concurrent fulfilment already granted it; entitlements are idempotent.
        if (error?.code !== 11000) {
            throw error;
        }
    }
}

async function grantPlanEntitlement({ student, planId, orderId, source }) {
    try {
        await EnrollmentModel.updateOne(
            { student, plan: planId },
            {
                $set: {
                    student,
                    itemType: "plan",
                    plan: planId,
                    order: orderId,
                    source,
                    status: "active",
                    expiresAt: null,
                    revokedAt: null,
                    revokedReason: "",
                    startsAt: new Date(),
                },
            },
            { upsert: true },
        );
    }
    catch (error) {
        if (error?.code !== 11000) {
            throw error;
        }
    }
}

/**
 * Create or extend a recurring subscription. Renewals are never charged
 * automatically: a renewal only happens when a new paid order settles.
 */
async function activateSubscription({ student, plan, order }) {
    const now = new Date();
    const live = await SubscriptionModel.findOne({
        student,
        plan: plan._id,
        status: { $in: ["pending", "active", "grace_period"] },
    });
    if (live) {
        const periodStart = live.currentPeriodEnd && live.currentPeriodEnd > now ? new Date(live.currentPeriodEnd) : now;
        const periodEnd = addInterval(periodStart, plan.interval);
        live.status = "active";
        live.startedAt = live.startedAt ?? now;
        live.currentPeriodStart = periodStart;
        live.currentPeriodEnd = periodEnd;
        live.gracePeriodEndsAt = null;
        live.gracePeriodDays = plan.gracePeriodDays ?? live.gracePeriodDays;
        live.renewalCount = (live.renewalCount ?? 0) + 1;
        live.lastOrder = order._id;
        live.provider = order.provider || live.provider;
        live.cancelAtPeriodEnd = false;
        live.history.push({ type: "renewed", at: now, note: `Renewed for one ${plan.interval}`, order: order._id });
        await live.save();
        await EnrollmentModel.updateMany(
            { student, subscription: live._id },
            { $set: { expiresAt: addGracePeriod(periodEnd, live.gracePeriodDays), status: "active" } },
        );
        return live;
    }
    const periodEnd = addInterval(now, plan.interval);
    let subscription;
    try {
        subscription = await SubscriptionModel.create({
            student,
            plan: plan._id,
            planCode: plan.code,
            interval: plan.interval,
            status: "active",
            provider: order.provider || "",
            startedAt: now,
            currentPeriodStart: now,
            currentPeriodEnd: periodEnd,
            gracePeriodDays: plan.gracePeriodDays ?? 0,
            lastOrder: order._id,
            history: [
                { type: "created", at: now, order: order._id },
                { type: "activated", at: now, order: order._id },
            ],
        });
    }
    catch (error) {
        if (error?.code === 11000) {
            return activateSubscription({ student, plan, order });
        }
        throw error;
    }
    for (const courseId of plan.courseIds ?? []) {
        await grantCourseEntitlement({ student, courseId, orderId: order._id, source: "subscription" });
        await EnrollmentModel.updateOne(
            { student, course: courseId },
            { $set: { expiresAt: addGracePeriod(periodEnd, subscription.gracePeriodDays), subscription: subscription._id, source: "subscription" } },
        );
    }
    return subscription;
}

function addGracePeriod(date, days = 0) {
    return new Date(date.getTime() + Math.max(0, days) * 24 * 60 * 60 * 1000);
}

async function refreshSubscriptionStatus(subscription) {
    const now = new Date();
    const periodEnd = subscription.currentPeriodEnd;
    if (periodEnd && periodEnd <= now && ["active", "grace_period"].includes(subscription.status)) {
        const graceEnd = subscription.gracePeriodEndsAt
            ?? addGracePeriod(periodEnd, subscription.gracePeriodDays);
        if (subscription.status === "active" && !subscription.cancelAtPeriodEnd && subscription.gracePeriodDays > 0 && now <= graceEnd) {
            subscription.status = "grace_period";
            subscription.gracePeriodEndsAt = graceEnd;
        } else if (subscription.status === "grace_period" && now <= graceEnd) {
            subscription.gracePeriodEndsAt = graceEnd;
        } else {
            subscription.status = subscription.cancelAtPeriodEnd ? "cancelled" : "expired";
            subscription.cancelledAt = subscription.cancelAtPeriodEnd ? periodEnd : subscription.cancelledAt;
            subscription.history.push({
                type: subscription.cancelAtPeriodEnd ? "cancelled" : "expired",
                at: now,
                note: "The paid access period has ended.",
            });
            await EnrollmentModel.updateMany(
                { subscription: subscription._id, status: "active" },
                { $set: { status: "expired" } },
            );
        }
        await subscription.save();
    }
    return subscription;
}

/**
 * Module 7: a verified payment records the student's course registration
 * request. It deliberately does NOT add the student to a Classroom — class
 * assignment remains the administrator's decision through the existing
 * workflow.
 */
async function recordRegistrationRequests(studentId, items) {
    const courseIds = items.filter((item) => item.itemType === "course").map((item) => item.itemId);
    const planIds = items.filter((item) => item.itemType === "plan").map((item) => item.itemId);
    if (planIds.length) {
        const plans = await PlanModel.find({ _id: { $in: planIds } }).select("courseIds").lean();
        courseIds.push(...plans.flatMap((plan) => plan.courseIds ?? []));
    }
    const uniqueCourseIds = [...new Set(courseIds.map(String))];
    if (uniqueCourseIds.length === 0) {
        return;
    }
    await UserModel.updateOne(
        { _id: studentId },
        { $addToSet: { "studentProfile.preferredCourseIds": { $each: uniqueCourseIds } } },
    );
}

async function notifyStudent(order, granted, kind = "payment") {
    const summary = granted.map((entry) => entry.title).join(", ") || "your purchase";
    const isSubscription = granted.some((entry) => entry.type === "subscription");
    try {
        await NotificationModel.create({
            user: order.student,
            kind,
            title: "Payment confirmed",
            message: `We received your payment of ${formatSantim(order.totalSantim, order.currency)} for ${summary}. ${isSubscription
                ? "Your subscription is active."
                : "Your registration request has been recorded and an administrator will assign your class."}`,
            link: "/dashboard?tab=payments",
        });
        void pruneNotifications(order.student, NOTIFICATION_CAPS.student);
    }
    catch (error) {
        console.error("[payments] failed to create payment notification", { order: String(order._id), error: error?.message });
    }
}

/**
 * Grant everything the order paid for, exactly once.
 *
 * The atomic `fulfilledAt: null` claim is the duplicate-payment guard: if a
 * webhook and a client verification arrive together, only one of them wins and
 * the loser becomes a no-op.
 */
export async function fulfilOrder({ orderId, transaction }) {
    const now = new Date();
    const update = { $set: { fulfillmentStartedAt: now, paidAt: now, status: "paid" } };
    if (transaction?.provider) {
        update.$set.provider = transaction.provider;
    }
    // A lease prevents concurrent workers from granting twice while allowing
    // recovery if a worker crashes before all idempotent entitlement writes.
    const order = await OrderModel.findOneAndUpdate({
        _id: orderId,
        fulfilledAt: null,
        $or: [
            { fulfillmentStartedAt: null },
            { fulfillmentStartedAt: { $lt: new Date(Date.now() - 5 * 60 * 1000) } },
        ],
    }, update, { new: true });
    if (!order) {
        const existing = await OrderModel.findById(orderId);
        return { order: existing, fulfilled: false, alreadyFulfilled: Boolean(existing?.fulfilledAt), granted: [] };
    }
    const granted = [];
    try {
        for (const item of order.items) {
            if (item.itemType === "course") {
                await grantCourseEntitlement({ student: order.student, courseId: item.itemId, orderId: order._id, source: "payment" });
                granted.push({ type: "course", id: String(item.itemId), title: item.title });
                continue;
            }
            const plan = await PlanModel.findById(item.itemId);
            if (!plan) {
                throw new Error(`Purchased plan ${String(item.itemId)} no longer exists.`);
            }
            if (plan.interval && plan.interval !== "none") {
                await activateSubscription({ student: order.student, plan, order });
                granted.push({ type: "subscription", id: String(plan._id), title: plan.name, interval: plan.interval });
            }
            else {
                await grantPlanEntitlement({ student: order.student, planId: plan._id, orderId: order._id, source: "payment" });
                granted.push({ type: "plan", id: String(plan._id), title: plan.name });
                for (const courseId of plan.courseIds ?? []) {
                    await grantCourseEntitlement({ student: order.student, courseId, orderId: order._id, source: "payment" });
                    granted.push({ type: "course", id: String(courseId), title: `${plan.name} bundle` });
                }
            }
        }
        await recordRegistrationRequests(order.student, order.items);
        const completedAt = new Date();
        await OrderModel.updateOne(
            { _id: order._id, fulfillmentStartedAt: now, fulfilledAt: null },
            { $set: { fulfilledAt: completedAt }, $unset: { fulfillmentStartedAt: 1 } },
        );
        order.fulfilledAt = completedAt;
        order.fulfillmentStartedAt = null;
    }
    catch (error) {
        await OrderModel.updateOne(
            { _id: order._id, fulfillmentStartedAt: now, fulfilledAt: null },
            { $unset: { fulfillmentStartedAt: 1 } },
        );
        throw error;
    }
    await notifyStudent(order, granted);
    await writeAudit(order.student, "payment.order.fulfilled", "Order", order._id, {
        reference: order.reference,
        totalSantim: order.totalSantim,
        provider: transaction?.provider ?? order.provider,
        granted,
    });
    return { order, fulfilled: true, alreadyFulfilled: false, granted };
}

// ---------------------------------------------------------------------------
// Verification
// ---------------------------------------------------------------------------

/**
 * Apply a provider outcome to a transaction. This is the only place a
 * transaction status is allowed to move to "success", and it always re-reads
 * the transaction so repeated calls converge on the same state.
 */
export async function applyVerificationResult({ transactionId, result, source }) {
    const transaction = await TransactionModel.findById(transactionId);
    if (!transaction) {
        return null;
    }
    if (transaction.status === "success") {
        const order = await OrderModel.findById(transaction.order);
        const fulfilment = order?.fulfilledAt
            ? null
            : await fulfilOrder({ orderId: transaction.order, transaction });
        return {
            transaction,
            order: fulfilment?.order ?? order,
            fulfilled: Boolean(fulfilment?.fulfilled),
            alreadySettled: true,
        };
    }
    const provider = getProvider(transaction.provider);
    const now = new Date();
    transaction.rawVerification = result.raw ?? null;
    transaction.verificationSource = source;
    transaction.verifiedAt = now;
    if (result.providerReference) {
        transaction.providerReference = result.providerReference;
    }
    if (result.providerTransactionId) {
        transaction.providerTransactionId = result.providerTransactionId;
    }
    if (Number.isInteger(result.feeSantim)) {
        transaction.feeSantim = result.feeSantim;
    }
    else if (Number.isFinite(provider.feePercent)) {
        // Estimated from the provider's published rate; replaced by the exact
        // figure the moment the gateway reports one.
        transaction.feeSantim = percentOfSantim(transaction.amountSantim, provider.feePercent);
    }
    transaction.netSantim = computeNetSantim(transaction.amountSantim, transaction.feeSantim);

    if (result.status === "success") {
        const currencyMismatch = typeof result.currency === "string"
            && result.currency.toUpperCase() !== transaction.currency.toUpperCase();
        if ((Number.isInteger(result.amountSantim) && result.amountSantim !== transaction.amountSantim) || currencyMismatch) {
            transaction.status = "failed";
            transaction.failureReason = currencyMismatch
                ? `Currency mismatch: the gateway reported ${result.currency} but the order currency is ${transaction.currency}.`
                : `Amount mismatch: the gateway reported ${result.amountSantim} santim but the order total is ${transaction.amountSantim} santim.`;
            await transaction.save();
            await writeAudit(null, "payment.amount_mismatch", "Transaction", transaction._id, {
                expectedSantim: transaction.amountSantim,
                reportedSantim: result.amountSantim,
                expectedCurrency: transaction.currency,
                reportedCurrency: result.currency,
                source,
            });
            return { transaction, fulfilled: false, mismatch: true };
        }
        if (!Number.isInteger(result.amountSantim) || typeof result.currency !== "string" || !result.currency.trim()) {
            // A success response without both amount and currency is not enough
            // evidence to settle, even when it came from the provider verify API.
            transaction.status = "pending";
            await transaction.save();
            return { transaction, fulfilled: false, awaitingVerification: true };
        }
        transaction.status = "success";
        transaction.paidAt = now;
        transaction.failureReason = "";
        await transaction.save();
        const fulfilment = await fulfilOrder({ orderId: transaction.order, transaction });
        return { transaction, order: fulfilment.order, fulfilled: fulfilment.fulfilled, granted: fulfilment.granted };
    }

    if (result.status === "cancelled") {
        transaction.status = "cancelled";
        transaction.failureReason = result.message || "The payment was cancelled.";
    }
    else if (result.status === "failed") {
        transaction.status = "failed";
        transaction.failureReason = result.message || "The payment failed.";
    }
    else {
        transaction.status = "pending";
    }
    await transaction.save();
    // The order only fails when no other attempt is still in flight.
    await orderStatusAfterFailedAttempt(transaction);
    return { transaction, fulfilled: false };
}

/** Move an order to "failed" once every attempt on it is terminal. */
async function orderStatusAfterFailedAttempt(transaction) {
    const liveAttempts = await TransactionModel.countDocuments({
        order: transaction.order,
        status: { $in: ["initialized", "pending", "success"] },
    });
    if (liveAttempts > 0) {
        return;
    }
    await OrderModel.updateOne(
        { _id: transaction.order, fulfilledAt: null, status: { $nin: ["cancelled", "expired"] } },
        { $set: { status: "failed" } },
    );
}

/** Student-triggered backend verification (step 7 of the Module 5 flow). */
export async function verifyOrder({ orderId, studentId }) {
    ensurePaymentsEnabled();
    const order = await OrderModel.findOne({ _id: orderId, student: studentId });
    if (!order) {
        throw new ApiError(404, "Order not found.");
    }
    if (order.fulfilledAt) {
        const transaction = await TransactionModel.findOne({ order: order._id, status: "success" }).sort({ createdAt: -1 });
        return { order, transaction, fulfilled: true, settled: true };
    }
    const transaction = await TransactionModel.findOne({
        order: order._id,
        status: { $in: ["initialized", "pending"] },
    }).sort({ createdAt: -1 });
    if (!transaction) {
        const latest = await TransactionModel.findOne({ order: order._id }).sort({ createdAt: -1 });
        if (latest?.status === "success" && !order.fulfilledAt) {
            const fulfilment = await fulfilOrder({ orderId: order._id, transaction: latest });
            return { order: fulfilment.order ?? order, transaction: latest, fulfilled: fulfilment.fulfilled, settled: true };
        }
        return { order, transaction: latest, fulfilled: false, settled: latest?.status === "success" };
    }
    const provider = getProvider(transaction.provider);
    if (!provider.isConfigured()) {
        throw new ApiError(503, `${provider.label} is not configured, so this payment cannot be verified.`);
    }
    const result = await provider.verify({ transaction, order });
    const applied = await applyVerificationResult({ transactionId: transaction._id, result, source: "verify_api" });
    return {
        order: applied?.order ?? order,
        transaction: applied?.transaction ?? transaction,
        fulfilled: Boolean(applied?.fulfilled),
        settled: Boolean(applied?.alreadySettled),
        mismatch: Boolean(applied?.mismatch),
    };
}

// ---------------------------------------------------------------------------
// Webhooks
// ---------------------------------------------------------------------------

/**
 * Process an inbound gateway webhook.
 *
 * Three layers of protection: the body hash is unique (a redelivered payload is
 * a no-op), the signature must validate, and the resulting state transition is
 * idempotent. Invalid signatures are still recorded so rejected traffic is
 * visible to an operator.
 */
export async function processWebhook({ providerId, headers, rawBody, body }) {
    const provider = getProvider(providerId);
    const parsed = provider.parseWebhook({ headers, rawBody, body });
    const bodyHash = crypto
        .createHash("sha256")
        .update(rawBody ?? Buffer.from(JSON.stringify(body ?? {}), "utf8"))
        .digest("hex");
    let event;
    try {
        event = await WebhookEventModel.create({
            provider: provider.id,
            bodyHash,
            providerEventId: parsed.providerEventId || "",
            reference: parsed.reference || "",
            signatureValid: parsed.signatureValid,
            payload: parsed.raw ?? body ?? null,
        });
    }
    catch (error) {
        if (error?.code !== 11000) {
            throw error;
        }
        const existing = await WebhookEventModel.findOne({ bodyHash });
        // A delivery that failed signature verification must not hold the dedupe
        // slot forever: otherwise anyone could POST an unsigned copy of a real
        // payload and stop the genuine callback from ever settling.
        if (!existing || existing.signatureValid) {
            return { status: "duplicate", duplicate: true, signatureValid: Boolean(existing?.signatureValid), reference: existing?.reference ?? "" };
        }
        if (!parsed.signatureValid) {
            // The same forged body again; it is already on record.
            throw new ApiError(400, "Invalid webhook signature.");
        }
        event = existing;
        event.providerEventId = parsed.providerEventId || "";
        event.reference = parsed.reference || "";
        event.signatureValid = true;
        event.payload = parsed.raw ?? body ?? null;
    }
    if (!parsed.signatureValid) {
        event.processingResult = "rejected:invalid_signature";
        event.processedAt = new Date();
        await event.save();
        await writeAudit(null, "payment.webhook_rejected", "WebhookEvent", event._id, { provider: provider.id, reason: "invalid_signature" });
        throw new ApiError(400, "Invalid webhook signature.");
    }
    if (!parsed.reference) {
        event.processingResult = "ignored:no_reference";
        event.processedAt = new Date();
        await event.save();
        return { status: "ignored", signatureValid: true };
    }
    const transaction = await TransactionModel.findOne({ provider: provider.id, reference: parsed.reference });
    if (!transaction) {
        event.processingResult = "ignored:unknown_reference";
        event.processedAt = new Date();
        await event.save();
        return { status: "ignored", signatureValid: true, reference: parsed.reference };
    }
    const applied = await applyVerificationResult({
        transactionId: transaction._id,
        source: "webhook",
        result: {
            status: parsed.status,
            amountSantim: parsed.amountSantim,
            currency: parsed.currency,
            feeSantim: null,
            providerReference: parsed.providerReference,
            providerTransactionId: parsed.providerTransactionId,
            message: "",
            raw: parsed.raw,
        },
    });
    event.processedAt = new Date();
    event.processingResult = applied?.mismatch
        ? "rejected:amount_mismatch"
        : `applied:${applied?.transaction?.status ?? "unknown"}`;
    await event.save();
    return {
        status: "processed",
        duplicate: false,
        signatureValid: true,
        transactionStatus: applied?.transaction?.status,
        fulfilled: Boolean(applied?.fulfilled),
    };
}

// ---------------------------------------------------------------------------
// Reconciliation
// ---------------------------------------------------------------------------

/**
 * Re-verify attempts that are still open. Intended to run on a schedule: it
 * catches webhooks that were never delivered and expires abandoned orders.
 */
export async function reconcilePendingTransactions({ olderThanMinutes = 15, limit = 50 } = {}) {
    const cutoff = new Date(Date.now() - olderThanMinutes * 60 * 1000);
    const transactions = await TransactionModel.find({
        status: { $in: ["initialized", "pending"] },
        createdAt: { $lte: cutoff },
    }).sort({ createdAt: 1 }).limit(limit);
    const summary = { checked: transactions.length, settled: 0, failed: 0, stillPending: 0, skipped: 0, errors: 0, expiredOrders: 0 };
    for (const transaction of transactions) {
        try {
            const provider = getProvider(transaction.provider);
            if (!provider.isConfigured()) {
                summary.skipped += 1;
                continue;
            }
            const result = await provider.verify({ transaction });
            const applied = await applyVerificationResult({ transactionId: transaction._id, result, source: "verify_api" });
            const status = applied?.transaction?.status;
            if (status === "success") {
                summary.settled += 1;
            }
            else if (status === "failed" || status === "cancelled") {
                summary.failed += 1;
            }
            else {
                summary.stillPending += 1;
            }
        }
        catch (error) {
            summary.errors += 1;
            console.error("[payments] reconciliation failed", { transaction: String(transaction._id), error: error?.message });
        }
    }
    const expired = await OrderModel.updateMany(
        { fulfilledAt: null, status: { $in: ["pending", "processing"] }, createdAt: { $lte: new Date(Date.now() - ORDER_EXPIRY_MS) } },
        { $set: { status: "expired" } },
    );
    summary.expiredOrders = expired.modifiedCount ?? 0;
    return summary;
}

// ---------------------------------------------------------------------------
// Student-facing reads
// ---------------------------------------------------------------------------

export async function listStudentOrders(studentId, { status = null, limit = 50 } = {}) {
    const filter = { student: studentId };
    if (status) {
        filter.status = status;
    }
    const orders = await OrderModel.find(filter).sort({ createdAt: -1 }).limit(Math.min(limit, 200)).lean();
    const transactionRows = await TransactionModel.find({ order: { $in: orders.map((order) => order._id) } })
        .select("_id order reference provider status amountSantim currency paidAt createdAt")
        .sort({ createdAt: -1 })
        .lean();
    const byOrder = new Map();
    for (const transaction of transactionRows) {
        const key = String(transaction.order);
        byOrder.set(key, [...(byOrder.get(key) ?? []), transaction]);
    }
    return orders.map((order) => ({ ...order, transactions: byOrder.get(String(order._id)) ?? [] }));
}

export async function listStudentSubscriptions(studentId) {
    const subscriptions = await SubscriptionModel.find({ student: studentId })
        .populate("plan", "code name kind interval priceSantim currency benefits")
        .sort({ createdAt: -1 })
        .limit(100);
    const updated = await Promise.all(subscriptions.map(refreshSubscriptionStatus));
    return updated.map((subscription) => subscription.toObject());
}

export async function cancelStudentSubscription({ subscriptionId, studentId }) {
    const subscription = await SubscriptionModel.findOne({ _id: subscriptionId, student: studentId });
    if (!subscription) {
        throw new ApiError(404, "Subscription not found.");
    }
    await refreshSubscriptionStatus(subscription);
    if (!["active", "grace_period"].includes(subscription.status)) {
        throw new ApiError(409, "Only an active subscription can be cancelled.");
    }
    if (subscription.cancelAtPeriodEnd) {
        return subscription;
    }
    subscription.cancelAtPeriodEnd = true;
    subscription.cancelledReason = "Student requested cancellation at the end of the current paid period.";
    subscription.history.push({
        type: "cancelled",
        at: new Date(),
        note: "Cancellation scheduled for the end of the current paid period. No automatic renewal charge will be made.",
    });
    await subscription.save();
    await writeAudit(studentId, "subscription.cancellation_scheduled", "Subscription", subscription._id, {
        plan: String(subscription.plan),
        periodEnd: subscription.currentPeriodEnd,
    });
    return subscription;
}

export async function getStudentOrder({ orderId, studentId }) {
    const order = await OrderModel.findOne({ _id: orderId, student: studentId }).lean();
    if (!order) {
        throw new ApiError(404, "Order not found.");
    }
    const transactions = await TransactionModel.find({ order: order._id }).sort({ createdAt: -1 }).lean();
    return { order, transactions };
}

/** Receipt data for a single settled transaction. Structured, not formatted:
 *  the client renders and prints it. */
export async function buildReceipt({ transactionId, studentId = null }) {
    const transaction = await TransactionModel.findById(transactionId).lean();
    if (!transaction) {
        throw new ApiError(404, "Transaction not found.");
    }
    if (studentId && String(transaction.student) !== String(studentId)) {
        throw new ApiError(403, "That receipt does not belong to you.");
    }
    const [order, student, refunds] = await Promise.all([
        OrderModel.findById(transaction.order).lean(),
        UserModel.findById(transaction.student).select("fullName email").lean(),
        RefundModel.find({ transaction: transaction._id }).lean(),
    ]);
    const refundedSantim = refunds
        .filter((refund) => ["approved", "processing", "processed"].includes(refund.status))
        .reduce((total, refund) => total + refund.amountSantim, 0);
    return {
        platform: {
            name: "TedbabeLearnHUB",
            currency: order?.currency ?? transaction.currency,
            supportEmail: env.SMTP_FROM.match(/<([^>]+)>/)?.[1] ?? "",
        },
        receiptNumber: `RCPT-${String(transaction._id).slice(-8).toUpperCase()}`,
        issuedAt: (transaction.paidAt ?? transaction.createdAt ?? new Date()).toISOString(),
        order: order
            ? {
                reference: order.reference,
                items: order.items.map((item) => ({
                    title: item.title,
                    itemType: item.itemType,
                    quantity: item.quantity,
                    unitPriceSantim: item.unitPriceSantim,
                    subtotalSantim: item.subtotalSantim,
                })),
                subtotalSantim: order.subtotalSantim,
                discountSantim: order.discountSantim,
                totalSantim: order.totalSantim,
                promotionCode: order.promotion?.code ?? "",
            }
            : null,
        student: student ? { fullName: student.fullName, email: student.email } : null,
        transaction: {
            id: String(transaction._id),
            reference: transaction.reference,
            provider: transaction.provider,
            providerReference: transaction.providerReference,
            status: transaction.status,
            amountSantim: transaction.amountSantim,
            feeSantim: transaction.feeSantim,
            netSantim: transaction.netSantim,
            paidAt: transaction.paidAt ?? null,
            verificationSource: transaction.verificationSource,
        },
        refundedSantim,
    };
}

// ---------------------------------------------------------------------------
// Refunds and settlement
// ---------------------------------------------------------------------------

async function refundedTotal(orderId) {
    const rows = await RefundModel.aggregate([
        { $match: { order: orderId, status: { $in: ["approved", "processing", "processed"] } } },
        { $group: { _id: null, total: { $sum: "$amountSantim" } } },
    ]);
    return rows[0]?.total ?? 0;
}

/**
 * Raise a refund. Where the gateway exposes a refund API it is called; where it
 * does not, the refund is still recorded and flagged `providerCapable: false`
 * so it is settled deliberately rather than silently.
 */
export async function requestRefund({ orderId, amountSantim, reason, actorId }) {
    const order = await OrderModel.findById(orderId);
    if (!order) {
        throw new ApiError(404, "Order not found.");
    }
    if (!order.fulfilledAt) {
        throw new ApiError(409, "Only a paid order can be refunded.");
    }
    const transaction = await TransactionModel.findOne({ order: order._id, status: "success" }).sort({ createdAt: -1 });
    if (!transaction) {
        throw new ApiError(409, "No settled transaction exists for this order.");
    }
    const amount = Number(amountSantim);
    if (!Number.isInteger(amount) || amount <= 0) {
        throw new ApiError(400, "Refund amount must be a positive whole number of santim.");
    }
    const alreadyRefunded = await refundedTotal(order._id);
    if (alreadyRefunded + amount > order.totalSantim) {
        throw new ApiError(400, `That exceeds the refundable balance of ${order.totalSantim - alreadyRefunded} santim.`);
    }
    const provider = getProvider(transaction.provider);
    let providerResult = { supported: false, providerRefundReference: "", raw: null };
    if (provider.capabilities.refund) {
        providerResult = await provider.refund({ transaction, amountSantim: amount, reason });
    }
    const refund = await RefundModel.create({
        order: order._id,
        transaction: transaction._id,
        student: order.student,
        amountSantim: amount,
        currency: order.currency,
        reason,
        status: "requested",
        providerCapable: Boolean(providerResult.supported),
        providerRefundReference: providerResult.providerRefundReference || "",
        providerResponse: providerResult.raw ?? null,
        requestedBy: actorId ?? null,
        notes: providerResult.supported
            ? ""
            : `${provider.label} does not expose a refund API; settle this refund through the provider dashboard.`,
    });
    await writeAudit(actorId, "payment.refund_requested", "Refund", refund._id, {
        order: String(order._id),
        amountSantim: amount,
        providerCapable: refund.providerCapable,
    });
    return refund;
}

/**
 * Move a refund through its lifecycle. Marking it processed updates revenue
 * figures and, on a full refund, revokes the access that was bought.
 */
export async function settleRefund({ refundId, actorId, status, notes = "" }) {
    if (!["approved", "rejected", "processing", "processed", "failed"].includes(status)) {
        throw new ApiError(400, "Unsupported refund status.");
    }
    const refund = await RefundModel.findById(refundId);
    if (!refund) {
        throw new ApiError(404, "Refund not found.");
    }
    refund.status = status;
    if (notes) {
        refund.notes = notes;
    }
    if (status === "processed") {
        refund.processedBy = actorId ?? null;
        refund.processedAt = new Date();
    }
    await refund.save();
    if (status !== "processed") {
        return refund;
    }
    const order = await OrderModel.findById(refund.order);
    if (!order) {
        return refund;
    }
    const total = await refundedTotal(order._id);
    const fullyRefunded = total >= order.totalSantim;
    order.status = fullyRefunded ? "refunded" : "partially_refunded";
    await order.save();
    await TransactionModel.updateOne(
        { _id: refund.transaction },
        { $set: { status: fullyRefunded ? "refunded" : "partially_refunded" } },
    );
    if (fullyRefunded) {
        // Access is withdrawn only on a full refund, and only over entitlements
        // that this order created.
        await EnrollmentModel.updateMany(
            { order: order._id },
            { $set: { status: "revoked", revokedAt: new Date(), revokedReason: `Order ${order.reference} refunded in full.` } },
        );
        await SubscriptionModel.updateMany(
            { lastOrder: order._id },
            { $set: { status: "cancelled", cancelledAt: new Date(), cancelledReason: `Order ${order.reference} refunded in full.` } },
        );
    }
    await writeAudit(actorId, "payment.refund_processed", "Refund", refund._id, {
        order: String(order._id),
        amountSantim: refund.amountSantim,
        fullyRefunded,
    });
    return refund;
}

export function listRefunds({ status = null, limit = 100 } = {}) {
    const filter = {};
    if (status) {
        filter.status = status;
    }
    return RefundModel.find(filter).sort({ createdAt: -1 }).limit(Math.min(limit, 500)).lean();
}
