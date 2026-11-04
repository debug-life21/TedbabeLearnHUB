import mongoose, { Schema } from "mongoose";

/**
 * Teacher attendance for a delivered teaching session. A teacher is only
 * marked for days they actually had a scheduled session (a "teaching day"),
 * so the register mirrors the class schedule rather than a generic timesheet.
 */
const teacherAttendanceRecordSchema = new Schema(
    {
        session: {
            type: Schema.Types.ObjectId,
            ref: "ClassSession",
            required: true,
            index: true,
        },
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
        // Scheduled start of the teaching day this record belongs to.
        teachingDate: { type: Date, required: true, index: true },
        status: {
            type: String,
            enum: ["present", "late", "absent", "excused"],
            required: true,
            default: "present",
        },
        notes: { type: String, default: "" },
        markedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    },
    { timestamps: true },
);

// One attendance record per teacher per session.
teacherAttendanceRecordSchema.index({ session: 1, teacher: 1 }, { unique: true });

export const TeacherAttendanceRecordModel = mongoose.model(
    "TeacherAttendanceRecord",
    teacherAttendanceRecordSchema,
);
