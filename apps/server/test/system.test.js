import test from "node:test";
import assert from "node:assert/strict";
import { app } from "../src/app.js";
import { connectDatabase } from "../src/db.js";
import mongoose from "mongoose";
import { UserModel as User } from "../src/models/User.js";
import { CourseModel as Course } from "../src/models/Course.js";
import { CertificateModel as Certificate } from "../src/models/Certificate.js";
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
                server.close(() => resolve({ status: response.status, data }));
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
    const course = await Course.findOne({ status: "published" }).select("_id").lean();
    assert.ok(course, "A published course is required for student signup tests.");
    return {
        preferredSchedule: "Weekday evenings",
        preferredCourseIds: [course._id.toString()],
    };
}

// ─── Public Catalog ───────────────────────────────────────────────────────────

test("Public Course Catalog: pagination", async () => {
    const res = await request("/api/public/courses?page=1&limit=10");
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.data.courses), "courses must be an array");
    assert.ok(typeof res.data.pagination?.total === "number", "pagination.total must be a number");
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

test("Public Instructors Directory", async () => {
    const res = await request("/api/public/instructors");
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.data.instructors));
});

// ─── Auth: Registration Flow ──────────────────────────────────────────────────

test("Auth Registration: rejects invalid email", async () => {
    const res = await request("/api/auth/signup", {
        method: "POST",
        body: { name: "Test User", email: "not-an-email", password: "Password123!", role: "student" },
    });
    assert.equal(res.status, 400);
});

test("Auth Registration: student signup is lean; teacher applicants still need details", async () => {
    // Students can now create an account without onboarding details —
    // learning preferences are completed later from the dashboard.
    const studentRes = await request("/api/auth/signup", {
        method: "POST",
        body: { name: "Student Without Preferences", email: `student.profile.${Date.now()}@example.com`, password: "Password123!", role: "student", phone: "+251912345678", country: "ET" },
    });
    assert.equal(studentRes.status, 201, `Expected 201 but got ${studentRes.status}: ${JSON.stringify(studentRes.data)}`);

    // Teacher applications must still include the required CV and details.
    const teacherRes = await request("/api/auth/signup", {
        method: "POST",
        body: { name: "Teacher Without Application", email: `teacher.application.${Date.now()}@example.com`, password: "Password123!", role: "teacher", phone: "+251912345678", country: "ET" },
    });
    assert.equal(teacherRes.status, 400);
});

test("Auth Registration: requires phone and country with validation", async () => {
    const profile = await studentSignupProfile();
    // Missing phone
    const resNoPhone = await request("/api/auth/signup", {
        method: "POST",
        body: { name: "No Phone", email: `nophone.${Date.now()}@example.com`, password: "Password123!", role: "student", country: "ET", studentProfile: profile },
    });
    assert.equal(resNoPhone.status, 400);

    // Missing country
    const resNoCountry = await request("/api/auth/signup", {
        method: "POST",
        body: { name: "No Country", email: `nocountry.${Date.now()}@example.com`, password: "Password123!", role: "student", phone: "+251912345678", studentProfile: profile },
    });
    assert.equal(resNoCountry.status, 400);

    // Invalid phone for Ethiopia
    const resInvalidPhone = await request("/api/auth/signup", {
        method: "POST",
        body: { name: "Invalid Phone", email: `invphone.${Date.now()}@example.com`, password: "Password123!", role: "student", phone: "123", country: "ET", studentProfile: profile },
    });
    assert.equal(resInvalidPhone.status, 400);
});

test("Auth Registration: creates account with hashed verification code", async () => {
    const email = `reg.${Date.now()}@example.com`;
    const profile = await studentSignupProfile();
    const res = await request("/api/auth/signup", {
        method: "POST",
        body: { name: "Verified Student", email, password: "Password123!", role: "student", phone: "+251912345678", country: "ET", studentProfile: profile },
    });
    assert.equal(res.status, 201, `Expected 201 but got ${res.status}: ${JSON.stringify(res.data)}`);
    assert.equal(res.data.purpose, "signup");

    // Verify the DB record
    const created = await User.findOne({ email }).select("+verificationCode +codePurpose");
    assert.ok(created, "User must exist in DB");
    assert.equal(created.isVerified, false);
    assert.ok(created.verificationCode, "verificationCode must be set (bcrypt hash)");
    assert.equal(created.codePurpose, "signup");
    assert.equal(created.studentProfile.preferredSchedule, "Weekday evenings");
    assert.equal(created.studentProfile.preferredCourseIds[0].toString(), profile.preferredCourseIds[0]);
});

test("Auth Registration: rejects duplicate email with 409", async () => {
    const email = `dup.${Date.now()}@example.com`;
    await request("/api/auth/signup", {
        method: "POST",
        body: { name: "First User", email, password: "Password123!", role: "student", phone: "+251912345678", country: "ET", studentProfile: await studentSignupProfile() },
    });
    const res = await request("/api/auth/signup", {
        method: "POST",
        body: { name: "Duplicate", email, password: "Password123!", role: "student", phone: "+251912345678", country: "ET", studentProfile: await studentSignupProfile() },
    });
    assert.equal(res.status, 409, `Expected 409 conflict but got ${res.status}`);
});

test("Auth Registration: rejects wrong verification code", async () => {
    const email = `verify.${Date.now()}@example.com`;
    await request("/api/auth/signup", {
        method: "POST",
        body: { name: "Verifying Student", email, password: "Password123!", role: "student", phone: "+251912345678", country: "ET", studentProfile: await studentSignupProfile() },
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
    assert.equal(res.status, 200, `Expected 200 but got ${res.status}: ${JSON.stringify(res.data)}`);

    const updated = await User.findOne({ email }).select("+resetPasswordToken +verificationCode +codePurpose");
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
