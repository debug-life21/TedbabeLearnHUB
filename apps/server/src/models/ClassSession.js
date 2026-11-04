import mongoose, { Schema } from "mongoose";
const classSessionSchema = new Schema({
    classroom: { type: Schema.Types.ObjectId, ref: "Classroom", required: true, index: true },
    teacher: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    seriesId: { type: String, default: "", index: true },
    recurrencePattern: {
        type: String,
        enum: ["none", "daily", "weekly", "biweekly", "monthly"],
        default: "none",
    },
    // Number of days / weeks / months between occurrences, based on the pattern.
    recurrenceInterval: { type: Number, default: 1 },
    // Retained for backwards compatibility with existing weekly series.
    recurrenceIntervalWeeks: { type: Number, default: 1 },
    recurrenceCount: { type: Number, default: 1 },
    recurrenceIndex: { type: Number, default: 0 },
    title: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    startsAt: { type: Date, required: true, index: true },
    endsAt: { type: Date, required: true },
    meetingUrl: { type: String, default: "" },
    status: {
        type: String,
        enum: ["scheduled", "completed", "cancelled"],
        default: "scheduled",
        index: true,
    },
}, { timestamps: true });
export const ClassSessionModel = mongoose.model("ClassSession", classSessionSchema);
