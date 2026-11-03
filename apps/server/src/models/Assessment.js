import mongoose, { Schema } from "mongoose";
const questionSchema = new Schema(
  {
    prompt: { type: String, required: true },
    options: { type: [String], required: true },
    correctOptionIndex: { type: Number, required: true },
    explanation: { type: String, default: "" },
    points: { type: Number, default: 1 },
  },
  { _id: true },
);
const assessmentSchema = new Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    instructions: { type: String, default: "" },
    classroom: {
      type: Schema.Types.ObjectId,
      ref: "Classroom",
      required: true,
      index: true,
    },
    teacher: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    assessmentType: {
      type: String,
      enum: [
        "quiz",
        "midExam",
        "final Exam ",
        "Assignment",
        "Attendance",
        "comprehensive",
      ],
      default: "quiz",
      index: true,
    },
    timeLimitMinutes: { type: Number, default: 30 },
    passingScorePercentage: { type: Number, default: 60 },
    isPublished: { type: Boolean, default: true, index: true },
    questions: { type: [questionSchema], default: [] },
  },
  { timestamps: true },
);
export const AssessmentModel = mongoose.model("Assessment", assessmentSchema);
