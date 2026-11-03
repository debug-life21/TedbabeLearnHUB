import mongoose from "mongoose";
import { AssignmentModel } from "../models/Assignment.js";
import { AssignmentSubmissionModel } from "../models/AssignmentSubmission.js";
import { AssessmentAttemptModel } from "../models/AssessmentAttempt.js";
import { AttendanceRecordModel } from "../models/AttendanceRecord.js";
import { CertificateModel } from "../models/Certificate.js";
import { ClassSessionModel } from "../models/ClassSession.js";
import { ClassroomModel } from "../models/Classroom.js";
import { CourseModel } from "../models/Course.js";
import { DiscussionModel } from "../models/Discussion.js";
import { EnrollmentModel } from "../models/Enrollment.js";
import { LearningCategoryModel } from "../models/LearningCategory.js";
import { TeacherApplicationModel } from "../models/TeacherApplication.js";
import { UserModel } from "../models/User.js";

/**
 * Analytics over live MongoDB data.
 *
 * Conventions
 * -----------
 * - Every calendar bucket is computed in Africa/Addis_Ababa. Ethiopia has no
 *   daylight saving, so the zone is a fixed +03:00 offset; the same offset is
 *   applied in JS when densifying bucket keys so that JS-generated empty
 *   buckets always line up with MongoDB's $dateToString output.
 * - A "week" bucket is an ISO week: "%G-W%V" (e.g. 2026-W45).
 * - Rates are integer percentages, or null when the denominator is zero, so the
 *   UI can distinguish "0%" from "not applicable".
 * - $lookup uses Model.collection.name rather than a hard-coded string so
 *   collection naming can never drift from the models.
 */
const TIMEZONE = "Africa/Addis_Ababa";
const TIMEZONE_OFFSET_MS = 3 * 60 * 60 * 1000; // UTC+03:00, no DST
const DAY_MS = 24 * 60 * 60 * 1000;

export const GRANULARITIES = ["day", "week", "month", "year"];
const DATE_FORMATS = {
    day: "%Y-%m-%d",
    week: "%G-W%V",
    month: "%Y-%m",
    year: "%Y",
};

/** Shift an instant into the platform timezone and treat it as UTC for keying. */
function shiftToZone(date) {
    return new Date(new Date(date).getTime() + TIMEZONE_OFFSET_MS);
}

/** Bucket key for an instant, matching the $dateToString format for `granularity`. */
export function bucketKey(date, granularity) {
    const zoned = shiftToZone(date);
    if (granularity === "year") {
        return String(zoned.getUTCFullYear());
    }
    if (granularity === "month") {
        return `${zoned.getUTCFullYear()}-${String(zoned.getUTCMonth() + 1).padStart(2, "0")}`;
    }
    if (granularity === "week") {
        // ISO week: the week containing the year's first Thursday.
        const cursor = new Date(Date.UTC(zoned.getUTCFullYear(), zoned.getUTCMonth(), zoned.getUTCDate()));
        const isoDay = cursor.getUTCDay() || 7;
        cursor.setUTCDate(cursor.getUTCDate() + 4 - isoDay);
        const isoYear = cursor.getUTCFullYear();
        const yearStart = Date.UTC(isoYear, 0, 1);
        const isoWeek = Math.ceil(((cursor.getTime() - yearStart) / DAY_MS + 1) / 7);
        return `${isoYear}-W${String(isoWeek).padStart(2, "0")}`;
    }
    return `${zoned.getUTCFullYear()}-${String(zoned.getUTCMonth() + 1).padStart(2, "0")}-${String(zoned.getUTCDate()).padStart(2, "0")}`;
}

/** Every bucket key between two instants inclusive, in ascending order. */
function bucketKeysBetween(from, to, granularity) {
    const keys = [];
    const seen = new Set();
    if (granularity === "day") {
        for (let cursor = from.getTime(); cursor <= to.getTime(); cursor += DAY_MS) {
            const key = bucketKey(new Date(cursor), granularity);
            if (!seen.has(key)) {
                seen.add(key);
                keys.push(key);
            }
        }
    }
    else if (granularity === "week") {
        // Step in days so ISO week boundaries are never skipped.
        for (let cursor = from.getTime(); cursor <= to.getTime(); cursor += DAY_MS) {
            const key = bucketKey(new Date(cursor), granularity);
            if (!seen.has(key)) {
                seen.add(key);
                keys.push(key);
            }
        }
    }
    else if (granularity === "month") {
        const start = shiftToZone(from);
        const end = shiftToZone(to);
        let year = start.getUTCFullYear();
        let month = start.getUTCMonth();
        while (year < end.getUTCFullYear() || (year === end.getUTCFullYear() && month <= end.getUTCMonth())) {
            const key = `${year}-${String(month + 1).padStart(2, "0")}`;
            if (!seen.has(key)) {
                seen.add(key);
                keys.push(key);
            }
            month += 1;
            if (month > 11) {
                month = 0;
                year += 1;
            }
        }
    }
    else {
        const start = shiftToZone(from).getUTCFullYear();
        const end = shiftToZone(to).getUTCFullYear();
        for (let year = start; year <= end; year += 1) {
            keys.push(String(year));
        }
    }
    return keys;
}

function pct(numerator, denominator) {
    if (!denominator) {
        return null;
    }
    return Math.round((numerator / denominator) * 100);
}

function round(value, digits = 2) {
    if (value === null || value === undefined || !Number.isFinite(value)) {
        return null;
    }
    const factor = 10 ** digits;
    return Math.round(value * factor) / factor;
}

