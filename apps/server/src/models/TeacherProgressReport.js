import mongoose, { Schema } from "mongoose";
import {
  ASSESSMENT_CATEGORIES,
  LEGACY_ASSESSMENT_CATEGORIES,
} from "../utils/assessmentCategories.js";

const componentSchema = new Schema(
  {
    category: {
      type: String,
      enum: [...ASSESSMENT_CATEGORIES, ...LEGACY_ASSESSMENT_CATEGORIES],
      required: true,
    },
    title: { type: String, required: true, trim: true },
    score: { type: Number, required: true, min: 0 },
    maxScore: { type: Number, required: true, min: 1 },
    feedback: { type: String, default: "" },
  },
  { _id: true },
);

const teacherProgressReportSchema = new Schema(
  {
    teacher: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    classroom: {
      type: Schema.Types.ObjectId,
      ref: "Classroom",
      required: true,
      index: true,
    },
    student: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    period: { type: String, required: true, trim: true },
    overallScore: { type: Number, default: null, min: 0, max: 100 },
    components: { type: [componentSchema], default: [] },
    selfAssessment: { type: String, default: "", maxlength: 4000 },
    feedback: { type: String, default: "", maxlength: 4000 },
    status: {
      type: String,
      enum: ["draft", "published"],
      default: "draft",
      index: true,
    },
    publishedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

teacherProgressReportSchema.index(
  { student: 1, classroom: 1, period: 1 },
  { unique: true },
);
teacherProgressReportSchema.index({ student: 1, status: 1, publishedAt: -1 });

export const TeacherProgressReportModel = mongoose.model(
  "TeacherProgressReport",
  teacherProgressReportSchema,
);
