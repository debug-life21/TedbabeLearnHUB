import mongoose from "mongoose";
import { Router } from "express";
import { pipeline } from "node:stream/promises";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { hashPassword, requireAuth, requireRole } from "../auth.js";
import { asyncHandler, ApiError } from "../lib/http.js";
import { AuditLogModel } from "../models/AuditLog.js";
import { ClassroomModel } from "../models/Classroom.js";
import { ClassSessionModel } from "../models/ClassSession.js";
import { ContactInquiryModel } from "../models/ContactInquiry.js";
import { CourseModel } from "../models/Course.js";
import { FAQModel } from "../models/FAQ.js";
import { LearningCategoryModel } from "../models/LearningCategory.js";
import {
  NotificationModel,
  pruneNotifications,
  NOTIFICATION_CAPS,
} from "../models/Notification.js";
import { TeacherApplicationModel } from "../models/TeacherApplication.js";
import { UserModel } from "../models/User.js";
import { AnnouncementModel } from "../models/Announcement.js";
import { PlatformSettingModel } from "../models/PlatformSetting.js";
import { AttendanceRecordModel } from "../models/AttendanceRecord.js";
import { TeacherAttendanceRecordModel } from "../models/TeacherAttendanceRecord.js";
import { AssessmentAttemptModel } from "../models/AssessmentAttempt.js";
import { AssignmentModel } from "../models/Assignment.js";
import { AssignmentSubmissionModel } from "../models/AssignmentSubmission.js";
import { AssessmentModel } from "../models/Assessment.js";
import { CertificateModel } from "../models/Certificate.js";
import { DiscussionModel } from "../models/Discussion.js";
import { TeacherProgressReportModel } from "../models/TeacherProgressReport.js";
import { LearningResourceModel } from "../models/LearningResource.js";
import { slugify } from "../utils.js";
import { buildAttendanceRegister } from "../utils/attendanceRegister.js";
import {
  buildRecurringSessions,
  recurrenceSchema,
  RECURRENCE_LABELS,
} from "../utils/recurrence.js";
import {
  cleanupSubmissionFiles,
  pickAttachment,
  streamSubmissionFile,
} from "../utils/submissionFiles.js";
import { deleteStoredFile, getStoredFileStream } from "../lib/storage.js";
import {
  sendAnnouncementEmail,
  sendClassPlacementEmail,
  sendSessionScheduledEmail,
} from "../utils/email.js";
export const adminRouter = Router();
adminRouter.use(requireAuth, requireRole("hub_admin"));
function isValidTimeZone(timeZone) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone }).format();
    return true;
  } catch {
    return false;
  }
}

// Minimum published overall score required before an administrator can issue a
// certificate of completion.
const CERTIFICATE_PASS_MARK = 70;