/** Resolve and clamp a { from, to } window. Defaults to the trailing `defaultDays`. */
export function resolveRange({ from, to, defaultDays = 30, maxDays = 400 } = {}) {
    const now = new Date();
    const parsedTo = to ? new Date(to) : now;
    const parsedFrom = from
        ? new Date(from)
        : new Date(parsedTo.getTime() - (defaultDays - 1) * DAY_MS);
    if (Number.isNaN(parsedFrom.getTime()) || Number.isNaN(parsedTo.getTime())) {
        throw new Error("Invalid date range.");
    }
    const start = parsedFrom <= parsedTo ? parsedFrom : parsedTo;
    const end = parsedFrom <= parsedTo ? parsedTo : parsedFrom;
    // Cap the span so a single request cannot scan an unbounded history.
    const maxSpanMs = maxDays * DAY_MS;
    if (end.getTime() - start.getTime() > maxSpanMs) {
        return { from: new Date(end.getTime() - maxSpanMs), to: end };
    }
    return { from: start, to: end };
}

/** Sensible default window and hard cap for each granularity. */
function rangeOptionsFor(granularity) {
    if (granularity === "year") {
        return { defaultDays: 365 * 4, maxDays: 365 * 12 };
    }
    if (granularity === "month" || granularity === "quarter") {
        return { defaultDays: 365, maxDays: 365 * 5 };
    }
    return { defaultDays: 30, maxDays: 400 };
}

/** Count distinct values of `field` as an integer. */
async function distinctCount(Model, match, field = "student") {
    const values = await Model.distinct(field, match);
    return Array.isArray(values) ? values.length : 0;
}

/** Group documents by time bucket using the platform timezone. */
async function timeSeries(Model, { match, granularity, from, to, sumExpression }) {
    const rows = await Model.aggregate([
        { $match: { ...match, createdAt: { $gte: from, $lte: to } } },
        {
            $group: {
                _id: { $dateToString: { format: DATE_FORMATS[granularity], date: "$createdAt", timezone: TIMEZONE } },
                count: { $sum: sumExpression ?? 1 },
            },
        },
        { $sort: { _id: 1 } },
    ]);
    const lookup = new Map(rows.map((row) => [row._id, row.count]));
    const buckets = bucketKeysBetween(from, to, granularity).map((key) => ({
        key,
        count: lookup.get(key) ?? 0,
    }));
    return {
        granularity,
        timezone: TIMEZONE,
        from,
        to,
        total: buckets.reduce((sum, bucket) => sum + bucket.count, 0),
        buckets,
    };
}

/**
 * Platform-wide headline metrics. All values are counts over live documents.
 */
export async function platformOverview({ range } = {}) {
    const from = range?.from ?? new Date(new Date().getTime() - 30 * DAY_MS);
    const to = range?.to ?? new Date();
    const now = new Date();
    const startOfToday = new Date(Date.UTC(shiftToZone(now).getUTCFullYear(), shiftToZone(now).getUTCMonth(), shiftToZone(now).getUTCDate()) - TIMEZONE_OFFSET_MS);
    const studentBase = { role: "student", isDeleted: { $ne: true } };

    const [
        totalStudents,
        activeStudents,
        newToday,
        newInRange,
        totalTeachers,
        activeTeachers,
        pendingTeacherApplications,
        totalCourses,
        publishedCourses,
        freeCourses,
        paidCourses,
        totalCategories,
        totalClasses,
        activeClasses,
        totalSessions,
        upcomingSessions,
        pendingPlacement,
        paidEnrollments,
        activeEnrollments,
        certificatesIssued,
        attendanceTotals,
        submissionTotals,
    ] = await Promise.all([
        UserModel.countDocuments(studentBase),
        UserModel.countDocuments({ ...studentBase, accountStatus: "active", emailVerified: true }),
        UserModel.countDocuments({ ...studentBase, createdAt: { $gte: startOfToday } }),
        UserModel.countDocuments({ ...studentBase, createdAt: { $gte: from, $lte: to } }),
        UserModel.countDocuments({ role: "teacher", isDeleted: { $ne: true } }),
        UserModel.countDocuments({ role: "teacher", isDeleted: { $ne: true }, accountStatus: "active" }),
        TeacherApplicationModel.countDocuments({ status: "pending" }),
        CourseModel.countDocuments({}),
        CourseModel.countDocuments({ status: "published" }),
        // Courses predating the monetization fields are treated as free, which
        // matches the schema default and the pre-existing behaviour.
        CourseModel.countDocuments({ isFree: { $ne: false }, status: "published" }),
        CourseModel.countDocuments({ isFree: false, status: "published" }),
        LearningCategoryModel.countDocuments({ isActive: true }),
        ClassroomModel.countDocuments({}),
        ClassroomModel.countDocuments({ status: { $in: ["planned", "active"] } }),
        ClassSessionModel.countDocuments({}),
        ClassSessionModel.countDocuments({ startsAt: { $gte: now }, status: "scheduled" }),
        UserModel.countDocuments({ ...studentBase, "studentProfile.placementStatus": "pending" }),
        EnrollmentModel.countDocuments({ source: "payment" }),
        EnrollmentModel.countDocuments({ status: "active", $or: [{ expiresAt: null }, { expiresAt: { $gte: now } }] }),
        CertificateModel.countDocuments({ status: "valid" }),
        AttendanceRecordModel.aggregate([
            {
                $group: {
                    _id: null,
                    total: { $sum: 1 },
                    attended: { $sum: { $cond: [{ $in: ["$status", ["present", "late"]] }, 1, 0] } },
                },
            },
        ]),
        AssignmentSubmissionModel.aggregate([
            {
                $group: {
                    _id: null,
                    total: { $sum: 1 },
                    graded: { $sum: { $cond: [{ $eq: ["$status", "graded"] }, 1, 0] } },
                },
            },
        ]),
    ]);

    const attendance = attendanceTotals[0] ?? { total: 0, attended: 0 };
    const submissions = submissionTotals[0] ?? { total: 0, graded: 0 };

    return {
        timezone: TIMEZONE,
        generatedAt: now,
        students: {
            total: totalStudents,
            active: activeStudents,
            pendingPlacement,
            newToday,
            newInRange,
        },
        teachers: {
            total: totalTeachers,
            active: activeTeachers,
            pendingApplications: pendingTeacherApplications,
        },
        catalog: {
            courses: totalCourses,
            publishedCourses,
            freeCourses,
            paidCourses,
            categories: totalCategories,
        },
        classes: {
            total: totalClasses,
            active: activeClasses,
            sessions: totalSessions,
            upcomingSessions,
        },
        learning: {
            attendanceRate: pct(attendance.attended, attendance.total),
            attendanceRecords: attendance.total,
            submissions: submissions.total,
            gradedSubmissions: submissions.graded,
            certificatesIssued,
        },
        monetization: {
            paidEnrollments,
            activeEntitlements: activeEnrollments,
        },
    };
}

