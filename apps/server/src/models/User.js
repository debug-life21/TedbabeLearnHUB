import mongoose, { Schema } from "mongoose";
export const roles = ["admin", "hub_admin", "teacher", "student", "support_staff"];
const studentProfileSchema = new Schema({
    learningInterests: { type: [String], default: [] },
    learningGoals: { type: String, default: "" },
    currentSkillLevel: { type: String, default: "" },
    preferredSchedule: { type: String, default: "" },
    preferredCourseIds: [{ type: Schema.Types.ObjectId, ref: "Course" }],
    preferredCourseNotes: { type: String, default: "" },
    preferredLearningModes: { type: [String], default: [] },
    weeklyStudyHours: { type: Number, default: 0 },
    timeZone: { type: String, default: "Africa/Addis_Ababa" },
    preferredLanguage: { type: String, default: "en" },
    courseSelectionUpdatedAt: { type: Date, default: null },
    placementStatus: {
        type: String,
        enum: ["pending", "assigned"],
        default: "pending",
    },
}, { _id: false });
const teacherProfileSchema = new Schema({
    bio: { type: String, default: "" },
    expertise: { type: [String], default: [] },
    qualifications: { type: String, default: "" },
    availabilityNotes: { type: String, default: "" },
    experienceYears: { type: Number, default: 0 },
    teachingModes: { type: [String], default: [] },
    portfolioUrl: { type: String, default: "" },
    linkedInUrl: { type: String, default: "" },
    teachingLanguages: { type: [String], default: [] },
}, { _id: false });
const userSchema = new Schema({
    name: { type: String, trim: true, default: "" },
    fullName: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, index: true },
    password: { type: String, select: false },
    passwordHash: { type: String, select: false },
    googleId: { type: String, sparse: true, unique: true },
    authProvider: { type: String, enum: ["local", "google"], default: "local" },
    role: { type: String, enum: roles, required: true, index: true },
    emailVerified: { type: Boolean, default: false },
    isVerified: { type: Boolean, default: false },
    teacherStatus: {
        type: String,
        enum: ["pending", "approved", "rejected"],
        default: function () { return this.accountStatus === "pending_approval" ? "pending" : "approved"; },
        index: true,
    },
    verificationCode: { type: String, select: false, default: undefined },
    codeExpiresAt: { type: Date, select: false, default: undefined },
    codePurpose: { type: String, enum: ["signup", "login", "reset_password"], select: false, default: undefined },
    codeAttempts: { type: Number, select: false, default: 0 },
    codeSentAt: { type: Date, select: false, default: undefined },
    resetPasswordToken: { type: String, select: false, default: undefined },
    resetPasswordExpires: { type: Date, select: false, default: undefined },
    // Device trust for new-device email verification
    trustedDevices: {
        type: [new Schema({
            deviceId: { type: String, required: true },
            label: { type: String, default: "" },
            userAgent: { type: String, default: "" },
            lastSeenAt: { type: Date, default: Date.now },
            createdAt: { type: Date, default: Date.now },
        }, { _id: false })],
        default: [],
        select: false,
    },
    pendingDeviceId: { type: String, select: false, default: undefined },
    pendingDeviceLabel: { type: String, select: false, default: undefined },
    avatarUrl: { type: String, default: "" },
    bio: { type: String, default: "" },
    phone: { type: String, default: "" },
    country: { type: String, default: "" },
    languagePreference: { type: String, enum: ["am", "en"], default: "en" },
    accountStatus: {
        type: String,
        enum: ["pending_approval", "active", "suspended"],
        default: "active",
        index: true,
    },
    // Activity signals for engagement, retention and "activity monitoring"
    // analytics. lastActiveAt is updated at most once every 15 minutes by the
    // role guard, never on every request.
    lastLoginAt: { type: Date, default: null, index: true },
    lastActiveAt: { type: Date, default: null, index: true },
    isDeleted: { type: Boolean, default: false, index: true },
    deletedAt: { type: Date, default: null },
    studentProfile: { type: studentProfileSchema, default: undefined },
    teacherProfile: { type: teacherProfileSchema, default: undefined },
}, { timestamps: true });
export const UserModel = mongoose.model("User", userSchema);