function makeCertificateNumber() {
  return `TLH-${new Date().getFullYear()}-${randomBytes(4)
    .toString("hex")
    .toUpperCase()}`;
}
// Admin: get own notifications (capped at 20)
adminRouter.get(
  "/notifications",
  asyncHandler(async (req, res) => {
    const adminId = req.user.id;
    const notifications = await NotificationModel.find({ user: adminId })
      .sort({ createdAt: -1 })
      .limit(NOTIFICATION_CAPS.hub_admin)
      .lean();
    void pruneNotifications(adminId, NOTIFICATION_CAPS.hub_admin);
    res.json({ notifications });
  }),
);
adminRouter.get(
  "/teachers/pending",
  asyncHandler(async (_req, res) => {
    const teachers = await UserModel.find({
      role: "teacher",
      isDeleted: { $ne: true },
      teacherStatus: "pending",
      isVerified: { $ne: false },
    })
      .select("-password -passwordHash -verificationCode")
      .sort({ createdAt: 1 })
      .lean();
    res.json({ teachers });
  }),
);
async function updateTeacherReview(req, res, status) {
  if (!mongoose.isValidObjectId(req.params.id)) {
    throw new ApiError(400, "Invalid teacher ID.");
  }
  const teacher = await UserModel.findOne({
    _id: req.params.id,
    role: "teacher",
    isDeleted: { $ne: true },
  });
  if (!teacher) {
    throw new ApiError(404, "Teacher not found.");
  }
  if (!teacher.isVerified) {
    throw new ApiError(
      409,
      "The teacher must verify their email before approval.",
    );
  }
  if (teacher.teacherStatus !== "pending") {
    throw new ApiError(
      409,
      "This teacher application has already been reviewed.",
    );
  }
  teacher.teacherStatus = status;
  teacher.accountStatus = status === "approved" ? "active" : "suspended";
  await teacher.save();
  await TeacherApplicationModel.findOneAndUpdate(
    { user: teacher._id },
    {
      status,
      reviewedBy: new mongoose.Types.ObjectId(req.user.id),
      reviewedAt: new Date(),
    },
  );
  await NotificationModel.create({
    user: teacher._id,
    title:
      status === "approved"
        ? "Teacher application approved"
        : "Teacher application update",
    message:
      status === "approved"
        ? "Your teacher account has been approved. You can now sign in."
        : "Your teacher application was rejected.",
    kind: "teacher_application",
    link: "/dashboard",
  });
  // Prune teacher's notifications to cap
  void pruneNotifications(teacher._id, NOTIFICATION_CAPS.teacher);
  await writeAudit(
    req.user.id,
    `teacher_application_${status}`,
    "User",
    teacher._id.toString(),
  );
  res.json({ message: `Teacher application ${status}.` });
}
adminRouter.patch(
  "/teachers/:id/approve",
  asyncHandler(async (req, res) => {
    const data = z
      .object({ status: z.enum(["approved", "rejected"]).default("approved") })
      .parse(req.body);
    await updateTeacherReview(req, res, data.status);
  }),
);
adminRouter.patch(
  "/teachers/:id/reject",
  asyncHandler(async (req, res) => {
    await updateTeacherReview(req, res, "rejected");
  }),
);
async function writeAudit(actorId, action, targetType, targetId, details = {}) {
  await AuditLogModel.create({
    actor: actorId,
    action,
    targetType,
    targetId,
    details,
  });
}
adminRouter.get(
  "/dashboard",
  asyncHandler(async (_req, res) => {
    const now = new Date();
    const [
      totalStudents,
      activeStudents,
      pendingStudentPlacement,
      totalTeachers,
      activeTeachers,
      pendingTeacherApplications,
      activeCourses,
      activeClasses,
      upcomingClasses,
      pendingSupportInquiries,
      certificatesIssued,
      teacherAttendanceRecords,
    ] = await Promise.all([
      UserModel.countDocuments({ role: "student", isDeleted: { $ne: true } }),
      UserModel.countDocuments({
        role: "student",
        isDeleted: { $ne: true },
        accountStatus: "active",
      }),
      UserModel.countDocuments({
        role: "student",
        isDeleted: { $ne: true },
        "studentProfile.placementStatus": "pending",
      }),
      UserModel.countDocuments({ role: "teacher", isDeleted: { $ne: true } }),
      UserModel.countDocuments({
        role: "teacher",
        isDeleted: { $ne: true },
        accountStatus: "active",
      }),
      TeacherApplicationModel.countDocuments({ status: "pending" }),
      CourseModel.countDocuments({ status: "published" }),
      ClassroomModel.countDocuments({ status: { $in: ["planned", "active"] } }),
      ClassSessionModel.countDocuments({
        startsAt: { $gte: now },
        status: "scheduled",
      }),
      ContactInquiryModel.countDocuments({ status: { $ne: "closed" } }),
      CertificateModel.countDocuments({ status: "valid" }),
      TeacherAttendanceRecordModel.countDocuments(),
    ]);
    res.json({
      metrics: {
        totalStudents,
        activeStudents,
        pendingStudentPlacement,
        totalTeachers,
        activeTeachers,
        pendingTeacherApplications,
        activeCourses,
        activeClasses,
        upcomingClasses,
        pendingSupportInquiries,
        certificatesIssued,
        teacherAttendanceRecords,
      },
    });
  }),
);
adminRouter.get(
  "/teacher-applications",
  asyncHandler(async (_req, res) => {
    const applications = await TeacherApplicationModel.find()
      .populate(
        "user",
        "fullName email accountStatus languagePreference isVerified isDeleted",
      )
      .sort({ createdAt: -1 })
      .lean();
    res.json({
      applications: applications.filter(
        (application) =>
          application.user &&
          !application.user.isDeleted &&
          application.user.isVerified !== false,
      ),
    });
  }),
);
adminRouter.get(
  "/teacher-applications/:applicationId/documents/:document",
  asyncHandler(async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.applicationId)) {
      throw new ApiError(400, "Invalid teacher application ID.");
    }
    const application = await TeacherApplicationModel.findById(
      req.params.applicationId,
    ).lean();
    if (!application) {
      throw new ApiError(404, "Teacher application not found.");
    }
    const document =
      req.params.document === "cv"
        ? application.documents?.cv
        : /^certificate-\d+$/.test(req.params.document)
          ? application.documents?.certificates?.[
              Number(req.params.document.slice("certificate-".length))
            ]
          : null;
    if (!document?.key) {
      throw new ApiError(404, "Application document not found.");
    }
    const storedFile = await getStoredFileStream(
      document.key,
      document.storageProvider || "local_disk",
    );
    if (!storedFile) {
      throw new ApiError(404, "Application document is no longer available.");
    }
    res.setHeader("Content-Type", document.mimeType);
    res.setHeader(
      "Content-Disposition",
      `attachment; filename*=UTF-8''${encodeURIComponent(document.filename)}`,
    );
    if (storedFile.contentLength !== undefined)
      res.setHeader("Content-Length", storedFile.contentLength);
    res.setHeader("Cache-Control", "private, no-store");
    await pipeline(storedFile.body, res);
  }),
);
adminRouter.patch(
  "/teacher-applications/:applicationId",
  asyncHandler(async (req, res) => {
    const data = z
      .object({
        status: z.enum(["approved", "rejected"]),
        rejectionReason: z.string().trim().default(""),
      })
      .parse(req.body);
    if (data.status === "rejected" && data.rejectionReason.length < 5) {
      throw new ApiError(
        400,
        "Provide a rejection reason of at least 5 characters.",
      );
    }
    const application = await TeacherApplicationModel.findById(
      req.params.applicationId,
    );
    if (!application) {
      throw new ApiError(404, "Teacher application not found.");
    }
    const teacher = await UserModel.findById(application.user);
    if (!teacher) {
      throw new ApiError(404, "Teacher account not found.");
    }
    if (!teacher.isVerified) {
      throw new ApiError(
        409,
        "The teacher must verify their email before approval.",
      );
    }
    application.status = data.status;
    application.rejectionReason =
      data.status === "rejected" ? data.rejectionReason : "";
    application.reviewedBy = new mongoose.Types.ObjectId(req.user.id);
    application.reviewedAt = new Date();
    await application.save();
    teacher.accountStatus = data.status === "approved" ? "active" : "suspended";
    teacher.teacherStatus = data.status;
    await teacher.save();
    await NotificationModel.create({
      user: teacher._id,
      title:
        data.status === "approved"
          ? "Teacher application approved"
          : "Teacher application update",
      message:
        data.status === "approved"
          ? "Your teacher account has been approved. You can now sign in."
          : `Your teacher application was rejected.${data.rejectionReason ? ` Reason: ${data.rejectionReason}` : ""}`,
      kind: "teacher_application",
      link: "/dashboard",
    });
    await writeAudit(
      req.user.id,
      `teacher_application_${data.status}`,
      "TeacherApplication",
      application._id.toString(),
      {
        teacherId: teacher._id.toString(),
      },
    );
    res.json({ message: "Teacher application updated successfully." });
  }),
);
adminRouter.get(
  "/teachers",
  asyncHandler(async (_req, res) => {
    const teachers = await UserModel.find({
      role: "teacher",
      isDeleted: { $ne: true },
    })
      .select("-passwordHash")
      .sort({ createdAt: -1 })
      .lean();
    res.json({ teachers });
  }),
);
adminRouter.get(
  "/administrators",
  asyncHandler(async (_req, res) => {
    const administrators = await UserModel.find({
      role: { $in: ["admin", "hub_admin"] },
      isDeleted: { $ne: true },
    })
      .select("-password -passwordHash -verificationCode")
      .sort({ createdAt: 1 })
      .lean();
    res.json({ administrators });
  }),
);
adminRouter.post(
  "/administrators",
  asyncHandler(async (req, res) => {
    const data = z
      .object({
        fullName: z.string().trim().min(2).max(100),
        email: z.string().trim().email().max(254),
        password: z.string().min(12).max(128),
      })
      .parse(req.body);
    const email = data.email.toLowerCase();
    if (await UserModel.exists({ email })) {
      throw new ApiError(409, "An account with this email already exists.");
    }
    const administrator = await UserModel.create({
      name: data.fullName,
      fullName: data.fullName,
      email,
      password: await hashPassword(data.password),
      authProvider: "local",
      role: "admin",
      isVerified: true,
      emailVerified: true,
      teacherStatus: "approved",
      accountStatus: "active",
    });
    await writeAudit(
      req.user.id,
      "administrator_created",
      "User",
      administrator._id.toString(),
    );
    res.status(201).json({
      administrator: {
        _id: administrator._id,
        fullName: administrator.fullName,
        email: administrator.email,
        role: administrator.role,
        accountStatus: administrator.accountStatus,
        createdAt: administrator.createdAt,
      },
    });
  }),
);
adminRouter.post(
  "/users",
  asyncHandler(async (req, res) => {
    const data = z
      .object({
        fullName: z.string().trim().min(2).max(100),
        email: z.string().trim().email().max(254),
        password: z.string().min(12).max(128),
        role: z.enum(["student", "teacher"]),
      })
      .parse(req.body);
    const email = data.email.toLowerCase();
    if (await UserModel.exists({ email }))
      throw new ApiError(409, "An account with this email already exists.");
    const account = await UserModel.create({
      name: data.fullName,
      fullName: data.fullName,
      email,
      password: await hashPassword(data.password),
      authProvider: "local",
      role: data.role,
      isVerified: true,
      emailVerified: true,
      teacherStatus: data.role === "teacher" ? "approved" : undefined,
      accountStatus: "active",
      ...(data.role === "student"
        ? { studentProfile: { placementStatus: "pending" } }
        : {}),
    });
    await writeAudit(
      req.user.id,
      `${data.role}_created_by_admin`,
      "User",
      account._id.toString(),
    );
    res.status(201).json({
      user: {
        _id: account._id,
        fullName: account.fullName,
        email: account.email,
        role: account.role,
        accountStatus: account.accountStatus,
        studentProfile: account.studentProfile,
        teacherStatus: account.teacherStatus,
        createdAt: account.createdAt,
      },
    });
  }),
);
adminRouter.patch(
  "/administrators/:administratorId/status",
  asyncHandler(async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.administratorId)) {
      throw new ApiError(400, "Invalid administrator ID.");
    }
    const { status } = z
      .object({ status: z.enum(["active", "suspended"]) })
      .parse(req.body);
    const administrator = await UserModel.findOne({
      _id: req.params.administratorId,
      role: { $in: ["admin", "hub_admin"] },
      isDeleted: { $ne: true },
    });
    if (!administrator)
      throw new ApiError(404, "Administrator account not found.");
    if (administrator._id.toString() === req.user.id && status !== "active") {
      throw new ApiError(
        400,
        "You cannot suspend your own administrator account.",
      );
    }
    if (status === "suspended" && administrator.accountStatus === "active") {
      const activeAdministrators = await UserModel.countDocuments({
        role: { $in: ["admin", "hub_admin"] },
        accountStatus: "active",
        isDeleted: { $ne: true },
      });
      if (activeAdministrators <= 1) {
        throw new ApiError(
          409,
          "The last active administrator cannot be suspended.",
        );
      }
    }
    administrator.accountStatus = status;
    await administrator.save();
    await writeAudit(
      req.user.id,
      `administrator_status_${status}`,
      "User",
      administrator._id.toString(),
    );
    res.json({ message: `Administrator status changed to ${status}.` });
  }),
);
adminRouter.patch(
  "/users/:userId/status",
  asyncHandler(async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.userId))
      throw new ApiError(400, "Invalid user ID.");
    const { status } = z
      .object({ status: z.enum(["active", "suspended"]) })
      .parse(req.body);
    const account = await UserModel.findOne({
      _id: req.params.userId,
      role: { $in: ["student", "teacher"] },
      isDeleted: { $ne: true },
    });
    if (!account)
      throw new ApiError(404, "Student or teacher account not found.");
    account.accountStatus = status;
    await account.save();
    await writeAudit(
      req.user.id,
      `user_status_${status}`,
      "User",
      account._id.toString(),
      { role: account.role },
    );
    res.json({
      message: `${account.role === "student" ? "Student" : "Teacher"} account status changed to ${status}.`,
    });
  }),
);
adminRouter.patch(
  "/users/:userId/verify-email",
  asyncHandler(async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.userId))
      throw new ApiError(400, "Invalid user ID.");
    const account = await UserModel.findOne({
      _id: req.params.userId,
      isDeleted: { $ne: true },
    });
    if (!account) throw new ApiError(404, "User account not found.");
    account.isVerified = true;
    account.emailVerified = true;
    account.accountStatus = "active";
    account.verificationCode = undefined;
    account.codeExpiresAt = undefined;
    await account.save();
    await writeAudit(
      req.user.id,
      "user_email_manually_verified",
      "User",
      account._id.toString(),
      { role: account.role, email: account.email },
    );
    res.json({
      message: `${account.fullName || account.email}'s email verified and activated.`,
    });
  }),
);
adminRouter.get(
  "/students",
  asyncHandler(async (_req, res) => {
    const students = await UserModel.find({
      role: "student",
      isDeleted: { $ne: true },
    })
      .select("-passwordHash")
      .populate("studentProfile.preferredCourseIds", "title")
      .sort({ createdAt: -1 })
      .lean();
    res.json({ students });
  }),
);
adminRouter.delete(
  "/users/:userId",
  asyncHandler(async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.userId)) {
      throw new ApiError(400, "Invalid user ID.");
    }
    const user = await UserModel.findOne({
      _id: req.params.userId,
      role: { $in: ["teacher", "student", "admin", "hub_admin"] },
      isDeleted: { $ne: true },
    });
    if (!user) {
      throw new ApiError(404, "Account not found.");
    }
    if (user._id.toString() === req.user.id) {
      throw new ApiError(
        400,
        "You cannot delete your own administrator account.",
      );
    }
    if (user.role === "admin" || user.role === "hub_admin") {
      const activeAdministrators = await UserModel.countDocuments({
        role: { $in: ["admin", "hub_admin"] },
        accountStatus: "active",
        isDeleted: { $ne: true },
      });
      if (user.accountStatus === "active" && activeAdministrators <= 1) {
        throw new ApiError(
          409,
          "The last active administrator cannot be deleted.",
        );
      }
    }

    const userId = user._id;
    const deletedAt = new Date();
    await UserModel.updateOne(
      { _id: userId },
      {
        $set: {
          name: "Removed account",
          fullName: "Removed account",
          email: `removed-${userId.toString()}@deleted.invalid`,
          accountStatus: "suspended",
          isVerified: false,
          emailVerified: false,
          isDeleted: true,
          deletedAt,
        },
        $unset: {
          password: "",
          passwordHash: "",
          googleId: "",
          verificationCode: "",
          codeExpiresAt: "",
          codePurpose: "",
          codeAttempts: "",
          codeSentAt: "",
          studentProfile: "",
          teacherProfile: "",
        },
      },
    );
    await Promise.all([
      ClassroomModel.updateMany(
        { students: userId },
        { $pull: { students: userId } },
      ),
      ClassroomModel.updateMany(
        { teacher: userId },
        { $set: { teacher: null } },
      ),
      TeacherApplicationModel.deleteOne({ user: userId }),
      NotificationModel.deleteMany({ user: userId }),
    ]);
    await writeAudit(
      req.user.id,
      "user_account_deleted",
      "User",
      userId.toString(),
      {
        role: user.role,
        deletedAt: deletedAt.toISOString(),
      },
    );
    const accountType =
      user.role === "teacher"
        ? "Teacher"
        : user.role === "student"
          ? "Student"
          : "Administrator";
    res.json({
      message: `${accountType} account deleted. Historical learning records were retained.`,
    });
  }),
);
adminRouter.post(
  "/categories",
  asyncHandler(async (req, res) => {
    const data = z
      .object({
        name: z.string().min(2),
        description: z.string().default(""),
        sortOrder: z.number().int().default(0),
      })
      .parse(req.body);
    const category = await LearningCategoryModel.create({
      ...data,
      slug: slugify(data.name),
    });
    await writeAudit(
      req.user.id,
      "category_created",
      "LearningCategory",
      category._id.toString(),
    );
    res.status(201).json({ category });
  }),
);
adminRouter.get(
  "/categories",
  asyncHandler(async (_req, res) => {
    const categories = await LearningCategoryModel.find()
      .sort({ sortOrder: 1 })
      .lean();
    res.json({ categories });
  }),
);
adminRouter.patch(
  "/categories/:categoryId",
  asyncHandler(async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.categoryId))
      throw new ApiError(400, "Invalid category ID.");
    const data = z
      .object({
        name: z.string().trim().min(2).optional(),
        description: z.string().default("").optional(),
        sortOrder: z.number().int().optional(),
        isActive: z.boolean().optional(),
      })
      .refine(
        (value) => Object.keys(value).length > 0,
        "Provide at least one field to update.",
      )
      .parse(req.body);
    const category = await LearningCategoryModel.findById(
      req.params.categoryId,
    );
    if (!category) throw new ApiError(404, "Category not found.");
    if (data.name) {
      category.name = data.name;
      category.slug = slugify(data.name);
    }
    if (data.description !== undefined) category.description = data.description;
    if (data.sortOrder !== undefined) category.sortOrder = data.sortOrder;
    if (data.isActive !== undefined) category.isActive = data.isActive;
    await category.save();
    await writeAudit(
      req.user.id,
      "category_updated",
      "LearningCategory",
      category._id.toString(),
    );
    res.json({ category });
  }),
);
adminRouter.delete(
  "/categories/:categoryId",
  asyncHandler(async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.categoryId))
      throw new ApiError(400, "Invalid category ID.");
    const category = await LearningCategoryModel.findById(
      req.params.categoryId,
    );
    if (!category) throw new ApiError(404, "Category not found.");
    if (await CourseModel.exists({ category: category._id })) {
      throw new ApiError(
        409,
        "Move or delete this category's courses before deleting the category.",
      );
    }
    await LearningCategoryModel.deleteOne({ _id: category._id });
    await writeAudit(
      req.user.id,
      "category_deleted",
      "LearningCategory",
      category._id.toString(),
    );
    res.json({ message: "Category deleted." });
  }),
);
adminRouter.post(
  "/courses",
  asyncHandler(async (req, res) => {
    const data = z
      .object({
        title: z.string().min(3),
        description: z.string().min(10),
        categoryId: z.string().min(1),
        learningObjectives: z.array(z.string()).default([]),
        skillLevel: z.string().default(""),
        status: z
          .enum(["draft", "published", "archived", "inactive"])
          .default("draft"),
      })
      .parse(req.body);
    if (
      !mongoose.isValidObjectId(data.categoryId) ||
      !(await LearningCategoryModel.exists({ _id: data.categoryId }))
    ) {
      throw new ApiError(400, "Select a valid category.");
    }
    const course = await CourseModel.create({
      title: data.title,
      slug: slugify(`${data.title}-${Date.now()}`),
      description: data.description,
      category: data.categoryId,
      learningObjectives: data.learningObjectives,
      skillLevel: data.skillLevel,
      status: data.status,
    });
    await writeAudit(
      req.user.id,
      "course_created",
      "Course",
      course._id.toString(),
    );
    res.status(201).json({ course });
  }),
);
adminRouter.get(
  "/courses",
  asyncHandler(async (_req, res) => {
    const courses = await CourseModel.find()
      .populate("category")
      .sort({ createdAt: -1 })
      .lean();
    res.json({ courses });
  }),
);
adminRouter.patch(
  "/courses/:courseId",
  asyncHandler(async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.courseId))
      throw new ApiError(400, "Invalid course ID.");
    const data = z
      .object({
        title: z.string().trim().min(3).optional(),
        description: z.string().trim().min(10).optional(),
        categoryId: z.string().optional(),
        learningObjectives: z.array(z.string()).optional(),
        skillLevel: z.string().optional(),
        status: z
          .enum(["draft", "published", "archived", "inactive"])
          .optional(),
      })
      .refine(
        (value) => Object.keys(value).length > 0,
        "Provide at least one field to update.",
      )
      .parse(req.body);
    const course = await CourseModel.findById(req.params.courseId);
    if (!course) throw new ApiError(404, "Course not found.");
    if (data.categoryId) {
      if (
        !mongoose.isValidObjectId(data.categoryId) ||
        !(await LearningCategoryModel.exists({ _id: data.categoryId }))
      ) {
        throw new ApiError(400, "Select a valid category.");
      }
      course.category = data.categoryId;
    }
    if (data.title) {
      course.title = data.title;
      course.slug = slugify(`${data.title}-${course._id.toString().slice(-6)}`);
    }
    if (data.description !== undefined) course.description = data.description;
    if (data.learningObjectives !== undefined)
      course.learningObjectives = data.learningObjectives;
    if (data.skillLevel !== undefined) course.skillLevel = data.skillLevel;
    if (data.status !== undefined) course.status = data.status;
    await course.save();
    await writeAudit(
      req.user.id,
      "course_updated",
      "Course",
      course._id.toString(),
    );
    res.json({ course });
  }),
);
adminRouter.delete(
  "/courses/:courseId",
  asyncHandler(async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.courseId))
      throw new ApiError(400, "Invalid course ID.");
    const course = await CourseModel.findById(req.params.courseId);
    if (!course) throw new ApiError(404, "Course not found.");
    if (await ClassroomModel.exists({ course: course._id })) {
      throw new ApiError(
        409,
        "Archive this course or move its cohorts before deleting it.",
      );
    }
    if (await LearningResourceModel.exists({ course: course._id })) {
      throw new ApiError(
        409,
        "Remove this course's learning resources before deleting it.",
      );
    }
    await CourseModel.deleteOne({ _id: course._id });
    await writeAudit(
      req.user.id,
      "course_deleted",
      "Course",
      course._id.toString(),
    );
    res.json({ message: "Course deleted." });
  }),
);
adminRouter.post(
  "/classes",
  asyncHandler(async (req, res) => {
    const data = z
      .object({
        title: z.string().min(3),
        courseId: z.string().min(1),
        teacherId: z.string().optional(),
        capacity: z.number().int().min(1).max(100).default(20),
        status: z
          .enum(["planned", "active", "completed", "archived"])
          .default("planned"),
        timeZone: z
          .string()
          .refine(isValidTimeZone, "Enter a valid IANA time zone.")
          .default("Africa/Addis_Ababa"),
        description: z.string().default(""),
        startDate: z.string().datetime().optional(),
        endDate: z.string().datetime().optional(),
      })
      .parse(req.body);
    if (
      !mongoose.isValidObjectId(data.courseId) ||
      !(await CourseModel.exists({ _id: data.courseId }))
    ) {
      throw new ApiError(400, "Select a valid course.");
    }
    const assignedTeacherId =
      data.teacherId && data.teacherId.trim() !== ""
        ? data.teacherId.trim()
        : null;
    if (assignedTeacherId) {
      if (!mongoose.isValidObjectId(assignedTeacherId)) {
        throw new ApiError(400, "Invalid teacher ID.");
      }
      const teacher = await UserModel.findOne({
        _id: assignedTeacherId,
        role: "teacher",
        accountStatus: "active",
      });
      if (!teacher) {
        throw new ApiError(400, "Assigned teacher must be an active teacher.");
      }
    }
    const classroom = await ClassroomModel.create({
      title: data.title,
      course: data.courseId,
      teacher: assignedTeacherId,
      capacity: data.capacity,
      status: data.status,
      timeZone: data.timeZone,
      description: data.description,
      startDate: data.startDate ? new Date(data.startDate) : null,
      endDate: data.endDate ? new Date(data.endDate) : null,
    });
    if (assignedTeacherId) {
      await NotificationModel.create({
        user: assignedTeacherId,
        title: "New class assignment",
        message: `You have been assigned to class "${data.title}".`,
        kind: "class_assignment",
        link: "/teacher/classes",
      });
    }
    await writeAudit(
      req.user.id,
      "class_created",
      "Classroom",
      classroom._id.toString(),
    );
    res.status(201).json({ classroom });
  }),
);
adminRouter.get(
  "/classes",
  asyncHandler(async (_req, res) => {
    const classes = await ClassroomModel.find()
      .populate("course")
      .populate("teacher", "fullName email")
      .populate("students", "fullName email")
      .sort({ createdAt: -1 })
      .lean();
    const sessions = await ClassSessionModel.find({
      classroom: { $in: classes.map((classroom) => classroom._id) },
    })
      .populate("classroom", "title timeZone")
      .sort({ startsAt: 1 })
      .lean();
    res.json({ classes, sessions });
  }),
);
adminRouter.get(
  "/classes/:classId",
  asyncHandler(async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.classId))
      throw new ApiError(400, "Invalid cohort ID.");
    const classroom = await ClassroomModel.findById(req.params.classId)
      .populate("course")
      .populate("teacher", "fullName name email avatarUrl teacherProfile")
      .populate("students", "fullName name email avatarUrl studentProfile")
      .lean();
    if (!classroom) throw new ApiError(404, "Cohort not found.");
    const sessions = await ClassSessionModel.find({ classroom: classroom._id })
      .sort({ startsAt: 1 })
      .lean();
    res.json({ classroom, sessions });
  }),
);
adminRouter.patch(
  "/classes/:classId",
  asyncHandler(async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.classId))
      throw new ApiError(400, "Invalid cohort ID.");
    const data = z
      .object({
        title: z.string().trim().min(3).optional(),
        courseId: z.string().optional(),
        teacherId: z.string().nullable().optional(),
        capacity: z.number().int().min(1).max(100).optional(),
        status: z
          .enum(["planned", "active", "completed", "archived"])
          .optional(),
        timeZone: z
          .string()
          .refine(isValidTimeZone, "Enter a valid IANA time zone.")
          .optional(),
        description: z.string().optional(),
      })
      .refine(
        (value) => Object.keys(value).length > 0,
        "Provide at least one field to update.",
      )
      .parse(req.body);
    const classroom = await ClassroomModel.findById(req.params.classId);
    if (!classroom) throw new ApiError(404, "Cohort not found.");
    if (data.courseId) {
      if (
        !mongoose.isValidObjectId(data.courseId) ||
        !(await CourseModel.exists({ _id: data.courseId }))
      ) {
        throw new ApiError(400, "Select a valid course.");
      }
      classroom.course = data.courseId;
    }
    if (data.teacherId !== undefined) {
      const cleanedTeacherId =
        data.teacherId && data.teacherId.trim() !== ""
          ? data.teacherId.trim()
          : null;
      if (cleanedTeacherId) {
        if (!mongoose.isValidObjectId(cleanedTeacherId))
          throw new ApiError(400, "Invalid teacher ID.");
        const teacher = await UserModel.findOne({
          _id: cleanedTeacherId,
          role: "teacher",
          accountStatus: "active",
          isDeleted: { $ne: true },
        });
        if (!teacher)
          throw new ApiError(
            400,
            "Assigned teacher must be an active teacher.",
          );
        classroom.teacher = teacher._id;
      } else {
        classroom.teacher = null;
      }
    }
    if (data.capacity !== undefined) {
      if (data.capacity < classroom.students.length)
        throw new ApiError(
          400,
          "Capacity cannot be lower than current enrollment.",
        );
      classroom.capacity = data.capacity;
    }
    if (data.title !== undefined) classroom.title = data.title;
    if (data.status !== undefined) classroom.status = data.status;
    if (data.timeZone !== undefined) classroom.timeZone = data.timeZone;
    if (data.description !== undefined)
      classroom.description = data.description;
    await classroom.save();
    await writeAudit(
      req.user.id,
      "classroom_updated",
      "Classroom",
      classroom._id.toString(),
    );
    res.json({ classroom });
  }),
);
adminRouter.delete(
  "/classes/:classId",
  asyncHandler(async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.classId))
      throw new ApiError(400, "Invalid cohort ID.");
    const classroom = await ClassroomModel.findById(req.params.classId).lean();
    if (!classroom) throw new ApiError(404, "Cohort not found.");
    const [sessions, assessments, assignments, resources] = await Promise.all([
      ClassSessionModel.find({ classroom: classroom._id }).select("_id").lean(),
      AssessmentModel.find({ classroom: classroom._id }).select("_id").lean(),
      AssignmentModel.find({ classroom: classroom._id }).select("_id").lean(),
      LearningResourceModel.find({ classroom: classroom._id })
        .select("storedKey storageProvider")
        .lean(),
    ]);
    const sessionIds = sessions.map(({ _id }) => _id);
    const assessmentIds = assessments.map(({ _id }) => _id);
    const assignmentIds = assignments.map(({ _id }) => _id);
    await Promise.all(
      resources
        .filter(
          (resource) =>
            !["youtube", "google_drive"].includes(resource.sourceType),
        )
        .map((resource) =>
          deleteStoredFile(
            resource.storedKey,
            resource.storageProvider || "local_disk",
          ),
        ),
    );
    await Promise.all([
      AnnouncementModel.deleteMany({ classroom: classroom._id }),
      AssessmentAttemptModel.deleteMany({
        $or: [
          { classroom: classroom._id },
          ...(assessmentIds.length
            ? [{ assessment: { $in: assessmentIds } }]
            : []),
        ],
      }),
      AssignmentSubmissionModel.deleteMany({
        $or: [
          { classroom: classroom._id },
          ...(assignmentIds.length
            ? [{ assignment: { $in: assignmentIds } }]
            : []),
        ],
      }),
      AttendanceRecordModel.deleteMany({
        $or: [
          { classroom: classroom._id },
          ...(sessionIds.length ? [{ session: { $in: sessionIds } }] : []),
        ],
      }),
      TeacherAttendanceRecordModel.deleteMany({
        $or: [
          { classroom: classroom._id },
          ...(sessionIds.length ? [{ session: { $in: sessionIds } }] : []),
        ],
      }),
      CertificateModel.deleteMany({ classroom: classroom._id }),
      DiscussionModel.deleteMany({ classroom: classroom._id }),
      LearningResourceModel.deleteMany({ classroom: classroom._id }),
      AssessmentModel.deleteMany({ classroom: classroom._id }),
      AssignmentModel.deleteMany({ classroom: classroom._id }),
      ClassSessionModel.deleteMany({ classroom: classroom._id }),
      ClassroomModel.deleteOne({ _id: classroom._id }),
    ]);
    for (const studentId of classroom.students) {
      const stillEnrolled = await ClassroomModel.exists({
        students: studentId,
      });
      if (!stillEnrolled) {
        await UserModel.updateOne(
          { _id: studentId },
          { $set: { "studentProfile.placementStatus": "pending" } },
        );
      }
    }
    await writeAudit(
      req.user.id,
      "classroom_deleted",
      "Classroom",
      classroom._id.toString(),
    );
    res.json({ message: "Cohort and its learning records deleted." });
  }),
);
adminRouter.post(
  "/classes/:classId/assign-student",
  asyncHandler(async (req, res) => {
    const data = z
      .object({
        studentId: z.string().min(1),
      })
      .parse(req.body);
    const classroom = await ClassroomModel.findById(req.params.classId);
    if (!classroom) {
      throw new ApiError(404, "Class not found.");
    }
    const student = await UserModel.findOne({
      _id: data.studentId,
      role: "student",
      accountStatus: "active",
    });
    if (!student) {
      throw new ApiError(404, "Student not found.");
    }
    if (
      classroom.students.some(
        (studentId) => studentId.toString() === data.studentId,
      )
    ) {
      throw new ApiError(409, "Student is already assigned to this class.");
    }
    if (classroom.students.length >= classroom.capacity) {
      throw new ApiError(400, "This class has reached capacity.");
    }
    classroom.students.push(student._id);
    await classroom.save();
    if (student.studentProfile) {
      student.studentProfile.placementStatus = "assigned";
      await student.save();
    }
    await NotificationModel.create({
      user: student._id,
      title: "New class placement",
      message: `You have been placed into class "${classroom.title}".`,
      kind: "student_placement",
      link: "/student/classes",
    });

    let teacherUser = null;
    if (classroom.teacher) {
      teacherUser = await UserModel.findById(classroom.teacher);
      if (teacherUser) {
        await NotificationModel.create({
          user: teacherUser._id,
          title: "New student enrolled",
          message: `Student "${student.name}" has been placed into your class "${classroom.title}".`,
          kind: "student_placement",
          link: `/teacher/classes/${classroom._id}`,
        });

        sendClassPlacementEmail({
          email: teacherUser.email,
          name: teacherUser.name,
          role: "teacher",
          classroomTitle: classroom.title,
          otherPartyName: student.name,
        }).catch((err) =>
          console.warn(`[Assignment Email Teacher Error] ${err?.message}`),
        );
      }
    }

    sendClassPlacementEmail({
      email: student.email,
      name: student.name,
      role: "student",
      classroomTitle: classroom.title,
      otherPartyName: teacherUser?.name || null,
    }).catch((err) =>
      console.warn(`[Assignment Email Student Error] ${err?.message}`),
    );

    await writeAudit(
      req.user.id,
      "student_assigned",
      "Classroom",
      classroom._id.toString(),
      {
        studentId: student._id.toString(),
      },
    );
    res.json({ message: "Student assigned successfully." });
  }),
);
adminRouter.delete(
  "/classes/:classId/students/:studentId",
  asyncHandler(async (req, res) => {
    if (
      !mongoose.isValidObjectId(req.params.classId) ||
      !mongoose.isValidObjectId(req.params.studentId)
    ) {
      throw new ApiError(400, "Invalid cohort or student ID.");
    }
    const classroom = await ClassroomModel.findById(req.params.classId);
    if (!classroom) {
      throw new ApiError(404, "Cohort not found.");
    }
    const student = await UserModel.findOne({
      _id: req.params.studentId,
      role: "student",
      isDeleted: { $ne: true },
    });
    if (!student) {
      throw new ApiError(404, "Student not found.");
    }
    const isAssigned = classroom.students.some(
      (studentId) => studentId.toString() === student._id.toString(),
    );
    if (!isAssigned) {
      throw new ApiError(404, "Student is not assigned to this cohort.");
    }

    classroom.students.pull(student._id);
    await classroom.save();
    const remainsAssigned = await ClassroomModel.exists({
      students: student._id,
    });
    if (!remainsAssigned && student.studentProfile) {
      student.studentProfile.placementStatus = "pending";
      await student.save();
    }
    await NotificationModel.create({
      user: student._id,
      title: "Cohort placement updated",
      message: `You have been removed from the cohort "${classroom.title}". An administrator will update your placement.`,
      kind: "student_placement",
      link: "/student/classes",
    });
    await writeAudit(
      req.user.id,
      "student_removed_from_class",
      "Classroom",
      classroom._id.toString(),
      { studentId: student._id.toString() },
    );
    res.json({
      message: `Student removed from ${classroom.title}.`,
      placementStatus: remainsAssigned ? "assigned" : "pending",
    });
  }),
);
adminRouter.post(
  "/classes/:classId/assign-teacher",
  asyncHandler(async (req, res) => {
    const data = z
      .object({
        teacherId: z.string().min(1),
      })
      .parse(req.body);
    const classroom = await ClassroomModel.findById(req.params.classId);
    if (!classroom) {
      throw new ApiError(404, "Class not found.");
    }
    const teacher = await UserModel.findOne({
      _id: data.teacherId,
      role: "teacher",
      accountStatus: "active",
    });
    if (!teacher) {
      throw new ApiError(404, "Teacher not found.");
    }
    classroom.teacher = teacher._id;
    await classroom.save();
    await NotificationModel.create({
      user: teacher._id,
      title: "Class assignment updated",
      message: `You are now assigned to class "${classroom.title}".`,
      kind: "class_assignment",
      link: "/teacher/classes",
    });
    await writeAudit(
      req.user.id,
      "teacher_assigned",
      "Classroom",
      classroom._id.toString(),
      {
        teacherId: teacher._id.toString(),
      },
    );
    res.json({ message: "Teacher assigned successfully." });
  }),
);