/** Registration statistics for a granularity, split by role. */
export async function registrationStatistics({ granularity = "day", from, to }) {
    const range = resolveRange({ from, to, ...rangeOptionsFor(granularity) });
    const [students, teachers, allUsers] = await Promise.all([
        timeSeries(UserModel, { match: { role: "student", isDeleted: { $ne: true } }, granularity, ...range }),
        timeSeries(UserModel, { match: { role: "teacher", isDeleted: { $ne: true } }, granularity, ...range }),
        timeSeries(UserModel, { match: { isDeleted: { $ne: true } }, granularity, ...range }),
    ]);
    return {
        granularity,
        timezone: TIMEZONE,
        from: range.from,
        to: range.to,
        // Per-role series plus a combined series, all on the same bucket keys.
        all: allUsers,
        students,
        teachers,
        totals: {
            students: students.total,
            teachers: teachers.total,
            all: allUsers.total,
        },
    };
}

/**
 * Course popularity and performance: demand (course selections), delivery
 * (cohorts, seats, sessions), engagement (attendance, submissions) and outcomes
 * (average grade, certificates).
 */
export async function coursePerformance({ from, to, limit = 25, categoryId = null } = {}) {
    const range = resolveRange({ from, to, defaultDays: 90 });
    const courseMatch = { };
    if (categoryId) {
        courseMatch.category = new mongoose.Types.ObjectId(categoryId);
    }
    const courses = await CourseModel.find(courseMatch)
        .select("title slug category status isFree priceSantim currency estimatedDuration createdAt")
        .populate("category", "name")
        .lean();
    if (courses.length === 0) {
        return { from: range.from, to: range.to, rows: [] };
    }

    const classroomCollection = ClassroomModel.collection.name;
    const assignmentCollection = AssignmentModel.collection.name;

    const [cohortStats, sessionStats, attendanceStats, submissionStats, certificateStats, demandStats] = await Promise.all([
        ClassroomModel.aggregate([
            { $match: { course: { $ne: null } } },
            {
                $group: {
                    _id: "$course",
                    cohorts: { $sum: 1 },
                    activeCohorts: { $sum: { $cond: [{ $in: ["$status", ["planned", "active"]] }, 1, 0] } },
                    seats: { $sum: { $ifNull: ["$capacity", 0] } },
                    students: { $sum: { $size: { $ifNull: ["$students", []] } } },
                },
            },
        ]),
        ClassSessionModel.aggregate([
            { $lookup: { from: classroomCollection, localField: "classroom", foreignField: "_id", as: "cohort" } },
            { $unwind: "$cohort" },
            { $match: { "cohort.course": { $ne: null } } },
            {
                $group: {
                    _id: "$cohort.course",
                    sessions: { $sum: 1 },
                    completedSessions: { $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] } },
                },
            },
        ]),
        AttendanceRecordModel.aggregate([
            { $match: { createdAt: { $gte: range.from, $lte: range.to } } },
            { $lookup: { from: classroomCollection, localField: "classroom", foreignField: "_id", as: "cohort" } },
            { $unwind: "$cohort" },
            { $match: { "cohort.course": { $ne: null } } },
            {
                $group: {
                    _id: "$cohort.course",
                    records: { $sum: 1 },
                    attended: { $sum: { $cond: [{ $in: ["$status", ["present", "late"]] }, 1, 0] } },
                },
            },
        ]),
        AssignmentSubmissionModel.aggregate([
            { $lookup: { from: classroomCollection, localField: "classroom", foreignField: "_id", as: "cohort" } },
            { $unwind: "$cohort" },
            { $match: { "cohort.course": { $ne: null } } },
            { $lookup: { from: assignmentCollection, localField: "assignment", foreignField: "_id", as: "task" } },
            { $unwind: "$task" },
            {
                $group: {
                    _id: "$cohort.course",
                    submissions: { $sum: 1 },
                    graded: { $sum: { $cond: [{ $eq: ["$status", "graded"] }, 1, 0] } },
                    scoreSum: { $sum: { $cond: [{ $ne: ["$score", null] }, "$score", 0] } },
                    maxScoreSum: { $sum: { $cond: [{ $ne: ["$score", null] }, { $ifNull: ["$task.maxScore", 100] }, 0] } },
                },
            },
        ]),
        CertificateModel.aggregate([
            { $match: { status: "valid" } },
            { $group: { _id: "$course", certificates: { $sum: 1 } } },
        ]),
        UserModel.aggregate([
            { $match: { role: "student", isDeleted: { $ne: true } } },
            { $unwind: "$studentProfile.preferredCourseIds" },
            { $group: { _id: "$studentProfile.preferredCourseIds", requests: { $sum: 1 } } },
        ]),
    ]);

    const index = (rows) => new Map(rows.map((row) => [String(row._id), row]));
    const cohortIndex = index(cohortStats);
    const sessionIndex = index(sessionStats);
    const attendanceIndex = index(attendanceStats);
    const submissionIndex = index(submissionStats);
    const certificateIndex = index(certificateStats);
    const demandIndex = index(demandStats);

    const rows = courses.map((course) => {
        const id = String(course._id);
        const cohort = cohortIndex.get(id) ?? {};
        const session = sessionIndex.get(id) ?? {};
        const attendance = attendanceIndex.get(id) ?? {};
        const submission = submissionIndex.get(id) ?? {};
        const certificates = certificateIndex.get(id)?.certificates ?? 0;
        const students = cohort.students ?? 0;
        return {
            courseId: id,
            title: course.title,
            slug: course.slug,
            category: course.category?.name ?? "Uncategorised",
            status: course.status,
            isFree: course.isFree,
            priceSantim: course.priceSantim ?? 0,
            currency: course.currency ?? "ETB",
            demand: demandIndex.get(id)?.requests ?? 0,
            cohorts: cohort.cohorts ?? 0,
            activeCohorts: cohort.activeCohorts ?? 0,
            seats: cohort.seats ?? 0,
            students,
            fillRate: pct(students, cohort.seats ?? 0),
            sessions: session.sessions ?? 0,
            completedSessions: session.completedSessions ?? 0,
            attendanceRecords: attendance.records ?? 0,
            attendanceRate: pct(attendance.attended ?? 0, attendance.records ?? 0),
            submissions: submission.submissions ?? 0,
            gradedSubmissions: submission.graded ?? 0,
            averageGradePercentage: submission.maxScoreSum ? round((submission.scoreSum / submission.maxScoreSum) * 100, 1) : null,
            certificates,
            completionRate: pct(certificates, students),
        };
    });

    rows.sort((a, b) => (b.students - a.students) || (b.demand - a.demand) || (b.submissions - a.submissions));
    return { from: range.from, to: range.to, rows: rows.slice(0, limit) };
}

