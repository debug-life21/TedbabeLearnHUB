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
import { UserModel } from "../models/User.js";
import { AssignmentModel } from "../models/Assignment.js";
import { AssignmentSubmissionModel } from "../models/AssignmentSubmission.js";
import { AssessmentModel } from "../models/Assessment.js";
import { AssessmentAttemptModel } from "../models/AssessmentAttempt.js";
import { AttendanceRecordModel } from "../models/AttendanceRecord.js";
import { AnnouncementModel } from "../models/Announcement.js";
import { CertificateModel } from "../models/Certificate.js";
import { DiscussionModel } from "../models/Discussion.js";
import { CourseModel } from "../models/Course.js";
import { TeacherProgressReportModel } from "../models/TeacherProgressReport.js";
import {
  cleanupSubmissionFiles,
  persistSubmissionFiles,
  pickAttachment,
  streamSubmissionFile,
} from "../utils/submissionFiles.js";
export const studentRouter = Router();
studentRouter.use(requireAuth, requireRole("student"));

const uploadedFileSchema = z.object({
  originalFilename: z.string().min(1).max(200),
  mimeType: z.string().min(1).max(120),
  base64Data: z.string().min(1),
});

const submissionLinkSchema = z.object({
  label: z.string().trim().max(120).optional().default(""),
  url: z.string().trim().url(),
});

const attachmentsSchema = z
  .array(uploadedFileSchema)
  .max(10)
  .optional()
  .default([]);
const linksSchema = z
  .array(submissionLinkSchema)
  .max(10)
  .optional()
  .default([]);

