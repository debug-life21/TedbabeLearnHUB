import test from "node:test";
import assert from "node:assert/strict";
import { app } from "../src/app.js";
import { connectDatabase } from "../src/db.js";
import mongoose from "mongoose";
import { UserModel as User } from "../src/models/User.js";
import { CourseModel as Course } from "../src/models/Course.js";
import { CertificateModel as Certificate } from "../src/models/Certificate.js";
import { ClassroomModel } from "../src/models/Classroom.js";
import { EnrollmentModel } from "../src/models/Enrollment.js";
import { OrderModel } from "../src/models/Order.js";
import { TransactionModel } from "../src/models/Transaction.js";
import { SubscriptionModel } from "../src/models/Subscription.js";
import { TeacherProgressReportModel } from "../src/models/TeacherProgressReport.js";
import { signToken } from "../src/auth.js";
import {
  applyVerificationResult,
  cancelStudentSubscription,
  fulfilOrder,
} from "../src/services/paymentService.js";
import { seedLearningCatalog } from "../src/catalog.js";

// Helper for in-process HTTP requests to the Express app
async function request(path, options = {}) {
  return new Promise((resolve, reject) => {
    const headers = {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    };
    const reqBody = options.body ? JSON.stringify(options.body) : undefined;
    if (reqBody) {
      headers["Content-Length"] = Buffer.byteLength(reqBody);
    }
    const server = app.listen(0, async () => {
      const port = server.address().port;
      try {
        const response = await fetch(`http://localhost:${port}${path}`, {
          method: options.method || "GET",
          headers,
          body: reqBody,
        });
        const data = await response.json().catch(() => ({}));
        server.close(() =>
          resolve({ status: response.status, data, headers: response.headers }),
        );
      } catch (err) {
        server.close(() => reject(err));
      }
    });
  });
}

test.before(async () => {
  await connectDatabase();
  // Seed the isolated test database so tests always have published courses to work with.
  await seedLearningCatalog();
});

test.after(async () => {
  // Clean up every account and record this suite creates so nothing is ever left behind.
  await User.deleteMany({ email: /@example\.com$/ });
  await Certificate.deleteMany({ certificateNumber: /^TLH-2026-E2E-/ });
  await mongoose.connection.close();
});

async function studentSignupProfile() {
  const course = await Course.findOne({ status: "published" })
    .select("_id")
    .lean();
  assert.ok(course, "A published course is required for student signup tests.");
  return {
    preferredSchedule: "Weekday evenings",
    preferredCourseIds: [course._id.toString()],
  };
}