/** Teacher performance: workload, engagement generated and learning outcomes. */
export async function teacherPerformance({ from, to, limit = 50 } = {}) {
    const range = resolveRange({ from, to, defaultDays: 90 });
    const classroomCollection = ClassroomModel.collection.name;
    const assignmentCollection = AssignmentModel.collection.name;

    const teachers = await UserModel.find({ role: "teacher", isDeleted: { $ne: true } })
        .select("fullName name email teacherStatus accountStatus lastActiveAt createdAt")
        .lean();
    if (teachers.length === 0) {
        return { from: range.from, to: range.to, rows: [] };
    }

    const [workload, sessionStats, gradingStats, attendanceStats, certificateStats] = await Promise.all([
        ClassroomModel.aggregate([
            { $match: { teacher: { $ne: null } } },
            {
                $group: {
                    _id: "$teacher",
                    cohorts: { $sum: 1 },
                    activeCohorts: { $sum: { $cond: [{ $in: ["$status", ["planned", "active"]] }, 1, 0] } },
                    seats: { $sum: { $ifNull: ["$capacity", 0] } },
                    students: { $sum: { $size: { $ifNull: ["$students", []] } } },
                },
            },
        ]),
        ClassSessionModel.aggregate([
            { $match: { startsAt: { $gte: range.from, $lte: range.to } } },
            {
                $group: {
                    _id: "$teacher",
                    sessions: { $sum: 1 },
                    completedSessions: { $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] } },
                },
            },
        ]),
        AssignmentSubmissionModel.aggregate([
            { $lookup: { from: assignmentCollection, localField: "assignment", foreignField: "_id", as: "task" } },
            { $unwind: "$task" },
            {
                $group: {
                    _id: "$task.teacher",
                    submissions: { $sum: 1 },
                    graded: { $sum: { $cond: [{ $eq: ["$status", "graded"] }, 1, 0] } },
                    scoreSum: { $sum: { $cond: [{ $ne: ["$score", null] }, "$score", 0] } },
                    maxScoreSum: { $sum: { $cond: [{ $ne: ["$score", null] }, { $ifNull: ["$task.maxScore", 100] }, 0] } },
                },
            },
        ]),
        AttendanceRecordModel.aggregate([
            { $match: { createdAt: { $gte: range.from, $lte: range.to } } },
            {
                $group: {
                    _id: "$markedBy",
                    records: { $sum: 1 },
                    attended: { $sum: { $cond: [{ $in: ["$status", ["present", "late"]] }, 1, 0] } },
                },
            },
        ]),
        CertificateModel.aggregate([
            { $lookup: { from: classroomCollection, localField: "classroom", foreignField: "_id", as: "cohort" } },
            { $unwind: "$cohort" },
            { $match: { "cohort.teacher": { $ne: null }, status: "valid" } },
            { $group: { _id: "$cohort.teacher", certificates: { $sum: 1 } } },
        ]),
    ]);

    const index = (rows) => new Map(rows.map((row) => [String(row._id), row]));
    const workloadIndex = index(workload);
    const sessionIndex = index(sessionStats);
    const gradingIndex = index(gradingStats);
    const attendanceIndex = index(attendanceStats);
    const certificateIndex = index(certificateStats);

    const rows = teachers.map((teacher) => {
        const id = String(teacher._id);
        const load = workloadIndex.get(id) ?? {};
        const sessions = sessionIndex.get(id) ?? {};
        const grading = gradingIndex.get(id) ?? {};
        const attendance = attendanceIndex.get(id) ?? {};
        return {
            teacherId: id,
            name: teacher.fullName || teacher.name || teacher.email,
            email: teacher.email,
            teacherStatus: teacher.teacherStatus,
            accountStatus: teacher.accountStatus,
            lastActiveAt: teacher.lastActiveAt,
            cohorts: load.cohorts ?? 0,
            activeCohorts: load.activeCohorts ?? 0,
            seats: load.seats ?? 0,
            students: load.students ?? 0,
            fillRate: pct(load.students ?? 0, load.seats ?? 0),
            sessions: sessions.sessions ?? 0,
            completedSessions: sessions.completedSessions ?? 0,
            submissions: grading.submissions ?? 0,
            gradedSubmissions: grading.graded ?? 0,
            gradingRate: pct(grading.graded ?? 0, grading.submissions ?? 0),
            averageGradePercentage: grading.maxScoreSum ? round((grading.scoreSum / grading.maxScoreSum) * 100, 1) : null,
            attendanceRecords: attendance.records ?? 0,
            attendanceRate: pct(attendance.attended ?? 0, attendance.records ?? 0),
            certificates: certificateIndex.get(id)?.certificates ?? 0,
        };
    });

    rows.sort((a, b) => (b.students - a.students) || (b.gradedSubmissions - a.gradedSubmissions));
    return { from: range.from, to: range.to, rows: rows.slice(0, limit) };
}