// ─── Admin Cohort Learning Space: Discussions & Oversight Tracking ───
adminRouter.get(
  "/classes/:classId/discussions",
  asyncHandler(async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.classId))
      throw new ApiError(400, "Invalid cohort ID.");
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

adminRouter.post(
  "/classes/:classId/discussions",
  asyncHandler(async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.classId))
      throw new ApiError(400, "Invalid cohort ID.");
    const classroom = await ClassroomModel.findById(req.params.classId);
    if (!classroom) throw new ApiError(404, "Cohort not found.");

    const data = z
      .object({
        title: z.string().trim().min(3).max(150),
        content: z.string().trim().min(5).max(3000),
        category: z
          .enum(["general", "assignment", "lesson", "question", "announcement"])
          .default("announcement"),
      })
      .parse(req.body);

    const discussion = await DiscussionModel.create({
      classroom: req.params.classId,
      author: req.user.id,
      title: data.title,
      content: data.content,
      category: data.category,
      isPinned: true,
    });

    const populated = await DiscussionModel.findById(discussion._id)
      .populate("author", "fullName name email avatarUrl role")
      .lean();

    const discussionRecipients = [
      ...(classroom.teacher ? [classroom.teacher.toString()] : []),
      ...classroom.students.map((s) => s.toString()),
    ].filter((id) => id !== req.user.id);
    if (discussionRecipients.length > 0) {
      await NotificationModel.insertMany(
        discussionRecipients.map((recipientId) => ({
          user: recipientId,
          title: `Cohort Update: ${data.title}`,
          message:
            data.content.length > 200
              ? `${data.content.slice(0, 200)}…`
              : data.content,
          kind: "announcement",
          link: `/learn/${classroom._id}`,
        })),
      );
    }

    res.status(201).json({
      message: "Admin announcement posted in cohort.",
      discussion: populated,
    });
  }),
);

