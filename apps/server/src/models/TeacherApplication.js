import mongoose, { Schema } from "mongoose";
const teacherApplicationSchema = new Schema({
    user: { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    qualifications: { type: String, required: true, trim: true },
    experience: { type: String, required: true, trim: true },
    teachingStatement: { type: String, default: "" },
    teachingCategories: { type: [String], default: [] },
    teachingModes: { type: [String], default: [] },
    teachingLanguages: { type: [String], default: [] },
    experienceYears: { type: Number, default: 0 },
    availability: { type: String, default: "" },
    portfolioUrl: { type: String, default: "" },
    linkedInUrl: { type: String, default: "" },
    documents: {
        cv: {
            key: { type: String, default: "" },
            storageProvider: { type: String, default: "local_disk" },
            filename: { type: String, default: "" },
            mimeType: { type: String, default: "" },
            size: { type: Number, default: 0 },
        },
        certificates: [{
            key: { type: String, required: true },
            storageProvider: { type: String, default: "local_disk" },
            filename: { type: String, required: true },
            mimeType: { type: String, required: true },
            size: { type: Number, required: true },
        }],
    },
    status: {
        type: String,
        enum: ["pending", "approved", "rejected"],
        default: "pending",
        index: true,
    },
    rejectionReason: { type: String, default: "" },
    reviewedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    reviewedAt: { type: Date, default: null },
}, { timestamps: true });
export const TeacherApplicationModel = mongoose.model("TeacherApplication", teacherApplicationSchema);