/** Per-cohort class performance for the requested window. */
export async function classPerformance({ from, to, limit = 50, status = null } = {}) {
    const range = resolveRange({ from, to, defaultDays: 90 });
    const classroomMatch = {};
    if (status) {
        classroomMatch.status = status;
    }
    const classrooms = await ClassroomModel.find(classroomMatch)
        .select("title status capacity students course teacher startDate endDate timeZone createdAt")
        .populate("course", "title slug")
        .populate("teacher", "fullName name email")
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean();
    if (classrooms.length === 0) {
        return { from: range.from, to: range.to, rows: [] };
    }
    const classroomIds = classrooms.map((room) => room._id);

    const [sessionStats, attendanceStats, submissionStats, certificateStats, discussionStats] = await Promise.all([
        ClassSessionModel.aggregate([
            { $match: { classroom: { $in: classroomIds } } },
            {
                $group: {
                    _id: "$classroom",
                    sessions: { $sum: 1 },
                    completedSessions: { $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] } },
                    upcomingSessions: { $sum: { $cond: [{ $and: [{ $gte: ["$startsAt", new Date()] }, { $eq: ["$status", "scheduled"] }] }, 1, 0] } },
                },
            },
        ]),
        AttendanceRecordModel.aggregate([
            { $match: { classroom: { $in: classroomIds }, createdAt: { $gte: range.from, $lte: range.to } } },
            {
                $group: {
                    _id: "$classroom",
                    records: { $sum: 1 },
                    attended: { $sum: { $cond: [{ $in: ["$status", ["present", "late"]] }, 1, 0] } },
                },
            },
        ]),
        AssignmentSubmissionModel.aggregate([
            { $match: { classroom: { $in: classroomIds } } },
            {
                $group: {
                    _id: "$classroom",
                    submissions: { $sum: 1 },
                    graded: { $sum: { $cond: [{ $eq: ["$status", "graded"] }, 1, 0] } },
                },
            },
        ]),
        CertificateModel.aggregate([
            { $match: { classroom: { $in: classroomIds }, status: "valid" } },
            { $group: { _id: "$classroom", certificates: { $sum: 1 } } },
        ]),
        DiscussionModel.aggregate([
            { $match: { classroom: { $in: classroomIds } } },
            {
                $group: {
                    _id: "$classroom",
                    discussions: { $sum: 1 },
                    replies: { $sum: { $size: { $ifNull: ["$replies", []] } } },
                },
            },
        ]),
    ]);

    const index = (rows) => new Map(rows.map((row) => [String(row._id), row]));
    const sessionIndex = index(sessionStats);
    const attendanceIndex = index(attendanceStats);
    const submissionIndex = index(submissionStats);
    const certificateIndex = index(certificateStats);
    const discussionIndex = index(discussionStats);

    const rows = classrooms.map((room) => {
        const id = String(room._id);
        const sessions = sessionIndex.get(id) ?? {};
        const attendance = attendanceIndex.get(id) ?? {};
        const submissions = submissionIndex.get(id) ?? {};
        const certificates = certificateIndex.get(id)?.certificates ?? 0;
        const discussions = discussionIndex.get(id) ?? {};
        const students = (room.students ?? []).length;
        return {
            classroomId: id,
            title: room.title,
            status: room.status,
            course: room.course?.title ?? null,
            courseSlug: room.course?.slug ?? null,
            teacher: room.teacher ? (room.teacher.fullName || room.teacher.name || room.teacher.email) : null,
            students,
            capacity: room.capacity ?? 0,
            fillRate: pct(students, room.capacity ?? 0),
            sessions: sessions.sessions ?? 0,
            completedSessions: sessions.completedSessions ?? 0,
            upcomingSessions: sessions.upcomingSessions ?? 0,
            attendanceRecords: attendance.records ?? 0,
            attendanceRate: pct(attendance.attended ?? 0, attendance.records ?? 0),
            submissions: submissions.submissions ?? 0,
            gradedSubmissions: submissions.graded ?? 0,
            certificates,
            completionRate: pct(certificates, students),
            discussions: discussions.discussions ?? 0,
            replies: discussions.replies ?? 0,
            startDate: room.startDate,
            endDate: room.endDate,
        };
    });

    return { from: range.from, to: range.to, rows };
}

