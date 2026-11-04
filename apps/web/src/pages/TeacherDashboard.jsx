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
    <div className="min-h-screen space-y-8 px-4 py-6 sm:px-6 lg:pl-72 lg:pr-8">
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
      {/* Top Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#0c234b] via-[#091b3b] to-[#061124] p-6 sm:p-8 text-white border border-sky-500/25 shadow-xl flex flex-wrap items-center justify-between gap-6">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-blue-500/10 blur-3xl"
        />
        <div className="relative">
          <span className="text-xs font-extrabold uppercase tracking-[0.16em] text-sky-400">
            TedbabeLearnHUB · {t("teacherOverview")}
          </span>
          <div className="mt-2 flex items-center gap-4">
            {profileForm.avatarUrl ? (
              <img
                src={profileForm.avatarUrl}
                alt=""
                className="h-14 w-14 rounded-full object-cover ring-2 ring-white/30"
              />
            ) : null}
            <h1 className="text-3xl font-black text-white sm:text-4xl">
              {profileForm.fullName}
            </h1>
          </div>
          <p className="mt-1 text-sm text-slate-300">{user.email}</p>
        </div>
        <div className="relative flex flex-wrap gap-2">
          <button
            onClick={() => setCreateAssignModal(true)}
            className="rounded-xl bg-gradient-to-r from-[#0066ff] to-[#0099ff] px-4 py-2.5 text-xs font-extrabold text-white shadow-md shadow-blue-500/25 hover:from-[#0052cc] hover:to-[#0088e6] transition-all hover:-translate-y-0.5"
          >
            + {t("createAssignment")}
          </button>
          <button
            onClick={() => setCreateQuizModal(true)}
            className="rounded-xl bg-gradient-to-r from-[#6366f1] to-[#8b5cf6] px-4 py-2.5 text-xs font-extrabold text-white shadow-md shadow-indigo-500/25 hover:from-[#4f46e5] hover:to-[#7c3aed] transition-all hover:-translate-y-0.5"
          >
            + {t("createAssessment")}
          </button>
          <button
            onClick={() => setUploadModal(true)}
            className="rounded-xl border border-white/20 bg-white/10 px-4 py-2.5 text-xs font-bold text-white hover:bg-white/20 transition-all"
          >
            + {t("uploadResource")}
          </button>
        </div>
      </div>

      {/* Prominent Next Scheduled Live Session Banner */}
      {upcomingLessons[0] ? (
        <div className="rounded-3xl bg-gradient-to-r from-emerald-950 via-slate-900 to-teal-950 p-6 sm:p-7 text-white shadow-xl flex flex-wrap items-center justify-between gap-6 border border-emerald-500/30">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-2 rounded-full bg-emerald-500/20 px-3 py-1 text-xs font-bold text-emerald-300 border border-emerald-500/30">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping"></span>
              <span>Next scheduled live session</span>
            </div>
            <h2 className="text-2xl font-black text-white">
              {upcomingLessons[0].title}
            </h2>
            <div className="flex flex-wrap items-center gap-4 text-xs text-slate-300">
              <p>
                📅 {formatSessionTime(upcomingLessons[0].startsAt)} —{" "}
                {formatSessionTime(upcomingLessons[0].endsAt)}
              </p>
              <span className="text-amber-300 font-medium">
                🔒 Meeting link activates 10 minutes prior
              </span>
            </div>
          </div>
          {upcomingLessons[0].meetingUrl ? (
            <LiveSessionButton session={upcomingLessons[0]} />
          ) : null}
        </div>
      ) : null}

      {feedback ? (
        <div className="rounded-2xl bg-blue-50 p-4 text-sm font-semibold text-blue-900 ring-1 ring-blue-200 flex justify-between items-center">
          <span>{feedback}</span>
          <button
            onClick={() => setFeedback("")}
            className="text-blue-500 hover:text-blue-800"
          >
            ✕
          </button>
        </div>
      ) : null}

      {/* 1. OVERVIEW */}
      {activeTab === "overview" ? (
        <div className="space-y-8">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <MetricCard
              label="Assigned cohorts"
              value={classes.length}
              icon="🏫"
            />
            <MetricCard
              label="Upcoming sessions"
              value={upcomingLessons.length}
              icon="📹"
            />
            <MetricCard
              label="Learners"
              value={classes.reduce(
                (acc, c) => acc + (c.students?.length || 0),
                0,
              )}
              icon="🎓"
            />
            <MetricCard
              label="Pending grading"
              value={overview?.pendingSubmissionsToGrade ?? 0}
              icon="📝"
            />
            <MetricCard
              label="Assessment reviews"
              value={overview?.pendingAssessmentReviews ?? 0}
              icon="✅"
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
                      className="rounded-2xl border border-slate-200 p-4 space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <h4 className="font-bold text-slate-900">
                          {session.title}
                        </h4>
                        <Badge variant="cyan">
                          {formatSessionTime(session.startsAt)}
                        </Badge>
                      </div>
                      {session.meetingUrl ? (
                        <div className="pt-2">
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
                      className="rounded-xl bg-slate-50 p-3 text-xs"
                    >
                      <p className="font-bold text-slate-900">{n.title}</p>
                      <p className="mt-1 text-slate-600">{n.message}</p>
                      <span className="mt-1 block text-[10px] text-slate-400">
                        {new Date(n.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </DashboardCard>
          </div>

          {announcements.length > 0 && (
            <div className="rounded-3xl border border-sky-200 bg-sky-50/60 p-6 space-y-4">
              <div className="flex items-center gap-2">
                <span className="text-lg">📢</span>
                <h3 className="font-bold text-slate-900 text-base">
                  Announcements & Updates
                </h3>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                {announcements.slice(0, 4).map((ann) => (
                  <div
                    key={ann._id}
                    className="rounded-2xl bg-white p-4 shadow-sm border border-sky-100/80 space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <h4 className="font-bold text-slate-900 text-sm">
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
                    <p className="text-xs text-slate-600 leading-relaxed">
                      {ann.content}
                    </p>
                    <div className="flex items-center gap-2 text-[10px] text-slate-400 pt-1 border-t border-slate-50">
                      <span>
                        {ann.author?.fullName
                          ? `By ${ann.author.fullName}`
                          : "Academy"}
                      </span>
                      {ann.classroom ? (
                        <span>• Cohort: {ann.classroom.title}</span>
                      ) : null}
                      <span>
                        • {new Date(ann.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : null}

      {/* 2. CLASSES */}
      {activeTab === "classes" ? (
        <div className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            {classes.map((cls) => (
              <div
                key={cls._id}
                className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200 space-y-4"
              >
                <div className="flex items-center justify-between">
                  <h4 className="text-lg font-bold text-slate-900">
                    {cls.title}
                  </h4>
                  <Badge variant="emerald">{cls.status}</Badge>
                </div>
                <p className="text-xs text-slate-600">
                  <strong>Program:</strong> {cls.course?.title || "General"}
                </p>
                <div className="border-t border-slate-100 pt-3">
                  <h5 className="text-xs font-bold text-slate-700 mb-2">
                    Assigned learners ({cls.students?.length || 0}):
                  </h5>
                  <div className="space-y-1 max-h-48 overflow-y-auto">
                    {cls.students?.map((s) => (
                      <div
                        key={s._id}
                        className="rounded-lg bg-slate-50 p-2 text-xs flex justify-between"
                      >
                        <span className="font-semibold text-slate-800">
                          {s.fullName}
                        </span>
                        <span className="text-slate-400">{s.email}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="pt-2 border-t border-slate-100">
                  <Link
                    to={`/workspace/${cls._id}`}
                    className="block w-full text-center rounded-2xl bg-gradient-to-r from-[#0066ff] to-[#0099ff] py-2.5 text-xs font-bold text-white shadow-md shadow-blue-500/25 transition hover:from-[#0052cc] hover:to-[#0088e6]"
                  >
                    Open Cohort Workspace →
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
            title="Live class schedule"
            subtitle="Times are shown in your device's local time. You can also compare with the cohort time zone."
          >
            <SessionSchedule sessions={upcomingLessons} />
          </DashboardCard>
        </div>
      ) : null}

      {/* 4. ATTENDANCE TRACKER */}
      {activeTab === "attendance" ? (
        <div className="space-y-6">
          <DashboardCard
            title="Attendance tracker"
            subtitle="Record learner attendance as present, absent, late, or excused."
          >
            <div className="space-y-6">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Select a session
                </label>
                <select
                  value={selectedSessionId}
                  onChange={(e) => setSelectedSessionId(e.target.value)}
                  className="w-full sm:w-96 rounded-xl border border-slate-200 p-2.5 text-xs outline-none bg-white"
                >
                  {upcomingLessons.map((s) => (
                    <option key={s._id} value={s._id}>
                      {s.title} ({formatSessionTime(s.startsAt)})
                    </option>
                  ))}
                </select>
              </div>

              {currentClassForAttendance ? (
                <div className="divide-y divide-slate-100">
                  {currentClassForAttendance.students.map((stud) => {
                    const currentStatus =
                      attendanceRecords[stud._id]?.status || "present";
                    return (
                      <div
                        key={stud._id}
                        className="py-4 flex flex-wrap items-center justify-between gap-4"
                      >
                        <div>
                          <p className="font-bold text-sm text-slate-900">
                            {stud.fullName}
                          </p>
                          <p className="text-xs text-slate-400">{stud.email}</p>
                        </div>
                        <div className="flex gap-1.5">
                          {["present", "absent", "late", "excused"].map(
                            (st) => (
                              <button
                                key={st}
                                type="button"
                                onClick={() =>
                                  setStudentAttendance(stud._id, st)
                                }
                                className={`rounded-lg px-3 py-1.5 text-xs font-bold capitalize transition-colors ${
                                  currentStatus === st
                                    ? st === "present"
                                      ? "bg-[#0066ff] text-white"
                                      : st === "absent"
                                        ? "bg-rose-600 text-white"
                                        : st === "late"
                                          ? "bg-amber-500 text-white"
                                          : "bg-blue-600 text-white"
                                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                                }`}
                              >
                                {t(st)}
                              </button>
                            ),
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <EmptyState title="No learners are assigned to this cohort yet." />
              )}

              <button
                onClick={saveAttendance}
                className="rounded-xl bg-slate-900 px-6 py-2.5 text-xs font-bold text-white hover:bg-slate-800"
              >
                {t("markAttendance")}
              </button>
            </div>
          </DashboardCard>

          <DashboardCard
            title="Cohort attendance register"
            subtitle="Cumulative attendance for each learner across all sessions."
          >
            <select
              value={registerClassroomId}
              onChange={(e) => void loadCohortRegister(e.target.value)}
              className="w-full sm:w-96 rounded-xl border border-slate-200 bg-white p-2.5 text-xs outline-none"
            >
              <option value="">Select a cohort</option>
              {classes.map((classroom) => (
                <option key={classroom._id} value={classroom._id}>
                  {classroom.title}
                </option>
              ))}
            </select>

            {registerLoading ? (
              <p className="mt-4 text-xs text-slate-500">Loading register…</p>
            ) : cohortRegister ? (
              <div className="mt-4 overflow-x-auto">
                <div className="mb-3 text-xs text-slate-500">
                  Sessions held: <strong>{cohortRegister.summary?.sessions ?? 0}</strong>{" "}
                  · Cohort attendance rate:{" "}
                  <strong>{cohortRegister.summary?.attendanceRate ?? 0}%</strong>
                </div>
                <table className="w-full min-w-[640px] text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500 uppercase tracking-wider">
                      <th className="py-2 pr-3 font-bold">Learner</th>
                      <th className="py-2 px-3 font-bold">Present</th>
                      <th className="py-2 px-3 font-bold">Late</th>
                      <th className="py-2 px-3 font-bold">Absent</th>
                      <th className="py-2 px-3 font-bold">Excused</th>
                      <th className="py-2 px-3 font-bold">Marked</th>
                      <th className="py-2 pl-3 font-bold">Rate</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {cohortRegister.students?.map((row) => (
                      <tr key={row._id}>
                        <td className="py-2.5 pr-3 font-semibold text-slate-900">
                          {row.fullName || row.name}
                        </td>
                        <td className="py-2.5 px-3 text-emerald-600 font-semibold">
                          {row.present}
                        </td>
                        <td className="py-2.5 px-3 text-amber-600 font-semibold">
                          {row.late}
                        </td>
                        <td className="py-2.5 px-3 text-rose-600 font-semibold">
                          {row.absent}
                        </td>
                        <td className="py-2.5 px-3 text-slate-600">
                          {row.excused}
                        </td>
                        <td className="py-2.5 px-3 text-slate-600">{row.total}</td>
                        <td className="py-2.5 pl-3 font-bold text-slate-900">
                          {row.attendanceRate}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="mt-4 text-xs text-slate-500">
                Select a cohort to view its attendance register.
              </p>
            )}
          </DashboardCard>
        </div>
      ) : null}

      {/* 5. ASSIGNMENTS */}
      {activeTab === "assignments" ? (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h3 className="text-xl font-bold text-slate-900">Assignments</h3>
            <button
              onClick={() => setCreateAssignModal(true)}
              className="rounded-xl bg-blue-600 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-blue-700"
            >
              + {t("createAssignment")}
            </button>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            {assignments.map((asgn) => (
              <div
                key={asgn._id}
                className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200 space-y-4"
              >
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-slate-900">{asgn.title}</h4>
                  <Badge variant="blue">{asgn.maxScore} pts</Badge>
                </div>
                <p className="text-xs text-slate-600 line-clamp-2">
                  {asgn.instructions}
                </p>
                <div className="flex justify-between items-center text-xs text-slate-500 border-t border-slate-100 pt-3">
                  <span>
                    Due: {new Date(asgn.dueDate).toLocaleDateString()}
                  </span>
                  <span className="font-bold text-blue-600">
                    {asgn.submissionCount || 0} submitted (
                    {asgn.gradedCount || 0} graded)
                  </span>
                </div>
                <button
                  onClick={() => openSubmissions(asgn)}
                  className="w-full rounded-xl bg-slate-100 py-2 text-xs font-bold text-slate-800 hover:bg-slate-200"
                >
                  View submissions
                </button>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {/* 6. ASSESSMENTS / QUIZZES */}
      {activeTab === "assessments" ? (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h3 className="text-xl font-bold text-slate-900">Assessments</h3>
            <button
              onClick={() => setCreateQuizModal(true)}
              className="rounded-xl bg-cyan-600 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-cyan-700"
            >
              + {t("createAssessment")}
            </button>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            {assessments.map((qz) => (
              <div
                key={qz._id}
                className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-slate-900">{qz.title}</h4>
                  <Badge variant="cyan">
                    {ASSESSMENT_TYPE_LABELS[qz.assessmentType] || "Quiz"}
                  </Badge>
                </div>
                <p className="text-xs text-slate-600">{qz.description}</p>
                <div className="text-xs text-slate-500 border-t border-slate-100 pt-2 flex justify-between">
                  <span>Questions: {qz.questions?.length || 0}</span>
                  <span>Passing score: {qz.passingScorePercentage}%</span>
                </div>
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span className="font-bold text-cyan-700">
                    {qz.attemptCount || 0} submitted ({qz.reviewedCount || 0}{" "}
                    released)
                  </span>
                </div>
                <button
                  onClick={() => openAttempts(qz)}
                  className="w-full rounded-xl bg-cyan-50 py-2 text-xs font-bold text-cyan-800 hover:bg-cyan-100"
                >
                  Review submissions
                </button>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {activeTab === "progress" ? (
        <div className="space-y-6">
          <DashboardCard
            title="Teacher-published progress"
            subtitle="Scores and self-assessment remain private to the learner until you publish the report."
          >
            <label className="block max-w-xl text-xs font-bold text-slate-700">
              Cohort
              <select
                value={progressClassroomId}
                onChange={(event) =>
                  void openProgressReports(event.target.value)
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
            {progressLoading && (
              <p role="status" className="mt-4 text-sm text-slate-500">
                Loading cohort progress…
              </p>
            )}
            {!progressLoading && !classes.length && (
              <EmptyState title="No cohorts assigned yet." />
            )}
          </DashboardCard>

          {progressClassroomId && !progressLoading ? (
            <DashboardCard
              title="Prepare learner report"
              subtitle="Enter each component score; the overall score is summed automatically."
            >
              {progressRoster.length === 0 ? (
                <EmptyState title="This cohort has no learners assigned." />
              ) : (
                <div className="space-y-5">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="block text-xs font-bold text-slate-700">
                      Learner
                      <select
                        value={progressForm.studentId}
                        onChange={(event) =>
                          handleProgressStudentChange(event.target.value)
                        }
                        className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-2.5 text-sm"
                      >
                        {progressRoster.map((student) => (
                          <option key={student._id} value={student._id}>
                            {student.fullName} · {student.email}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="block text-xs font-bold text-slate-700">
                      Reporting period
                      <input
                        required
                        maxLength={80}
                        value={progressForm.period}
                        onChange={(event) =>
                          setProgressForm((form) => ({
                            ...form,
                            period: event.target.value,
                          }))
                        }
                        className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 text-sm"
                        placeholder="e.g. Term 1, 2026"
                      />
                    </label>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    <label className="block text-xs font-bold text-slate-700">
                      Overall score (%)
                      <input
                        type="text"
                        readOnly
                        value={hasProgressComponents ? progressOverallTotal : ""}
                        className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-100 p-2.5 text-sm font-bold text-slate-900"
                        placeholder="Sum of components"
                      />
                      <span className="mt-1 block text-[11px] font-normal text-slate-500">
                        Automatically the sum of the component scores above.
                      </span>
                    </label>
                    {PROGRESS_COMPONENTS.map(({ category, label }) => (
                      <label
                        key={category}
                        className="block text-xs font-bold text-slate-700"
                      >
                        {label} (%)
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="0.1"
                          value={progressForm[category]}
                          onChange={(event) =>
                            setProgressForm((form) => ({
                              ...form,
                              [category]: event.target.value,
                            }))
                          }
                          className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 text-sm"
                          placeholder="Optional"
                        />
                      </label>
                    ))}
                  </div>

                  <label className="block text-xs font-bold text-slate-700">
                    Teacher self-assessment
                    <textarea
                      rows={3}
                      maxLength={4000}
                      value={progressForm.selfAssessment}
                      onChange={(event) =>
                        setProgressForm((form) => ({
                          ...form,
                          selfAssessment: event.target.value,
                        }))
                      }
                      className="mt-1 w-full rounded-xl border border-slate-200 p-3 text-sm"
                      placeholder="Describe the learner’s strengths, growth, and next steps."
                    />
                  </label>
                  <label className="block text-xs font-bold text-slate-700">
                    Feedback for learner
                    <textarea
                      rows={3}
                      maxLength={4000}
                      value={progressForm.feedback}
                      onChange={(event) =>
                        setProgressForm((form) => ({
                          ...form,
                          feedback: event.target.value,
                        }))
                      }
                      className="mt-1 w-full rounded-xl border border-slate-200 p-3 text-sm"
                      placeholder="Add feedback that will appear with the published report."
                    />
                  </label>

                  {progressReports.filter(
                    (report) =>
                      String(report.student?._id ?? report.student) ===
                      progressForm.studentId,
                  ).length > 0 && (
                    <div className="space-y-2 border-t border-slate-100 pt-4">
                      <h4 className="text-xs font-bold uppercase tracking-wide text-slate-500">
                        Existing reports
                      </h4>
                      {progressReports
                        .filter(
                          (report) =>
                            String(report.student?._id ?? report.student) ===
                            progressForm.studentId,
                        )
                        .map((report) => (
                          <div
                            key={report._id}
                            className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2 text-xs"
                          >
                            <span className="font-semibold text-slate-700">
                              {report.period} ·{" "}
                              {report.overallScore ?? "No score"}%
                            </span>
                            <Badge
                              variant={
                                report.status === "published"
                                  ? "emerald"
                                  : "amber"
                              }
                            >
                              {report.status}
                            </Badge>
                          </div>
                        ))}
                    </div>
                  )}

                  <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-4">
                    <button
                      type="button"
                      disabled={progressSaving || !progressForm.period.trim()}
                      onClick={() => void saveProgressReport("draft")}
                      className="rounded-xl border border-slate-300 px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                    >
                      {progressSaving ? "Saving…" : "Save draft"}
                    </button>
                    <button
                      type="button"
                      disabled={
                        progressSaving ||
                        !progressForm.period.trim() ||
                        !hasProgressComponents ||
                        !progressForm.selfAssessment.trim()
                      }
                      onClick={() => void saveProgressReport("published")}
                      className="rounded-xl bg-blue-700 px-4 py-2.5 text-xs font-bold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {progressSaving ? "Publishing…" : "Publish to learner"}
                    </button>
                  </div>
                </div>
              )}
            </DashboardCard>
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
              className="rounded-xl bg-blue-600 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-blue-700"
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
                    className="rounded-lg bg-blue-600 px-3 py-1 text-xs font-bold text-white hover:bg-blue-700"
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
            className="w-full rounded-xl bg-blue-600 py-2.5 text-xs font-bold text-white"
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
                  className={`flex-1 rounded-xl border py-2 px-2 text-[11px] font-bold transition-all ${
                    uploadForm.sourceType === opt.value
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
            className="w-full rounded-xl bg-gradient-to-r from-[#0066ff] to-[#0099ff] py-2.5 text-xs font-bold text-white hover:from-[#0052cc] hover:to-[#0088e6] shadow-md shadow-blue-500/20 transition-all"
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
