import { OrderModel } from "../models/Order.js";
import { RefundModel } from "../models/Refund.js";
import { TransactionModel } from "../models/Transaction.js";
import { resolveRange } from "./analytics.js";

/**
 * Revenue reporting for the admin payment dashboard (Module 4) and the
 * financial reports (Module 8).
 *
 * The four figures are kept deliberately distinct so a dashboard can never blur
 * them together:
 *   gross    = everything the gateway collected from students
 *   fees     = gateway charges withheld
 *   refunds  = money returned to students
 *   net      = gross - fees - refunds     (what the platform keeps)
 *
 * A transaction counts towards revenue once it has collected money, and it is
 * bucketed by `paidAt` — never by `createdAt`, which would move revenue into the
 * wrong period when a payment settles later.
 */
const TIMEZONE = "Africa/Addis_Ababa";
/**
 * Statuses that represent money collected. Refunded transactions stay in here:
 * a refund is deducted separately through the Refund collection, so dropping
 * them from gross would both understate sales and double-count the refund.
 */
const COLLECTED = ["success", "refunded", "partially_refunded"];
/** Refund states that reduce revenue. */
const REFUNDED_STATES = ["approved", "processing", "processed"];

/** `$cond` helper: 1 when the transaction collected money. */
const collectedCond = { $in: ["$status", COLLECTED] };

function bucketExpression(granularity) {
    const format = granularity === "month" ? "%Y-%m" : granularity === "year" ? "%Y" : "%Y-%m-%d";
    return { $dateToString: { format, date: "$paidAt", timezone: TIMEZONE } };
}

export function resolveReportRange({ from, to, defaultDays = 30, maxDays = 1095 } = {}) {
    return resolveRange({ from, to, defaultDays, maxDays });
}

/**
 * Full payment dashboard payload: headline figures, a time series, revenue by
 * course and by plan type, provider performance and transaction status counts.
 */