test("Students only see teacher-published progress reports", async () => {
  const course = await Course.findOne({ status: "published" })
    .select("_id")
    .lean();
  assert.ok(course);
  const uniqueId = Date.now();
  const teacher = await User.create({
    fullName: "Progress Report Teacher",
    email: `progress.teacher.${uniqueId}@example.com`,
    role: "teacher",
    emailVerified: true,
  });
  const student = await User.create({
    fullName: "Progress Report Student",
    email: `progress.student.${uniqueId}@example.com`,
    role: "student",
    emailVerified: true,
  });
  const classroom = await ClassroomModel.create({
    title: "Progress Report Cohort",
    course: course._id,
    teacher: teacher._id,
    students: [student._id],
    status: "active",
  });
  const studentToken = signToken({ sub: String(student._id), role: "student" });
  const teacherToken = signToken({ sub: String(teacher._id), role: "teacher" });
  const reportUrl = `/api/teacher/progress-reports/${classroom._id}/${student._id}`;

  try {
    const draft = await request(reportUrl, {
      method: "PUT",
      headers: { Authorization: `Bearer ${teacherToken}` },
      body: {
        period: "Term 1",
        overallScore: null,
        selfAssessment: "Draft teacher assessment",
        feedback: "Draft feedback",
        status: "draft",
      },
    });
    assert.equal(draft.status, 200);

    const hidden = await request("/api/student/progress", {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    assert.equal(hidden.status, 200);
    assert.equal(hidden.data.reports.length, 0);
    assert.equal(hidden.data.progress, null);

    const published = await request(reportUrl, {
      method: "PUT",
      headers: { Authorization: `Bearer ${teacherToken}` },
      body: {
        period: "Term 1",
        overallScore: 84,
        components: [
          { category: "midterm", title: "Midterm", score: 42, maxScore: 50 },
        ],
        selfAssessment: "The learner has made steady progress.",
        feedback: "Keep practicing the weekly exercises.",
        status: "published",
      },
    });
    assert.equal(published.status, 200);

    const visible = await request("/api/student/progress", {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    assert.equal(visible.status, 200);
    assert.equal(visible.data.reports.length, 1);
    assert.equal(visible.data.progress.overallScore, 84);
    assert.equal(visible.data.reports[0].components[0].category, "midterm");
  } finally {
    await TeacherProgressReportModel.deleteMany({ classroom: classroom._id });
    await ClassroomModel.deleteOne({ _id: classroom._id });
    await User.deleteMany({ _id: { $in: [teacher._id, student._id] } });
  }
});

// ─── Public Catalog ───────────────────────────────────────────────────────────

test("Public Course Catalog: pagination", async () => {
  const res = await request("/api/public/courses?page=1&limit=10");
  assert.equal(res.status, 200);
  assert.ok(Array.isArray(res.data.courses), "courses must be an array");
  assert.ok(
    typeof res.data.pagination?.total === "number",
    "pagination.total must be a number",
  );
});

test("Public Course Catalog: search filter", async () => {
  const res = await request("/api/public/courses?search=Math&limit=5");
  assert.equal(res.status, 200);
  assert.ok(Array.isArray(res.data.courses));
});

test("Public Course Catalog: individual course detail", async () => {
  const sample = await Course.findOne({}).lean();
  if (!sample) {
    console.log("[TEST SKIP] No courses seeded — skipping course detail test");
    return;
  }
  const res = await request(`/api/public/courses/${sample._id}`);
  assert.equal(res.status, 200);
  assert.equal(res.data.course.title, sample.title);
  assert.ok(Array.isArray(res.data.course.modules));
});

test("Public monetization plans expose active offers only", async () => {
  const res = await request("/api/public/plans");
  assert.equal(res.status, 200);
  assert.ok(Array.isArray(res.data.plans));
  assert.ok(res.data.plans.every((plan) => plan.isActive !== false));
  assert.ok(res.data.plans.every((plan) => !("createdBy" in plan)));
});

test("CORS rejects unlisted credentialed origins", async () => {
  const allowed = await request("/api/health", {
    headers: { Origin: "http://localhost:5173" },
  });
  const rejected = await request("/api/health", {
    headers: { Origin: "https://untrusted.example" },
  });
  const unconfiguredPreview = await request("/api/health", {
    headers: { Origin: "https://attacker-preview.vercel.app" },
  });
  assert.equal(
    allowed.headers.get("access-control-allow-origin"),
    "http://localhost:5173",
  );
  assert.equal(rejected.headers.get("access-control-allow-origin"), null);
  assert.equal(
    unconfiguredPreview.headers.get("access-control-allow-origin"),
    null,
  );
});

test("Public Instructors Directory", async () => {
  const res = await request("/api/public/instructors");
  assert.equal(res.status, 200);
  assert.ok(Array.isArray(res.data.instructors));
});

test("Payment fulfillment is idempotent and does not assign a classroom", async () => {
  const course = await Course.findOne({ status: "published" }).lean();
  assert.ok(course);
  const student = await User.create({
    fullName: "Payment Test Student",
    email: `fulfillment.${Date.now()}@example.com`,
    role: "student",
  });
  const reference = `TEST-FULFILL-${Date.now()}`;
  try {
    const order = await OrderModel.create({
      reference,
      student: student._id,
      items: [
        {
          itemType: "course",
          itemId: course._id,
          title: course.title,
          unitPriceSantim: 500,
          quantity: 1,
          subtotalSantim: 500,
        },
      ],
      subtotalSantim: 500,
      totalSantim: 500,
      status: "processing",
    });
    const first = await fulfilOrder({
      orderId: order._id,
      transaction: { provider: "chapa" },
    });
    const second = await fulfilOrder({
      orderId: order._id,
      transaction: { provider: "chapa" },
    });
    assert.equal(first.fulfilled, true);
    assert.equal(second.alreadyFulfilled, true);
    assert.ok(
      await OrderModel.exists({ _id: order._id, fulfilledAt: { $ne: null } }),
    );
    assert.equal(
      await EnrollmentModel.countDocuments({
        student: student._id,
        course: course._id,
        status: "active",
      }),
      1,
    );
    assert.equal(
      await ClassroomModel.countDocuments({ students: student._id }),
      0,
    );
  } finally {
    await EnrollmentModel.deleteMany({ student: student._id });
    await OrderModel.deleteMany({ reference });
    await User.deleteOne({ _id: student._id });
  }
});

test("Provider success without amount/currency cannot settle an order", async () => {
  const student = await User.create({
    fullName: "Verification Test Student",
    email: `verify.payment.${Date.now()}@example.com`,
    role: "student",
  });
  const reference = `TEST-VERIFY-${Date.now()}`;
  try {
    const order = await OrderModel.create({
      reference,
      student: student._id,
      items: [],
      subtotalSantim: 500,
      totalSantim: 500,
      status: "processing",
    });
    const transaction = await TransactionModel.create({
      order: order._id,
      student: student._id,
      provider: "chapa",
      reference,
      idempotencyKey: `test-${reference}`,
      amountSantim: 500,
      status: "pending",
    });
    const incomplete = await applyVerificationResult({
      transactionId: transaction._id,
      source: "verify_api",
      result: { status: "success", amountSantim: null, currency: null },
    });
    assert.equal(incomplete.awaitingVerification, true);
    assert.equal(incomplete.transaction.status, "pending");
    assert.ok(await OrderModel.exists({ _id: order._id, fulfilledAt: null }));

    const mismatch = await applyVerificationResult({
      transactionId: transaction._id,
      source: "verify_api",
      result: { status: "success", amountSantim: 400, currency: "ETB" },
    });
    assert.equal(mismatch.mismatch, true);
    assert.equal(mismatch.transaction.status, "failed");
    assert.ok(await OrderModel.exists({ _id: order._id, fulfilledAt: null }));
  } finally {
    await TransactionModel.deleteMany({ reference });
    await OrderModel.deleteMany({ reference });
    await User.deleteOne({ _id: student._id });
  }
});

test("Subscription cancellation is owner-scoped and does not create an automatic renewal", async () => {
  const student = await User.create({
    fullName: "Subscription Test Student",
    email: `subscription.${Date.now()}@example.com`,
    role: "student",
  });
  const otherStudent = await User.create({
    fullName: "Other Subscription Student",
    email: `subscription.other.${Date.now()}@example.com`,
    role: "student",
  });
  let subscription;
  try {
    subscription = await SubscriptionModel.create({
      student: student._id,
      plan: new mongoose.Types.ObjectId(),
      interval: "month",
      status: "active",
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    });
    await assert.rejects(
      () =>
        cancelStudentSubscription({
          subscriptionId: subscription._id,
          studentId: otherStudent._id,
        }),
      { statusCode: 404 },
    );
    const cancelled = await cancelStudentSubscription({
      subscriptionId: subscription._id,
      studentId: student._id,
    });
    assert.equal(cancelled.cancelAtPeriodEnd, true);
    assert.equal(cancelled.status, "active");
    assert.equal(await OrderModel.countDocuments({ student: student._id }), 0);
  } finally {
    if (subscription)
      await SubscriptionModel.deleteOne({ _id: subscription._id });
    await User.deleteMany({ _id: { $in: [student._id, otherStudent._id] } });
  }
});

// ─── Auth: Registration Flow ──────────────────────────────────────────────────

test("Auth Registration: rejects invalid email", async () => {
  const res = await request("/api/auth/signup", {
    method: "POST",
    body: {
      name: "Test User",
      email: "not-an-email",
      password: "Password123!",
      role: "student",
    },
  });
  assert.equal(res.status, 400);
});

test("Auth Registration: student signup is lean; teacher applicants still need details", async () => {
  // Students can now create an account without onboarding details —
  // learning preferences are completed later from the dashboard.
  const studentRes = await request("/api/auth/signup", {
    method: "POST",
    body: {
      name: "Student Without Preferences",
      email: `student.profile.${Date.now()}@example.com`,
      password: "Password123!",
      role: "student",
      phone: "+251912345678",
      country: "ET",
    },
  });
  assert.equal(
    studentRes.status,
    201,
    `Expected 201 but got ${studentRes.status}: ${JSON.stringify(studentRes.data)}`,
  );

  // Teacher applications must still include the required CV and details.
  const teacherRes = await request("/api/auth/signup", {
    method: "POST",
    body: {
      name: "Teacher Without Application",
      email: `teacher.application.${Date.now()}@example.com`,
      password: "Password123!",
      role: "teacher",
      phone: "+251912345678",
      country: "ET",
    },
  });
  assert.equal(teacherRes.status, 400);
});

test("Auth Registration: requires phone and country with validation", async () => {
  const profile = await studentSignupProfile();
  // Missing phone
  const resNoPhone = await request("/api/auth/signup", {
    method: "POST",
    body: {
      name: "No Phone",
      email: `nophone.${Date.now()}@example.com`,
      password: "Password123!",
      role: "student",
      country: "ET",
      studentProfile: profile,
    },
  });
  assert.equal(resNoPhone.status, 400);

  // Missing country
  const resNoCountry = await request("/api/auth/signup", {
    method: "POST",
    body: {
      name: "No Country",
      email: `nocountry.${Date.now()}@example.com`,
      password: "Password123!",
      role: "student",
      phone: "+251912345678",
      studentProfile: profile,
    },
  });
  assert.equal(resNoCountry.status, 400);

  // Invalid phone for Ethiopia
  const resInvalidPhone = await request("/api/auth/signup", {
    method: "POST",
    body: {
      name: "Invalid Phone",
      email: `invphone.${Date.now()}@example.com`,
      password: "Password123!",
      role: "student",
      phone: "123",
      country: "ET",
      studentProfile: profile,
    },
  });
  assert.equal(resInvalidPhone.status, 400);
});

test("Auth Registration: creates account with hashed verification code", async () => {
  const email = `reg.${Date.now()}@example.com`;
  const profile = await studentSignupProfile();
  const res = await request("/api/auth/signup", {
    method: "POST",
    body: {
      name: "Verified Student",
      email,
      password: "Password123!",
      role: "student",
      phone: "+251912345678",
      country: "ET",
      studentProfile: profile,
    },
  });
  assert.equal(
    res.status,
    201,
    `Expected 201 but got ${res.status}: ${JSON.stringify(res.data)}`,
  );
  assert.equal(res.data.purpose, "signup");

  // Verify the DB record
  const created = await User.findOne({ email }).select(
    "+verificationCode +codePurpose",
  );
  assert.ok(created, "User must exist in DB");
  assert.equal(created.isVerified, false);
  assert.ok(
    created.verificationCode,
    "verificationCode must be set (bcrypt hash)",
  );
  assert.equal(created.codePurpose, "signup");
  assert.equal(created.studentProfile.preferredSchedule, "Weekday evenings");
  assert.equal(
    created.studentProfile.preferredCourseIds[0].toString(),
    profile.preferredCourseIds[0],
  );
});

test("Auth Registration: rejects duplicate email with 409", async () => {
  const email = `dup.${Date.now()}@example.com`;
  await request("/api/auth/signup", {
    method: "POST",
    body: {
      name: "First User",
      email,
      password: "Password123!",
      role: "student",
      phone: "+251912345678",
      country: "ET",
      studentProfile: await studentSignupProfile(),
    },
  });
  const res = await request("/api/auth/signup", {
    method: "POST",
    body: {
      name: "Duplicate",
      email,
      password: "Password123!",
      role: "student",
      phone: "+251912345678",
      country: "ET",
      studentProfile: await studentSignupProfile(),
    },
  });
  assert.equal(res.status, 409, `Expected 409 conflict but got ${res.status}`);
});

test("Auth Registration: rejects wrong verification code", async () => {
  const email = `verify.${Date.now()}@example.com`;
  await request("/api/auth/signup", {
    method: "POST",
    body: {
      name: "Verifying Student",
      email,
      password: "Password123!",
      role: "student",
      phone: "+251912345678",
      country: "ET",
      studentProfile: await studentSignupProfile(),
    },
  });
  const res = await request("/api/auth/verify-code", {
    method: "POST",
    body: { email, code: "000000", purpose: "signup" },
  });
  assert.equal(res.status, 400);
});

// ─── Auth: Password Reset ─────────────────────────────────────────────────────

test("Auth Password Reset: forgot-password issues reset code", async () => {
  const email = `pw.reset.${Date.now()}@example.com`;
  await User.create({
    name: "Reset Target",
    fullName: "Reset Target",
    email,
    passwordHash: "irrelevant-hash",
    role: "student",
    isVerified: true,
    accountStatus: "active",
  });

  const res = await request("/api/auth/forgot-password", {
    method: "POST",
    body: { email },
  });
  assert.equal(
    res.status,
    200,
    `Expected 200 but got ${res.status}: ${JSON.stringify(res.data)}`,
  );

  const updated = await User.findOne({ email }).select(
    "+resetPasswordToken +verificationCode +codePurpose",
  );
  assert.ok(updated.resetPasswordToken, "resetPasswordToken must be set");
  assert.ok(updated.verificationCode, "verificationCode must be set");
  assert.equal(updated.codePurpose, "reset_password");
});

// ─── Security: Role-Based Access Control ──────────────────────────────────────

test("RBAC: admin endpoint requires authentication", async () => {
  const res = await request("/api/admin/metrics");
  assert.equal(res.status, 401);
});

test("RBAC: teacher endpoint requires authentication", async () => {
  const res = await request("/api/teacher/classes");
  assert.equal(res.status, 401);
});

test("RBAC: student endpoint requires authentication", async () => {
  const res = await request("/api/student/classes");
  assert.equal(res.status, 401);
});

// ─── Certificate Verification ─────────────────────────────────────────────────

test("Certificate Verification: valid certificate lookup", async () => {
  const stubId = new mongoose.Types.ObjectId();
  const certNumber = `TLH-2026-E2E-${Date.now()}`;
  await Certificate.create({
    certificateNumber: certNumber,
    student: stubId,
    classroom: stubId,
    course: stubId,
    studentName: "Abebe Bikila",
    courseTitle: "Full-Stack Web Development",
    overallScore: 94,
    issueDate: new Date(),
    status: "valid",
    verificationUrl: `https://tedbabelearnhub.et/verify-certificate?id=${certNumber}`,
  });

  const res = await request(`/api/public/certificates/${certNumber}`);
  assert.equal(res.status, 200);
  assert.equal(res.data.certificate.studentName, "Abebe Bikila");
  assert.equal(res.data.certificate.overallScore, 94);
});

test("Certificate Verification: returns 404 for unknown credential", async () => {
  const res = await request("/api/public/certificates/TLH-DOES-NOT-EXIST-0000");
  assert.equal(res.status, 404);
});