adminRouter.post(
  "/classes/:classId/discussions/:discussionId/reply",
  asyncHandler(async (req, res) => {
    if (
      !mongoose.isValidObjectId(req.params.classId) ||
      !mongoose.isValidObjectId(req.params.discussionId)
    ) {
      throw new ApiError(400, "Invalid IDs.");
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
    if (!discussion) throw new ApiError(404, "Discussion not found.");

    discussion.replies.push({
      author: req.user.id,
      content: data.content,
      createdAt: new Date(),
    });
    await discussion.save();

    const updated = await DiscussionModel.findById(discussion._id)
      .populate("author", "fullName name email avatarUrl role")
      .populate("replies.author", "fullName name email avatarUrl role")
      .lean();

    res.json({ message: "Reply added.", discussion: updated });
  }),
);

adminRouter.delete(
  "/classes/:classId/discussions/:discussionId",
  asyncHandler(async (req, res) => {
    if (
      !mongoose.isValidObjectId(req.params.classId) ||
      !mongoose.isValidObjectId(req.params.discussionId)
    ) {
      throw new ApiError(400, "Invalid IDs.");
    }
    await DiscussionModel.deleteOne({
      _id: req.params.discussionId,
      classroom: req.params.classId,
    });
    res.json({ message: "Discussion topic removed by administrator." });
  }),
);

adminRouter.get(
  "/classes/:classId/tracking",
  asyncHandler(async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.classId))
      throw new ApiError(400, "Invalid cohort ID.");
    const classroom = await ClassroomModel.findById(req.params.classId)
      .populate("course")
      .populate("teacher", "fullName name email avatarUrl teacherProfile")
      .populate("students", "fullName name email avatarUrl studentProfile")
      .lean();
    if (!classroom) throw new ApiError(404, "Cohort not found.");

    const [sessions, attendance, assignments, resources, discussionsCount] =
      await Promise.all([
        ClassSessionModel.find({ classroom: classroom._id })
          .sort({ startsAt: 1 })
          .lean(),
        AttendanceRecordModel.find({ classroom: classroom._id }).lean(),
        AssignmentModel.find({ classroom: classroom._id }).lean(),
        LearningResourceModel.find({ classroom: classroom._id }).lean(),
        DiscussionModel.countDocuments({ classroom: classroom._id }),
      ]);

    const completedSessions = sessions.filter(
      (s) => s.status === "completed" || new Date(s.endsAt) < new Date(),
    ).length;
    const fillRate = Math.round(
      ((classroom.students.length || 0) / (classroom.capacity || 1)) * 100,
    );

    res.json({
      cohort: classroom,
      stats: {
        totalSessions: sessions.length,
        completedSessions,
        totalStudents: classroom.students.length,
        capacity: classroom.capacity,
        fillRate,
        totalResources: resources.length,
        totalAssignments: assignments.length,
        attendanceRecordsCount: attendance.length,
        discussionsCount,
      },
      sessions,
      resources,
    });
  }),
);

