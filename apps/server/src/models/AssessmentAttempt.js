import mongoose, { Schema } from "mongoose";
const assessmentLinkSchema = new Schema({
    label: { type: String, default: "" },
    url: { type: String, required: true, trim: true },
}, { _id: false });
const assessmentAttachmentSchema = new Schema({
    key: { type: String, required: true },
    storageProvider: { type: String, default: "local_disk" },
    filename: { type: String, required: true },
    mimeType: { type: String, required: true },
    size: { type: Number, required: true },
}, { _id: false });
const assessmentAttemptSchema = new Schema({
    assessment: { type: Schema.Types.ObjectId, ref: "Assessment", required: true, index: true },
    classroom: { type: Schema.Types.ObjectId, ref: "Classroom", required: true, index: true },
    student: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    answers: [
        {
            questionId: { type: Schema.Types.ObjectId, required: true },
            selectedOption: { type: Number, default: -1 },
        },
    ],
    responseText: { type: String, default: "" },
    submissionLinks: { type: [assessmentLinkSchema], default: [] },
    attachments: { type: [assessmentAttachmentSchema], default: [] },
    status: {
        type: String,
        enum: ["submitted", "reviewed"],
        default: "submitted",
        index: true,
    },
    score: { type: Number, default: null },
    maxScore: { type: Number, default: null },
    percentage: { type: Number, default: null },
    passed: { type: Boolean, default: null },
    feedback: { type: String, default: "" },
    reviewedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    reviewedAt: { type: Date, default: null },
    completedAt: { type: Date, default: Date.now },
}, { timestamps: true });
export const AssessmentAttemptModel = mongoose.model("AssessmentAttempt", assessmentAttemptSchema);
