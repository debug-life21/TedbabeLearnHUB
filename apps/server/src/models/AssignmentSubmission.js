import mongoose, { Schema } from "mongoose";
const submissionLinkSchema = new Schema({
    label: { type: String, default: "" },
    url: { type: String, required: true, trim: true },
}, { _id: false });
const submissionAttachmentSchema = new Schema({
    key: { type: String, required: true },
    storageProvider: { type: String, default: "local_disk" },
    filename: { type: String, required: true },
    mimeType: { type: String, required: true },
    size: { type: Number, required: true },
}, { _id: false });
const assignmentSubmissionSchema = new Schema({
    assignment: { type: Schema.Types.ObjectId, ref: "Assignment", required: true, index: true },
    classroom: { type: Schema.Types.ObjectId, ref: "Classroom", required: true, index: true },
    student: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    textResponse: { type: String, default: "" },
    submissionLinks: { type: [submissionLinkSchema], default: [] },
    attachments: { type: [submissionAttachmentSchema], default: [] },
    status: {
        type: String,
        enum: ["submitted", "graded", "resubmitted"],
        default: "submitted",
        index: true,
    },
    score: { type: Number, default: null },
    feedback: { type: String, default: "" },
    gradedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    gradedAt: { type: Date, default: null },
}, { timestamps: true });
// A student can have one submission per assignment
assignmentSubmissionSchema.index({ assignment: 1, student: 1 }, { unique: true });
export const AssignmentSubmissionModel = mongoose.model("AssignmentSubmission", assignmentSubmissionSchema);
