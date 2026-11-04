import mongoose, { Schema } from "mongoose";
import {
  ASSESSMENT_CATEGORIES,
  LEGACY_ASSESSMENT_CATEGORIES,
} from "../utils/assessmentCategories.js";
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
      enum: [...ASSESSMENT_CATEGORIES, ...LEGACY_ASSESSMENT_CATEGORIES],
      default: "quiz",
      index: true,
    },
    // Maximum marks for the assessment. Written/category assessments use this
    // directly; quiz-style assessments also accept a sum of question points.
    maxScore: { type: Number, default: 100, min: 1 },
    timeLimitMinutes: { type: Number, default: 30 },
    passingScorePercentage: { type: Number, default: 60 },
    isPublished: { type: Boolean, default: true, index: true },
    questions: { type: [questionSchema], default: [] },
  },
  { timestamps: true },
);
export const AssessmentModel = mongoose.model("Assessment", assessmentSchema);
