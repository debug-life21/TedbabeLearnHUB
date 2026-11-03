import mongoose from "mongoose";
import { Router } from "express";
import { z } from "zod";
import { requireAuth, requireRole } from "../auth.js";
import { ApiError, asyncHandler } from "../lib/http.js";
import { writeAudit } from "../lib/audit.js";
import { RefundModel } from "../models/Refund.js";
import {
    paymentConfig,
    reconcilePendingTransactions,
    requestRefund,
    settleRefund,
} from "../services/paymentService.js";
import { listRefundLedger, listTransactions, paymentDashboard } from "../services/revenueService.js";

/**
 * Admin payment management surface (Module 4, plus the financial report data
 * used by Module 8).
 *
 * This router is mounted ahead of the main admin router, so it authenticates
 * itself: sub-routers registered before `/api/admin` do not inherit that
 * router's requireAuth middleware.
 */
export const paymentAdminRouter = Router();

paymentAdminRouter.use(requireAuth, requireRole("hub_admin"));

const objectId = z.string().regex(/^[a-f\d]{24}$/i, "Must be a valid identifier.");

const rangeQuery = z.object({
    from: z.string().datetime().optional(),
    to: z.string().datetime().optional(),
    provider: z.string().trim().max(40).optional(),
    status: z.enum(["initialized", "pending", "success", "failed", "cancelled", "expired", "refunded", "partially_refunded"]).optional(),
    courseId: objectId.optional(),
    studentId: objectId.optional(),
    granularity: z.enum(["day", "month", "year"]).optional().default("day"),
    limit: z.coerce.number().int().min(1).max(500).optional(),
    page: z.coerce.number().int().min(1).max(10000).optional(),
});

paymentAdminRouter.get("/dashboard", asyncHandler(async (req, res) => {
    const query = rangeQuery.parse(req.query ?? {});
    res.json(await paymentDashboard(query));
}));

paymentAdminRouter.get("/transactions", asyncHandler(async (req, res) => {
    const query = rangeQuery.parse(req.query ?? {});
    res.json(await listTransactions(query));
}));

function csvCell(value) {
    let text = String(value ?? "");
    if (typeof value !== "number" && /^[\s]*[=+\-@]/.test(text)) {
        text = `'${text}`;
    }
    return `"${text.replace(/"/g, '""')}"`;
}

paymentAdminRouter.get("/transactions/export.csv", asyncHandler(async (req, res) => {
    const query = rangeQuery.parse(req.query ?? {});
    const report = await listTransactions({ ...query, page: 1, limit: 5000 });
    if (report.total > report.rows.length) {
        throw new ApiError(413, "This export exceeds 5,000 transactions. Narrow the date range or filters and retry.");
    }
    const refunds = await RefundModel.aggregate([
        {
            $match: {
                transaction: { $in: report.rows.map((row) => new mongoose.Types.ObjectId(row.id)) },
                status: { $in: ["approved", "processing", "processed"] },
            },
        },
        { $group: { _id: "$transaction", totalSantim: { $sum: "$amountSantim" } } },
    ]);
    const refundsByTransaction = new Map(refunds.map((refund) => [String(refund._id), refund.totalSantim]));
    const rows = [
        ["Created at", "Paid at", "Order reference", "Provider", "Status", "Currency", "Transaction amount (santim)", "Collected gross (santim)", "Gateway fee (santim)", "Refunds (santim)", "Net revenue (santim)", "Student", "Email", "Items", "Failure reason"],
        ...report.rows.map((row) => [
            row.createdAt?.toISOString?.() ?? row.createdAt,
            row.paidAt?.toISOString?.() ?? row.paidAt,
            row.reference,
            row.provider,
            row.status,
            row.currency,
            row.amountSantim,
            ["success", "refunded", "partially_refunded"].includes(row.status) ? row.amountSantim : 0,
            ["success", "refunded", "partially_refunded"].includes(row.status) ? row.feeSantim : 0,
            refundsByTransaction.get(row.id) ?? 0,
            ["success", "refunded", "partially_refunded"].includes(row.status)
                ? row.amountSantim - row.feeSantim - (refundsByTransaction.get(row.id) ?? 0)
                : 0,
            row.student?.fullName,
            row.student?.email,
            row.order?.items?.map((item) => `${item.title} x${item.quantity}`).join("; "),
            row.failureReason,
        ]),
    ];
    res.set({
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="learnhub-transactions.csv"',
        "X-Export-Total": String(report.total),
        "X-Export-Truncated": report.total > report.rows.length ? "true" : "false",
    });
    res.send(`\uFEFF${rows.map((row) => row.map(csvCell).join(",")).join("\r\n")}`);
}));

paymentAdminRouter.get("/refunds", asyncHandler(async (req, res) => {
    const query = rangeQuery.parse(req.query ?? {});
    res.json({ refunds: await listRefundLedger(query) });
}));

paymentAdminRouter.post("/refunds", asyncHandler(async (req, res) => {
    const data = z.object({
        orderId: objectId,
        amountSantim: z.coerce.number().int().positive(),
        reason: z.string().trim().min(3).max(500),
    }).parse(req.body ?? {});
    const refund = await requestRefund({ ...data, actorId: req.user.id });
    res.status(201).json({ refund });
}));

paymentAdminRouter.patch("/refunds/:refundId", asyncHandler(async (req, res) => {
    const refundId = objectId.parse(req.params.refundId);
    const data = z.object({
        status: z.enum(["approved", "rejected", "processing", "processed", "failed"]),
        notes: z.string().trim().max(500).optional().default(""),
    }).parse(req.body ?? {});
    const refund = await settleRefund({ refundId, actorId: req.user.id, status: data.status, notes: data.notes });
    res.json({ refund });
}));

paymentAdminRouter.post("/reconcile", asyncHandler(async (req, res) => {
    const data = z.object({
        olderThanMinutes: z.coerce.number().int().min(1).max(1440).optional().default(15),
        limit: z.coerce.number().int().min(1).max(200).optional().default(50),
    }).parse(req.body ?? {});
    const summary = await reconcilePendingTransactions(data);
    await writeAudit(req.user.id, "payment.reconciled", "Transaction", "reconciliation", summary);
    res.json({ summary });
}));

paymentAdminRouter.get("/config", asyncHandler(async (_req, res) => {
    res.json(paymentConfig());
}));