// Cohort attendance register (students x sessions with cumulative totals)
adminRouter.get(
  "/classes/:classId/attendance",
  asyncHandler(async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.classId))
      throw new ApiError(400, "Invalid cohort ID.");
    const classroom = await ClassroomModel.findById(req.params.classId)
      .populate("students", "fullName name email avatarUrl")
      .lean();
    if (!classroom) throw new ApiError(404, "Cohort not found.");
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

// Teacher attendance: records, per-teacher summaries and pending teaching days
adminRouter.get(
  "/teacher-attendance",
  asyncHandler(async (req, res) => {
    const filter = {};
    if (
      req.query.teacherId &&
      mongoose.isValidObjectId(req.query.teacherId)
    ) {
      filter.teacher = req.query.teacherId;
    }
    const [records, teachers] = await Promise.all([
      TeacherAttendanceRecordModel.find(filter)
        .populate("teacher", "fullName name email avatarUrl")
        .populate("classroom", "title")
        .populate("session", "title startsAt endsAt")
        .sort({ teachingDate: -1 })
        .limit(500)
        .lean(),
      UserModel.find({ role: "teacher", isDeleted: { $ne: true } })
        .select("fullName name email avatarUrl accountStatus")
        .sort({ fullName: 1 })
        .lean(),
    ]);

    const upcomingSessions = await ClassSessionModel.find({
      status: "scheduled",
      endsAt: { $gte: new Date() },
    })
      .select("teacher classroom startsAt")
      .lean();

    const summaryMap = new Map();
    const ensure = (teacher) => {
      const id = teacher._id.toString();
      if (!summaryMap.has(id)) {
        summaryMap.set(id, {
          teacher: {
            _id: teacher._id,
            fullName: teacher.fullName || teacher.name,
            email: teacher.email,
            avatarUrl: teacher.avatarUrl,
            accountStatus: teacher.accountStatus,
          },
          present: 0,
          late: 0,
          absent: 0,
          excused: 0,
          total: 0,
          loggedSessions: 0,
          scheduledTeachingDays: 0,
        });
      }
      return summaryMap.get(id);
    };

    for (const teacher of teachers) ensure(teacher);
    for (const record of records) {
      if (!record.teacher) continue;
      const entry = ensure(record.teacher);
      if (entry[record.status] !== undefined) entry[record.status] += 1;
      entry.total += 1;
      if (record.status !== "excused") entry.loggedSessions += 1;
    }
    for (const session of upcomingSessions) {
      const teacherId = session.teacher?.toString();
      if (!teacherId || !summaryMap.has(teacherId)) continue;
      summaryMap.get(teacherId).scheduledTeachingDays += 1;
    }

    const summary = Array.from(summaryMap.values()).map((entry) => {
      const attended = entry.present + entry.late;
      return {
        ...entry,
        attendanceRate:
          entry.total > 0 ? Math.round((attended / entry.total) * 100) : 0,
      };
    });

    res.json({ records, summary });
  }),
);