/**
 * Learning activity per student per day, derived from the learning artefacts the
 * student actually produced (assignment submissions, assessment attempts and
 * discussion posts). `User.lastActiveAt` holds only the latest heartbeat, so it
 * cannot be used to reconstruct history — these collections can.
 */
const ACTIVITY_SOURCES = [
    { model: AssignmentSubmissionModel, studentField: "$student" },
    { model: AssessmentAttemptModel, studentField: "$student" },
    // Discussions store the author rather than a student field.
    { model: DiscussionModel, studentField: "$author" },
];

/** Distinct (student, day) activity pairs across every activity source. */
async function activityPairs({ from, to }) {
    const results = await Promise.all(ACTIVITY_SOURCES.map(async (source) => {
        return source.model.aggregate([
            { $match: { createdAt: { $gte: from, $lte: to } } },
            {
                $group: {
                    _id: {
                        student: source.studentField,
                        day: { $dateToString: { format: DATE_FORMATS.day, date: "$createdAt", timezone: TIMEZONE } },
                    },
                    count: { $sum: 1 },
                },
            },
        ]);
    }));
    return results;
}

/** Daily active learners plus a per-day activity breakdown by source. */
export async function learningActivity({ from, to } = {}) {
    const range = resolveRange({ from, to, defaultDays: 30 });
    const [submissions, attempts, discussions] = await activityPairs(range);
    const days = bucketKeysBetween(range.from, range.to, "day");
    const perDay = new Map(days.map((day) => [day, { day, students: new Set(), submissions: 0, assessmentAttempts: 0, discussions: 0 }]));

    for (const row of submissions) {
        const bucket = perDay.get(row._id.day);
        if (bucket) {
            bucket.students.add(String(row._id.student));
            bucket.submissions += row.count;
        }
    }
    for (const row of attempts) {
        const bucket = perDay.get(row._id.day);
        if (bucket) {
            bucket.students.add(String(row._id.student));
            bucket.assessmentAttempts += row.count;
        }
    }
    for (const row of discussions) {
        const bucket = perDay.get(row?._id?.day);
        if (bucket) {
            bucket.discussions += row.count;
            if (row._id?.student) {
                bucket.students.add(String(row._id.student));
            }
        }
    }

    const buckets = days.map((day) => {
        const bucket = perDay.get(day);
        return {
            key: day,
            activeLearners: bucket.students.size,
            submissions: bucket.submissions,
            assessmentAttempts: bucket.assessmentAttempts,
            discussions: bucket.discussions,
        };
    });

    return {
        timezone: TIMEZONE,
        from: range.from,
        to: range.to,
        signals: ["assignment_submissions", "assessment_attempts", "discussion_posts"],
        buckets,
        peakActiveLearners: buckets.reduce((max, bucket) => Math.max(max, bucket.activeLearners), 0),
    };
}

/**
 * Weekly cohort retention. Each cohort is the set of students who registered in
 * an ISO week; retention at offset N is the share of that cohort with at least
 * one learning-activity event during the week N weeks later.
 */
export async function retentionCohorts({ weeks = 12 } = {}) {
    const weekCount = Math.min(Math.max(Number(weeks) || 12, 4), 26);
    const now = new Date();
    // Align the window start to a week boundary so cohorts are complete.
    const windowStart = new Date(now.getTime() - weekCount * 7 * DAY_MS);

    const students = await UserModel.find({
        role: "student",
        isDeleted: { $ne: true },
        createdAt: { $gte: windowStart, $lte: now },
    }).select("_id createdAt").lean();

    const cohortOf = new Map();
    for (const student of students) {
        const key = bucketKey(student.createdAt, "week");
        if (!cohortOf.has(key)) {
            cohortOf.set(key, []);
        }
        cohortOf.get(key).push(String(student._id));
    }

    const [submissions, attempts] = await activityPairs({ from: windowStart, to: now });
    const activeWeeks = new Map(); // studentId -> Set(weekKey)
    const record = (studentId, dayKey) => {
        if (!studentId) {
            return;
        }
        const weekKey = bucketKey(new Date(`${dayKey}T00:00:00.000Z`), "week");
        const id = String(studentId);
        if (!activeWeeks.has(id)) {
            activeWeeks.set(id, new Set());
        }
        activeWeeks.get(id).add(weekKey);
    };
    for (const row of submissions) {
        record(row._id.student, row._id.day);
    }
    for (const row of attempts) {
        record(row._id.student, row._id.day);
    }

    const allKeys = bucketKeysBetween(windowStart, now, "week");
    const cohorts = allKeys.map((key, cohortIndex) => {
        const members = cohortOf.get(key) ?? [];
        const row = {
            cohort: key,
            size: members.length,
            retention: [],
        };
        for (let offset = 0; offset < allKeys.length - cohortIndex; offset += 1) {
            const targetWeek = allKeys[cohortIndex + offset];
            const retained = members.filter((id) => activeWeeks.get(id)?.has(targetWeek)).length;
            row.retention.push({ offset, week: targetWeek, retained, rate: pct(retained, members.length) });
        }
        return row;
    });

    return {
        timezone: TIMEZONE,
        weeks: weekCount,
        from: windowStart,
        to: now,
        definition: "A learner counts as retained in week N if they produced at least one assignment submission or assessment attempt during that week.",
        cohorts,
    };
}