// Keep assessment results hidden from students until the teacher reviews them.
function sanitizeAttemptForStudent(attempt) {
  if (!attempt) return attempt;
  if (attempt.status === "reviewed") return attempt;
  return {
    _id: attempt._id,
    assessment: attempt.assessment,
    classroom: attempt.classroom,
    status: attempt.status,
    responseText: attempt.responseText ?? "",
    submissionLinks: attempt.submissionLinks ?? [],
    attachments: attempt.attachments ?? [],
    completedAt: attempt.completedAt,
    createdAt: attempt.createdAt,
    updatedAt: attempt.updatedAt,
  };
}
// 1. Student Dashboard
studentRouter.get(
  "/dashboard",
  asyncHandler(async (req, res) => {
    const studentId = req.user.id;
    const now = new Date();
    const [student, classes, notifications] = await Promise.all([
      UserModel.findById(studentId).select("-passwordHash").lean(),
      ClassroomModel.find({ students: studentId })
        .populate("course")
        .populate("teacher", "fullName email")
        .sort({ createdAt: -1 })
        .lean(),
      NotificationModel.find({ user: studentId })
        .sort({ createdAt: -1 })
        .limit(NOTIFICATION_CAPS.student)
        .lean(),
    ]);
    // Prune any notifications beyond the cap in the background (fire-and-forget)
    void pruneNotifications(studentId, NOTIFICATION_CAPS.student);
    const classIds = classes.map((classroom) => classroom._id);
    const [upcomingLessons, assignments, submissions] = await Promise.all([
      ClassSessionModel.find({
        classroom: { $in: classIds },
        endsAt: { $gte: now },
        status: "scheduled",
      })
        .populate("classroom", "title timeZone")
        .sort({ startsAt: 1 })
        .limit(50)
        .lean(),
      AssignmentModel.find({ classroom: { $in: classIds } })
        .select("_id")
        .lean(),
      AssignmentSubmissionModel.find({ student: studentId }).lean(),
    ]);
    res.json({
      student,
      overview: {
        assignedCourses: classes.length,
        nextLesson: upcomingLessons[0] ?? null,
        placementStatus: student?.studentProfile?.placementStatus ?? "pending",
        pendingAssignments: Math.max(
          0,
          assignments.length - submissions.length,
        ),
      },
      classes,
      upcomingLessons,
      notifications,
    });
  }),
);
// 2. Classes list
studentRouter.get(
  "/classes",
  asyncHandler(async (req, res) => {
    const studentId = req.user.id;
    const classes = await ClassroomModel.find({ students: studentId })
      .populate("course")
      .populate("teacher", "fullName email")
      .sort({ createdAt: -1 })
      .lean();
    const classIds = classes.map((c) => c._id);
    const sessions = await ClassSessionModel.find({
      classroom: { $in: classIds },
    })
      .populate("classroom", "title timeZone")
      .sort({ startsAt: 1 })
      .lean();
    res.json({ classes, sessions });
  }),
);
// 3. Assignments list for enrolled classes
studentRouter.get(
  "/assignments",
  asyncHandler(async (req, res) => {
    const studentId = req.user.id;
    const enrolledClasses = await ClassroomModel.find({ students: studentId })
      .select("_id")
      .lean();
    const classIds = enrolledClasses.map((c) => c._id);
    const [assignments, submissions] = await Promise.all([
      AssignmentModel.find({ classroom: { $in: classIds } })
        .populate("classroom", "title")
        .populate("teacher", "fullName")
        .sort({ dueDate: 1 })
        .lean(),
      AssignmentSubmissionModel.find({ student: studentId }).lean(),
    ]);
    const submissionMap = new Map(
      submissions.map((s) => [s.assignment.toString(), s]),
    );
    const enriched = assignments.map((a) => ({
      ...a,
      submission: submissionMap.get(a._id.toString()) ?? null,
    }));
    res.json({ assignments: enriched });
  }),
);
// 4. Submit assignment (text + file uploads + links)
studentRouter.post(
  "/assignments/:assignmentId/submit",
  asyncHandler(async (req, res) => {
    const studentId = req.user.id;
    const data = z
      .object({
        textResponse: z.string().max(20000).optional().default(""),
        links: linksSchema,
        files: attachmentsSchema,
      })
      .parse(req.body);
    const assignment = await AssignmentModel.findById(req.params.assignmentId);
    if (!assignment) {
      throw new ApiError(404, "Assignment not found.");
    }
    const isEnrolled = await ClassroomModel.exists({
      _id: assignment.classroom,
      students: studentId,
    });
    if (!isEnrolled) {
      throw new ApiError(
        403,
        "You can only submit assignments for classes you are enrolled in.",
      );
    }
    if (
      !data.textResponse.trim() &&
      data.links.length === 0 &&
      data.files.length === 0
    ) {
      throw new ApiError(
        400,
        "Add a written response, a link, or a file before submitting.",
      );
    }
    const existingSubmission = await AssignmentSubmissionModel.findOne({
      assignment: assignment._id,
      student: studentId,
    });
    if (existingSubmission && existingSubmission.status === "graded") {
      throw new ApiError(
        400,
        "This assignment has already been graded and cannot be resubmitted.",
      );
    }
    const attachments = data.files.length
      ? await persistSubmissionFiles(data.files, {
          errorPrefix: "Assignment files",
        })
      : (existingSubmission?.attachments ?? []);
    let submission;
    try {
      submission = await AssignmentSubmissionModel.findOneAndUpdate(
        { assignment: assignment._id, student: studentId },
        {
          classroom: assignment.classroom,
          textResponse: data.textResponse,
          submissionLinks: data.links,
          attachments,
          status: existingSubmission ? "resubmitted" : "submitted",
          score: null,
          feedback: "",
          gradedBy: null,
          gradedAt: null,
        },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      );
    } catch (error) {
      if (data.files.length) await cleanupSubmissionFiles(attachments);
      throw error;
    }
    if (data.files.length && existingSubmission?.attachments?.length) {
      await cleanupSubmissionFiles(existingSubmission.attachments);
    }
    await NotificationModel.create({
      user: assignment.teacher,
      title: "New Assignment Submission",
      message: `A student submitted work for "${assignment.title}".`,
      kind: "submission",
      link: "/teacher/assignments",
    });
    res.status(201).json({
      message:
        "Assignment submitted successfully. Your teacher will review and return your result.",
      submission,
    });
  }),
);
// 4b. Stream a file attached to the student's own submission
studentRouter.get(
  "/submissions/:submissionId/files/:index",
  asyncHandler(async (req, res) => {
    const submission = await AssignmentSubmissionModel.findOne({
      _id: req.params.submissionId,
      student: req.user.id,
    }).lean();
    if (!submission) {
      throw new ApiError(404, "Submission not found.");
    }
    await streamSubmissionFile(
      req,
      res,
      pickAttachment(submission.attachments, req.params.index),
    );
  }),
);
// 5. Assessments list
studentRouter.get(
  "/assessments",
  asyncHandler(async (req, res) => {
    const studentId = req.user.id;
    const enrolledClasses = await ClassroomModel.find({ students: studentId })
      .select("_id")
      .lean();
    const classIds = enrolledClasses.map((c) => c._id);
    const [assessments, attempts] = await Promise.all([
      AssessmentModel.find({ classroom: { $in: classIds }, isPublished: true })
        .populate("classroom", "title")
        .select("-questions.correctOptionIndex -questions.explanation")
        .sort({ createdAt: -1 })
        .lean(),
      AssessmentAttemptModel.find({ student: studentId }).lean(),
    ]);
    const attemptsMap = new Map(
      attempts.map((att) => [att.assessment.toString(), att]),
    );
    const enriched = assessments.map((assessment) => ({
      ...assessment,
      latestAttempt:
        sanitizeAttemptForStudent(attemptsMap.get(assessment._id.toString())) ??
        null,
    }));
    res.json({ assessments: enriched });
  }),
);
// 6. Get single assessment to take (WITHOUT correct answers!)
studentRouter.get(
  "/assessments/:assessmentId",
  asyncHandler(async (req, res) => {
    const studentId = req.user.id;
    const assessment = await AssessmentModel.findById(req.params.assessmentId)
      .populate("classroom", "title")
      .select("-questions.correctOptionIndex -questions.explanation")
      .lean();
    if (!assessment) {
      throw new ApiError(404, "Assessment not found.");
    }
    const isEnrolled = await ClassroomModel.exists({
      _id: assessment.classroom,
      students: studentId,
    });
    if (!isEnrolled) {
      throw new ApiError(403, "You do not have access to this assessment.");
    }
    const previousAttempt = await AssessmentAttemptModel.findOne({
      assessment: assessment._id,
      student: studentId,
    }).lean();
    res.json({
      assessment,
      previousAttempt: sanitizeAttemptForStudent(previousAttempt),
    });
  }),
);
// 7. Submit assessment for teacher review (files + links + optional quiz answers)
// Results are NOT released here — the teacher issues the final score.
studentRouter.post(
  "/assessments/:assessmentId/attempt",
  asyncHandler(async (req, res) => {
    const studentId = req.user.id;
    const data = z
      .object({
        answers: z
          .array(
            z.object({
              questionId: z.string(),
              selectedOption: z.number().int(),
            }),
          )
          .max(200)
          .optional()
          .default([]),
        responseText: z.string().max(20000).optional().default(""),
        links: linksSchema,
        files: attachmentsSchema,
      })
      .parse(req.body);
    const assessment = await AssessmentModel.findById(req.params.assessmentId);
    if (!assessment) {
      throw new ApiError(404, "Assessment not found.");
    }
    const isEnrolled = await ClassroomModel.exists({
      _id: assessment.classroom,
      students: studentId,
    });
    if (!isEnrolled) {
      throw new ApiError(403, "You do not have access to this assessment.");
    }
    const hasQuestions = assessment.questions.length > 0;
    if (hasQuestions && data.answers.length === 0) {
      throw new ApiError(
        400,
        "Answer the questions before submitting this assessment.",
      );
    }
    if (
      !hasQuestions &&
      !data.responseText.trim() &&
      data.links.length === 0 &&
      data.files.length === 0
    ) {
      throw new ApiError(
        400,
        "Add a written response, a link, or a file before submitting.",
      );
    }
    const existingAttempt = await AssessmentAttemptModel.findOne({
      assessment: assessment._id,
      student: studentId,
    });
    if (existingAttempt && existingAttempt.status === "reviewed") {
      throw new ApiError(
        400,
        "This assessment has already been reviewed and cannot be resubmitted.",
      );
    }
    // Record the maximum possible score so teachers can grade consistently.
    // Quiz-style assessments derive it from question points; written/category
    // assessments use the maximum marks the teacher configured.
    const questionPoints = assessment.questions.reduce(
      (total, question) => total + (question.points || 1),
      0,
    );
    const maxScore = questionPoints > 0 ? questionPoints : assessment.maxScore || 100;
    const evaluatedAnswers = hasQuestions
      ? assessment.questions.map((question) => {
          const studentAns = data.answers.find(
            (a) => a.questionId === question._id.toString(),
          );
          return {
            questionId: question._id,
            selectedOption:
              studentAns !== undefined ? studentAns.selectedOption : -1,
          };
        })
      : [];
    const attachments = data.files.length
      ? await persistSubmissionFiles(data.files, {
          errorPrefix: "Assessment files",
        })
      : (existingAttempt?.attachments ?? []);
    let attempt;
    try {
      attempt = await AssessmentAttemptModel.findOneAndUpdate(
        { assessment: assessment._id, student: studentId },
        {
          classroom: assessment.classroom,
          answers: evaluatedAnswers,
          responseText: data.responseText,
          submissionLinks: data.links,
          attachments,
          maxScore,
          status: "submitted",
          score: null,
          percentage: null,
          passed: null,
          feedback: "",
          reviewedBy: null,
          reviewedAt: null,
          completedAt: new Date(),
        },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      );
    } catch (error) {
      if (data.files.length) await cleanupSubmissionFiles(attachments);
      throw error;
    }
    if (data.files.length && existingAttempt?.attachments?.length) {
      await cleanupSubmissionFiles(existingAttempt.attachments);
    }
    await NotificationModel.create({
      user: assessment.teacher,
      title: "New Assessment Submission",
      message: `A student submitted "${assessment.title}" for review.`,
      kind: "submission",
      link: "/teacher/assessments",
    });
    res.status(201).json({
      message:
        "Assessment submitted. Your teacher will review and release your result.",
      attempt: { status: "submitted", maxScore },
    });
  }),
);
// 7b. Stream a file attached to the student's own assessment attempt
studentRouter.get(
  "/attempts/:attemptId/files/:index",
  asyncHandler(async (req, res) => {
    const attempt = await AssessmentAttemptModel.findOne({
      _id: req.params.attemptId,
      student: req.user.id,
    }).lean();
    if (!attempt) {
      throw new ApiError(404, "Assessment submission not found.");
    }
    await streamSubmissionFile(
      req,
      res,
      pickAttachment(attempt.attachments, req.params.index),
    );
  }),
);
// 8. View Attendance history with cumulative totals per cohort
studentRouter.get(
  "/attendance",
  asyncHandler(async (req, res) => {
    const studentId = req.user.id;
    const classes = await ClassroomModel.find({ students: studentId })
      .populate("course", "title")
      .select("title course")
      .lean();
    const classIds = classes.map((c) => c._id);
    const [records, sessions] = await Promise.all([
      AttendanceRecordModel.find({ student: studentId, classroom: { $in: classIds } })
        .populate("session", "title startsAt endsAt")
        .populate("classroom", "title")
        .sort({ createdAt: -1 })
        .lean(),
      ClassSessionModel.find({ classroom: { $in: classIds } })
        .select("classroom startsAt status")
        .lean(),
    ]);

    const summary = {
      total: records.length,
      present: 0,
      absent: 0,
      late: 0,
      excused: 0,
      attendanceRate: 0,
    };
    for (const record of records) {
      if (summary[record.status] !== undefined) summary[record.status] += 1;
    }
    const attended = summary.present + summary.late;
    summary.attendanceRate =
      summary.total > 0 ? Math.round((attended / summary.total) * 100) : 0;

    // Per-cohort cumulative totals and how many sessions were held.
    const classes_summary = classes.map((classroom) => {
      const classRecords = records.filter(
        (record) => record.classroom?._id?.toString() === classroom._id.toString(),
      );
      const present = classRecords.filter((r) => r.status === "present").length;
      const late = classRecords.filter((r) => r.status === "late").length;
      const absent = classRecords.filter((r) => r.status === "absent").length;
      const excused = classRecords.filter((r) => r.status === "excused").length;
      return {
        classroom: {
          _id: classroom._id,
          title: classroom.title,
          courseTitle: classroom.course?.title ?? "",
        },
        sessionsHeld: sessions.filter(
          (s) => s.classroom?.toString() === classroom._id.toString(),
        ).length,
        marked: classRecords.length,
        present,
        late,
        absent,
        excused,
        attendanceRate:
          classRecords.length > 0
            ? Math.round(((present + late) / classRecords.length) * 100)
            : 0,
      };
    });

    res.json({ records, summary, classes: classes_summary });
  }),
);
// 9. Student progress is visible only through teacher-published reports.
studentRouter.get(
  "/progress",
  asyncHandler(async (req, res) => {
    const reports = await TeacherProgressReportModel.find({
      student: req.user.id,
      status: "published",
    })
      .populate("classroom", "title")
      .populate("teacher", "fullName")
      .sort({ publishedAt: -1, createdAt: -1 })
      .lean();
    res.json({
      reports,
      progress: reports[0] ?? null,
    });
  }),
);
// 10. Profile preferences update
studentRouter.patch(
  "/profile",
  asyncHandler(async (req, res) => {
    const studentId = req.user.id;
    const data = z
      .object({
        learningInterests: z.array(z.string()).optional(),
        learningGoals: z.string().optional(),
        currentSkillLevel: z.string().optional(),
        preferredSchedule: z.string().optional(),
        preferredCourseIds: z.array(z.string()).max(20).optional(),
        preferredCourseNotes: z.string().trim().max(1200).optional(),
        preferredLearningModes: z
          .array(z.enum(["live", "self_paced", "hybrid"]))
          .max(3)
          .optional(),
        weeklyStudyHours: z.coerce.number().min(1).max(80).optional(),
        timeZone: z.string().trim().max(80).optional(),
        preferredLanguage: z.enum(["am", "en"]).optional(),
      })
      .parse(req.body);
    const preferredCourseIds = data.preferredCourseIds ?? [];
    if (preferredCourseIds.length > 0) {
      if (
        preferredCourseIds.some((courseId) => !/^[a-f\d]{24}$/i.test(courseId))
      ) {
        throw new ApiError(
          400,
          "Select valid courses from the course catalog.",
        );
      }
      const availableCourses = await CourseModel.countDocuments({
        _id: { $in: preferredCourseIds },
        status: "published",
      });
      if (availableCourses !== new Set(preferredCourseIds).size) {
        throw new ApiError(
          400,
          "One or more selected courses are no longer available.",
        );
      }
    }
    const user = await UserModel.findById(studentId);
    if (!user) {
      throw new ApiError(404, "Student not found.");
    }
    if (!user.studentProfile) {
      user.studentProfile = {
        learningInterests: [],
        learningGoals: "",
        currentSkillLevel: "",
        preferredSchedule: "",
        preferredLanguage: "en",
        placementStatus: "pending",
      };
    }
    if (data.learningInterests !== undefined)
      user.studentProfile.learningInterests = data.learningInterests;
    if (data.learningGoals !== undefined)
      user.studentProfile.learningGoals = data.learningGoals;
    if (data.currentSkillLevel !== undefined)
      user.studentProfile.currentSkillLevel = data.currentSkillLevel;
    if (data.preferredSchedule !== undefined)
      user.studentProfile.preferredSchedule = data.preferredSchedule;
    if (data.preferredCourseIds !== undefined) {
      user.studentProfile.preferredCourseIds = preferredCourseIds;
      user.studentProfile.courseSelectionUpdatedAt = new Date();
    }
    if (data.preferredCourseNotes !== undefined)
      user.studentProfile.preferredCourseNotes = data.preferredCourseNotes;
    if (data.preferredLearningModes !== undefined)
      user.studentProfile.preferredLearningModes = data.preferredLearningModes;
    if (data.weeklyStudyHours !== undefined)
      user.studentProfile.weeklyStudyHours = data.weeklyStudyHours;
    if (data.timeZone !== undefined)
      user.studentProfile.timeZone = data.timeZone;
    if (data.preferredLanguage !== undefined) {
      user.studentProfile.preferredLanguage = data.preferredLanguage;
      user.languagePreference = data.preferredLanguage;
    }
    await user.save();
    res.json({
      message: "Profile preferences updated successfully.",
      profile: user.studentProfile,
    });
  }),
);
// 11. View announcements
studentRouter.get(
  "/announcements",
  asyncHandler(async (req, res) => {
    const studentId = req.user.id;
    const enrolledClasses = await ClassroomModel.find({ students: studentId })
      .select("_id")
      .lean();
    const classIds = enrolledClasses.map((c) => c._id);
    const announcements = await AnnouncementModel.find({
      $or: [
        { target: "all" },
        { target: "all_students" },
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

// 12. Classroom Discussions
studentRouter.get(
  "/classes/:classId/discussions",
  asyncHandler(async (req, res) => {
    const studentId = req.user.id;
    const isEnrolled = await ClassroomModel.exists({
      _id: req.params.classId,
      students: studentId,
    });
    if (!isEnrolled) {
      throw new ApiError(
        403,
        "You can only view discussions for your assigned classes.",
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

studentRouter.post(
  "/classes/:classId/discussions",
  asyncHandler(async (req, res) => {
    const studentId = req.user.id;
    const isEnrolled = await ClassroomModel.exists({
      _id: req.params.classId,
      students: studentId,
    });
    if (!isEnrolled) {
      throw new ApiError(
        403,
        "You can only post discussions in your assigned classes.",
      );
    }
    const data = z
      .object({
        title: z.string().trim().min(3).max(150),
        content: z.string().trim().min(5).max(3000),
        category: z
          .enum(["general", "assignment", "lesson", "question", "announcement"])
          .default("general"),
      })
      .parse(req.body);

    const discussion = await DiscussionModel.create({
      classroom: req.params.classId,
      author: studentId,
      title: data.title,
      content: data.content,
      category: data.category,
    });

    const populated = await DiscussionModel.findById(discussion._id)
      .populate("author", "fullName name email avatarUrl role")
      .lean();

    res
      .status(201)
      .json({ message: "Discussion topic created.", discussion: populated });
  }),
);

studentRouter.post(
  "/classes/:classId/discussions/:discussionId/reply",
  asyncHandler(async (req, res) => {
    const studentId = req.user.id;
    const isEnrolled = await ClassroomModel.exists({
      _id: req.params.classId,
      students: studentId,
    });
    if (!isEnrolled) {
      throw new ApiError(
        403,
        "You can only reply to discussions in your assigned classes.",
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
      author: studentId,
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

// 13. Student Certificates (issued by the academy after reviewing results)
studentRouter.get(
  "/certificates",
  asyncHandler(async (req, res) => {
    const studentId = req.user.id;
    const certificates = await CertificateModel.find({
      student: studentId,
    })
      .populate("course", "title slug thumbnailUrl")
      .populate("classroom", "title")
      .sort({ issueDate: -1 })
      .lean();
    res.json({ certificates });
  }),
);

// 14. Teacher-published results for the signed-in student
studentRouter.get(
  "/results",
  asyncHandler(async (req, res) => {
    const studentId = req.user.id;
    const [attempts, reports] = await Promise.all([
      AssessmentAttemptModel.find({ student: studentId, status: "reviewed" })
        .populate("assessment", "title assessmentType maxScore")
        .populate("classroom", "title")
        .sort({ reviewedAt: -1, createdAt: -1 })
        .lean(),
      TeacherProgressReportModel.find({ student: studentId, status: "published" })
        .populate("classroom", "title")
        .populate("teacher", "fullName name")
        .sort({ publishedAt: -1 })
        .lean(),
    ]);
    res.json({ attempts, reports });
  }),
);

// 15. Notification management
studentRouter.patch(
  "/notifications/read-all",
  asyncHandler(async (req, res) => {
    await NotificationModel.updateMany(
      { user: req.user.id, isRead: false },
      { isRead: true },
    );
    res.json({ message: "All notifications marked as read." });
  }),
);