// Admin records or overrides a teacher's attendance for a teaching day
adminRouter.post(
  "/teacher-attendance",
  asyncHandler(async (req, res) => {
    const data = z
      .object({
        sessionId: z.string().min(1),
        status: z.enum(["present", "late", "absent", "excused"]),
        notes: z.string().max(500).default(""),
      })
      .parse(req.body);
    if (!mongoose.isValidObjectId(data.sessionId)) {
      throw new ApiError(400, "Invalid session ID.");
    }
    const session = await ClassSessionModel.findById(data.sessionId).lean();
    if (!session) throw new ApiError(404, "Session not found.");
    if (!session.teacher) {
      throw new ApiError(400, "This session has no assigned teacher.");
    }
    const record = await TeacherAttendanceRecordModel.findOneAndUpdate(
      { session: session._id, teacher: session.teacher },
      {
        $set: {
          classroom: session.classroom,
          teachingDate: session.startsAt,
          status: data.status,
          notes: data.notes,
          markedBy: req.user.id,
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
    await writeAudit(
      req.user.id,
      "teacher_attendance_recorded",
      "TeacherAttendanceRecord",
      record._id.toString(),
      { sessionId: session._id.toString() },
    );
    res.json({ message: "Teacher attendance recorded.", record });
  }),
);

adminRouter.post(
  "/sessions",
  asyncHandler(async (req, res) => {
    const data = z
      .object({
        classId: z.string().min(1),
        title: z.string().min(3),
        description: z.string().default(""),
        startsAt: z.string().datetime(),
        endsAt: z.string().datetime(),
        meetingUrl: z.string().url().optional(),
        recurrence: recurrenceSchema,
      })
      .parse(req.body);
    const classroom = await ClassroomModel.findById(data.classId);
    if (!classroom) {
      throw new ApiError(404, "Class not found.");
    }
    if (!classroom.teacher) {
      throw new ApiError(400, "Assign a teacher before creating sessions.");
    }
    const start = new Date(data.startsAt);
    const end = new Date(data.endsAt);
    if (start >= end) {
      throw new ApiError(400, "Session end time must be after start time.");
    }
    // Expand the request into one or more weekly occurrences.
    const occurrences = buildRecurringSessions({
      startsAt: start,
      endsAt: end,
      recurrence: data.recurrence,
    });
    for (const occurrence of occurrences) {
      const conflict = await ClassSessionModel.findOne({
        teacher: classroom.teacher,
        status: "scheduled",
        startsAt: { $lt: occurrence.endsAt },
        endsAt: { $gt: occurrence.startsAt },
      });
      if (conflict) {
        throw new ApiError(
          409,
          `The assigned teacher already has a conflicting session on ${occurrence.startsAt.toISOString()}.`,
        );
      }
    }
    const created = await ClassSessionModel.insertMany(
      occurrences.map((occurrence) => ({
        classroom: classroom._id,
        teacher: classroom.teacher,
        title: data.title,
        description: data.description,
        startsAt: occurrence.startsAt,
        endsAt: occurrence.endsAt,
        meetingUrl: data.meetingUrl ?? "",
        seriesId: occurrence.seriesId,
        recurrencePattern: occurrence.recurrencePattern,
        recurrenceInterval: occurrence.recurrenceInterval,
        recurrenceIntervalWeeks: occurrence.recurrenceIntervalWeeks,
        recurrenceCount: occurrence.recurrenceCount,
        recurrenceIndex: occurrence.recurrenceIndex,
      })),
    );
    const first = created[0];
    const isSeries = created.length > 1;
    const recurrenceLabel =
      RECURRENCE_LABELS[data.recurrence?.pattern] ?? "Recurring";
    const recipientIds = [classroom.teacher, ...classroom.students];
    await NotificationModel.insertMany(
      recipientIds.map((recipientId) => ({
        user: recipientId,
        title: isSeries
          ? `${recurrenceLabel} class sessions scheduled`
          : "New class session scheduled",
        message: isSeries
          ? `${data.title} has been scheduled ${recurrenceLabel.toLowerCase()} (${created.length} sessions), starting ${start.toISOString()}.`
          : `${data.title} has been scheduled for ${start.toISOString()}.`,
        kind: "session",
        link: "/dashboard",
      })),
    );

    // Inbox email notification to teacher and enrolled students (first occurrence only)
    UserModel.find({ _id: { $in: recipientIds }, accountStatus: "active" })
      .select("name email role")
      .lean()
      .then((recipients) => {
        recipients.forEach((recipient) => {
          sendSessionScheduledEmail({
            email: recipient.email,
            name: recipient.name,
            role: recipient.role,
            sessionTitle: isSeries
              ? `${data.title} (${recurrenceLabel.toLowerCase()}, ${created.length} sessions)`
              : data.title,
            classroomTitle: classroom.title,
            startsAt: start,
            endsAt: end,
            meetingUrl: data.meetingUrl ?? "",
          }).catch((err) =>
            console.warn(
              `[Session Scheduled Email Error] ${recipient.email}:`,
              err?.message,
            ),
          );
        });
      })
      .catch((err) =>
        console.warn("[Session Recipients Lookup Error]:", err?.message),
      );

    await writeAudit(
      req.user.id,
      "session_created",
      "ClassSession",
      first._id.toString(),
      {
        classroomId: classroom._id.toString(),
        recurrencePattern: data.recurrence?.pattern ?? "none",
        occurrences: created.length,
      },
    );
    res
      .status(201)
      .json({ session: first, sessions: created, occurrences: created.length });
  }),
);
adminRouter.patch(
  "/sessions/:sessionId",
  asyncHandler(async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.sessionId))
      throw new ApiError(400, "Invalid session ID.");
    const data = z
      .object({
        title: z.string().trim().min(3).optional(),
        description: z.string().optional(),
        startsAt: z.string().datetime().optional(),
        endsAt: z.string().datetime().optional(),
        meetingUrl: z.union([z.string().url(), z.literal("")]).optional(),
        status: z.enum(["scheduled", "completed", "cancelled"]).optional(),
      })
      .refine(
        (value) => Object.keys(value).length > 0,
        "Provide at least one field to update.",
      )
      .parse(req.body);
    const session = await ClassSessionModel.findById(req.params.sessionId);
    if (!session) throw new ApiError(404, "Session not found.");
    const startsAt = data.startsAt ? new Date(data.startsAt) : session.startsAt;
    const endsAt = data.endsAt ? new Date(data.endsAt) : session.endsAt;
    if (startsAt >= endsAt)
      throw new ApiError(400, "Session end time must be after start time.");
    if (session.status === "scheduled" && (data.startsAt || data.endsAt)) {
      const conflict = await ClassSessionModel.findOne({
        _id: { $ne: session._id },
        teacher: session.teacher,
        status: "scheduled",
        startsAt: { $lt: endsAt },
        endsAt: { $gt: startsAt },
      });
      if (conflict)
        throw new ApiError(
          409,
          "The assigned teacher already has a conflicting session.",
        );
    }
    if (data.title !== undefined) session.title = data.title;
    if (data.description !== undefined) session.description = data.description;
    session.startsAt = startsAt;
    session.endsAt = endsAt;
    if (data.meetingUrl !== undefined) session.meetingUrl = data.meetingUrl;
    if (data.status !== undefined) session.status = data.status;
    await session.save();
    const classroom = await ClassroomModel.findById(session.classroom)
      .select("title students")
      .lean();
    if (classroom) {
      const recipients = [
        ...new Set([
          session.teacher.toString(),
          ...classroom.students.map((studentId) => studentId.toString()),
        ]),
      ];
      await NotificationModel.insertMany(
        recipients.map((recipientId) => ({
          user: recipientId,
          title:
            session.status === "cancelled"
              ? "Class session cancelled"
              : session.status === "completed"
                ? "Class session completed"
                : "Class session updated",
          message:
            session.status === "cancelled"
              ? `"${session.title}" in ${classroom.title} has been cancelled.`
              : session.status === "completed"
                ? `"${session.title}" in ${classroom.title} has been marked complete by an administrator.`
                : `"${session.title}" in ${classroom.title} is scheduled for ${session.startsAt.toISOString()}.`,
          kind: "session",
          link: "/dashboard",
        })),
      );
    }
    await writeAudit(
      req.user.id,
      "session_updated",
      "ClassSession",
      session._id.toString(),
    );
    res.json({ session });
  }),
);
adminRouter.delete(
  "/sessions/:sessionId",
  asyncHandler(async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.sessionId))
      throw new ApiError(400, "Invalid session ID.");
    const session = await ClassSessionModel.findById(req.params.sessionId);
    if (!session) throw new ApiError(404, "Session not found.");
    // Support removing the entire weekly series in one action.
    const deleteSeries = req.query.series === "true" && session.seriesId;
    const filter = deleteSeries
      ? { seriesId: session.seriesId }
      : { _id: session._id };
    const targets = await ClassSessionModel.find(filter).select("_id").lean();
    const sessionIds = targets.map((item) => item._id);
    await Promise.all([
      AttendanceRecordModel.deleteMany({ session: { $in: sessionIds } }),
      TeacherAttendanceRecordModel.deleteMany({ session: { $in: sessionIds } }),
      ClassSessionModel.deleteMany({ _id: { $in: sessionIds } }),
    ]);
    await writeAudit(
      req.user.id,
      "session_deleted",
      "ClassSession",
      session._id.toString(),
      {
        seriesId: session.seriesId ?? "",
        deletedCount: sessionIds.length,
      },
    );
    res.json({
      message: deleteSeries
        ? `Recurring series and its ${sessionIds.length} sessions were deleted.`
        : "Session and its attendance records deleted.",
      deletedCount: sessionIds.length,
    });
  }),
);
adminRouter.get(
  "/faqs",
  asyncHandler(async (_req, res) => {
    const faqs = await FAQModel.find().sort({ sortOrder: 1 }).lean();
    res.json({ faqs });
  }),
);
adminRouter.post(
  "/faqs",
  asyncHandler(async (req, res) => {
    const data = z
      .object({
        question: z.string().min(5),
        answer: z.string().min(10),
        isPublished: z.boolean().default(true),
        sortOrder: z.number().int().default(0),
      })
      .parse(req.body);
    const faq = await FAQModel.create(data);
    await writeAudit(req.user.id, "faq_created", "FAQ", faq._id.toString());
    res.status(201).json({ faq });
  }),
);
adminRouter.patch(
  "/faqs/:faqId",
  asyncHandler(async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.faqId))
      throw new ApiError(400, "Invalid FAQ ID.");
    const data = z
      .object({
        question: z.string().trim().min(5).optional(),
        answer: z.string().trim().min(10).optional(),
        isPublished: z.boolean().optional(),
        sortOrder: z.number().int().optional(),
      })
      .refine(
        (value) => Object.keys(value).length > 0,
        "Provide at least one field to update.",
      )
      .parse(req.body);
    const faq = await FAQModel.findByIdAndUpdate(
      req.params.faqId,
      { $set: data },
      { new: true, runValidators: true },
    );
    if (!faq) throw new ApiError(404, "FAQ not found.");
    await writeAudit(req.user.id, "faq_updated", "FAQ", faq._id.toString());
    res.json({ faq });
  }),
);
adminRouter.delete(
  "/faqs/:faqId",
  asyncHandler(async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.faqId))
      throw new ApiError(400, "Invalid FAQ ID.");
    const faq = await FAQModel.findByIdAndDelete(req.params.faqId);
    if (!faq) throw new ApiError(404, "FAQ not found.");
    await writeAudit(req.user.id, "faq_deleted", "FAQ", faq._id.toString());
    res.json({ message: "FAQ deleted." });
  }),
);
adminRouter.get(
  "/contact-inquiries",
  asyncHandler(async (_req, res) => {
    const inquiries = await ContactInquiryModel.find()
      .sort({ createdAt: -1 })
      .lean();
    res.json({ inquiries });
  }),
);
adminRouter.patch(
  "/contact-inquiries/:inquiryId",
  asyncHandler(async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.inquiryId))
      throw new ApiError(400, "Invalid inquiry ID.");
    const data = z
      .object({ status: z.enum(["new", "in_progress", "closed"]) })
      .parse(req.body);
    const inquiry = await ContactInquiryModel.findByIdAndUpdate(
      req.params.inquiryId,
      { $set: data },
      { new: true, runValidators: true },
    );
    if (!inquiry) throw new ApiError(404, "Contact inquiry not found.");
    await writeAudit(
      req.user.id,
      `contact_inquiry_${data.status}`,
      "ContactInquiry",
      inquiry._id.toString(),
    );
    res.json({ inquiry });
  }),
);
adminRouter.delete(
  "/contact-inquiries/:inquiryId",
  asyncHandler(async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.inquiryId))
      throw new ApiError(400, "Invalid inquiry ID.");
    const inquiry = await ContactInquiryModel.findByIdAndDelete(
      req.params.inquiryId,
    );
    if (!inquiry) throw new ApiError(404, "Contact inquiry not found.");
    await writeAudit(
      req.user.id,
      "contact_inquiry_deleted",
      "ContactInquiry",
      inquiry._id.toString(),
    );
    res.json({ message: "Contact inquiry deleted." });
  }),
);
adminRouter.get(
  "/audit-logs",
  asyncHandler(async (_req, res) => {
    const logs = await AuditLogModel.find()
      .populate("actor", "fullName email role")
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();
    res.json({ logs });
  }),
);
adminRouter.delete(
  "/audit-logs/:logId",
  asyncHandler(async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.logId)) {
      throw new ApiError(400, "Invalid audit log ID.");
    }
    const log = await AuditLogModel.findByIdAndDelete(req.params.logId);
    if (!log) {
      throw new ApiError(404, "Audit log entry not found.");
    }
    res.json({ message: "Activity entry deleted successfully." });
  }),
);
adminRouter.patch(
  "/teachers/:teacherId/status",
  asyncHandler(async (req, res) => {
    const data = z
      .object({
        status: z.enum(["active", "suspended"]),
      })
      .parse(req.body);
    const teacher = await UserModel.findOne({
      _id: req.params.teacherId,
      role: "teacher",
      isDeleted: { $ne: true },
    });
    if (!teacher) {
      throw new ApiError(404, "Teacher account not found.");
    }
    teacher.accountStatus = data.status;
    await teacher.save();
    await writeAudit(
      req.user.id,
      `teacher_status_${data.status}`,
      "User",
      teacher._id.toString(),
    );
    res.json({ message: `Teacher status changed to ${data.status}.`, teacher });
  }),
);
adminRouter.get(
  "/announcements",
  asyncHandler(async (_req, res) => {
    const announcements = await AnnouncementModel.find()
      .populate("author", "fullName")
      .populate("classroom", "title")
      .sort({ createdAt: -1 })
      .lean();
    res.json({ announcements });
  }),
);
adminRouter.post(
  "/announcements",
  asyncHandler(async (req, res) => {
    const data = z
      .object({
        title: z.string().trim().min(3, "Title must be at least 3 characters."),
        content: z
          .string()
          .trim()
          .min(5, "Message must be at least 5 characters."),
        target: z.enum(["all", "all_students", "all_teachers", "classroom"], {
          errorMap: () => ({ message: "Select a valid audience." }),
        }),
        classroomId: z.any().optional(),
        priority: z.enum(["normal", "high", "urgent"]).default("normal"),
      })
      .parse(req.body);

    let validClassroomId = null;
    if (data.target === "classroom") {
      const rawId =
        typeof data.classroomId === "string" ? data.classroomId.trim() : null;
      if (!rawId || !mongoose.isValidObjectId(rawId)) {
        throw new ApiError(
          400,
          "Select a valid cohort for a cohort-specific announcement.",
        );
      }
      if (!(await ClassroomModel.exists({ _id: rawId }))) {
        throw new ApiError(404, "The selected cohort does not exist.");
      }
      validClassroomId = rawId;
    }

    const announcement = await AnnouncementModel.create({
      title: data.title,
      content: data.content,
      target: data.target,
      classroom: validClassroomId,
      author: req.user.id,
      priority: data.priority,
    });

    // Notify and inbox targeted users by collecting their emails
    let targetUsers = [];
    let cohortTitle = null;

    if (data.target === "all") {
      targetUsers = await UserModel.find({ accountStatus: "active" })
        .select("_id email fullName name")
        .lean();
    } else if (data.target === "all_students") {
      targetUsers = await UserModel.find({
        role: "student",
        accountStatus: "active",
      })
        .select("_id email fullName name")
        .lean();
    } else if (data.target === "all_teachers") {
      targetUsers = await UserModel.find({
        role: "teacher",
        accountStatus: "active",
      })
        .select("_id email fullName name")
        .lean();
    } else if (data.target === "classroom" && validClassroomId) {
      const classroom = await ClassroomModel.findById(validClassroomId)
        .select("title teacher students")
        .lean();
      if (classroom) {
        cohortTitle = classroom.title;
        const userIds = [
          ...(classroom.teacher ? [classroom.teacher] : []),
          ...(classroom.students || []),
        ];
        targetUsers = await UserModel.find({
          _id: { $in: userIds },
          accountStatus: "active",
        })
          .select("_id email fullName name")
          .lean();
      }
    }

    if (targetUsers.length > 0) {
      // 1. In-App Notifications
      const uniqueRecipients = [
        ...new Map(targetUsers.map((u) => [u._id.toString(), u])).values(),
      ];
      await NotificationModel.insertMany(
        uniqueRecipients.map((u) => ({
          user: u._id,
          title: `📢 Announcement: ${announcement.title}`,
          message:
            announcement.content.length > 200
              ? `${announcement.content.slice(0, 200)}…`
              : announcement.content,
          kind: "announcement",
          link: "/dashboard",
        })),
      );
      // Prune each recipient's notifications to their role-based cap (fire-and-forget)
      void Promise.all(
        uniqueRecipients.map(async (u) => {
          const userDoc = await UserModel.findById(u._id).select("role").lean();
          const cap =
            NOTIFICATION_CAPS[userDoc?.role] || NOTIFICATION_CAPS.student;
          await pruneNotifications(u._id, cap);
        }),
      );

      // 2. Direct Email Inboxing to everyone registered
      void (async () => {
        console.log(
          `[Announcement Inboxing] Sending "${announcement.title}" directly to ${uniqueRecipients.length} registered user inboxes...`,
        );
        for (const recipient of uniqueRecipients) {
          if (recipient.email) {
            await sendAnnouncementEmail({
              email: recipient.email,
              name: recipient.fullName || recipient.name,
              title: announcement.title,
              content: announcement.content,
              priority: announcement.priority,
              cohortTitle,
            }).catch((err) => {
              console.error(
                `[Announcement Inboxing] Failed for ${recipient.email}:`,
                err?.message || err,
              );
            });
          }
        }
      })();
    }

    await writeAudit(
      req.user.id,
      "announcement_created",
      "Announcement",
      announcement._id.toString(),
    );
    res.status(201).json({ announcement });
  }),
);
adminRouter.patch(
  "/announcements/:announcementId",
  asyncHandler(async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.announcementId))
      throw new ApiError(400, "Invalid announcement ID.");
    const data = z
      .object({
        title: z.string().trim().min(3).optional(),
        content: z.string().trim().min(5).optional(),
        target: z
          .enum(["all", "all_students", "all_teachers", "classroom"])
          .optional(),
        classroomId: z.any().optional(),
        priority: z.enum(["normal", "high", "urgent"]).optional(),
      })
      .refine(
        (value) => Object.keys(value).length > 0,
        "Provide at least one field to update.",
      )
      .parse(req.body);

    const announcement = await AnnouncementModel.findById(
      req.params.announcementId,
    );
    if (!announcement) throw new ApiError(404, "Announcement not found.");

    if (data.title !== undefined) announcement.title = data.title;
    if (data.content !== undefined) announcement.content = data.content;
    if (data.target !== undefined) announcement.target = data.target;
    if (data.priority !== undefined) announcement.priority = data.priority;

    if (announcement.target === "classroom") {
      const rawId =
        data.classroomId !== undefined
          ? typeof data.classroomId === "string"
            ? data.classroomId.trim()
            : null
          : announcement.classroom?.toString();

      if (!rawId || !mongoose.isValidObjectId(rawId)) {
        throw new ApiError(
          400,
          "Select a valid cohort for a cohort-specific announcement.",
        );
      }
      if (!(await ClassroomModel.exists({ _id: rawId }))) {
        throw new ApiError(404, "The selected cohort does not exist.");
      }
      announcement.classroom = rawId;
    } else {
      announcement.classroom = null;
    }

    await announcement.save();
    await writeAudit(
      req.user.id,
      "announcement_updated",
      "Announcement",
      announcement._id.toString(),
    );
    res.json({ announcement });
  }),
);
adminRouter.delete(
  "/announcements/:announcementId",
  asyncHandler(async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.announcementId))
      throw new ApiError(400, "Invalid announcement ID.");
    const announcement = await AnnouncementModel.findByIdAndDelete(
      req.params.announcementId,
    );
    if (!announcement) throw new ApiError(404, "Announcement not found.");
    await writeAudit(
      req.user.id,
      "announcement_deleted",
      "Announcement",
      announcement._id.toString(),
    );
    res.json({ message: "Announcement deleted." });
  }),
);
// ─── Certificate management (Admin reviews published results and issues) ───
adminRouter.get(
  "/certificates",
  asyncHandler(async (_req, res) => {
    const [certificates, publishedReports] = await Promise.all([
      CertificateModel.find()
        .populate("student", "fullName name email avatarUrl")
        .populate("classroom", "title")
        .populate("course", "title slug thumbnailUrl")
        .populate("issuedBy", "fullName name")
        .sort({ issueDate: -1 })
        .lean(),
      TeacherProgressReportModel.find({
        status: "published",
        overallScore: { $ne: null, $gte: CERTIFICATE_PASS_MARK },
      })
        .populate("student", "fullName name email avatarUrl")
        .populate({
          path: "classroom",
          select: "title course",
          populate: { path: "course", select: "title slug thumbnailUrl" },
        })
        .sort({ publishedAt: -1 })
        .lean(),
    ]);

    const issuedKeys = new Set(
      certificates.map((cert) => `${cert.student?._id}-${cert.classroom?._id}`),
    );
    const eligibleMap = new Map();
    for (const report of publishedReports) {
      if (!report.student || !report.classroom) continue;
      const key = `${report.student._id}-${report.classroom._id}`;
      if (issuedKeys.has(key) || eligibleMap.has(key)) continue;
      eligibleMap.set(key, {
        student: report.student,
        classroom: report.classroom,
        course: report.classroom.course ?? null,
        overallScore: report.overallScore,
        period: report.period,
        publishedAt: report.publishedAt,
      });
    }

    res.json({
      certificates,
      eligible: Array.from(eligibleMap.values()),
      threshold: CERTIFICATE_PASS_MARK,
    });
  }),
);
adminRouter.post(
  "/certificates",
  asyncHandler(async (req, res) => {
    const data = z
      .object({
        studentId: z.string().min(1),
        classroomId: z.string().min(1),
        overallScore: z.number().min(0).max(100).optional(),
        notes: z.string().trim().max(500).default(""),
      })
      .parse(req.body);
    if (
      !mongoose.isValidObjectId(data.studentId) ||
      !mongoose.isValidObjectId(data.classroomId)
    ) {
      throw new ApiError(400, "Invalid student or cohort ID.");
    }
    const classroom = await ClassroomModel.findById(data.classroomId)
      .populate("course")
      .populate("teacher", "fullName name")
      .lean();
    if (!classroom) throw new ApiError(404, "Cohort not found.");
    const student = await UserModel.findOne({
      _id: data.studentId,
      role: "student",
      isDeleted: { $ne: true },
    }).lean();
    if (!student) throw new ApiError(404, "Student not found.");
    if (
      !classroom.students.some(
        (studentId) => studentId.toString() === data.studentId,
      )
    ) {
      throw new ApiError(
        403,
        "This student is not enrolled in the selected cohort.",
      );
    }

    const existing = await CertificateModel.findOne({
      student: student._id,
      classroom: classroom._id,
    });
    if (existing) {
      throw new ApiError(
        409,
        "A certificate has already been issued to this student for this cohort.",
      );
    }

    const publishedReport = await TeacherProgressReportModel.findOne({
      student: student._id,
      classroom: classroom._id,
      status: "published",
      overallScore: { $ne: null },
    })
      .sort({ publishedAt: -1 })
      .lean();

    const overallScore = data.overallScore ?? publishedReport?.overallScore;
    if (overallScore === undefined || overallScore === null) {
      throw new ApiError(
        400,
        "Enter an overall score or publish a graded progress report before issuing a certificate.",
      );
    }
    if (overallScore < CERTIFICATE_PASS_MARK) {
      throw new ApiError(
        400,
        `The overall score must be at least ${CERTIFICATE_PASS_MARK}% to issue a certificate.`,
      );
    }

    const certificateNumber = makeCertificateNumber();
    const certificate = await CertificateModel.create({
      student: student._id,
      classroom: classroom._id,
      course: classroom.course?._id ?? classroom.course,
      certificateNumber,
      studentName: student.fullName || student.name || "TedbabeLearnHUB Scholar",
      courseTitle: classroom.course?.title || classroom.title,
      instructorName:
        classroom.teacher?.fullName ||
        classroom.teacher?.name ||
        "TedbabeLearnHUB Academic Faculty",
      issueDate: new Date(),
      overallScore,
      status: "valid",
      verificationUrl: `/verify-certificate/${certificateNumber}`,
      issuedBy: req.user.id,
      notes: data.notes,
    });

    await NotificationModel.create({
      user: student._id,
      title: "Certificate of Completion Awarded!",
      message: `Congratulations! The academy issued your certificate ${certificateNumber} for "${classroom.course?.title || classroom.title}".`,
      kind: "certificate",
      link: "/student/certificates",
    });
    await writeAudit(
      req.user.id,
      "certificate_issued",
      "Certificate",
      certificate._id.toString(),
      {
        studentId: student._id.toString(),
        classroomId: classroom._id.toString(),
        certificateNumber,
      },
    );
    res.status(201).json({
      message: "Certificate issued and delivered to the student.",
      certificate,
    });
  }),
);
adminRouter.patch(
  "/certificates/:certificateId/status",
  asyncHandler(async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.certificateId)) {
      throw new ApiError(400, "Invalid certificate ID.");
    }
    const { status } = z
      .object({ status: z.enum(["valid", "revoked"]) })
      .parse(req.body);
    const certificate = await CertificateModel.findById(
      req.params.certificateId,
    );
    if (!certificate) throw new ApiError(404, "Certificate not found.");
    certificate.status = status;
    certificate.revokedAt = status === "revoked" ? new Date() : null;
    await certificate.save();
    await NotificationModel.create({
      user: certificate.student,
      title:
        status === "revoked"
          ? "Certificate revoked"
          : "Certificate reinstated",
      message:
        status === "revoked"
          ? `Your certificate ${certificate.certificateNumber} has been revoked. Please contact the academy.`
          : `Your certificate ${certificate.certificateNumber} is valid again.`,
      kind: "certificate",
      link: "/student/certificates",
    });
    await writeAudit(
      req.user.id,
      `certificate_${status}`,
      "Certificate",
      certificate._id.toString(),
    );
    res.json({
      message:
        status === "revoked"
          ? "Certificate revoked."
          : "Certificate reinstated.",
      certificate,
    });
  }),
);