/** Engagement and retention summary metrics. */
export async function engagementAndRetention({ from, to } = {}) {
    const range = resolveRange({ from, to, defaultDays: 30 });
    const now = new Date();
    const activeCutoff = new Date(now.getTime() - 7 * DAY_MS);
    const recentCutoff = new Date(now.getTime() - 30 * DAY_MS);
    const dormantCutoff = new Date(now.getTime() - 90 * DAY_MS);
    const riskCutoff = new Date(now.getTime() - 14 * DAY_MS);

    const [
        totalStudents,
        activityBuckets,
        enrolledSummary,
        attendanceSummary,
        assessmentSummary,
        activityTrend,
    ] = await Promise.all([
        UserModel.countDocuments({ role: "student", isDeleted: { $ne: true } }),
        UserModel.aggregate([
            { $match: { role: "student", isDeleted: { $ne: true } } },
            {
                $group: {
                    _id: null,
                    active: { $sum: { $cond: [{ $gte: ["$lastActiveAt", activeCutoff] }, 1, 0] } },
                    recent: { $sum: { $cond: [{ $and: [{ $lt: ["$lastActiveAt", activeCutoff] }, { $gte: ["$lastActiveAt", recentCutoff] }] }, 1, 0] } },
                    dormant: { $sum: { $cond: [{ $and: [{ $lt: ["$lastActiveAt", recentCutoff] }, { $gte: ["$lastActiveAt", dormantCutoff] }] }, 1, 0] } },
                    cold: { $sum: { $cond: [{ $or: [{ $lt: ["$lastActiveAt", dormantCutoff] }, { $eq: ["$lastActiveAt", null] }] }, 1, 0] } },
                },
            },
        ]),
        ClassroomModel.aggregate([
            { $match: { status: { $in: ["planned", "active"] }, students: { $ne: [] } } },
            { $unwind: "$students" },
            { $group: { _id: "$students" } },
            { $lookup: { from: UserModel.collection.name, localField: "_id", foreignField: "_id", as: "student" } },
            { $unwind: "$student" },
            {
                $group: {
                    _id: null,
                    enrolled: { $sum: 1 },
                    atRisk: {
                        $sum: {
                            $cond: [
                                { $or: [{ $eq: ["$student.lastActiveAt", null] }, { $lt: ["$student.lastActiveAt", riskCutoff] }] },
                                1,
                                0,
                            ],
                        },
                    },
                    neverActive: { $sum: { $cond: [{ $eq: ["$student.lastActiveAt", null] }, 1, 0] } },
                },
            },
        ]),
        AttendanceRecordModel.aggregate([
            { $match: { createdAt: { $gte: range.from, $lte: range.to } } },
            {
                $group: {
                    _id: null,
                    total: { $sum: 1 },
                    attended: { $sum: { $cond: [{ $in: ["$status", ["present", "late"]] }, 1, 0] } },
                },
            },
        ]),
        AssessmentAttemptModel.aggregate([
            { $match: { createdAt: { $gte: range.from, $lte: range.to } } },
            {
                $group: {
                    _id: null,
                    attempts: { $sum: 1 },
                    reviewed: { $sum: { $cond: [{ $eq: ["$status", "reviewed"] }, 1, 0] } },
                    passed: { $sum: { $cond: [{ $eq: ["$passed", true] }, 1, 0] } },
                },
            },
        ]),
        timeSeries(AssignmentSubmissionModel, { match: {}, granularity: "day", ...range }),
    ]);

    const buckets = activityBuckets[0] ?? { active: 0, recent: 0, dormant: 0, cold: 0 };
    const enrolled = enrolledSummary[0] ?? { enrolled: 0, atRisk: 0, neverActive: 0 };
    const attendance = attendanceSummary[0] ?? { total: 0, attended: 0 };
    const assessments = assessmentSummary[0] ?? { attempts: 0, reviewed: 0, passed: 0 };

    return {
        timezone: TIMEZONE,
        from: range.from,
        to: range.to,
        generatedAt: now,
        students: {
            total: totalStudents,
            active: buckets.active,
            recent: buckets.recent,
            dormant: buckets.dormant,
            cold: buckets.cold,
        },
        engagement: {
            enrolledInLiveCohorts: enrolled.enrolled,
            atRisk: enrolled.atRisk,
            neverActive: enrolled.neverActive,
            atRiskRate: pct(enrolled.atRisk, enrolled.enrolled),
            attendanceRate: pct(attendance.attended, attendance.total),
            attendanceRecords: attendance.total,
        },
        assessments: {
            attempts: assessments.attempts,
            reviewed: assessments.reviewed,
            passed: assessments.passed,
            passRate: pct(assessments.passed, assessments.attempts),
            reviewRate: pct(assessments.reviewed, assessments.attempts),
        },
        submissionTrend: activityTrend,
    };
}

/**
 * Registration conversion funnel.
 *
 * Every stage is measured against the same cohort — the students who signed up
 * inside the requested window — so the percentages are internally consistent and
 * can never exceed 100%. Students who signed up earlier are not counted, even if
 * they later placed or graduated.
 */
