import mongoose from "mongoose";
import { Router } from "express";
import { z } from "zod";
import { requireAuth, requireRole } from "../auth.js";
import { asyncHandler, ApiError } from "../lib/http.js";
import { ClassroomModel } from "../models/Classroom.js";
import { ClassSessionModel } from "../models/ClassSession.js";
import {
  NotificationModel,
  pruneNotifications,
  NOTIFICATION_CAPS,
} from "../models/Notification.js";
import { AssignmentModel } from "../models/Assignment.js";
import { AssignmentSubmissionModel } from "../models/AssignmentSubmission.js";
import { AssessmentModel } from "../models/Assessment.js";
import { AssessmentAttemptModel } from "../models/AssessmentAttempt.js";
import { AttendanceRecordModel } from "../models/AttendanceRecord.js";
import { TeacherAttendanceRecordModel } from "../models/TeacherAttendanceRecord.js";
import { UserModel } from "../models/User.js";
import { DiscussionModel } from "../models/Discussion.js";
import { TeacherProgressReportModel } from "../models/TeacherProgressReport.js";
import { AnnouncementModel } from "../models/Announcement.js";
import {
  pickAttachment,
  streamSubmissionFile,
} from "../utils/submissionFiles.js";
import {
  ASSESSMENT_CATEGORIES,
  LEGACY_ASSESSMENT_CATEGORIES,
  assessmentCategoryLabel,
} from "../utils/assessmentCategories.js";
import { buildAttendanceRegister } from "../utils/attendanceRegister.js";
export const teacherRouter = Router();
teacherRouter.use(requireAuth, requireRole("teacher"));

/**
 * Broadcast a published result to every active administrator so the academy
 * can review performance and prepare certificates. Teachers never issue
 * certificates themselves.
 */