// ─── Published results for academy review ───
adminRouter.get(
  "/results",
  asyncHandler(async (req, res) => {
    const filter = {};
    if (
      req.query.classroomId &&
      mongoose.isValidObjectId(req.query.classroomId)
    ) {
      filter.classroom = req.query.classroomId;
    }
    const [attempts, reports] = await Promise.all([
      AssessmentAttemptModel.find({ ...filter, status: "reviewed" })
        .populate("student", "fullName name email")
        .populate("assessment", "title assessmentType maxScore")
        .populate("classroom", "title")
        .sort({ reviewedAt: -1, createdAt: -1 })
        .limit(300)
        .lean(),
      TeacherProgressReportModel.find({ ...filter, status: "published" })
        .populate("student", "fullName name email")
        .populate("teacher", "fullName name")
        .populate("classroom", "title")
        .sort({ publishedAt: -1 })
        .limit(300)
        .lean(),
    ]);
    res.json({ attempts, reports, threshold: CERTIFICATE_PASS_MARK });
  }),
);
adminRouter.get(
  "/reports",
  asyncHandler(async (_req, res) => {
    const [
      studentsByPlacement,
      teachersWithClasses,
      attendanceSummary,
      teacherAttendanceSummary,
      certificateSummary,
      classesWithOccupancy,
    ] = await Promise.all([
      UserModel.aggregate([
        { $match: { role: "student" } },
        {
          $group: {
            _id: "$studentProfile.placementStatus",
            count: { $sum: 1 },
          },
        },
      ]),
      ClassroomModel.aggregate([
        { $match: { teacher: { $ne: null } } },
        { $group: { _id: "$teacher", classCount: { $sum: 1 } } },
      ]),
      AttendanceRecordModel.aggregate([
        { $group: { _id: "$status", count: { $sum: 1 } } },
      ]),
      TeacherAttendanceRecordModel.aggregate([
        { $group: { _id: "$status", count: { $sum: 1 } } },
      ]),
      CertificateModel.aggregate([
        { $group: { _id: "$status", count: { $sum: 1 } } },
      ]),
      ClassroomModel.find()
        .populate("teacher", "fullName")
        .populate("course", "title")
        .select("title capacity students teacher course status")
        .lean(),
    ]);
    res.json({
      placementStats: studentsByPlacement,
      teacherWorkloads: teachersWithClasses,
      attendanceStats: attendanceSummary,
      teacherAttendanceStats: teacherAttendanceSummary,
      certificateStats: certificateSummary,
      classes: classesWithOccupancy.map((c) => ({
        _id: c._id,
        title: c.title,
        teacher: c.teacher?.fullName ?? "Unassigned",
        course: c.course?.title ?? "No course",
        capacity: c.capacity,
        enrolledCount: c.students.length,
        status: c.status,
      })),
    });
  }),
);
adminRouter.get(
  "/settings",
  asyncHandler(async (_req, res) => {
    const settings = await PlatformSettingModel.find().lean();
    res.json({ settings });
  }),
);
adminRouter.post(
  "/settings",
  asyncHandler(async (req, res) => {
    const data = z
      .object({
        key: z.string().min(1),
        value: z.any(),
        description: z.string().default(""),
      })
      .parse(req.body);
    const setting = await PlatformSettingModel.findOneAndUpdate(
      { key: data.key },
      { value: data.value, description: data.description },
      { upsert: true, new: true },
    );
    await writeAudit(
      req.user.id,
      "setting_updated",
      "PlatformSetting",
      setting._id.toString(),
      { key: data.key },
    );
    res.json({ setting });
  }),
);