export async function registrationFunnel({ from, to } = {}) {
    const range = resolveRange({ from, to, defaultDays: 90, maxDays: 400 });
    const scoped = { role: "student", isDeleted: { $ne: true }, createdAt: { $gte: range.from, $lte: range.to } };

    const cohort = await UserModel.find(scoped).select("_id").lean();
    const ids = cohort.map((entry) => entry._id);
    const forCohort = { student: { $in: ids } };

    const stages = [
        { key: "signed_up", label: "Signed up", count: ids.length },
    ];

    if (ids.length > 0) {
        const [emailVerified, selectedCourses, placed, attended, submitted, purchased, certified] = await Promise.all([
            UserModel.countDocuments({ _id: { $in: ids }, emailVerified: true }),
            UserModel.countDocuments({ _id: { $in: ids }, "studentProfile.courseSelectionUpdatedAt": { $ne: null } }),
            UserModel.countDocuments({ _id: { $in: ids }, "studentProfile.placementStatus": "assigned" }),
            distinctCount(AttendanceRecordModel, { ...forCohort, status: { $in: ["present", "late"] } }),
            distinctCount(AssignmentSubmissionModel, forCohort),
            distinctCount(EnrollmentModel, { ...forCohort, source: "payment" }),
            distinctCount(CertificateModel, { ...forCohort, status: "valid" }),
        ]);
        stages.push(
            { key: "email_verified", label: "Email verified", count: emailVerified },
            { key: "courses_selected", label: "Course preferences submitted", count: selectedCourses },
            { key: "placed", label: "Placed in a cohort", count: placed },
            { key: "attended", label: "Attended a live session", count: attended },
            { key: "submitted_work", label: "Submitted assignment work", count: submitted },
            { key: "purchased", label: "Completed a paid purchase", count: purchased },
            { key: "certified", label: "Earned a certificate", count: certified },
        );
    }

    const top = ids.length;
    return {
        timezone: TIMEZONE,
        from: range.from,
        to: range.to,
        definition: "Stages are measured over students who registered within the selected window.",
        stages: stages.map((stage, position) => {
            const previous = position === 0 ? stage.count : stages[position - 1].count;
            return {
                ...stage,
                conversionFromPrevious: pct(stage.count, previous),
                conversionFromTop: pct(stage.count, top),
                dropOffFromPrevious: Math.max(previous - stage.count, 0),
            };
        }),
    };
}

/** Per-student activity monitoring table with a recency classification. */
export async function studentActivity({ from, to, limit = 100, status = null } = {}) {
    const range = resolveRange({ from, to, defaultDays: 30 });
    const now = new Date();
    const students = await UserModel.find({ role: "student", isDeleted: { $ne: true } })
        .select("fullName name email country accountStatus emailVerified lastLoginAt lastActiveAt createdAt studentProfile.placementStatus")
        .sort({ lastActiveAt: -1, createdAt: -1 })
        .limit(limit)
        .lean();
    const studentIds = students.map((student) => student._id);

    const [submissionCounts, attendanceCounts, certificateCounts] = await Promise.all([
        AssignmentSubmissionModel.aggregate([
            { $match: { student: { $in: studentIds }, createdAt: { $gte: range.from, $lte: range.to } } },
            { $group: { _id: "$student", count: { $sum: 1 } } },
        ]),
        AttendanceRecordModel.aggregate([
            { $match: { student: { $in: studentIds }, createdAt: { $gte: range.from, $lte: range.to } } },
            {
                $group: {
                    _id: "$student",
                    records: { $sum: 1 },
                    attended: { $sum: { $cond: [{ $in: ["$status", ["present", "late"]] }, 1, 0] } },
                },
            },
        ]),
        CertificateModel.aggregate([
            { $match: { student: { $in: studentIds }, status: "valid" } },
            { $group: { _id: "$student", count: { $sum: 1 } } },
        ]),
    ]);

    const index = (rows) => new Map(rows.map((row) => [String(row._id), row]));
    const submissionIndex = index(submissionCounts);
    const attendanceIndex = index(attendanceCounts);
    const certificateIndex = index(certificateCounts);

    const classify = (lastActiveAt) => {
        if (!lastActiveAt) {
            return "never";
        }
        const ageMs = now.getTime() - new Date(lastActiveAt).getTime();
        if (ageMs <= 7 * DAY_MS) {
            return "active";
        }
        if (ageMs <= 30 * DAY_MS) {
            return "recent";
        }
        if (ageMs <= 90 * DAY_MS) {
            return "dormant";
        }
        return "cold";
    };

    const rows = students.map((student) => {
        const id = String(student._id);
        const attendance = attendanceIndex.get(id) ?? {};
        const bucket = classify(student.lastActiveAt);
        return {
            studentId: id,
            name: student.fullName || student.name || student.email,
            email: student.email,
            country: student.country,
            accountStatus: student.accountStatus,
            emailVerified: student.emailVerified,
            placementStatus: student.studentProfile?.placementStatus ?? "pending",
            registeredAt: student.createdAt,
            lastLoginAt: student.lastLoginAt,
            lastActiveAt: student.lastActiveAt,
            recency: bucket,
            submissions: submissionIndex.get(id)?.count ?? 0,
            attendanceRecords: attendance.records ?? 0,
            attendanceRate: pct(attendance.attended ?? 0, attendance.records ?? 0),
            certificates: certificateIndex.get(id)?.count ?? 0,
        };
    });

    const filtered = status ? rows.filter((row) => row.recency === status) : rows;
    return {
        timezone: TIMEZONE,
        from: range.from,
        to: range.to,
        total: filtered.length,
        rows: filtered,
    };
}

/** Everything the analytics dashboard needs, in one round trip. */
export async function analyticsDashboard({ granularity = "day", from, to } = {}) {
    const range = resolveRange({ from, to, ...rangeOptionsFor(granularity) });
    const [overview, registrations, courses, teachers, classes, engagement, funnel] = await Promise.all([
        platformOverview({ range }),
        registrationStatistics({ granularity, from: range.from, to: range.to }),
        coursePerformance({ from: range.from, to: range.to, limit: 10 }),
        teacherPerformance({ from: range.from, to: range.to, limit: 10 }),
        classPerformance({ from: range.from, to: range.to, limit: 10 }),
        engagementAndRetention({ from: range.from, to: range.to }),
        registrationFunnel({ from: range.from, to: range.to }),
    ]);
    return { range, granularity, overview, registrations, topCourses: courses.rows, topTeachers: teachers.rows, classes: classes.rows, engagement, funnel };
}
