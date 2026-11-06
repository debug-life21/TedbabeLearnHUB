import React, { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { API_BASE_URL, apiRequest } from "../lib/api";
import { SessionSchedule } from "../components/SessionSchedule";
import { LiveSessionButton } from "../components/LiveSessionButton";
import { ProfilePhotoField } from "../components/ProfilePhotoField";
import { DashboardSettings } from "../components/DashboardSettings";
import { DashboardSidebar } from "../components/DashboardSidebar";
import { formatSessionTime } from "../lib/sessionTime";
import {
  MetricCard,
  DashboardCard,
  EmptyState,
  Badge,
  Modal,
} from "../components/UIComponents";
import { useAuth } from "../context/AuthContext";

const PROGRESS_COMPONENTS = [
  { category: "attendance", label: "Attendance" },
  { category: "assignment", label: "Assignments" },
  { category: "quiz", label: "Quizzes" },
  { category: "midExam", label: "Mid Exam" },
  { category: "finalExam", label: "Final Exam" },
  { category: "project", label: "Project" },
];

// Canonical assessment categories shared with the backend enum.
const ASSESSMENT_TYPE_OPTIONS = [
  { value: "quiz", label: "Quiz" },
  { value: "assignment", label: "Assignment" },
  { value: "midExam", label: "Mid Exam" },
  { value: "finalExam", label: "Final Exam" },
  { value: "project", label: "Project" },
  { value: "presentation", label: "Presentation" },
  { value: "practical", label: "Practical / Lab" },
  { value: "selfAssessment", label: "Teacher-reviewed self-assessment" },
];

const ASSESSMENT_TYPE_LABELS = ASSESSMENT_TYPE_OPTIONS.reduce(
  (labels, option) => ({ ...labels, [option.value]: option.label }),
  { midterm: "Mid Exam", final: "Final Exam", self_assessment: "Self Assessment" },
);

const emptyQuizQuestion = () => ({
  prompt: "",
  options: ["", "", "", ""],
  correctOptionIndex: 0,
  explanation: "",
  points: 1,
});
export function TeacherDashboard({ user }) {
  const { t } = useTranslation();
  const { refreshUser } = useAuth();
  const [activeTab, setActiveTab] = useState("overview");
  const [classes, setClasses] = useState([]);
  const [upcomingLessons, setUpcomingLessons] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [assessments, setAssessments] = useState([]);
  const [resources, setResources] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [feedback, setFeedback] = useState("");
  const [profileForm, setProfileForm] = useState({
    fullName: user.fullName || "",
    phone: user.phone || "",
    bio: user.bio || "",
    avatarUrl: user.avatarUrl || "",
    expertise: user.teacherProfile?.expertise?.join(", ") || "",
    qualifications: user.teacherProfile?.qualifications || "",
    availabilityNotes: user.teacherProfile?.availabilityNotes || "",
    experienceYears: user.teacherProfile?.experienceYears || 0,
  });
  // Password change state
  const [securityForm, setSecurityForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [securityLoading, setSecurityLoading] = useState(false);
  // Attendance state
  const [selectedSessionId, setSelectedSessionId] = useState("");
  const [attendanceRecords, setAttendanceRecords] = useState({});
  const [registerClassroomId, setRegisterClassroomId] = useState("");
  const [cohortRegister, setCohortRegister] = useState(null);
  const [registerLoading, setRegisterLoading] = useState(false);
  // Submissions state
  const [submissionsModal, setSubmissionsModal] = useState({
    open: false,
    assignment: null,
    list: [],
  });
  const [gradingDrafts, setGradingDrafts] = useState({});
  const [overview, setOverview] = useState(null);
  const [progressClassroomId, setProgressClassroomId] = useState("");
  const [progressRoster, setProgressRoster] = useState([]);
  const [progressReports, setProgressReports] = useState([]);
  const [progressLoading, setProgressLoading] = useState(false);
  const [progressSaving, setProgressSaving] = useState(false);
  const [progressForm, setProgressForm] = useState({
    studentId: "",
    period: "",
    overallScore: "",
    attendance: "",
    assignment: "",
    quiz: "",
    midExam: "",
    finalExam: "",
    project: "",
    selfAssessment: "",
    feedback: "",
  });
  // Assessment attempts review state
  const [attemptsModal, setAttemptsModal] = useState({
    open: false,
    assessment: null,
    list: [],
  });
  const [reviewDrafts, setReviewDrafts] = useState({});
  // Authenticated file preview state
  const [filePreview, setFilePreview] = useState({
    open: false,
    title: "",
    url: "",
    mimeType: "",
  });
  const [fileBusy, setFileBusy] = useState(false);
  // Create Assignment Modal
  const [createAssignModal, setCreateAssignModal] = useState(false);
  const [assignForm, setAssignForm] = useState({
    classroomId: "",
    title: "",
    description: "",
    instructions: "",
    dueDate: "",
    maxScore: 100,
  });
  // Create Assessment Modal
  const [createQuizModal, setCreateQuizModal] = useState(false);
  const [quizForm, setQuizForm] = useState({
    classroomId: "",
    title: "",
    description: "",
    instructions: "",
    assessmentType: "quiz",
    maxScore: 100,
    timeLimitMinutes: 30,
    passingScorePercentage: 70,
    questions: [emptyQuizQuestion()],
  });
  // Upload Resource Modal
  const [uploadModal, setUploadModal] = useState(false);
  const [uploadForm, setUploadForm] = useState({
    title: "",
    description: "",
    classroomId: "",
    category: "document",
    sourceType: "upload",
    sourceUrl: "",
    originalFilename: "",
    mimeType: "application/pdf",
    base64Data: "",
  });
  const loadTeacherData = useCallback(async () => {
    try {
      const [dash, classesRes, assignRes, quizRes, resRes, annRes] =
        await Promise.all([
          apiRequest("/api/teacher/dashboard"),
          apiRequest("/api/teacher/classes"),
          apiRequest("/api/teacher/assignments"),
          apiRequest("/api/teacher/assessments"),
          apiRequest("/api/resources"),
          apiRequest("/api/teacher/announcements").catch(() => ({
            announcements: [],
          })),
        ]);
      setClasses(classesRes.classes || []);
      setUpcomingLessons(dash.upcomingLessons || []);
      setAssignments(assignRes.assignments || []);
      setAssessments(quizRes.assessments || []);
      setResources(resRes.resources || []);
      setNotifications(dash.notifications || []);
      setAnnouncements(annRes.announcements || []);
      setOverview(dash.overview || null);
      if (dash.upcomingLessons?.[0] && !selectedSessionId) {
        setSelectedSessionId(dash.upcomingLessons[0]._id);
      }
    } catch (err) {
      setFeedback(err.message);
    }
  }, [selectedSessionId]);
  useEffect(() => {
    loadTeacherData();
    const refreshTimer = window.setInterval(() => {
      void loadTeacherData();
    }, 60_000);
    return () => window.clearInterval(refreshTimer);
  }, [loadTeacherData]);
  // Handle Attendance Change
  const setStudentAttendance = (studentId, status) => {
    setAttendanceRecords((prev) => ({
      ...prev,
      [studentId]: {
        status,
        notes: prev[studentId]?.notes || "",
      },
    }));
  };
  const saveAttendance = async () => {
    if (!selectedSessionId) return;
    const records = Object.entries(attendanceRecords).map(
      ([studentId, data]) => ({
        studentId,
        status: data.status,
        notes: data.notes,
      }),
    );
    try {
      await apiRequest(
        `/api/teacher/sessions/${selectedSessionId}/attendance`,
        {
          method: "POST",
          body: JSON.stringify({ records }),
        },
      );
      setFeedback("Attendance saved.");
    } catch (err) {
      setFeedback(err.message);
    }
  };
  // Load the cumulative attendance register for one of the teacher's cohorts
  const loadCohortRegister = async (classroomId) => {
    setRegisterClassroomId(classroomId);
    if (!classroomId) {
      setCohortRegister(null);
      return;
    }
    setRegisterLoading(true);
    try {
      const res = await apiRequest(
        `/api/teacher/classes/${classroomId}/attendance`,
      );
      setCohortRegister(res.register || null);
    } catch (err) {
      setFeedback(err.message);
    } finally {
      setRegisterLoading(false);
    }
  };
  // Create Assignment
  const handleCreateAssignment = async (e) => {
    e.preventDefault();
    try {
      await apiRequest("/api/teacher/assignments", {
        method: "POST",
        body: JSON.stringify({
          classroomId: assignForm.classroomId || classes[0]?._id,
          title: assignForm.title,
          description: assignForm.description,
          instructions: assignForm.instructions,
          dueDate: new Date(assignForm.dueDate).toISOString(),
          maxScore: Number(assignForm.maxScore),
        }),
      });
      setCreateAssignModal(false);
      setFeedback("Assignment created.");
      void loadTeacherData();
    } catch (err) {
      setFeedback(err.message);
    }
  };
  // View Submissions
  const openSubmissions = async (assignment) => {
    try {
      const res = await apiRequest(
        `/api/teacher/assignments/${assignment._id}/submissions`,
      );
      setSubmissionsModal({
        open: true,
        assignment,
        list: res.submissions,
      });
    } catch (err) {
      setFeedback(err.message);
    }
  };
  // Grade Submission
  const updateGradingDraft = (subId, patch) => {
    setGradingDrafts((prev) => ({
      ...prev,
      [subId]: { ...prev[subId], ...patch },
    }));
  };
  const handleGradeSubmission = async (sub) => {
    const draft = gradingDrafts[sub._id] || {};
    try {
      await apiRequest(`/api/teacher/submissions/${sub._id}/grade`, {
        method: "PATCH",
        body: JSON.stringify({
          score: Number(draft.score ?? 0),
          feedback: draft.feedback ?? "",
        }),
      });
      setFeedback("Grade saved.");
      setGradingDrafts((prev) => {
        const next = { ...prev };
        delete next[sub._id];
        return next;
      });
      if (submissionsModal.assignment) {
        openSubmissions(submissionsModal.assignment);
      }
      void loadTeacherData();
    } catch (err) {
      setFeedback(err.message);
    }
  };
  // View assessment attempts
  const openAttempts = async (assessment) => {
    try {
      const res = await apiRequest(
        `/api/teacher/assessments/${assessment._id}/attempts`,
      );
      setAttemptsModal({
        open: true,
        assessment,
        list: res.attempts || [],
      });
    } catch (err) {
      setFeedback(err.message);
    }
  };
  // Review an assessment attempt and release the result
  const updateReviewDraft = (attemptId, patch) => {
    setReviewDrafts((prev) => ({
      ...prev,
      [attemptId]: { ...prev[attemptId], ...patch },
    }));
  };
  const handleReviewAttempt = async (attempt) => {
    const draft = reviewDrafts[attempt._id] || {};
    try {
      await apiRequest(`/api/teacher/attempts/${attempt._id}/review`, {
        method: "PATCH",
        body: JSON.stringify({
          score: Number(draft.score ?? 0),
          feedback: draft.feedback ?? "",
          passed: draft.passed ?? true,
        }),
      });
      setFeedback("Result released to the student.");
      setReviewDrafts((prev) => {
        const next = { ...prev };
        delete next[attempt._id];
        return next;
      });
      if (attemptsModal.assessment) {
        openAttempts(attemptsModal.assessment);
      }
      void loadTeacherData();
    } catch (err) {
      setFeedback(err.message);
    }
  };
  const openProgressReports = async (classroomId) => {
    setProgressClassroomId(classroomId);
    setProgressReports([]);
    setProgressRoster([]);
    setProgressForm({
      studentId: "",
      period: "",
      overallScore: "",
      attendance: "",
      assignment: "",
      quiz: "",
      midExam: "",
      finalExam: "",
      project: "",
      selfAssessment: "",
      feedback: "",
    });
    if (!classroomId) return;
    setProgressLoading(true);
    try {
      const response = await apiRequest(
        `/api/teacher/progress-reports/${classroomId}`,
      );
      const roster = response.classroom?.students || [];
      const reports = response.reports || [];
      const firstStudentId = String(roster[0]?._id || "");
      const existing = reports.find(
        (report) =>
          String(report.student?._id ?? report.student) === firstStudentId,
      );
      setProgressRoster(roster);
      setProgressReports(reports);
      setProgressForm(progressFormFromReport(existing, firstStudentId));
    } catch (err) {
      setFeedback(err.message || "Could not load progress reports.");
    } finally {
      setProgressLoading(false);
    }
  };
  const handleProgressStudentChange = (studentId) => {
    const existing = progressReports.find(
      (report) => String(report.student?._id ?? report.student) === studentId,
    );
    setProgressForm(progressFormFromReport(existing, studentId));
  };
  const saveProgressReport = async (status) => {
    if (!progressClassroomId || !progressForm.studentId) return;
    setProgressSaving(true);
    try {
      const components = PROGRESS_COMPONENTS.flatMap(({ category, label }) => {
        const score = progressForm[category];
        if (score === "" || score === null || score === undefined) return [];
        return [
          { category, title: label, score: Number(score), maxScore: 100 },
        ];
      });
      const response = await apiRequest(
        `/api/teacher/progress-reports/${progressClassroomId}/${progressForm.studentId}`,
        {
          method: "PUT",
          body: JSON.stringify({
            period: progressForm.period,
            overallScore: components.length > 0 ? progressOverallTotal : null,
            components,
            selfAssessment: progressForm.selfAssessment,
            feedback: progressForm.feedback,
            status,
          }),
        },
      );
      setFeedback(response.message);
      await openProgressReports(progressClassroomId);
    } catch (err) {
      setFeedback(err.message || "Could not save this progress report.");
    } finally {
      setProgressSaving(false);
    }
  };
  // Load a protected submission/attempt file via an authenticated blob
  const openSubmissionFile = async (fileUrl, file) => {
    setFileBusy(true);
    try {
      const blob = await apiRequest(fileUrl, { responseType: "blob" });
      const typed =
        blob instanceof Blob &&
          (!blob.type || blob.type === "application/octet-stream")
          ? new Blob([blob], {
            type: file?.mimeType || "application/octet-stream",
          })
          : blob;
      const objectUrl = URL.createObjectURL(typed);
      setFilePreview((prev) => {
        if (prev.url) URL.revokeObjectURL(prev.url);
        return {
          open: true,
          title: file?.filename || "Submission file",
          url: objectUrl,
          mimeType: file?.mimeType || typed.type,
        };
      });
    } catch (err) {
      setFeedback(err.message);
    } finally {
      setFileBusy(false);
    }
  };
  const closeFilePreview = () => {
    setFilePreview((prev) => {
      if (prev.url) URL.revokeObjectURL(prev.url);
      return { open: false, title: "", url: "", mimeType: "" };
    });
  };
  // Create Quiz
  const handleCreateQuiz = async (e) => {
    e.preventDefault();
    try {
      const questions =
        quizForm.assessmentType === "selfAssessment"
          ? []
          : quizForm.questions
            .filter((question) => question.prompt.trim())
            .map((question) => ({
              ...question,
              options: question.options
                .map((option) => option.trim())
                .filter(Boolean),
            }));
      await apiRequest("/api/teacher/assessments", {
        method: "POST",
        body: JSON.stringify({
          classroomId: quizForm.classroomId || classes[0]?._id,
          title: quizForm.title,
          description: quizForm.description,
          instructions: quizForm.instructions,
          assessmentType: quizForm.assessmentType,
          maxScore: Number(quizForm.maxScore) || 100,
          timeLimitMinutes: Number(quizForm.timeLimitMinutes),
          passingScorePercentage: Number(quizForm.passingScorePercentage),
          questions,
        }),
      });
      setCreateQuizModal(false);
      setQuizForm({
        classroomId: "",
        title: "",
        description: "",
        instructions: "",
        assessmentType: "quiz",
        maxScore: 100,
        timeLimitMinutes: 30,
        passingScorePercentage: 70,
        questions: [emptyQuizQuestion()],
      });
      setFeedback("Assessment created and shared with your cohort.");
      void loadTeacherData();
    } catch (err) {
      setFeedback(err.message);
    }
  };
  // Upload Resource (file, YouTube, or Google Drive)
  const handleFileUpload = async (e) => {
    e.preventDefault();
    try {
      const targetClass = uploadForm.classroomId || classes[0]?._id;
      const isExternal =
        uploadForm.sourceType === "youtube" ||
        uploadForm.sourceType === "google_drive";
      await apiRequest("/api/resources/upload", {
        method: "POST",
        body: JSON.stringify({
          title: uploadForm.title,
          description: uploadForm.description,
          classroomId: targetClass,
          category:
            uploadForm.sourceType === "youtube" ? "video" : uploadForm.category,
          sourceType: uploadForm.sourceType || "upload",
          ...(isExternal
            ? {
              sourceUrl: uploadForm.sourceUrl,
            }
            : {
              originalFilename: uploadForm.originalFilename || "document.pdf",
              mimeType: uploadForm.mimeType || "application/pdf",
              base64Data:
                uploadForm.base64Data ||
                btoa("TedbabeLearnHUB Sample Resource Content"),
            }),
          visibility: "class_only",
        }),
      });
      setUploadModal(false);
      setUploadForm({
        title: "",
        description: "",
        classroomId: "",
        category: "document",
        sourceType: "upload",
        sourceUrl: "",
        originalFilename: "",
        mimeType: "application/pdf",
        base64Data: "",
      });
      setFeedback("Learning resource shared with your cohort.");
      void loadTeacherData();
    } catch (err) {
      setFeedback(err.message);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (securityForm.newPassword !== securityForm.confirmPassword) {
      setFeedback("New passwords do not match.");
      return;
    }
    setSecurityLoading(true);
    setFeedback("");
    try {
      const res = await apiRequest("/api/auth/change-password", {
        method: "POST",
        body: JSON.stringify({
          currentPassword: securityForm.currentPassword,
          newPassword: securityForm.newPassword,
        }),
      });
      setFeedback(res.message || "Password updated successfully.");
      setSecurityForm({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
    } catch (err) {
      setFeedback(err.message || "Failed to update password.");
    } finally {
      setSecurityLoading(false);
    }
  };

  const handleSaveProfile = async (event) => {
    event.preventDefault();
    try {
      const response = await apiRequest("/api/auth/profile", {
        method: "PATCH",
        body: JSON.stringify({
          fullName: profileForm.fullName,
          phone: profileForm.phone,
          bio: profileForm.bio,
          avatarUrl: profileForm.avatarUrl,
          teacherProfile: {
            expertise: profileForm.expertise
              .split(",")
              .map((item) => item.trim())
              .filter(Boolean),
            qualifications: profileForm.qualifications,
            availabilityNotes: profileForm.availabilityNotes,
            experienceYears: Number(profileForm.experienceYears),
          },
        }),
      });
      setProfileForm((current) => ({
        ...current,
        fullName: response.user.fullName,
        avatarUrl: response.user.avatarUrl,
      }));
      await refreshUser();
      setFeedback("Professional profile updated.");
    } catch (err) {
      setFeedback(err.message);
    }
  };

  const currentClassForAttendance = classes.find((c) => c.students?.length > 0);
  // The overall score is always the sum of the entered component scores.
  const hasProgressComponents = PROGRESS_COMPONENTS.some(({ category }) => {
    const value = progressForm[category];
    return value !== "" && value !== null && value !== undefined;
  });
  const progressOverallTotal = Number(
    PROGRESS_COMPONENTS.reduce((sum, { category }) => {
      const value = progressForm[category];
      if (value === "" || value === null || value === undefined) return sum;
      const numeric = Number(value);
      return Number.isFinite(numeric) ? sum + numeric : sum;
    }, 0).toFixed(2),
  );
  const progressFormFromReport = (report, studentId) => {
    const scoreFor = (...categories) =>
      report?.components?.find((component) =>
        categories.includes(component.category),
      )?.score ?? "";
    return {
      studentId,
      period: report?.period || "",
      overallScore: report?.overallScore ?? "",
      attendance: scoreFor("attendance"),
      assignment: scoreFor("assignment", "Assignment"),
      quiz: scoreFor("quiz"),
      midExam: scoreFor("midExam", "midterm", "mid Exam"),
      finalExam: scoreFor("finalExam", "final", "final Exam "),
      project: scoreFor("project"),
      selfAssessment: report?.selfAssessment || "",
      feedback: report?.feedback || "",
    };
  };
  const dashboardTabs = [
    { id: "overview", label: "Overview", icon: "📊" },
    { id: "classes", label: `My cohorts (${classes.length})`, icon: "🏫" },
    {
      id: "schedule",
      label: `Live sessions (${upcomingLessons.length})`,
      icon: "📹",
    },
    { id: "attendance", label: "Attendance", icon: "📝" },
    {
      id: "assignments",
      label: `Assignments (${assignments.length})`,
      icon: "📚",
    },
    {
      id: "assessments",
      label: `Assessments (${assessments.length})`,
      icon: "⏱️",
    },
    { id: "progress", label: "Progress & results", icon: "📈" },
    { id: "resources", label: `Resources (${resources.length})`, icon: "📁" },
    { id: "profile", label: "Professional profile", icon: "👤" },
    { id: "settings", label: "Settings", icon: "⚙️" },
    { id: "security", label: "Account security", icon: "🔒" },
  ];
  return (
    <div className="teacher-workspace min-h-screen space-y-8 px-4 py-6 sm:px-6 lg:pl-72 lg:pr-8">
      <DashboardSidebar
        title="Teacher workspace"
        user={{
          ...user,
          fullName: profileForm.fullName,
          avatarUrl: profileForm.avatarUrl,
        }}
        tabs={dashboardTabs}
        activeTab={activeTab}
        onSelect={setActiveTab}
      />

      {/* Top Banner - Premium Redesign */}
      <div className="relative overflow-hidden rounded-[var(--radius-3xl)] bg-gradient-to-br from-[var(--tlh-navy)] via-[var(--tlh-deep-blue)] to-slate-950 p-6 sm:p-10 text-white border border-[var(--tlh-cyan)]/25 shadow-[var(--shadow-lg)] flex flex-wrap items-center justify-between gap-8">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-20 -top-24 h-96 w-96 rounded-full bg-[var(--tlh-blue-primary)]/10 blur-[100px]"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -left-20 -bottom-24 h-64 w-64 rounded-full bg-[var(--tlh-cyan)]/5 blur-[80px]"
        />

        <div className="relative flex items-center gap-6 sm:gap-8">
          <div className="relative">
            {profileForm.avatarUrl ? (
              <img
                src={profileForm.avatarUrl}
                alt=""
                className="h-20 w-20 sm:h-24 sm:w-24 rounded-full object-cover ring-4 ring-white/10 shadow-2xl"
              />
            ) : (
              <div className="flex h-20 w-20 sm:h-24 sm:w-24 items-center justify-center rounded-full bg-gradient-to-br from-[var(--tlh-blue-primary)] to-[var(--tlh-sky)] text-3xl font-black ring-4 ring-white/10 shadow-2xl">
                {profileForm.fullName?.charAt(0) || "T"}
              </div>
            )}
            <div className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full bg-[var(--tlh-gold)] text-white shadow-lg ring-2 ring-[var(--tlh-navy)]">
              <span className="text-xs">✨</span>
            </div>
          </div>

          <div className="space-y-1">
            <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-[10px] font-extrabold uppercase tracking-[0.2em] text-[var(--tlh-cyan)] backdrop-blur-md border border-white/10">
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--tlh-cyan)] animate-pulse"></span>
              {t("teacherOverview")}
            </span>
            <h1 className="text-3xl font-black tracking-tight text-white sm:text-5xl lg:text-6xl drop-shadow-sm">
              {profileForm.fullName.split(' ')[0]}<span className="text-[var(--tlh-sky)]">.</span>
            </h1>
            <div className="flex items-center gap-3 text-sm font-medium text-slate-300">
              <span className="flex items-center gap-1.5">
                <span className="text-[var(--tlh-gold)]">📧</span> {user.email}
              </span>
              <span className="h-1 w-1 rounded-full bg-slate-500"></span>
              <span className="text-[var(--tlh-sky)] font-bold uppercase tracking-wider text-[10px]">
                {user.role}
              </span>
            </div>
          </div>
        </div>

        <div className="relative flex flex-wrap gap-3">
          <button
            onClick={() => setCreateAssignModal(true)}
            className="golden-btn group flex items-center gap-2 rounded-full px-6 py-3.5 text-sm font-bold text-white shadow-sm hover:shadow-md transition-all active:scale-95"
          >
            <span className="text-lg transition-transform group-hover:rotate-12">+</span>
            {t("createAssignment")}
          </button>
          <button
            onClick={() => setCreateQuizModal(true)}
            className="group flex items-center gap-2 rounded-2xl bg-white/10 px-6 py-3.5 text-sm font-black text-white backdrop-blur-md border border-white/20 transition-all hover:bg-white/20 hover:-translate-y-1 active:scale-95"
          >
            <span className="text-lg text-[var(--tlh-gold)] transition-transform group-hover:scale-110">⏱️</span>
            {t("createAssessment")}
          </button>
          <button
            onClick={() => setUploadModal(true)}
            className="group flex items-center gap-2 rounded-2xl bg-white/5 px-6 py-3.5 text-sm font-black text-white/80 backdrop-blur-md border border-white/10 transition-all hover:bg-white/15 hover:-translate-y-1 active:scale-95"
          >
            <span className="text-lg transition-transform group-hover:scale-110">📁</span>
            {t("uploadResource")}
          </button>
        </div>
      </div>

      {/* Prominent Next Scheduled Live Session Banner - Premium Redesign */}
      {upcomingLessons[0] ? (
        <div className="group relative overflow-hidden rounded-[var(--radius-3xl)] bg-slate-950 p-6 sm:p-8 text-white shadow-[var(--shadow-xl)] border border-emerald-500/20">
          <div className="absolute inset-0 bg-gradient-to-r from-emerald-950/80 via-slate-950 to-slate-950 opacity-90" />
          <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-emerald-500/10 blur-[80px] transition-transform group-hover:scale-110" />

          <div className="relative flex flex-wrap items-center justify-between gap-8">
            <div className="space-y-4">
              <div className="inline-flex items-center gap-2.5 rounded-full bg-emerald-500/10 px-4 py-1.5 text-xs font-black text-emerald-400 border border-emerald-500/20 backdrop-blur-md">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <span className="uppercase tracking-widest">Next Live Session</span>
              </div>

              <div className="space-y-1">
                <h2 className="text-2xl font-black text-white sm:text-3xl lg:text-4xl tracking-tight">
                  {upcomingLessons[0].title}
                </h2>
                <div className="flex flex-wrap items-center gap-5 text-sm font-bold text-slate-400">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">📅</span>
                    <span>{formatSessionTime(upcomingLessons[0].startsAt)} — {formatSessionTime(upcomingLessons[0].endsAt)}</span>
                  </div>
                  <div className="h-4 w-px bg-slate-800 hidden sm:block"></div>
                  <div className="flex items-center gap-2 text-[var(--tlh-gold)]">
                    <span>🔒</span>
                    <span className="text-xs uppercase tracking-tighter text-[var(--tlh-gold)]/80">Meeting link active 10m prior</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-4">
              {upcomingLessons[0].meetingUrl ? (
                <LiveSessionButton session={upcomingLessons[0]} />
              ) : (
                <div className="rounded-2xl bg-white/5 px-6 py-4 text-center border border-white/10 backdrop-blur-sm">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Status</p>
                  <p className="text-sm font-bold text-slate-300">Link Pending</p>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {feedback ? (
        <div className="flex items-center justify-between rounded-2xl bg-[var(--tlh-blue-primary)]/5 p-4 text-sm font-bold text-[var(--tlh-blue-primary)] border border-[var(--tlh-blue-primary)]/20 shadow-sm animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-3">
            <span className="text-lg">ℹ️</span>
            <span>{feedback}</span>
          </div>
          <button
            onClick={() => setFeedback("")}
            className="h-8 w-8 rounded-full hover:bg-[var(--tlh-blue-primary)]/10 flex items-center justify-center transition-colors"
          >
            ✕
          </button>
        </div>
      ) : null}

      {/* 1. OVERVIEW */}
      {activeTab === "overview" ? (
        <div className="space-y-8">
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-5">
            <MetricCard
              label="Assigned cohorts"
              value={classes.length}
              icon="🏫"
              variant="blue"
            />
            <MetricCard
              label="Upcoming sessions"
              value={upcomingLessons.length}
              icon="📹"
              variant="emerald"
            />
            <MetricCard
              label="Total Learners"
              value={classes.reduce(
                (acc, c) => acc + (c.students?.length || 0),
                0,
              )}
              icon="🎓"
              variant="indigo"
            />
            <MetricCard
              label="Pending grading"
              value={overview?.pendingSubmissionsToGrade ?? 0}
              icon="📝"
              variant="amber"
            />
            <MetricCard
              label="Assessment reviews"
              value={overview?.pendingAssessmentReviews ?? 0}
              icon="✅"
              variant="cyan"
            />
          </div>

          <div className="grid gap-8 lg:grid-cols-2">
            <DashboardCard title="Upcoming live sessions">
              <div className="space-y-4">
                {upcomingLessons.length === 0 ? (
                  <EmptyState title="No sessions scheduled yet." />
                ) : (
                  upcomingLessons.map((session) => (
                    <div
                      key={session._id}
                      className="group rounded-[var(--radius-xl)] border border-[var(--surface-border)] bg-[var(--surface-card)] p-5 transition-all hover:border-[var(--tlh-blue-primary)]/30 hover:shadow-[var(--shadow-md)]"
                    >
                      <div className="flex items-center justify-between gap-4">
                        <div className="space-y-1">
                          <h4 className="font-black text-[var(--text-main)] group-hover:text-[var(--tlh-blue-primary)] transition-colors">
                            {session.title}
                          </h4>
                          <div className="flex items-center gap-2 text-xs font-bold text-[var(--text-muted)]">
                            <span>🕒</span>
                            <span>{formatSessionTime(session.startsAt)}</span>
                          </div>
                        </div>
                        <Badge variant="blue">Scheduled</Badge>
                      </div>
                      {session.meetingUrl ? (
                        <div className="mt-4 pt-4 border-t border-[var(--surface-border)]">
                          <LiveSessionButton session={session} compact />
                        </div>
                      ) : null}
                    </div>
                  ))
                )}
              </div>
            </DashboardCard>

            <DashboardCard title="Recent notifications">
              <div className="space-y-3">
                {notifications.length === 0 ? (
                  <EmptyState title="No notifications yet." />
                ) : (
                  notifications.slice(0, 10).map((n) => (
                    <div
                      key={n._id}
                      className="rounded-[var(--radius-lg)] bg-[var(--surface-page)] p-4 border border-[var(--surface-border)]"
                    >
                      <p className="font-black text-sm text-[var(--text-main)]">{n.title}</p>
                      <p className="mt-1 text-xs font-medium text-[var(--text-secondary)] leading-relaxed">{n.message}</p>
                      <div className="mt-2 flex items-center gap-2 text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest">
                        <span>📅</span>
                        <span>{new Date(n.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </DashboardCard>
          </div>

          {announcements.length > 0 && (
            <div className="rounded-[var(--radius-3xl)] border border-[var(--tlh-cyan)]/20 bg-[var(--tlh-cyan)]/5 p-8 space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[var(--tlh-cyan)]/20 text-xl">
                    📢
                  </div>
                  <div>
                    <h3 className="font-black text-[var(--text-main)] text-lg tracking-tight">
                      Announcements & Updates
                    </h3>
                    <p className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">Stay informed with platform news</p>
                  </div>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                {announcements.slice(0, 4).map((ann) => (
                  <div
                    key={ann._id}
                    className="group rounded-[var(--radius-2xl)] bg-[var(--surface-card)] p-6 shadow-[var(--shadow-sm)] border border-[var(--surface-border)] transition-all hover:shadow-[var(--shadow-md)] hover:border-[var(--tlh-cyan)]/30"
                  >
                    <div className="flex items-center justify-between gap-4 mb-3">
                      <h4 className="font-black text-[var(--text-main)] text-sm group-hover:text-[var(--tlh-cyan)] transition-colors">
                        {ann.title}
                      </h4>
                      <Badge
                        variant={
                          ann.priority === "urgent"
                            ? "rose"
                            : ann.priority === "high"
                              ? "amber"
                              : "blue"
                        }
                      >
                        {ann.priority}
                      </Badge>
                    </div>
                    <p className="text-xs font-medium text-[var(--text-secondary)] leading-relaxed mb-4">
                      {ann.content}
                    </p>
                    <div className="flex items-center justify-between pt-4 border-t border-[var(--surface-border)]">
                      <div className="flex items-center gap-2">
                        <div className="h-6 w-6 rounded-full bg-slate-100 flex items-center justify-center text-[10px]">👤</div>
                        <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase">
                          {ann.author?.fullName || "Academy"}
                        </span>
                      </div>
                      <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-tighter">
                        {new Date(ann.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : null}

      {/* 2. CLASSES / COHORTS */}
      {activeTab === "classes" ? (
        <div className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {classes.map((cls) => (
              <div
                key={cls._id}
                className="group relative overflow-hidden rounded-[var(--radius-3xl)] bg-[var(--surface-card)] p-8 shadow-[var(--shadow-sm)] border border-[var(--surface-border)] transition-all hover:shadow-[var(--shadow-lg)] hover:border-[var(--tlh-blue-primary)]/30"
              >
                <div className="flex items-center justify-between mb-6">
                  <div className="h-12 w-12 rounded-2xl bg-[var(--tlh-blue-primary)]/10 flex items-center justify-center text-2xl">
                    🏫
                  </div>
                  <Badge variant={cls.status === "active" ? "emerald" : "amber"}>
                    {cls.status.toUpperCase()}
                  </Badge>
                </div>

                <div className="space-y-4">
                  <div>
                    <h4 className="text-xl font-black text-[var(--text-main)] tracking-tight">
                      {cls.title}
                    </h4>
                    <p className="text-xs font-bold text-[var(--tlh-blue-primary)] uppercase tracking-widest mt-1">
                      {cls.course?.title || "Educational Program"}
                    </p>
                  </div>

                  <div className="pt-4 border-t border-[var(--surface-border)]">
                    <div className="flex items-center justify-between mb-3">
                      <h5 className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest">
                        Enrolled Learners ({cls.students?.length || 0})
                      </h5>
                    </div>
                    <div className="space-y-2 max-h-40 overflow-y-auto pr-2 custom-scrollbar">
                      {cls.students?.length > 0 ? (
                        cls.students.map((s) => (
                          <div
                            key={s._id}
                            className="rounded-xl bg-[var(--surface-page)] p-3 text-xs border border-[var(--surface-border)] flex items-center justify-between group/student hover:border-[var(--tlh-blue-primary)]/20 transition-colors"
                          >
                            <span className="font-bold text-[var(--text-main)]">
                              {s.fullName}
                            </span>
                            <span className="text-[10px] text-[var(--text-muted)] font-medium opacity-0 group-hover/student:opacity-100 transition-opacity uppercase tracking-tighter">
                              View Profile
                            </span>
                          </div>
                        ))
                      ) : (
                        <p className="text-[10px] text-[var(--text-muted)] italic">No students assigned yet.</p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="mt-8">
                  <Link
                    to={`/workspace/${cls._id}`}
                    className="flex items-center justify-center gap-2 w-full rounded-2xl bg-[var(--surface-page)] py-4 text-xs font-black text-[var(--tlh-blue-primary)] border border-[var(--tlh-blue-primary)]/20 transition-all hover:bg-[var(--tlh-blue-primary)] hover:text-white hover:shadow-[0_8px_20px_-6px_rgba(18,102,232,0.4)]"
                  >
                    Enter Workspace
                    <span className="text-lg">→</span>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {/* 3. SCHEDULE */}
      {activeTab === "schedule" ? (
        <div className="space-y-6">
          <DashboardCard
            title="Live session schedule"
            subtitle="Manage your upcoming virtual classrooms and meeting links."
          >
            <SessionSchedule sessions={upcomingLessons} />
          </DashboardCard>
        </div>
      ) : null}

      {/* 4. ATTENDANCE TRACKER */}
      {activeTab === "attendance" ? (
        <div className="space-y-8">
          <DashboardCard
            title="Session Attendance"
            subtitle="Mark learners as present, absent, late, or excused for the current session."
          >
            <div className="space-y-8">
              <div className="max-w-md">
                <label className="block text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest mb-2">
                  Select Active Session
                </label>
                <div className="relative">
                  <select
                    value={selectedSessionId}
                    onChange={(e) => setSelectedSessionId(e.target.value)}
                    className="w-full appearance-none rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-page)] p-4 text-sm font-bold text-[var(--text-main)] outline-none focus:ring-2 focus:ring-[var(--tlh-blue-primary)]/20 transition-all"
                  >
                    {upcomingLessons.map((s) => (
                      <option key={s._id} value={s._id}>
                        {s.title} ({formatSessionTime(s.startsAt)})
                      </option>
                    ))}
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-[var(--text-muted)]">
                    ▼
                  </div>
                </div>
              </div>

              {currentClassForAttendance ? (
                <div className="overflow-hidden rounded-3xl border border-[var(--surface-border)] bg-[var(--surface-card)] shadow-sm">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="bg-[var(--surface-page)] border-b border-[var(--surface-border)]">
                          <th className="px-6 py-4 text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest">Learner</th>
                          <th className="px-6 py-4 text-center text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--surface-border)]">
                        {currentClassForAttendance.students.map((stud) => {
                          const currentStatus = attendanceRecords[stud._id]?.status || "present";
                          return (
                            <tr key={stud._id} className="hover:bg-slate-50/50 transition-colors">
                              <td className="px-6 py-4">
                                <div>
                                  <p className="font-black text-sm text-[var(--text-main)]">{stud.fullName}</p>
                                  <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-tighter">{stud.email}</p>
                                </div>
                              </td>
                              <td className="px-6 py-4">
                                <div className="flex justify-center gap-1">
                                  {["present", "absent", "late", "excused"].map((st) => (
                                    <button
                                      key={st}
                                      type="button"
                                      onClick={() => setStudentAttendance(stud._id, st)}
                                      className={`rounded-xl px-4 py-2 text-[10px] font-black uppercase tracking-widest transition-all ${currentStatus === st
                                        ? st === "present"
                                          ? "bg-[var(--tlh-blue-primary)] text-white shadow-lg shadow-blue-500/25"
                                          : st === "absent"
                                            ? "bg-rose-600 text-white shadow-lg shadow-rose-500/25"
                                            : st === "late"
                                              ? "bg-amber-500 text-white shadow-lg shadow-amber-500/25"
                                              : "bg-[var(--tlh-cyan)] text-white shadow-lg shadow-cyan-500/25"
                                        : "bg-[var(--surface-page)] text-[var(--text-secondary)] border border-[var(--surface-border)] hover:bg-white"
                                        }`}
                                    >
                                      {t(st)}
                                    </button>
                                  ))}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <EmptyState title="No learners are assigned to this cohort yet." />
              )}

              <div className="flex justify-end pt-4">
                <button
                  onClick={saveAttendance}
                  className="rounded-2xl bg-[var(--tlh-navy)] px-8 py-4 text-xs font-black text-white shadow-xl hover:bg-[#0a1636] transition-all hover:-translate-y-0.5 active:scale-95"
                >
                  {t("markAttendance")}
                </button>
              </div>
            </div>
          </DashboardCard>

          <DashboardCard
            title="Cohort Attendance Register"
            subtitle="Analyze cumulative attendance patterns and engagement metrics for each cohort."
          >
            <div className="space-y-6">
              <div className="max-w-md">
                <label className="block text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest mb-2">
                  Select Cohort
                </label>
                <div className="relative">
                  <select
                    value={registerClassroomId}
                    onChange={(e) => void loadCohortRegister(e.target.value)}
                    className="w-full appearance-none rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-page)] p-4 text-sm font-bold text-[var(--text-main)] outline-none focus:ring-2 focus:ring-[var(--tlh-blue-primary)]/20 transition-all"
                  >
                    <option value="">Choose a cohort...</option>
                    {classes.map((classroom) => (
                      <option key={classroom._id} value={classroom._id}>
                        {classroom.title}
                      </option>
                    ))}
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-[var(--text-muted)]">
                    ▼
                  </div>
                </div>
              </div>

              {registerLoading ? (
                <div className="py-12 text-center">
                  <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-[var(--tlh-blue-primary)] border-r-transparent"></div>
                  <p className="mt-4 text-xs font-bold text-[var(--text-muted)] uppercase tracking-widest">Synchronizing records...</p>
                </div>
              ) : cohortRegister ? (
                <div className="space-y-6">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="rounded-2xl bg-[var(--tlh-blue-primary)]/5 p-4 border border-[var(--tlh-blue-primary)]/10">
                      <p className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest">Sessions Held</p>
                      <p className="text-2xl font-black text-[var(--tlh-blue-primary)]">{cohortRegister.summary?.sessions ?? 0}</p>
                    </div>
                    <div className="rounded-2xl bg-emerald-500/5 p-4 border border-emerald-500/10">
                      <p className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest">Attendance Rate</p>
                      <p className="text-2xl font-black text-emerald-600">{cohortRegister.summary?.attendanceRate ?? 0}%</p>
                    </div>
                  </div>

                  <div className="overflow-hidden rounded-3xl border border-[var(--surface-border)] bg-[var(--surface-card)]">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left">
                        <thead>
                          <tr className="bg-[var(--surface-page)] border-b border-[var(--surface-border)]">
                            <th className="px-6 py-4 text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest">Learner</th>
                            <th className="px-4 py-4 text-center text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest">Present</th>
                            <th className="px-4 py-4 text-center text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest">Late</th>
                            <th className="px-4 py-4 text-center text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest">Absent</th>
                            <th className="px-4 py-4 text-center text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest">Excused</th>
                            <th className="px-6 py-4 text-right text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest">Rate</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--surface-border)]">
                          {cohortRegister.students?.map((row) => (
                            <tr key={row._id} className="hover:bg-slate-50/50 transition-colors">
                              <td className="px-6 py-4">
                                <span className="font-black text-sm text-[var(--text-main)]">{row.fullName || row.name}</span>
                              </td>
                              <td className="px-4 py-4 text-center">
                                <span className="text-sm font-bold text-emerald-600">{row.present}</span>
                              </td>
                              <td className="px-4 py-4 text-center">
                                <span className="text-sm font-bold text-amber-600">{row.late}</span>
                              </td>
                              <td className="px-4 py-4 text-center">
                                <span className="text-sm font-bold text-rose-600">{row.absent}</span>
                              </td>
                              <td className="px-4 py-4 text-center">
                                <span className="text-sm font-bold text-[var(--text-secondary)]">{row.excused}</span>
                              </td>
                              <td className="px-6 py-4 text-right">
                                <div className="inline-flex items-center gap-2">
                                  <div className="h-2 w-16 rounded-full bg-slate-100 overflow-hidden">
                                    <div
                                      className={`h-full rounded-full ${Number(row.attendanceRate) > 75 ? 'bg-emerald-500' : Number(row.attendanceRate) > 50 ? 'bg-amber-500' : 'bg-rose-500'}`}
                                      style={{ width: `${row.attendanceRate}%` }}
                                    />
                                  </div>
                                  <span className="text-sm font-black text-[var(--text-main)] w-10">{row.attendanceRate}%</span>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="py-12 text-center border-2 border-dashed border-[var(--surface-border)] rounded-[var(--radius-3xl)]">
                  <p className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-widest">Please select a cohort to generate reports</p>
                </div>
              )}
            </div>
          </DashboardCard>
        </div>
      ) : null}

      {/* 5. ASSIGNMENTS */}
      {activeTab === "assignments" ? (
        <div className="space-y-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h3 className="text-2xl font-black text-[var(--text-main)] tracking-tight">Assignment Management</h3>
              <p className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-widest mt-1">Review and grade learner submissions</p>
            </div>
            <button
              onClick={() => setCreateAssignModal(true)}
              className="flex items-center gap-2 rounded-2xl bg-[var(--tlh-blue-primary)] px-6 py-3.5 text-sm font-black text-white shadow-[0_8px_20px_-6px_rgba(18,102,232,0.4)] transition-all hover:-translate-y-1 active:scale-95"
            >
              <span>+</span>
              {t("createAssignment")}
            </button>
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {assignments.map((asgn) => (
              <div
                key={asgn._id}
                className="group flex flex-col rounded-[var(--radius-3xl)] bg-[var(--surface-card)] p-8 shadow-[var(--shadow-sm)] border border-[var(--surface-border)] transition-all hover:shadow-[var(--shadow-lg)] hover:border-[var(--tlh-blue-primary)]/30"
              >
                <div className="flex items-center justify-between mb-4">
                  <Badge variant="blue">{asgn.maxScore} POINTS</Badge>
                  <div className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-tighter">
                    Due: {new Date(asgn.dueDate).toLocaleDateString()}
                  </div>
                </div>

                <h4 className="text-xl font-black text-[var(--text-main)] group-hover:text-[var(--tlh-blue-primary)] transition-colors line-clamp-1 mb-2">
                  {asgn.title}
                </h4>
                <p className="text-xs font-medium text-[var(--text-secondary)] line-clamp-2 mb-6 leading-relaxed">
                  {asgn.instructions}
                </p>

                <div className="mt-auto space-y-6">
                  <div className="grid grid-cols-2 gap-4 pt-6 border-t border-[var(--surface-border)]">
                    <div className="text-center">
                      <p className="text-lg font-black text-[var(--text-main)]">{asgn.submissionCount || 0}</p>
                      <p className="text-[9px] font-black text-[var(--text-muted)] uppercase tracking-widest">Submitted</p>
                    </div>
                    <div className="text-center">
                      <p className="text-lg font-black text-emerald-600">{asgn.gradedCount || 0}</p>
                      <p className="text-[9px] font-black text-[var(--text-muted)] uppercase tracking-widest">Graded</p>
                    </div>
                  </div>

                  <button
                    onClick={() => openSubmissions(asgn)}
                    className="flex items-center justify-center gap-2 w-full rounded-2xl bg-[var(--surface-page)] py-4 text-xs font-black text-[var(--text-main)] border border-[var(--surface-border)] transition-all hover:bg-[var(--tlh-blue-primary)] hover:text-white hover:border-[var(--tlh-blue-primary)]"
                  >
                    Manage Submissions
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {/* 6. ASSESSMENTS / QUIZZES */}
      {activeTab === "assessments" ? (
        <div className="space-y-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h3 className="text-2xl font-black text-[var(--text-main)] tracking-tight">Assessments & Exams</h3>
              <p className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-widest mt-1">Create and review automated or manual exams</p>
            </div>
            <button
              onClick={() => setCreateQuizModal(true)}
              className="flex items-center gap-2 rounded-2xl bg-[var(--tlh-cyan)] px-6 py-3.5 text-sm font-black text-white shadow-[0_8px_20px_-6px_rgba(18,188,235,0.4)] transition-all hover:-translate-y-1 active:scale-95"
            >
              <span>+</span>
              {t("createAssessment")}
            </button>
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {assessments.map((qz) => (
              <div
                key={qz._id}
                className="group flex flex-col rounded-[var(--radius-3xl)] bg-[var(--surface-card)] p-8 shadow-[var(--shadow-sm)] border border-[var(--surface-border)] transition-all hover:shadow-[var(--shadow-lg)] hover:border-[var(--tlh-cyan)]/30"
              >
                <div className="flex items-center justify-between mb-4">
                  <Badge variant="cyan">
                    {ASSESSMENT_TYPE_LABELS[qz.assessmentType] || "Quiz"}
                  </Badge>
                  <div className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-tighter">
                    {qz.questions?.length || 0} Questions
                  </div>
                </div>

                <h4 className="text-xl font-black text-[var(--text-main)] group-hover:text-[var(--tlh-cyan)] transition-colors line-clamp-1 mb-2">
                  {qz.title}
                </h4>
                <p className="text-xs font-medium text-[var(--text-secondary)] line-clamp-2 mb-6 leading-relaxed">
                  {qz.description}
                </p>

                <div className="mt-auto space-y-6">
                  <div className="flex items-center justify-between text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest border-t border-[var(--surface-border)] pt-6">
                    <span>Pass: {qz.passingScorePercentage}%</span>
                    <span className="text-[var(--tlh-cyan)]">
                      {qz.attemptCount || 0} Attempts · {qz.reviewedCount || 0} Reviewed
                    </span>
                  </div>

                  <button
                    onClick={() => openAttempts(qz)}
                    className="flex items-center justify-center gap-2 w-full rounded-2xl bg-[var(--tlh-cyan)]/5 py-4 text-xs font-black text-[var(--tlh-cyan)] border border-[var(--tlh-cyan)]/20 transition-all hover:bg-[var(--tlh-cyan)] hover:text-white"
                  >
                    Review Attempts
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {/* 7. PROGRESS & RESULTS */}
      {activeTab === "progress" ? (
        <div className="space-y-8">
          <DashboardCard
            title="Comprehensive Grading & Progress Publishing"
            subtitle="Centralized interface for finalizing student grades and publishing performance reports."
          >
            <div className="max-w-md">
              <label className="block text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest mb-2">
                Select Target Cohort
              </label>
              <div className="relative">
                <select
                  value={progressClassroomId}
                  onChange={(event) => void openProgressReports(event.target.value)}
                  className="w-full appearance-none rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-page)] p-4 text-sm font-bold text-[var(--text-main)] outline-none focus:ring-2 focus:ring-[var(--tlh-blue-primary)]/20 transition-all"
                >
                  <option value="">Choose a cohort...</option>
                  {classes.map((classroom) => (
                    <option key={classroom._id} value={classroom._id}>
                      {classroom.title}
                    </option>
                  ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-[var(--text-muted)]">
                  ▼
                </div>
              </div>
            </div>

            {progressLoading && (
              <div className="py-12 text-center">
                <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-[var(--tlh-blue-primary)] border-r-transparent"></div>
                <p className="mt-4 text-xs font-bold text-[var(--text-muted)] uppercase tracking-widest">Compiling progress data...</p>
              </div>
            )}
          </DashboardCard>

          {progressClassroomId && !progressLoading ? (
            <div className="grid gap-8 lg:grid-cols-12">
              {/* Learner Roster Sidebar */}
              <div className="lg:col-span-4 space-y-4">
                <DashboardCard title="Learner Roster">
                  <div className="space-y-2 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
                    {progressRoster.map((student) => {
                      const isSelected = progressForm.studentId === student._id;
                      const hasReport = progressReports.some(r => String(r.student?._id ?? r.student) === student._id);
                      return (
                        <button
                          key={student._id}
                          onClick={() => handleProgressStudentChange(student._id)}
                          className={`w-full text-left rounded-2xl p-4 transition-all border ${isSelected
                            ? "bg-[var(--tlh-blue-primary)] border-[var(--tlh-blue-primary)] text-white shadow-lg"
                            : "bg-[var(--surface-page)] border-[var(--surface-border)] text-[var(--text-main)] hover:border-[var(--tlh-blue-primary)]/30"
                            }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-black text-sm">{student.fullName}</span>
                            {hasReport && (
                              <Badge variant={isSelected ? "white" : "emerald"}>GRADED</Badge>
                            )}
                          </div>
                          <p className={`text-[10px] mt-1 font-bold uppercase tracking-tighter ${isSelected ? "text-white/70" : "text-[var(--text-muted)]"}`}>
                            {student.email}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                </DashboardCard>
              </div>

              {/* Grading Form */}
              <div className="lg:col-span-8">
                <DashboardCard title="Grading & Feedback Form">
                  {progressForm.studentId ? (
                    <div className="space-y-8">
                      <div className="grid gap-6 sm:grid-cols-2">
                        <div className="space-y-2">
                          <label className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest">Reporting Period</label>
                          <input
                            required
                            maxLength={80}
                            value={progressForm.period}
                            onChange={(event) => setProgressForm(f => ({ ...f, period: event.target.value }))}
                            className="w-full rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-page)] p-4 text-sm font-bold text-[var(--text-main)] outline-none focus:ring-2 focus:ring-[var(--tlh-blue-primary)]/20"
                            placeholder="e.g. Final Term 2026"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest">Calculated Overall (%)</label>
                          <div className="w-full rounded-2xl bg-[var(--tlh-navy)] p-4 text-sm font-black text-[var(--tlh-gold)] flex items-center justify-between shadow-inner">
                            <span>TOTAL SCORE</span>
                            <span>{hasProgressComponents ? progressOverallTotal : "0"}%</span>
                          </div>
                        </div>
                      </div>

                      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {PROGRESS_COMPONENTS.map(({ category, label }) => (
                          <div key={category} className="space-y-2">
                            <label className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest">{label} (%)</label>
                            <input
                              type="number"
                              min="0"
                              max="100"
                              step="0.1"
                              value={progressForm[category]}
                              onChange={(event) => setProgressForm(f => ({ ...f, [category]: event.target.value }))}
                              className="w-full rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-page)] p-4 text-sm font-bold text-[var(--text-main)] outline-none focus:ring-2 focus:ring-[var(--tlh-blue-primary)]/20"
                              placeholder="0.0"
                            />
                          </div>
                        ))}
                      </div>

                      <div className="space-y-6">
                        <div className="space-y-2">
                          <label className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest">Internal Self-Assessment</label>
                          <textarea
                            rows={3}
                            value={progressForm.selfAssessment}
                            onChange={(event) => setProgressForm(f => ({ ...f, selfAssessment: event.target.value }))}
                            className="w-full rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-page)] p-4 text-sm font-bold text-[var(--text-main)] outline-none focus:ring-2 focus:ring-[var(--tlh-blue-primary)]/20"
                            placeholder="Learner's performance analysis for records..."
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest">Feedback for Learner</label>
                          <textarea
                            rows={3}
                            value={progressForm.feedback}
                            onChange={(event) => setProgressForm(f => ({ ...f, feedback: event.target.value }))}
                            className="w-full rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-page)] p-4 text-sm font-bold text-[var(--text-main)] outline-none focus:ring-2 focus:ring-[var(--tlh-blue-primary)]/20"
                            placeholder="Direct encouragement and guidance for the student..."
                          />
                        </div>
                      </div>

                      <div className="flex flex-wrap justify-end gap-3 pt-6 border-t border-[var(--surface-border)]">
                        <button
                          type="button"
                          disabled={progressSaving || !progressForm.period.trim()}
                          onClick={() => void saveProgressReport("draft")}
                          className="rounded-2xl border border-[var(--surface-border)] px-8 py-4 text-xs font-black text-[var(--text-secondary)] hover:bg-[var(--surface-page)] transition-all"
                        >
                          {progressSaving ? "Saving..." : "Save Draft"}
                        </button>
                        <button
                          type="button"
                          disabled={progressSaving || !progressForm.period.trim() || !hasProgressComponents || !progressForm.selfAssessment.trim()}
                          onClick={() => void saveProgressReport("published")}
                          className="rounded-2xl bg-[var(--tlh-blue-primary)] px-8 py-4 text-xs font-black text-white shadow-xl hover:shadow-blue-500/30 transition-all hover:-translate-y-0.5"
                        >
                          {progressSaving ? "Publishing..." : "Publish to Learner"}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="py-24 text-center">
                      <p className="text-xs font-black text-[var(--text-muted)] uppercase tracking-[0.2em]">Select a learner from the roster to start grading</p>
                    </div>
                  )}
                </DashboardCard>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {/* 7. RESOURCES */}
      {activeTab === "resources" ? (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h3 className="text-xl font-bold text-slate-900">
              Learning resources
            </h3>
            <button
              onClick={() => setUploadModal(true)}
              className="golden-btn rounded-xl px-3.5 py-1.5 text-xs font-bold text-white shadow-sm"
            >
              + {t("uploadResource")}
            </button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {resources.map((res) => (
              <div
                key={res._id}
                className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 flex flex-col justify-between"
              >
                <div>
                  <Badge variant="indigo">{res.category}</Badge>
                  <h4 className="font-bold text-slate-900 mt-2">{res.title}</h4>
                  <p className="text-xs text-slate-500 mt-1">
                    {res.description}
                  </p>
                </div>
                <div className="mt-4 pt-3 border-t border-slate-100 flex justify-between items-center text-xs">
                  <span className="text-slate-400">
                    {(res.fileSize / 1024).toFixed(1)} KB
                  </span>
                  <a
                    href={`${API_BASE_URL}/api/resources/${res._id}/download`}
                    className="font-bold text-blue-600 hover:underline"
                  >
                    {t("download")} ↓
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {/* 8. ACCOUNT SECURITY */}
      {activeTab === "security" ? (
        <div className="space-y-6 max-w-xl">
          <DashboardCard title="Account Password & Security">
            <form onSubmit={handleChangePassword} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                  Current Password
                </label>
                <input
                  required
                  type="password"
                  value={securityForm.currentPassword}
                  onChange={(e) =>
                    setSecurityForm({
                      ...securityForm,
                      currentPassword: e.target.value,
                    })
                  }
                  className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 text-xs outline-none"
                  placeholder="Enter current password"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                  New Password (min. 8 characters)
                </label>
                <input
                  required
                  minLength={8}
                  maxLength={128}
                  type="password"
                  value={securityForm.newPassword}
                  onChange={(e) =>
                    setSecurityForm({
                      ...securityForm,
                      newPassword: e.target.value,
                    })
                  }
                  className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 text-xs outline-none"
                  placeholder="At least 8 characters"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                  Confirm New Password
                </label>
                <input
                  required
                  minLength={8}
                  maxLength={128}
                  type="password"
                  value={securityForm.confirmPassword}
                  onChange={(e) =>
                    setSecurityForm({
                      ...securityForm,
                      confirmPassword: e.target.value,
                    })
                  }
                  className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 text-xs outline-none"
                  placeholder="Repeat new password"
                />
              </div>
              <button
                type="submit"
                disabled={securityLoading}
                className="w-full rounded-xl bg-slate-900 py-3 text-xs font-bold text-white hover:bg-slate-800 disabled:opacity-50"
              >
                {securityLoading ? "Updating…" : "Update Password"}
              </button>
            </form>
          </DashboardCard>
        </div>
      ) : null}

      {/* MODAL: View Submissions & Grade */}
      <Modal
        title={`Learner submissions: ${submissionsModal.assignment?.title || ""}`}
        isOpen={submissionsModal.open}
        onClose={() =>
          setSubmissionsModal({ open: false, assignment: null, list: [] })
        }
      >
        <div className="space-y-4 max-h-[70vh] overflow-y-auto">
          {submissionsModal.list.length === 0 ? (
            <EmptyState title="No submissions yet." />
          ) : (
            submissionsModal.list.map((sub) => (
              <div
                key={sub._id}
                className="rounded-xl border border-slate-200 p-4 space-y-2"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900">
                    {sub.student?.fullName}
                  </span>
                  <Badge
                    variant={sub.status === "graded" ? "emerald" : "amber"}
                  >
                    {sub.status === "graded"
                      ? `${sub.score} pts`
                      : "Awaiting review"}
                  </Badge>
                </div>
                <p className="text-xs text-slate-700 bg-slate-50 p-2 rounded-lg whitespace-pre-wrap">
                  {sub.textResponse || "No written response."}
                </p>

                {sub.submissionLinks?.length ? (
                  <div className="flex flex-wrap gap-2">
                    {sub.submissionLinks.map((link, index) => (
                      <a
                        key={index}
                        href={link.url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 rounded-lg bg-blue-50 px-2 py-1 text-[11px] font-semibold text-blue-700 hover:bg-blue-100"
                      >
                        🔗 {link.label || link.url}
                      </a>
                    ))}
                  </div>
                ) : null}

                {sub.attachments?.length ? (
                  <div className="flex flex-wrap gap-2">
                    {sub.attachments.map((file, index) => (
                      <button
                        key={file.key || index}
                        type="button"
                        disabled={fileBusy}
                        onClick={() =>
                          openSubmissionFile(
                            `/api/teacher/submissions/${sub._id}/files/${index}`,
                            file,
                          )
                        }
                        className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-200 disabled:opacity-60"
                      >
                        📎 {file.filename}
                      </button>
                    ))}
                  </div>
                ) : null}

                {sub.feedback ? (
                  <p className="text-xs text-blue-700">
                    Feedback: {sub.feedback}
                  </p>
                ) : null}

                {/* Inline Grading Form */}
                <div className="pt-2 border-t border-slate-100 flex gap-2">
                  <input
                    type="number"
                    max={submissionsModal.assignment?.maxScore || 100}
                    placeholder="Score"
                    value={gradingDrafts[sub._id]?.score ?? ""}
                    className="w-20 rounded-lg border border-slate-200 p-1 text-xs"
                    onChange={(e) =>
                      updateGradingDraft(sub._id, {
                        score: Number(e.target.value),
                      })
                    }
                  />
                  <input
                    type="text"
                    placeholder="Feedback"
                    value={gradingDrafts[sub._id]?.feedback ?? ""}
                    className="flex-1 rounded-lg border border-slate-200 p-1 text-xs"
                    onChange={(e) =>
                      updateGradingDraft(sub._id, { feedback: e.target.value })
                    }
                  />
                  <button
                    onClick={() => handleGradeSubmission(sub)}
                    className="golden-btn rounded-lg px-3.5 py-1.5 text-xs font-bold text-white shadow-xs"
                  >
                    {sub.status === "graded"
                      ? "Update & publish"
                      : "Publish result"}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </Modal>

      {/* MODAL: Review assessment attempts */}
      <Modal
        title={`Assessment submissions: ${attemptsModal.assessment?.title || ""}`}
        isOpen={attemptsModal.open}
        onClose={() =>
          setAttemptsModal({ open: false, assessment: null, list: [] })
        }
      >
        <div className="space-y-4 max-h-[70vh] overflow-y-auto">
          {attemptsModal.list.length === 0 ? (
            <EmptyState title="No submissions yet." />
          ) : (
            attemptsModal.list.map((attempt) => (
              <div
                key={attempt._id}
                className="rounded-xl border border-slate-200 p-4 space-y-2"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900">
                    {attempt.student?.fullName || attempt.student?.name}
                  </span>
                  <Badge
                    variant={
                      attempt.status === "reviewed" ? "emerald" : "amber"
                    }
                  >
                    {attempt.status === "reviewed"
                      ? `${attempt.score}/${attempt.maxScore}`
                      : "Awaiting review"}
                  </Badge>
                </div>

                {attempt.responseText ? (
                  <p className="text-xs text-slate-700 bg-slate-50 p-2 rounded-lg whitespace-pre-wrap">
                    {attempt.responseText}
                  </p>
                ) : null}

                {attempt.submissionLinks?.length ? (
                  <div className="flex flex-wrap gap-2">
                    {attempt.submissionLinks.map((link, index) => (
                      <a
                        key={index}
                        href={link.url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 rounded-lg bg-blue-50 px-2 py-1 text-[11px] font-semibold text-blue-700 hover:bg-blue-100"
                      >
                        🔗 {link.label || link.url}
                      </a>
                    ))}
                  </div>
                ) : null}

                {attempt.attachments?.length ? (
                  <div className="flex flex-wrap gap-2">
                    {attempt.attachments.map((file, index) => (
                      <button
                        key={file.key || index}
                        type="button"
                        disabled={fileBusy}
                        onClick={() =>
                          openSubmissionFile(
                            `/api/teacher/attempts/${attempt._id}/files/${index}`,
                            file,
                          )
                        }
                        className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-200 disabled:opacity-60"
                      >
                        📎 {file.filename}
                      </button>
                    ))}
                  </div>
                ) : null}

                {attempt.feedback ? (
                  <p className="text-xs text-blue-700">
                    Feedback: {attempt.feedback}
                  </p>
                ) : null}

                {/* Inline review form */}
                <div className="pt-2 border-t border-slate-100 space-y-2">
                  <div className="flex gap-2">
                    <input
                      type="number"
                      min="0"
                      max={
                        attempt.maxScore ||
                        attemptsModal.assessment?.questions?.reduce(
                          (total, q) => total + (q.points || 1),
                          0,
                        ) ||
                        100
                      }
                      placeholder="Score"
                      value={reviewDrafts[attempt._id]?.score ?? ""}
                      className="w-20 rounded-lg border border-slate-200 p-1 text-xs"
                      onChange={(e) =>
                        updateReviewDraft(attempt._id, {
                          score: e.target.value,
                        })
                      }
                    />
                    <select
                      value={
                        reviewDrafts[attempt._id]?.passed === false
                          ? "false"
                          : "true"
                      }
                      onChange={(e) =>
                        updateReviewDraft(attempt._id, {
                          passed: e.target.value === "true",
                        })
                      }
                      className="rounded-lg border border-slate-200 p-1 text-xs bg-white"
                    >
                      <option value="true">Passed</option>
                      <option value="false">Not passed</option>
                    </select>
                    <button
                      onClick={() => handleReviewAttempt(attempt)}
                      className="rounded-lg bg-cyan-600 px-3 py-1 text-xs font-bold text-white hover:bg-cyan-700"
                    >
                      Release result
                    </button>
                  </div>
                  <input
                    type="text"
                    placeholder="Feedback for the student"
                    value={reviewDrafts[attempt._id]?.feedback ?? ""}
                    className="w-full rounded-lg border border-slate-200 p-1 text-xs"
                    onChange={(e) =>
                      updateReviewDraft(attempt._id, {
                        feedback: e.target.value,
                      })
                    }
                  />
                </div>
              </div>
            ))
          )}
        </div>
      </Modal>

      {/* MODAL: Authenticated file preview */}
      <Modal
        title={filePreview.title || "Submission file"}
        isOpen={filePreview.open}
        onClose={closeFilePreview}
      >
        {filePreview.mimeType?.startsWith("image/") ? (
          <img
            src={filePreview.url}
            alt={filePreview.title}
            className="mx-auto max-h-[70vh] rounded-xl"
          />
        ) : filePreview.mimeType?.startsWith("video/") ? (
          <video
            src={filePreview.url}
            controls
            className="mx-auto max-h-[70vh] w-full rounded-xl"
          />
        ) : filePreview.mimeType?.startsWith("audio/") ? (
          <audio src={filePreview.url} controls className="mx-auto w-full" />
        ) : (
          <iframe
            src={filePreview.url}
            title={filePreview.title}
            className="h-[70vh] w-full rounded-xl border border-slate-200"
          />
        )}
        <a
          href={filePreview.url}
          download={filePreview.title}
          className="mt-3 block rounded-xl bg-slate-900 py-2 text-center text-xs font-bold text-white hover:bg-slate-800"
        >
          Download
        </a>
      </Modal>

      {activeTab === "profile" ? (
        <div className="mx-auto max-w-2xl">
          <DashboardCard
            title="Professional profile"
            subtitle="Keep your contact details, qualifications, teaching subjects, and availability up to date."
          >
            <form onSubmit={handleSaveProfile} className="space-y-4">
              <ProfilePhotoField
                value={profileForm.avatarUrl}
                onChange={(avatarUrl) =>
                  setProfileForm({ ...profileForm, avatarUrl })
                }
              />
              <label className="block text-xs font-bold text-slate-700">
                Full name
                <input
                  required
                  minLength={2}
                  maxLength={100}
                  value={profileForm.fullName}
                  onChange={(event) =>
                    setProfileForm({
                      ...profileForm,
                      fullName: event.target.value,
                    })
                  }
                  className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 text-sm"
                />
              </label>
              <label className="block text-xs font-bold text-slate-700">
                Phone number
                <input
                  type="tel"
                  maxLength={30}
                  value={profileForm.phone}
                  onChange={(event) =>
                    setProfileForm({
                      ...profileForm,
                      phone: event.target.value,
                    })
                  }
                  className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 text-sm"
                />
              </label>
              <label className="block text-xs font-bold text-slate-700">
                Professional introduction
                <textarea
                  rows={3}
                  maxLength={500}
                  value={profileForm.bio}
                  onChange={(event) =>
                    setProfileForm({ ...profileForm, bio: event.target.value })
                  }
                  className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 text-sm"
                />
              </label>
              <label className="block text-xs font-bold text-slate-700">
                Subjects / expertise (comma-separated)
                <input
                  value={profileForm.expertise}
                  onChange={(event) =>
                    setProfileForm({
                      ...profileForm,
                      expertise: event.target.value,
                    })
                  }
                  className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 text-sm"
                />
              </label>
              <label className="block text-xs font-bold text-slate-700">
                Qualifications
                <textarea
                  rows={3}
                  maxLength={1000}
                  value={profileForm.qualifications}
                  onChange={(event) =>
                    setProfileForm({
                      ...profileForm,
                      qualifications: event.target.value,
                    })
                  }
                  className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 text-sm"
                />
              </label>
              <label className="block text-xs font-bold text-slate-700">
                Years of experience
                <input
                  required
                  type="number"
                  min="0"
                  max="60"
                  value={profileForm.experienceYears}
                  onChange={(event) =>
                    setProfileForm({
                      ...profileForm,
                      experienceYears: event.target.value,
                    })
                  }
                  className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 text-sm"
                />
              </label>
              <label className="block text-xs font-bold text-slate-700">
                Availability
                <textarea
                  rows={2}
                  maxLength={500}
                  value={profileForm.availabilityNotes}
                  onChange={(event) =>
                    setProfileForm({
                      ...profileForm,
                      availabilityNotes: event.target.value,
                    })
                  }
                  className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 text-sm"
                  placeholder="Days, times, and time zone"
                />
              </label>
              <button
                type="submit"
                className="w-full rounded-xl bg-slate-900 py-2.5 text-xs font-bold text-white hover:bg-slate-800"
              >
                Save professional profile
              </button>
            </form>
          </DashboardCard>
        </div>
      ) : null}

      {activeTab === "settings" ? (
        <DashboardSettings
          user={user}
          sessions={upcomingLessons}
          onNavigateTab={(tab) => setActiveTab(tab)}
        />
      ) : null}

      {/* MODAL: Create Assignment */}
      <Modal
        title={t("createAssignment")}
        isOpen={createAssignModal}
        onClose={() => setCreateAssignModal(false)}
      >
        <form onSubmit={handleCreateAssignment} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700">
              {t("title")}
            </label>
            <input
              required
              type="text"
              value={assignForm.title}
              onChange={(e) =>
                setAssignForm({ ...assignForm, title: e.target.value })
              }
              className="mt-1 w-full rounded-xl border border-slate-200 p-2 text-sm outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700">
              Instructions
            </label>
            <textarea
              required
              rows={3}
              value={assignForm.instructions}
              onChange={(e) =>
                setAssignForm({ ...assignForm, instructions: e.target.value })
              }
              className="mt-1 w-full rounded-xl border border-slate-200 p-2 text-sm outline-none"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700">
                {t("dueDate")}
              </label>
              <input
                required
                type="date"
                value={assignForm.dueDate}
                onChange={(e) =>
                  setAssignForm({ ...assignForm, dueDate: e.target.value })
                }
                className="mt-1 w-full rounded-xl border border-slate-200 p-2 text-xs outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700">
                Maximum score
              </label>
              <input
                required
                type="number"
                value={assignForm.maxScore}
                onChange={(e) =>
                  setAssignForm({
                    ...assignForm,
                    maxScore: Number(e.target.value),
                  })
                }
                className="mt-1 w-full rounded-xl border border-slate-200 p-2 text-xs outline-none"
              />
            </div>
          </div>
          <button
            type="submit"
            className="golden-btn w-full rounded-xl py-2.5 text-xs font-bold text-white shadow-sm"
          >
            {t("createAssignment")}
          </button>
        </form>
      </Modal>

      {/* MODAL: Create Quiz */}
      <Modal
        title={t("createAssessment")}
        isOpen={createQuizModal}
        onClose={() => setCreateQuizModal(false)}
      >
        <form onSubmit={handleCreateQuiz} className="space-y-4">
          <label className="block text-xs font-bold text-slate-700">
            Cohort
            <select
              required
              value={quizForm.classroomId || classes[0]?._id || ""}
              onChange={(event) =>
                setQuizForm({ ...quizForm, classroomId: event.target.value })
              }
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-2.5 text-sm"
            >
              <option value="">Select a cohort</option>
              {classes.map((classroom) => (
                <option key={classroom._id} value={classroom._id}>
                  {classroom.title}
                </option>
              ))}
            </select>
          </label>
          <div>
            <label className="block text-xs font-bold text-slate-700">
              {t("title")}
            </label>
            <input
              required
              type="text"
              value={quizForm.title}
              onChange={(e) =>
                setQuizForm({ ...quizForm, title: e.target.value })
              }
              className="mt-1 w-full rounded-xl border border-slate-200 p-2 text-sm outline-none"
            />
          </div>
          <label className="block text-xs font-bold text-slate-700">
            Assessment type
            <select
              value={quizForm.assessmentType}
              onChange={(event) =>
                setQuizForm({ ...quizForm, assessmentType: event.target.value })
              }
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-2.5 text-sm"
            >
              {ASSESSMENT_TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs font-bold text-slate-700">
            Maximum marks
            <input
              type="number"
              min={1}
              max={1000}
              required
              value={quizForm.maxScore}
              onChange={(event) =>
                setQuizForm({ ...quizForm, maxScore: event.target.value })
              }
              className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 text-sm outline-none"
              placeholder="e.g. 100"
            />
            <span className="mt-1 block text-[11px] font-normal text-slate-500">
              The total marks this assessment is graded out of.
            </span>
          </label>
          <label className="block text-xs font-bold text-slate-700">
            Instructions
            <textarea
              required={
                quizForm.assessmentType === "selfAssessment" ||
                quizForm.questions.length === 0
              }
              minLength={
                quizForm.assessmentType === "selfAssessment" ||
                  quizForm.questions.length === 0
                  ? 5
                  : undefined
              }
              rows={3}
              value={quizForm.instructions}
              onChange={(event) =>
                setQuizForm({ ...quizForm, instructions: event.target.value })
              }
              className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 text-sm"
              placeholder="Explain how learners should complete the assessment."
            />
          </label>
          {quizForm.assessmentType === "selfAssessment" ||
            quizForm.questions.length === 0 ? (
            <div className="space-y-3">
              <p className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-xs leading-5 text-blue-900">
                Learners submit written work. You review it and release the
                result; answers are never scored automatically.
              </p>
              {quizForm.assessmentType !== "selfAssessment" && (
                <button
                  type="button"
                  onClick={() =>
                    setQuizForm((form) => ({
                      ...form,
                      questions: [emptyQuizQuestion()],
                    }))
                  }
                  className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
                >
                  + Add multiple-choice question
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {quizForm.questions.map((question, questionIndex) => (
                <div
                  key={questionIndex}
                  className="space-y-3 rounded-xl border border-slate-200 p-3"
                >
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold text-slate-700">
                      Question {questionIndex + 1}
                    </p>
                    <button
                      type="button"
                      onClick={() =>
                        setQuizForm((form) => ({
                          ...form,
                          questions: form.questions.filter(
                            (_, index) => index !== questionIndex,
                          ),
                        }))
                      }
                      className="text-xs font-bold text-rose-700"
                    >
                      Remove
                    </button>
                  </div>
                  <input
                    required
                    type="text"
                    value={question.prompt}
                    onChange={(event) =>
                      setQuizForm((form) => ({
                        ...form,
                        questions: form.questions.map((item, index) =>
                          index === questionIndex
                            ? { ...item, prompt: event.target.value }
                            : item,
                        ),
                      }))
                    }
                    className="w-full rounded-xl border border-slate-200 p-2 text-sm outline-none"
                    placeholder="Question prompt"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    {question.options.map((option, optionIndex) => (
                      <input
                        key={optionIndex}
                        required={optionIndex < 2}
                        type="text"
                        placeholder={`Option ${String.fromCharCode(65 + optionIndex)}`}
                        value={option}
                        onChange={(event) =>
                          setQuizForm((form) => ({
                            ...form,
                            questions: form.questions.map((item, index) =>
                              index === questionIndex
                                ? {
                                  ...item,
                                  options: item.options.map(
                                    (entry, entryIndex) =>
                                      entryIndex === optionIndex
                                        ? event.target.value
                                        : entry,
                                  ),
                                }
                                : item,
                            ),
                          }))
                        }
                        className="rounded-xl border border-slate-200 p-2 text-xs outline-none"
                      />
                    ))}
                  </div>
                  <label className="block text-xs font-bold text-slate-700">
                    Correct answer
                    <select
                      value={question.correctOptionIndex}
                      onChange={(event) =>
                        setQuizForm((form) => ({
                          ...form,
                          questions: form.questions.map((item, index) =>
                            index === questionIndex
                              ? {
                                ...item,
                                correctOptionIndex: Number(
                                  event.target.value,
                                ),
                              }
                              : item,
                          ),
                        }))
                      }
                      className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-2 text-xs"
                    >
                      {question.options.map((option, optionIndex) =>
                        option.trim() ? (
                          <option key={optionIndex} value={optionIndex}>
                            Option {String.fromCharCode(65 + optionIndex)}
                          </option>
                        ) : null,
                      )}
                    </select>
                  </label>
                </div>
              ))}
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setQuizForm((form) => ({
                      ...form,
                      questions: [...form.questions, emptyQuizQuestion()],
                    }))
                  }
                  className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
                >
                  + Add question
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setQuizForm((form) => ({ ...form, questions: [] }))
                  }
                  className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
                >
                  Use written response only
                </button>
              </div>
            </div>
          )}
          <button
            type="submit"
            className="w-full rounded-xl bg-cyan-600 py-2.5 text-xs font-bold text-white"
          >
            {t("createAssessment")}
          </button>
        </form>
      </Modal>

      {/* MODAL: Share Learning Resource */}
      <Modal
        title="Share a learning resource"
        isOpen={uploadModal}
        onClose={() => {
          setUploadModal(false);
          setUploadForm({
            title: "",
            description: "",
            classroomId: "",
            category: "document",
            sourceType: "upload",
            sourceUrl: "",
            originalFilename: "",
            mimeType: "application/pdf",
            base64Data: "",
          });
        }}
      >
        <form onSubmit={handleFileUpload} className="space-y-4">
          {/* Cohort selector */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Share with cohort
            </label>
            <select
              value={uploadForm.classroomId || classes[0]?._id || ""}
              onChange={(e) =>
                setUploadForm({ ...uploadForm, classroomId: e.target.value })
              }
              className="w-full rounded-xl border border-slate-200 p-2 text-xs outline-none bg-white"
              required
            >
              {classes.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.title} ({c.students?.length || 0} learners)
                </option>
              ))}
            </select>
            <p className="mt-1 text-[10px] text-slate-400">
              You can only share resources with cohorts you are assigned to
              teach.
            </p>
          </div>

          {/* Resource type selector */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Resource type
            </label>
            <div className="flex gap-2">
              {[
                { value: "upload", label: "📄 File upload" },
                { value: "youtube", label: "▶️ YouTube" },
                { value: "google_drive", label: "🗂 Google Drive" },
              ].map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() =>
                    setUploadForm({
                      ...uploadForm,
                      sourceType: opt.value,
                      sourceUrl: "",
                      base64Data: "",
                      originalFilename: "",
                      mimeType: "application/pdf",
                    })
                  }
                  className={`flex-1 rounded-xl border py-2 px-2 text-[11px] font-bold transition-all ${uploadForm.sourceType === opt.value
                    ? "border-blue-500 bg-blue-50 text-blue-700"
                    : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                    }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Title */}
          <div>
            <label className="block text-xs font-bold text-slate-700">
              {t("title")}
            </label>
            <input
              required
              type="text"
              value={uploadForm.title}
              onChange={(e) =>
                setUploadForm({ ...uploadForm, title: e.target.value })
              }
              className="mt-1 w-full rounded-xl border border-slate-200 p-2 text-sm outline-none"
              placeholder="e.g. Chapter 3 — Introduction to Algebra"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-bold text-slate-700">
              {t("description")}
            </label>
            <textarea
              rows={2}
              value={uploadForm.description}
              onChange={(e) =>
                setUploadForm({ ...uploadForm, description: e.target.value })
              }
              className="mt-1 w-full rounded-xl border border-slate-200 p-2 text-sm outline-none"
              placeholder="Brief description for your students…"
            />
          </div>

          {/* YouTube URL input */}
          {uploadForm.sourceType === "youtube" && (
            <div>
              <label className="block text-xs font-bold text-slate-700">
                YouTube video or playlist URL
              </label>
              <input
                required
                type="url"
                value={uploadForm.sourceUrl}
                onChange={(e) =>
                  setUploadForm({ ...uploadForm, sourceUrl: e.target.value })
                }
                className="mt-1 w-full rounded-xl border border-red-200 bg-red-50/30 p-2 text-sm outline-none focus:border-red-400"
                placeholder="https://www.youtube.com/watch?v=..."
              />
              <p className="mt-1 text-[10px] text-slate-400">
                Paste a YouTube video, short, or playlist link from your YouTube
                account. Students will view it embedded in the workspace.
              </p>
            </div>
          )}

          {/* Google Drive URL input */}
          {uploadForm.sourceType === "google_drive" && (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700">
                  Google Drive sharing link
                </label>
                <input
                  required
                  type="url"
                  value={uploadForm.sourceUrl}
                  onChange={(e) =>
                    setUploadForm({ ...uploadForm, sourceUrl: e.target.value })
                  }
                  className="mt-1 w-full rounded-xl border border-emerald-200 bg-emerald-50/30 p-2 text-sm outline-none focus:border-emerald-400"
                  placeholder="https://drive.google.com/file/d/..."
                />
                <p className="mt-1 text-[10px] text-slate-400">
                  Paste a shareable link from your Google Drive, Docs, Sheets,
                  or Slides. Ensure sharing is set to "Anyone with the link can
                  view".
                </p>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700">
                  Document category
                </label>
                <select
                  value={uploadForm.category}
                  onChange={(e) =>
                    setUploadForm({ ...uploadForm, category: e.target.value })
                  }
                  className="mt-1 w-full rounded-xl border border-slate-200 p-2 text-xs outline-none bg-white"
                >
                  <option value="document">📄 Document (Google Docs)</option>
                  <option value="spreadsheet">
                    📊 Spreadsheet (Google Sheets)
                  </option>
                  <option value="slide">🖼 Presentation (Google Slides)</option>
                  <option value="pdf">📑 PDF file</option>
                  <option value="video">🎥 Video file</option>
                </select>
              </div>
            </div>
          )}

          {/* File upload input */}
          {uploadForm.sourceType === "upload" && (
            <div>
              <label className="block text-xs font-bold text-slate-700">
                Choose a file (max 25 MB)
              </label>
              <input
                type="file"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    const reader = new FileReader();
                    reader.onload = () => {
                      const base64 = reader.result.split(",")[1];
                      setUploadForm({
                        ...uploadForm,
                        originalFilename: file.name,
                        mimeType: file.type || "application/pdf",
                        base64Data: base64,
                      });
                    };
                    reader.readAsDataURL(file);
                  }
                }}
                className="mt-1 w-full text-xs"
              />
            </div>
          )}

          <button
            type="submit"
            className="golden-btn w-full rounded-full py-3 text-xs font-bold text-white shadow-sm hover:shadow-md transition-all active:scale-95"
          >
            {uploadForm.sourceType === "youtube"
              ? "▶️ Share YouTube resource"
              : uploadForm.sourceType === "google_drive"
                ? "🗂 Share Google Drive resource"
                : "📄 Upload and share file"}
          </button>
        </form>
      </Modal>
    </div>
  );
}