async function notifyAdminsOfResult({ title, message, link }) {
  const admins = await UserModel.find({
    role: { $in: ["admin", "hub_admin"] },
    accountStatus: "active",
    isDeleted: { $ne: true },
  })
    .select("_id")
    .lean();
  if (admins.length === 0) return;
  await NotificationModel.insertMany(
    admins.map((admin) => ({
      user: admin._id,
      title,
      message,
      kind: "result",
      link,
    })),
  );
}
// 1. Teacher Dashboard
teacherRouter.get(
  "/dashboard",
  asyncHandler(async (req, res) => {
    const teacherId = req.user.id;
    const now = new Date();
    const [classes, upcomingLessons, notifications, assignments] =
      await Promise.all([
        ClassroomModel.find({ teacher: teacherId })
          .populate("course")
          .populate("students", "fullName email")
          .sort({ createdAt: -1 })
          .lean(),
        ClassSessionModel.find({
          teacher: teacherId,
          endsAt: { $gte: now },
          status: "scheduled",
        })
          .populate("classroom", "title timeZone")
          .sort({ startsAt: 1 })
          .limit(50)
          .lean(),
        NotificationModel.find({ user: teacherId })
          .sort({ createdAt: -1 })
          .limit(NOTIFICATION_CAPS.teacher)
          .lean(),
        AssignmentModel.find({ teacher: teacherId }).select("_id").lean(),
      ]);
    // Prune excess notifications beyond the cap in the background
    void pruneNotifications(teacherId, NOTIFICATION_CAPS.teacher);
    const assignmentIds = assignments.map((a) => a._id);
    const [pendingSubmissions, assessmentIds] = await Promise.all([
      AssignmentSubmissionModel.countDocuments({
        assignment: { $in: assignmentIds },
        status: { $ne: "graded" },
      }),
      AssessmentModel.find({ teacher: teacherId }).select("_id").lean(),
    ]);
    const pendingAssessmentReviews =
      await AssessmentAttemptModel.countDocuments({
        assessment: { $in: assessmentIds.map((a) => a._id) },
        status: "submitted",
      });
    res.json({
      overview: {
        assignedClasses: classes.length,
        upcomingLessons: upcomingLessons.length,
        totalAssignedStudents: classes.reduce(
          (total, classroom) => total + (classroom.students?.length ?? 0),
          0,
        ),
        pendingSubmissionsToGrade: pendingSubmissions,
        pendingAssessmentReviews,
      },
      classes,
      upcomingLessons,
      notifications,
    });
  }),
);
// 2. Classes list
teacherRouter.get(
  "/classes",
  asyncHandler(async (req, res) => {
    const teacherId = req.user.id;
    const classes = await ClassroomModel.find({ teacher: teacherId })
      .populate("course")
      .populate("students", "fullName email studentProfile")
      .sort({ createdAt: -1 })
      .lean();
    const classIds = classes.map((classroom) => classroom._id);
    const sessions = await ClassSessionModel.find({
      classroom: { $in: classIds },
    })
      .populate("classroom", "title timeZone")
      .sort({ startsAt: 1 })
      .lean();
    res.json({ classes, sessions });
  }),
);
// 3. Single class details with sessions & students
teacherRouter.get(
  "/classes/:classId",
  asyncHandler(async (req, res) => {
    const teacherId = req.user.id;
    const classroom = await ClassroomModel.findOne({
      _id: req.params.classId,
      teacher: teacherId,
    })
      .populate("course")
      .populate("students", "fullName email studentProfile")
      .lean();
    if (!classroom) {
      throw new ApiError(404, "Class not found or not assigned to you.");
    }
    const [sessions, assignments, assessments] = await Promise.all([
      ClassSessionModel.find({ classroom: classroom._id })
        .sort({ startsAt: -1 })
        .lean(),
      AssignmentModel.find({ classroom: classroom._id })
        .sort({ dueDate: -1 })
        .lean(),
      AssessmentModel.find({ classroom: classroom._id })
        .sort({ createdAt: -1 })
        .lean(),
    ]);
    res.json({
      classroom,
      sessions,
      assignments,
      assessments,
    });
  }),
);
// 4. Create assignment
teacherRouter.post(
  "/assignments",
  asyncHandler(async (req, res) => {
    const teacherId = req.user.id;
    const data = z
      .object({
        classroomId: z.string().min(1),
        title: z.string().min(3),
        description: z.string().default(""),
        instructions: z.string().min(5),
        dueDate: z.string().datetime(),
        maxScore: z.number().int().min(1).default(100),
        allowedSubmissionTypes: z
          .array(z.enum(["text", "file", "both"]))
          .default(["text"]),
      })
      .parse(req.body);
    const classroom = await ClassroomModel.findOne({
      _id: data.classroomId,
      teacher: teacherId,
    });
    if (!classroom) {
      throw new ApiError(
        403,
        "You can only create assignments for classes assigned to you.",
      );
    }
    const assignment = await AssignmentModel.create({
      title: data.title,
      description: data.description,
      instructions: data.instructions,
      classroom: classroom._id,
      course: classroom.course,
      teacher: teacherId,
      dueDate: new Date(data.dueDate),
      maxScore: data.maxScore,
      allowedSubmissionTypes: data.allowedSubmissionTypes,
    });
    // Notify all students in this class
    if (classroom.students.length > 0) {
      await NotificationModel.insertMany(
        classroom.students.map((studentId) => ({
          user: studentId,
          title: `New Assignment: ${data.title}`,
          message: `A new assignment was posted in ${classroom.title}. Due date: ${new Date(data.dueDate).toLocaleDateString()}.`,
          kind: "assignment",
          link: "/student/assignments",
        })),
      );
    }
    res.status(201).json({ assignment });
  }),
);
// 5. List teacher's assignments
teacherRouter.get(
  "/assignments",
  asyncHandler(async (req, res) => {
    const teacherId = req.user.id;
    const assignments = await AssignmentModel.find({ teacher: teacherId })
      .populate("classroom", "title")
      .sort({ createdAt: -1 })
      .lean();
    const assignmentIds = assignments.map((a) => a._id);
    const submissions = await AssignmentSubmissionModel.aggregate([
      { $match: { assignment: { $in: assignmentIds } } },
      {
        $group: {
          _id: "$assignment",
          total: { $sum: 1 },
          graded: { $sum: { $cond: [{ $eq: ["$status", "graded"] }, 1, 0] } },
        },
      },
    ]);
    const statsMap = new Map(submissions.map((s) => [s._id.toString(), s]));
    const enriched = assignments.map((a) => {
      const stats = statsMap.get(a._id.toString());
      return {
        ...a,
        submissionCount: stats?.total ?? 0,
        gradedCount: stats?.graded ?? 0,
      };
    });
    res.json({ assignments: enriched });
  }),
);
// 6. View submissions for an assignment
teacherRouter.get(
  "/assignments/:assignmentId/submissions",
  asyncHandler(async (req, res) => {
    const teacherId = req.user.id;
    const assignment = await AssignmentModel.findOne({
      _id: req.params.assignmentId,
      teacher: teacherId,
    })
      .populate("classroom", "title students")
      .lean();
    if (!assignment) {
      throw new ApiError(404, "Assignment not found or unauthorized.");
    }
    const submissions = await AssignmentSubmissionModel.find({
      assignment: assignment._id,
    })
      .populate("student", "fullName email")
      .sort({ createdAt: -1 })
      .lean();
    res.json({ assignment, submissions });
  }),
);
// 7. Grade student submission
teacherRouter.patch(
  "/submissions/:submissionId/grade",
  asyncHandler(async (req, res) => {
    const teacherId = req.user.id;
    const data = z
      .object({
        score: z.number().min(0),
        feedback: z.string().default(""),
      })
      .parse(req.body);
    const submission = await AssignmentSubmissionModel.findById(
      req.params.submissionId,
    )
      .populate("assignment")
      .populate("student", "fullName email");
    if (!submission) {
      throw new ApiError(404, "Submission not found.");
    }
    const assignment = await AssignmentModel.findOne({
      _id: submission.assignment,
      teacher: teacherId,
    });
    if (!assignment) {
      throw new ApiError(
        403,
        "You can only grade submissions for your assigned classes.",
      );
    }
    if (data.score > assignment.maxScore) {
      throw new ApiError(
        400,
        `Score cannot exceed maximum score of ${assignment.maxScore}.`,
      );
    }
    submission.score = data.score;
    submission.feedback = data.feedback;
    submission.status = "graded";
    submission.gradedBy = teacherId;
    submission.gradedAt = new Date();
    await submission.save();
    await NotificationModel.create({
      user: submission.student._id,
      title: `Assignment Graded: ${assignment.title}`,
      message: `Your submission for "${assignment.title}" has been graded: ${data.score}/${assignment.maxScore}.`,
      kind: "grade",
      link: "/student/assignments",
    });
    res.json({ message: "Submission graded successfully.", submission });
  }),
);
// 7b. Stream a file attached to a submission the teacher owns
teacherRouter.get(
  "/submissions/:submissionId/files/:index",
  asyncHandler(async (req, res) => {
    const submission = await AssignmentSubmissionModel.findById(
      req.params.submissionId,
    )
      .populate("assignment", "teacher")
      .lean();
    if (
      !submission ||
      submission.assignment?.teacher?.toString() !== req.user.id
    ) {
      throw new ApiError(404, "Submission not found or unauthorized.");
    }
    await streamSubmissionFile(
      req,
      res,
      pickAttachment(submission.attachments, req.params.index),
    );
  }),
);
// 7c. View submissions (attempts) for an assessment
teacherRouter.get(
  "/assessments/:assessmentId/attempts",
  asyncHandler(async (req, res) => {
    const assessment = await AssessmentModel.findOne({
      _id: req.params.assessmentId,
      teacher: req.user.id,
    })
      .populate("classroom", "title students")
      .lean();
    if (!assessment) {
      throw new ApiError(404, "Assessment not found or unauthorized.");
    }
    const attempts = await AssessmentAttemptModel.find({
      assessment: assessment._id,
    })
      .populate("student", "fullName name email")
      .sort({ createdAt: -1 })
      .lean();
    res.json({ assessment, attempts });
  }),
);
// 7d. Stream a file attached to an assessment attempt
teacherRouter.get(
  "/attempts/:attemptId/files/:index",
  asyncHandler(async (req, res) => {
    const attempt = await AssessmentAttemptModel.findById(req.params.attemptId)
      .populate("assessment", "teacher")
      .lean();
    if (!attempt || attempt.assessment?.teacher?.toString() !== req.user.id) {
      throw new ApiError(
        404,
        "Assessment submission not found or unauthorized.",
      );
    }
    await streamSubmissionFile(
      req,
      res,
      pickAttachment(attempt.attachments, req.params.index),
    );
  }),
);
// 7e. Review an assessment attempt and release the result
teacherRouter.patch(
  "/attempts/:attemptId/review",
  asyncHandler(async (req, res) => {
    const teacherId = req.user.id;
    const data = z
      .object({
        score: z.number().min(0),
        feedback: z.string().max(4000).default(""),
        passed: z.boolean().optional(),
      })
      .parse(req.body);
    const attempt = await AssessmentAttemptModel.findById(req.params.attemptId)
      .populate("assessment")
      .populate("student", "fullName name email");
    if (!attempt) {
      throw new ApiError(404, "Assessment submission not found.");
    }
    const assessment = await AssessmentModel.findOne({
      _id: attempt.assessment,
      teacher: teacherId,
    });
    if (!assessment) {
      throw new ApiError(
        403,
        "You can only review submissions for your own assessments.",
      );
    }
    const maxScore =
      attempt.maxScore ||
      assessment.questions.reduce(
        (total, question) => total + (question.points || 1),
        0,
      ) ||
      assessment.maxScore ||
      100;
    if (data.score > maxScore) {
      throw new ApiError(
        400,
        `Score cannot exceed the maximum score of ${maxScore}.`,
      );
    }
    const percentage =
      maxScore > 0 ? Math.round((data.score / maxScore) * 100) : 0;
    const passed =
      data.passed ?? percentage >= assessment.passingScorePercentage;
    attempt.score = data.score;
    attempt.maxScore = maxScore;
    attempt.percentage = percentage;
    attempt.passed = passed;
    attempt.feedback = data.feedback;
    attempt.status = "reviewed";
    attempt.reviewedBy = teacherId;
    attempt.reviewedAt = new Date();
    await attempt.save();
    await NotificationModel.create({
      user: attempt.student._id,
      title: `Assessment Result Released: ${assessment.title}`,
      message: `Your submission for "${assessment.title}" has been reviewed: ${data.score}/${maxScore} (${percentage}%).`,
      kind: "grade",
      link: "/student/assessments",
    });
    await notifyAdminsOfResult({
      title: `Result published: ${assessment.title}`,
      message: `${attempt.student.fullName || attempt.student.name || "A student"} scored ${data.score}/${maxScore} (${percentage}%) on the ${assessmentCategoryLabel(assessment.assessmentType)} "${assessment.title}". Review and prepare a certificate if eligible.`,
      link: "/admin/certificates",
    });
    res.json({
      message: "Assessment result released to the student.",
      attempt,
    });
  }),
);
// Teacher-owned progress reports stay hidden from students until published.
teacherRouter.get(
  "/progress-reports/:classroomId",
  asyncHandler(async (req, res) => {
    const classroom = await ClassroomModel.findOne({
      _id: req.params.classroomId,
      teacher: req.user.id,
    })
      .populate("students", "fullName email")
      .lean();
    if (!classroom) {
      throw new ApiError(404, "Cohort not found or not assigned to you.");
    }
    const reports = await TeacherProgressReportModel.find({
      classroom: classroom._id,
      teacher: req.user.id,
    })
      .sort({ period: -1, updatedAt: -1 })
      .lean();
    res.json({ classroom, reports });
  }),
);
teacherRouter.put(
  "/progress-reports/:classroomId/:studentId",
  asyncHandler(async (req, res) => {
    const data = z
      .object({
        period: z.string().trim().min(1).max(80),
        overallScore: z.number().min(0).max(100).nullable().optional(),
        components: z
          .array(
            z.object({
              category: z.enum([
                ...ASSESSMENT_CATEGORIES,
                ...LEGACY_ASSESSMENT_CATEGORIES,
              ]),
              title: z.string().trim().min(1).max(120),
              score: z.number().min(0).max(1000),
              maxScore: z.number().positive().max(1000),
              feedback: z.string().max(1000).default(""),
            }),
          )
          .max(30)
          .superRefine((components, context) => {
            components.forEach((component, index) => {
              if (component.score > component.maxScore) {
                context.addIssue({
                  code: "custom",
                  path: [index, "score"],
                  message: "A component score cannot exceed its maximum score.",
                });
              }
            });
          })
          .default([]),
        selfAssessment: z.string().max(4000).default(""),
        feedback: z.string().max(4000).default(""),
        status: z.enum(["draft", "published"]),
      })
      .parse(req.body);
    const classroom = await ClassroomModel.findOne({
      _id: req.params.classroomId,
      teacher: req.user.id,
    }).select("students title");
    if (!classroom) {
      throw new ApiError(404, "Cohort not found or not assigned to you.");
    }
    if (
      !classroom.students.some(
        (studentId) => studentId.toString() === req.params.studentId,
      )
    ) {
      throw new ApiError(
        403,
        "You can only publish progress for students in your assigned cohort.",
      );
    }
    // The overall score is the sum of the component scores (Mid Exam, Final
    // Exam, Project, ...) so the report can never drift from its parts.
    const computedOverall =
      data.components.length > 0
        ? Number(
            data.components
              .reduce((sum, component) => sum + component.score, 0)
              .toFixed(2),
          )
        : null;
    if (computedOverall !== null && computedOverall > 100) {
      throw new ApiError(
        400,
        `Component scores add up to ${computedOverall}%, which is above the maximum overall score of 100%.`,
      );
    }
    if (
      data.overallScore !== undefined &&
      data.overallScore !== null &&
      computedOverall !== null &&
      Math.abs(data.overallScore - computedOverall) > 0.01
    ) {
      throw new ApiError(
        400,
        `Overall score must equal the sum of the component scores (${computedOverall}%).`,
      );
    }
    if (
      data.status === "published" &&
      (computedOverall === null || !data.selfAssessment.trim())
    ) {
      throw new ApiError(
        400,
        "Add component scores and a teacher assessment before publishing this report.",
      );
    }
    const existing = await TeacherProgressReportModel.findOne({
      classroom: classroom._id,
      student: req.params.studentId,
      period: data.period,
    })
      .select("status publishedAt")
      .lean();
    const publishedAt =
      data.status === "published"
        ? existing?.status === "published"
          ? existing.publishedAt
          : new Date()
        : null;
    const report = await TeacherProgressReportModel.findOneAndUpdate(
      {
        classroom: classroom._id,
        student: req.params.studentId,
        period: data.period,
      },
      {
        $set: {
          teacher: req.user.id,
          overallScore: computedOverall,
          components: data.components,
          selfAssessment: data.selfAssessment,
          feedback: data.feedback,
          status: data.status,
          publishedAt,
        },
      },
      {
        upsert: true,
        new: true,
        runValidators: true,
        setDefaultsOnInsert: true,
      },
    );
    if (data.status === "published" && existing?.status !== "published") {
      await NotificationModel.create({
        user: report.student,
        title: "Progress report published",
        message: `Your teacher published your progress report for ${data.period}.`,
        kind: "grade",
        link: "/student/progress",
      });
      await notifyAdminsOfResult({
        title: "Progress report published",
        message: `A progress report for ${data.period} was published with an overall score of ${computedOverall}%. Review and prepare a certificate if eligible.`,
        link: "/admin/certificates",
      });
    }
    res.json({
      message:
        data.status === "published"
          ? "Progress report published to the student."
          : "Progress report saved as a draft.",
      report,
    });
  }),
);
// 8. Record attendance for a class session
teacherRouter.post(
  "/sessions/:sessionId/attendance",
  asyncHandler(async (req, res) => {
    const teacherId = req.user.id;
    const data = z
      .object({
        records: z.array(
          z.object({
            studentId: z.string().min(1),
            status: z.enum(["present", "absent", "late", "excused"]),
            notes: z.string().default(""),
          }),
        ),
      })
      .parse(req.body);
    const session = await ClassSessionModel.findOne({
      _id: req.params.sessionId,
      teacher: teacherId,
    });
    if (!session) {
      throw new ApiError(404, "Session not found or not assigned to you.");
    }
    const operations = data.records.map((rec) => ({
      updateOne: {
        filter: {
          session: session._id,
          student: new mongoose.Types.ObjectId(rec.studentId),
        },
        update: {
          $set: {
            classroom: session.classroom,
            status: rec.status,
            notes: rec.notes,
            markedBy: new mongoose.Types.ObjectId(teacherId),
          },
        },
        upsert: true,
      },
    }));
    if (operations.length > 0) {
      await AttendanceRecordModel.bulkWrite(operations);
    }
    res.json({ message: "Attendance recorded successfully." });
  }),
);
// 8b. Cohort attendance register (students x sessions with cumulative totals)
teacherRouter.get(
  "/classes/:classId/attendance",
  asyncHandler(async (req, res) => {
    const classroom = await ClassroomModel.findOne({
      _id: req.params.classId,
      teacher: req.user.id,
    })
      .populate("students", "fullName name email avatarUrl")
      .lean();
    if (!classroom) {
      throw new ApiError(404, "Cohort not found or not assigned to you.");
    }
    const [sessions, records] = await Promise.all([
      ClassSessionModel.find({ classroom: classroom._id })
        .sort({ startsAt: 1 })
        .lean(),
      AttendanceRecordModel.find({ classroom: classroom._id }).lean(),
    ]);
    res.json({
      classroom: {
        _id: classroom._id,
        title: classroom.title,
        timeZone: classroom.timeZone,
      },
      register: buildAttendanceRegister({ classroom, sessions, records }),
    });
  }),
);
// 8c. Teacher marks their own attendance for a teaching day (session)
teacherRouter.post(
  "/sessions/:sessionId/teacher-attendance",
  asyncHandler(async (req, res) => {
    const teacherId = req.user.id;
    const data = z
      .object({
        status: z.enum(["present", "late", "absent", "excused"]),
        notes: z.string().max(500).default(""),
      })
      .parse(req.body);
    const session = await ClassSessionModel.findOne({
      _id: req.params.sessionId,
      teacher: teacherId,
    }).lean();
    if (!session) {
      throw new ApiError(404, "Session not found or not assigned to you.");
    }
    const record = await TeacherAttendanceRecordModel.findOneAndUpdate(
      { session: session._id, teacher: teacherId },
      {
        $set: {
          classroom: session.classroom,
          teachingDate: session.startsAt,
          status: data.status,
          notes: data.notes,
          markedBy: teacherId,
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
    res.json({
      message: "Teaching attendance recorded.",
      record,
    });
  }),
);
// 8d. Teacher's own attendance history and cumulative totals
teacherRouter.get(
  "/attendance",
  asyncHandler(async (req, res) => {
    const teacherId = req.user.id;
    const records = await TeacherAttendanceRecordModel.find({
      teacher: teacherId,
    })
      .populate("classroom", "title")
      .populate("session", "title startsAt endsAt")
      .sort({ teachingDate: -1 })
      .lean();
    const summary = { total: records.length, present: 0, late: 0, absent: 0, excused: 0 };
    for (const record of records) {
      if (summary[record.status] !== undefined) summary[record.status] += 1;
    }
    const attended = summary.present + summary.late;
    summary.attendanceRate =
      summary.total > 0 ? Math.round((attended / summary.total) * 100) : 0;
    const upcoming = await ClassSessionModel.countDocuments({
      teacher: teacherId,
      endsAt: { $gte: new Date() },
      status: "scheduled",
    });
    res.json({ records, summary, pendingTeachingDays: upcoming });
  }),
);
// 9. Mark session as completed
teacherRouter.patch(
  "/sessions/:sessionId/complete",
  asyncHandler(async (req, res) => {
    const teacherId = req.user.id;
    const data = z
      .object({
        description: z.string().default(""),
      })
      .parse(req.body);
    const session = await ClassSessionModel.findOne({
      _id: req.params.sessionId,
      teacher: teacherId,
    });
    if (!session) {
      throw new ApiError(404, "Session not found or not assigned to you.");
    }
    session.status = "completed";
    if (data.description) {
      session.description = data.description;
    }
    await session.save();
    res.json({ message: "Session marked as completed.", session });
  }),
);
// 10. Create assessment / quiz
teacherRouter.post(
  "/assessments",
  asyncHandler(async (req, res) => {
    const teacherId = req.user.id;
    const data = z
      .object({
        classroomId: z.string().min(1),
        title: z.string().min(3),
        description: z.string().default(""),
        instructions: z.string().max(4000).default(""),
        assessmentType: z.enum(ASSESSMENT_CATEGORIES).default("quiz"),
        maxScore: z.number().int().min(1).max(1000).default(100),
        timeLimitMinutes: z.number().int().min(5).max(180).default(30),
        passingScorePercentage: z.number().min(1).max(100).default(60),
        questions: z
          .array(
            z
              .object({
                prompt: z.string().min(3),
                options: z.array(z.string().min(1)).min(2),
                correctOptionIndex: z.number().int().min(0),
                explanation: z.string().default(""),
                points: z.number().int().min(1).default(1),
              })
              .superRefine((question, context) => {
                if (question.correctOptionIndex >= question.options.length) {
                  context.addIssue({
                    code: "custom",
                    path: ["correctOptionIndex"],
                    message: "Choose one of the listed answer options.",
                  });
                }
              }),
          )
          .max(200)
          .default([]),
      })
      .superRefine((value, context) => {
        if (
          value.questions.length === 0 &&
          value.instructions.trim().length < 5
        ) {
          context.addIssue({
            code: "custom",
            path: ["instructions"],
            message: "Add instructions for a written assessment.",
          });
        }
        if (
          value.assessmentType === "selfAssessment" &&
          value.questions.length > 0
        ) {
          context.addIssue({
            code: "custom",
            path: ["questions"],
            message:
              "Self-assessments must be written responses reviewed by the teacher.",
          });
        }
      })
      .parse(req.body);
    const classroom = await ClassroomModel.findOne({
      _id: data.classroomId,
      teacher: teacherId,
    });
    if (!classroom) {
      throw new ApiError(
        403,
        "You can only create assessments for your assigned classes.",
      );
    }
    const assessment = await AssessmentModel.create({
      title: data.title,
      description: data.description,
      instructions: data.instructions,
      classroom: classroom._id,
      teacher: teacherId,
      assessmentType: data.assessmentType,
      maxScore: data.maxScore,
      timeLimitMinutes: data.timeLimitMinutes,
      passingScorePercentage: data.passingScorePercentage,
      questions: data.questions,
    });
    if (classroom.students.length > 0) {
      await NotificationModel.insertMany(
        classroom.students.map((studentId) => ({
          user: studentId,
          title: `New Assessment: ${data.title}`,
          message: `An assessment has been assigned in ${classroom.title}.`,
          kind: "assessment",
          link: "/student/assessments",
        })),
      );
    }
    res.status(201).json({ assessment });
  }),
);
// 11. List assessments
teacherRouter.get(
  "/assessments",
  asyncHandler(async (req, res) => {
    const teacherId = req.user.id;
    const assessments = await AssessmentModel.find({ teacher: teacherId })
      .populate("classroom", "title")
      .sort({ createdAt: -1 })
      .lean();
    const assessmentIds = assessments.map((a) => a._id);
    const attemptStats = await AssessmentAttemptModel.aggregate([
      { $match: { assessment: { $in: assessmentIds } } },
      {
        $group: {
          _id: "$assessment",
          total: { $sum: 1 },
          reviewed: {
            $sum: { $cond: [{ $eq: ["$status", "reviewed"] }, 1, 0] },
          },
        },
      },
    ]);
    const statsMap = new Map(attemptStats.map((s) => [s._id.toString(), s]));
    const enriched = assessments.map((a) => {
      const stats = statsMap.get(a._id.toString());
      return {
        ...a,
        attemptCount: stats?.total ?? 0,
        reviewedCount: stats?.reviewed ?? 0,
      };
    });
    res.json({ assessments: enriched });
  }),
);
// 12. View students assigned to teacher
teacherRouter.get(
  "/students",
  asyncHandler(async (req, res) => {
    const teacherId = req.user.id;
    const classes = await ClassroomModel.find({ teacher: teacherId })
      .select("students title")
      .lean();
    const studentIds = Array.from(
      new Set(classes.flatMap((c) => c.students.map((s) => s.toString()))),
    );
    const students = await UserModel.find({ _id: { $in: studentIds } })
      .select("fullName email studentProfile createdAt")
      .lean();
    res.json({ students });
  }),
);

// 13. Classroom Discussions
teacherRouter.get(
  "/classes/:classId/discussions",
  asyncHandler(async (req, res) => {
    const teacherId = req.user.id;
    const isTeacher = await ClassroomModel.exists({
      _id: req.params.classId,
      teacher: teacherId,
    });
    if (!isTeacher) {
      throw new ApiError(
        403,
        "You can only view discussions for classes assigned to you.",
      );
    }
    const discussions = await DiscussionModel.find({
      classroom: req.params.classId,
    })
      .populate("author", "fullName name email avatarUrl role")
      .populate("replies.author", "fullName name email avatarUrl role")
      .sort({ isPinned: -1, createdAt: -1 })
      .lean();
    res.json({ discussions });
  }),
);

teacherRouter.post(
  "/classes/:classId/discussions",
  asyncHandler(async (req, res) => {
    const teacherId = req.user.id;
    const isTeacher = await ClassroomModel.exists({
      _id: req.params.classId,
      teacher: teacherId,
    });
    if (!isTeacher) {
      throw new ApiError(
        403,
        "You can only post discussions in classes assigned to you.",
      );
    }
    const data = z
      .object({
        title: z.string().trim().min(3).max(150),
        content: z.string().trim().min(5).max(3000),
        category: z
          .enum(["general", "assignment", "lesson", "question", "announcement"])
          .default("general"),
        isPinned: z.boolean().default(false),
      })
      .parse(req.body);

    const discussion = await DiscussionModel.create({
      classroom: req.params.classId,
      author: teacherId,
      title: data.title,
      content: data.content,
      category: data.category,
      isPinned: data.isPinned,
    });

    const populated = await DiscussionModel.findById(discussion._id)
      .populate("author", "fullName name email avatarUrl role")
      .lean();

    const classroom = await ClassroomModel.findById(req.params.classId)
      .select("title students")
      .lean();
    if (classroom && classroom.students?.length > 0) {
      await NotificationModel.insertMany(
        classroom.students.map((studentId) => ({
          user: studentId,
          title:
            data.category === "announcement"
              ? `📢 Cohort Announcement: ${data.title}`
              : `New Discussion in ${classroom.title}: ${data.title}`,
          message:
            data.content.length > 200
              ? `${data.content.slice(0, 200)}…`
              : data.content,
          kind: data.category === "announcement" ? "announcement" : "general",
          link: `/learn/${req.params.classId}`,
        })),
      );
    }

    res
      .status(201)
      .json({ message: "Discussion topic created.", discussion: populated });
  }),
);

teacherRouter.post(
  "/classes/:classId/discussions/:discussionId/reply",
  asyncHandler(async (req, res) => {
    const teacherId = req.user.id;
    const isTeacher = await ClassroomModel.exists({
      _id: req.params.classId,
      teacher: teacherId,
    });
    if (!isTeacher) {
      throw new ApiError(
        403,
        "You can only reply to discussions in classes assigned to you.",
      );
    }
    const data = z
      .object({
        content: z.string().trim().min(2).max(2000),
      })
      .parse(req.body);

    const discussion = await DiscussionModel.findOne({
      _id: req.params.discussionId,
      classroom: req.params.classId,
    });
    if (!discussion) {
      throw new ApiError(404, "Discussion not found.");
    }

    discussion.replies.push({
      author: teacherId,
      content: data.content,
      createdAt: new Date(),
    });
    await discussion.save();

    const updated = await DiscussionModel.findById(discussion._id)
      .populate("author", "fullName name email avatarUrl role")
      .populate("replies.author", "fullName name email avatarUrl role")
      .lean();

    res.status(201).json({ message: "Reply added.", discussion: updated });
  }),
);

// 14. Notifications
teacherRouter.patch(
  "/notifications/read-all",
  asyncHandler(async (req, res) => {
    await NotificationModel.updateMany(
      { user: req.user.id, isRead: false },
      { isRead: true },
    );
    res.json({ message: "All notifications marked as read." });
  }),
);

// 15. View announcements
teacherRouter.get(
  "/announcements",
  asyncHandler(async (req, res) => {
    const teacherId = req.user.id;
    const taughtClasses = await ClassroomModel.find({ teacher: teacherId })
      .select("_id")
      .lean();
    const classIds = taughtClasses.map((c) => c._id);
    const announcements = await AnnouncementModel.find({
      $or: [
        { target: "all" },
        { target: "all_teachers" },
        { target: "classroom", classroom: { $in: classIds } },
      ],
    })
      .populate("author", "fullName")
      .populate("classroom", "title")
      .sort({ createdAt: -1 })
      .lean();
    res.json({ announcements });
  }),
);
