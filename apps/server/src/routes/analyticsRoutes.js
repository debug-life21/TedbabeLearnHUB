import { Router } from "express";
import { z } from "zod";
import { requireAuth, requireRole } from "../auth.js";
import { asyncHandler } from "../lib/http.js";
import {
    analyticsDashboard,
    classPerformance,
    coursePerformance,
    engagementAndRetention,
    learningActivity,
    platformOverview,
    registrationFunnel,
    registrationStatistics,
    resolveRange,
    retentionCohorts,
    studentActivity,
    teacherPerformance,
} from "../services/analytics.js";

/**
 * Admin analytics API (Module 1). Mounted at /api/admin/analytics, ahead of the
 * main admin router, and gated to hub administrators.
 */
export const analyticsRouter = Router();
// This router is mounted ahead of the main admin router, so it must authenticate
// itself rather than relying on that router's requireAuth.
analyticsRouter.use(requireAuth, requireRole("hub_admin"));

const rangeQuery = z.object({
    from: z.string().trim().min(1).optional(),
    to: z.string().trim().min(1).optional(),
    granularity: z.enum(["day", "week", "month", "year"]).optional(),
    limit: z.coerce.number().int().min(1).max(500).optional(),
    status: z.string().trim().min(1).optional(),
    weeks: z.coerce.number().int().min(4).max(26).optional(),
    categoryId: z.string().trim().regex(/^[a-f\d]{24}$/i).optional(),
});

/** Parse and normalise the shared query string into service arguments. */
function parseQuery(req) {
    const parsed = rangeQuery.parse(req.query);
    const range = resolveRange({ from: parsed.from, to: parsed.to, defaultDays: 30 });
    return { ...parsed, range };
}

analyticsRouter.get("/dashboard", asyncHandler(async (req, res) => {
    const query = parseQuery(req);
    res.json(await analyticsDashboard({ granularity: query.granularity ?? "day", from: query.from, to: query.to }));
}));

analyticsRouter.get("/overview", asyncHandler(async (req, res) => {
    const query = parseQuery(req);
    res.json(await platformOverview({ range: query.range }));
}));

analyticsRouter.get("/registrations", asyncHandler(async (req, res) => {
    const query = parseQuery(req);
    res.json(await registrationStatistics({ granularity: query.granularity ?? "day", from: query.from, to: query.to }));
}));

analyticsRouter.get("/courses", asyncHandler(async (req, res) => {
    const query = parseQuery(req);
    res.json(await coursePerformance({
        from: query.from,
        to: query.to,
        limit: query.limit ?? 25,
        categoryId: query.categoryId ?? null,
    }));
}));

analyticsRouter.get("/teachers", asyncHandler(async (req, res) => {
    const query = parseQuery(req);
    res.json(await teacherPerformance({ from: query.from, to: query.to, limit: query.limit ?? 50 }));
}));

analyticsRouter.get("/classes", asyncHandler(async (req, res) => {
    const query = parseQuery(req);
    res.json(await classPerformance({ from: query.from, to: query.to, limit: query.limit ?? 50, status: query.status ?? null }));
}));

analyticsRouter.get("/engagement", asyncHandler(async (req, res) => {
    const query = parseQuery(req);
    res.json(await engagementAndRetention({ from: query.from, to: query.to }));
}));

analyticsRouter.get("/activity/daily", asyncHandler(async (req, res) => {
    const query = parseQuery(req);
    res.json(await learningActivity({ from: query.from, to: query.to }));
}));

analyticsRouter.get("/activity/students", asyncHandler(async (req, res) => {
    const query = parseQuery(req);
    res.json(await studentActivity({
        from: query.from,
        to: query.to,
        limit: query.limit ?? 100,
        status: query.status ?? null,
    }));
}));

analyticsRouter.get("/retention", asyncHandler(async (req, res) => {
    const query = parseQuery(req);
    res.json(await retentionCohorts({ weeks: query.weeks ?? 12 }));
}));

analyticsRouter.get("/funnel", asyncHandler(async (req, res) => {
    const query = parseQuery(req);
    res.json(await registrationFunnel({ from: query.from, to: query.to }));
}));