// ─── Submission & assessment-attempt management (keeps uploaded files from bloating storage) ───
adminRouter.get(
  "/submissions",
  asyncHandler(async (req, res) => {
    const filter = {};
    if (
      req.query.classroomId &&
      mongoose.isValidObjectId(req.query.classroomId)
    ) {
      filter.classroom = req.query.classroomId;
    }
    if (req.query.status) {
      filter.status = req.query.status;
    }
    const [submissions, attempts] = await Promise.all([
      AssignmentSubmissionModel.find(filter)
        .populate("assignment", "title maxScore dueDate")
        .populate("student", "fullName name email")
        .populate("classroom", "title")
        .sort({ createdAt: -1 })
        .limit(300)
        .lean(),
      AssessmentAttemptModel.find(
        req.query.classroomId && mongoose.isValidObjectId(req.query.classroomId)
          ? { classroom: req.query.classroomId }
          : {},
      )
        .populate("assessment", "title")
        .populate("student", "fullName name email")
        .populate("classroom", "title")
        .sort({ createdAt: -1 })
        .limit(300)
        .lean(),
    ]);
    const allAttachments = [
      ...submissions.flatMap((item) => item.attachments ?? []),
      ...attempts.flatMap((item) => item.attachments ?? []),
    ];
    res.json({
      submissions,
      attempts,
      storage: {
        fileCount: allAttachments.length,
        totalBytes: allAttachments.reduce(
          (total, file) => total + (file.size || 0),
          0,
        ),
      },
    });
  }),
);
adminRouter.get(
  "/submissions/:submissionId/files/:index",
  asyncHandler(async (req, res) => {
    const submission = await AssignmentSubmissionModel.findById(
      req.params.submissionId,
    ).lean();
    if (!submission) throw new ApiError(404, "Submission not found.");
    await streamSubmissionFile(
      req,
      res,
      pickAttachment(submission.attachments, req.params.index),
    );
  }),
);
adminRouter.delete(
  "/submissions/:submissionId",
  asyncHandler(async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.submissionId))
      throw new ApiError(400, "Invalid submission ID.");
    const submission = await AssignmentSubmissionModel.findById(
      req.params.submissionId,
    );
    if (!submission) throw new ApiError(404, "Submission not found.");
    await cleanupSubmissionFiles(submission.attachments);
    await AssignmentSubmissionModel.deleteOne({ _id: submission._id });
    await writeAudit(
      req.user.id,
      "submission_deleted",
      "AssignmentSubmission",
      submission._id.toString(),
      {
        attachmentCount: submission.attachments?.length ?? 0,
      },
    );
    res.json({ message: "Submission and its uploaded files were deleted." });
  }),
);
adminRouter.get(
  "/attempts/:attemptId/files/:index",
  asyncHandler(async (req, res) => {
    const attempt = await AssessmentAttemptModel.findById(
      req.params.attemptId,
    ).lean();
    if (!attempt) throw new ApiError(404, "Assessment submission not found.");
    await streamSubmissionFile(
      req,
      res,
      pickAttachment(attempt.attachments, req.params.index),
    );
  }),
);
adminRouter.delete(
  "/attempts/:attemptId",
  asyncHandler(async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.attemptId))
      throw new ApiError(400, "Invalid assessment submission ID.");
    const attempt = await AssessmentAttemptModel.findById(req.params.attemptId);
    if (!attempt) throw new ApiError(404, "Assessment submission not found.");
    await cleanupSubmissionFiles(attempt.attachments);
    await AssessmentAttemptModel.deleteOne({ _id: attempt._id });
    await writeAudit(
      req.user.id,
      "attempt_deleted",
      "AssessmentAttempt",
      attempt._id.toString(),
      {
        attachmentCount: attempt.attachments?.length ?? 0,
      },
    );
    res.json({
      message: "Assessment submission and its uploaded files were deleted.",
    });
  }),
);