export async function paymentDashboard({ from, to, provider = null, courseId = null, status = null, granularity = "day" } = {}) {
    const range = resolveRange({ from, to, defaultDays: 30, maxDays: 1095 });
    const transactionMatch = { paidAt: { $gte: range.from, $lte: range.to } };
    if (provider) {
        transactionMatch.provider = provider;
    }
    if (status) {
        transactionMatch.status = status;
    }
    // Revenue only ever counts collected transactions; the status filter is for
    // the transaction ledger, not for the revenue headline.
    const settledMatch = { status: { $in: COLLECTED }, paidAt: { $gte: range.from, $lte: range.to } };
    if (provider) {
        settledMatch.provider = provider;
    }

    const orderMatch = { fulfilledAt: { $ne: null }, paidAt: { $gte: range.from, $lte: range.to } };
    if (provider) {
        orderMatch.provider = provider;
    }

    const [
        statusCounts,
        revenueAgg,
        refundAgg,
        seriesAgg,
        dayAgg,
        monthAgg,
        courseAgg,
        planAgg,
        providerAgg,
        refundStatusAgg,
    ] = await Promise.all([
        TransactionModel.aggregate([
            { $match: transactionMatch },
            { $group: { _id: "$status", count: { $sum: 1 }, amountSantim: { $sum: "$amountSantim" } } },
        ]),
        TransactionModel.aggregate([
            { $match: settledMatch },
            {
                $group: {
                    _id: null,
                    grossSantim: { $sum: "$amountSantim" },
                    feeSantim: { $sum: "$feeSantim" },
                    netSantim: { $sum: "$netSantim" },
                    count: { $sum: 1 },
                },
            },
        ]),
        RefundModel.aggregate([
            { $match: { status: { $in: REFUNDED_STATES }, createdAt: { $gte: range.from, $lte: range.to } } },
            { $group: { _id: null, refundedSantim: { $sum: "$amountSantim" }, count: { $sum: 1 } } },
        ]),
        TransactionModel.aggregate([
            { $match: settledMatch },
            { $group: { _id: bucketExpression(granularity), grossSantim: { $sum: "$amountSantim" }, feeSantim: { $sum: "$feeSantim" }, netSantim: { $sum: "$netSantim" }, count: { $sum: 1 } } },
            { $sort: { _id: 1 } },
        ]),
        TransactionModel.aggregate([
            { $match: { ...settledMatch, paidAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } } },
            { $group: { _id: null, grossSantim: { $sum: "$amountSantim" }, count: { $sum: 1 } } },
        ]),
        TransactionModel.aggregate([
            { $match: { ...settledMatch, paidAt: { $gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) } } },
            { $group: { _id: null, grossSantim: { $sum: "$amountSantim" }, count: { $sum: 1 } } },
        ]),
        OrderModel.aggregate([
            { $match: orderMatch },
            { $unwind: "$items" },
            { $match: { "items.itemType": "course", ...(courseId ? { "items.itemId": courseId } : {}) } },
            { $group: { _id: "$items.itemId", title: { $first: "$items.title" }, quantity: { $sum: "$items.quantity" }, grossSantim: { $sum: "$items.subtotalSantim" }, orders: { $addToSet: "$_id" } } },
            { $project: { title: 1, quantity: 1, grossSantim: 1, orderCount: { $size: "$orders" } } },
            { $sort: { grossSantim: -1 } },
            { $limit: 25 },
        ]),
        OrderModel.aggregate([
            { $match: orderMatch },
            { $unwind: "$items" },
            { $match: { "items.itemType": "plan" } },
            { $lookup: { from: "plans", localField: "items.itemId", foreignField: "_id", as: "plan" } },
            { $unwind: { path: "$plan", preserveNullAndEmptyArrays: true } },
            {
                $group: {
                    _id: { $ifNull: ["$plan.interval", "none"] },
                    grossSantim: { $sum: "$items.subtotalSantim" },
                    quantity: { $sum: "$items.quantity" },
                },
            },
            { $sort: { grossSantim: -1 } },
        ]),
        TransactionModel.aggregate([
            { $match: { paidAt: { $gte: range.from, $lte: range.to } } },
            {
                $group: {
                    _id: "$provider",
                    attempts: { $sum: 1 },
                    successCount: { $sum: { $cond: [collectedCond, 1, 0] } },
                    failureCount: { $sum: { $cond: [{ $in: ["$status", ["failed", "cancelled"]] }, 1, 0] } },
                    pendingCount: { $sum: { $cond: [{ $in: ["$status", ["initialized", "pending"]] }, 1, 0] } },
                    grossSantim: { $sum: { $cond: [collectedCond, "$amountSantim", 0] } },
                    feeSantim: { $sum: { $cond: [collectedCond, "$feeSantim", 0] } },
                    netSantim: { $sum: { $cond: [collectedCond, "$netSantim", 0] } },
                    refundedCount: { $sum: { $cond: [{ $in: ["$status", ["refunded", "partially_refunded"]] }, 1, 0] } },
                },
            },
            { $sort: { grossSantim: -1 } },
        ]),
        RefundModel.aggregate([
            { $group: { _id: "$status", count: { $sum: 1 }, amountSantim: { $sum: "$amountSantim" } } },
        ]),
    ]);

    const revenue = revenueAgg[0] ?? { grossSantim: 0, feeSantim: 0, netSantim: 0, count: 0 };
    const refunds = refundAgg[0] ?? { refundedSantim: 0, count: 0 };
    const statusMap = Object.fromEntries(statusCounts.map((row) => [row._id, row]));
    const countOf = (...names) => names.reduce((total, name) => total + (statusMap[name]?.count ?? 0), 0);

    const grossSantim = revenue.grossSantim ?? 0;
    const feeSantim = revenue.feeSantim ?? 0;
    const refundedSantim = refunds.refundedSantim ?? 0;

    const subscriptionGross = planAgg
        .filter((row) => row._id && row._id !== "none")
        .reduce((total, row) => total + row.grossSantim, 0);
    const oneOffPlanGross = planAgg
        .filter((row) => !row._id || row._id === "none")
        .reduce((total, row) => total + row.grossSantim, 0);
    const courseGross = courseAgg.reduce((total, row) => total + row.grossSantim, 0);

    return {
        range: { from: range.from.toISOString(), to: range.to.toISOString() },
        granularity,
        timezone: TIMEZONE,
        currency: "ETB",
        revenue: {
            grossSantim,
            gatewayFeeSantim: feeSantim,
            refundedSantim,
            // Deliberately not clamped at zero: when a gateway keeps its fee on a
            // refunded payment, net revenue is genuinely negative and that must
            // be visible rather than hidden behind a 0.
            netSantim: grossSantim - feeSantim - refundedSantim,
            transactionCount: revenue.count ?? 0,
            averageOrderSantim: revenue.count ? Math.round(grossSantim / revenue.count) : 0,
        },
        today: {
            grossSantim: dayAgg[0]?.grossSantim ?? 0,
            transactionCount: dayAgg[0]?.count ?? 0,
        },
        monthToDate: {
            grossSantim: monthAgg[0]?.grossSantim ?? 0,
            transactionCount: monthAgg[0]?.count ?? 0,
        },
        transactions: {
            successful: countOf("success"),
            failed: countOf("failed"),
            cancelled: countOf("cancelled"),
            pending: countOf("initialized", "pending"),
            refunded: countOf("refunded", "partially_refunded"),
            total: statusCounts.reduce((total, row) => total + row.count, 0),
        },
        series: seriesAgg.map((row) => ({
            key: row._id,
            grossSantim: row.grossSantim,
            feeSantim: row.feeSantim,
            netSantim: row.netSantim,
            count: row.count,
        })),
        revenueBySource: {
            coursesSantim: courseGross,
            subscriptionSantim: subscriptionGross,
            oneOffPlansSantim: oneOffPlanGross,
            plansTotalSantim: subscriptionGross + oneOffPlanGross,
        },
        courses: courseAgg.map((row) => ({
            courseId: String(row._id),
            title: row.title,
            quantity: row.quantity,
            orderCount: row.orderCount,
            grossSantim: row.grossSantim,
        })),
        planIntervals: planAgg.map((row) => ({
            interval: row._id || "none",
            grossSantim: row.grossSantim,
            quantity: row.quantity,
        })),
        providers: providerAgg.map((row) => ({
            provider: row._id || "unknown",
            attempts: row.attempts,
            successCount: row.successCount,
            failureCount: row.failureCount,
            pendingCount: row.pendingCount,
            refundedCount: row.refundedCount,
            grossSantim: row.grossSantim,
            feeSantim: row.feeSantim,
            netSantim: row.netSantim,
            successRate: row.attempts ? Math.round((row.successCount / row.attempts) * 100) : null,
        })),
        refunds: {
            byStatus: Object.fromEntries(refundStatusAgg.map((row) => [row._id, { count: row.count, amountSantim: row.amountSantim }])),
            count: refunds.count ?? 0,
            amountSantim: refundedSantim,
        },
    };
}

