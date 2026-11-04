// Canonical assessment categories shared by the Assessment model, teacher
// routes and progress reports. Keeping a single source of truth prevents the
// enum drift that previously allowed invalid categories such as "mid Exam ".
export const ASSESSMENT_CATEGORIES = [
    "quiz",
    "assignment",
    "midExam",
    "finalExam",
    "quiz_bank",
    "project",
    "presentation",
    "practical",
    "attendance",
    "selfAssessment",
];

// Friendly human labels used in emails, notifications and dashboards.
export const ASSESSMENT_CATEGORY_LABELS = {
    quiz: "Quiz",
    assignment: "Assignment",
    midExam: "Mid Exam",
    finalExam: "Final Exam",
    quiz_bank: "Question Bank",
    project: "Project",
    presentation: "Presentation",
    practical: "Practical / Lab",
    attendance: "Attendance",
    selfAssessment: "Self Assessment",
    comprehensive: "Comprehensive",
};

// Legacy values that may still exist on documents created before the enum was
// normalised. They are accepted on write so historical records can be re-saved.
export const LEGACY_ASSESSMENT_CATEGORIES = [
    "midterm",
    "final",
    "self_assessment",
    "Assignment",
    "Attendance",
    "mid Exam",
    "final Exam ",
    "comprehensive",
];

const LEGACY_MAP = {
    midterm: "midExam",
    "mid Exam": "midExam",
    final: "finalExam",
    "final Exam ": "finalExam",
    self_assessment: "selfAssessment",
    Assignment: "assignment",
    Attendance: "attendance",
    comprehensive: "comprehensive",
};

export function assessmentCategoryLabel(value) {
    const canonical = ASSESSMENT_CATEGORIES.includes(value)
        ? value
        : LEGACY_MAP[value];
    return ASSESSMENT_CATEGORY_LABELS[canonical] ?? "Assessment";
}
