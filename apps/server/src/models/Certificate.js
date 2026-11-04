import mongoose, { Schema } from "mongoose";

const certificateSchema = new Schema({
    student: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    classroom: { type: Schema.Types.ObjectId, ref: "Classroom", required: true, index: true },
    course: { type: Schema.Types.ObjectId, ref: "Course", required: true, index: true },
    certificateNumber: { type: String, required: true, unique: true, index: true },
    studentName: { type: String, required: true },
    courseTitle: { type: String, required: true },
    instructorName: { type: String, default: "TedbabeLearnHUB Academic Faculty" },
    issueDate: { type: Date, default: Date.now },
    overallScore: { type: Number, required: true }, // e.g. 88
    // Lifecycle: administrators prepare a draft, sign it, then publish it so it
    // reaches the student. "valid" is a legacy value treated as published.
    status: {
        type: String,
        enum: ["draft", "published", "revoked"],
        default: "draft",
        index: true,
    },
    verificationUrl: { type: String, default: "" },
    // Issued by an administrator after reviewing published results.
    issuedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    // Signature the administrator applies when preparing the certificate.
    signatureName: { type: String, default: "" },
    signatureTitle: { type: String, default: "" },
    signatureImage: { type: String, default: "" },
    notes: { type: String, default: "" },
    publishedAt: { type: Date, default: null },
    revokedAt: { type: Date, default: null },
}, { timestamps: true });

// Prevent duplicate certificates for the same student and classroom
certificateSchema.index({ student: 1, classroom: 1 }, { unique: true });

export const CertificateModel = mongoose.model("Certificate", certificateSchema);
