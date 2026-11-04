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
    status: {
        type: String,
        enum: ["valid", "revoked"],
        default: "valid",
    },
    verificationUrl: { type: String, default: "" },
    // Issued by an administrator after reviewing published results.
    issuedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    notes: { type: String, default: "" },
    revokedAt: { type: Date, default: null },
}, { timestamps: true });

// Prevent duplicate certificates for the same student and classroom
certificateSchema.index({ student: 1, classroom: 1 }, { unique: true });

export const CertificateModel = mongoose.model("Certificate", certificateSchema);