/**
 * Transaction ledger for the dashboard table, with the same filters as the
 * headline figures.
 */
export async function listTransactions({ from, to, provider = null, status = null, courseId = null, studentId = null, limit = 100, page = 1 } = {}) {
    const range = resolveRange({ from, to, defaultDays: 30, maxDays: 1095 });
    const filter = { createdAt: { $gte: range.from, $lte: range.to } };
    if (provider) {
        filter.provider = provider;
    }
    if (status) {
        filter.status = status;
    }
    if (studentId) {
        filter.student = studentId;
    }
    if (courseId) {
        filter.order = { $in: await OrderModel.distinct("_id", { "items.itemId": courseId }) };
    }
    const safeLimit = Math.min(Math.max(Number(limit) || 100, 1), 5000);
    const safePage = Math.max(Number(page) || 1, 1);
    const [rows, total] = await Promise.all([
        TransactionModel.find(filter)
            .sort({ createdAt: -1 })
            .skip((safePage - 1) * safeLimit)
            .limit(safeLimit)
            .populate("student", "fullName email")
            .populate({ path: "order", select: "reference items totalSantim status currency promotion" })
            .lean(),
        TransactionModel.countDocuments(filter),
    ]);
    return {
        range: { from: range.from.toISOString(), to: range.to.toISOString() },
        total,
        page: safePage,
        limit: safeLimit,
        rows: rows.map((row) => ({
            id: String(row._id),
            reference: row.reference,
            provider: row.provider,
            providerReference: row.providerReference,
            status: row.status,
            amountSantim: row.amountSantim,
            feeSantim: row.feeSantim,
            netSantim: row.netSantim,
            currency: row.currency,
            verificationSource: row.verificationSource,
            failureReason: row.failureReason,
            attempt: row.attempt,
            createdAt: row.createdAt,
            paidAt: row.paidAt,
            student: row.student ? { id: String(row.student._id), fullName: row.student.fullName, email: row.student.email } : null,
            order: row.order
                ? {
                    id: String(row.order._id),
                    reference: row.order.reference,
                    status: row.order.status,
                    totalSantim: row.order.totalSantim,
                    items: (row.order.items ?? []).map((item) => ({ title: item.title, itemType: item.itemType, quantity: item.quantity })),
                }
                : null,
        })),
    };
}

/** Refund ledger for the dashboard, including the provider-capability flag. */
export async function listRefundLedger({ from, to, status = null, limit = 100 } = {}) {
    const range = resolveRange({ from, to, defaultDays: 365, maxDays: 1095 });
    const filter = { createdAt: { $gte: range.from, $lte: range.to } };
    if (status) {
        filter.status = status;
    }
    return RefundModel.find(filter)
        .sort({ createdAt: -1 })
        .limit(Math.min(Number(limit) || 100, 500))
        .populate("student", "fullName email")
        .populate({ path: "order", select: "reference totalSantim currency" })
        .lean();
}
