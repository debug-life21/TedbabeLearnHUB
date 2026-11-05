import React, { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { apiRequest, loadPublicCourses } from "../lib/api";
import { TIME_ZONES } from "../lib/timezones";
import { SessionSchedule } from "../components/SessionSchedule";
import { LiveSessionButton } from "../components/LiveSessionButton";
import { CategoryCoursePicker } from "../components/CategoryCoursePicker";
import { ProfilePhotoField } from "../components/ProfilePhotoField";
import { DashboardSettings } from "../components/DashboardSettings";
import { DashboardSidebar } from "../components/DashboardSidebar";
import { formatSessionTime } from "../lib/sessionTime";
import {
  downloadCertificate,
  printCertificate,
} from "../lib/certificateDocument";
import {
  MetricCard,
  DashboardCard,
  EmptyState,
  Badge,
  Modal,
} from "../components/UIComponents";
import { SchedulePreferenceSelector } from "../components/SchedulePreferenceSelector";
import { StudentPaymentsPanel } from "../components/StudentPaymentsPanel";
import { useAuth } from "../context/AuthContext";

const SUBMISSION_FILE_TYPES =
  ".pdf,.ppt,.pptx,.doc,.docx,.xls,.xlsx,.txt,.jpg,.jpeg,.png,.webp,.mp4,.webm,.mp3,.wav";
const MAX_FILE_BYTES = 30 * 1024 * 1024;
const MAX_TOTAL_BYTES = 60 * 1024 * 1024;
const LEARNING_MODE_OPTIONS = [
  { value: "live", label: "Live cohort classes" },
  { value: "self_paced", label: "Self-paced study" },
  { value: "hybrid", label: "Hybrid (live + self-paced)" },
];

function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || "");
      resolve(
        result.includes(",") ? result.slice(result.indexOf(",") + 1) : result,
      );
    };
    reader.onerror = () => reject(new Error(`Could not read “${file.name}”.`));
    reader.readAsDataURL(file);
  });
}

// Convert the selected files into the base64 payload the API expects.
async function buildFilePayload(fileList) {
  const files = Array.from(fileList || []);
  let total = 0;
  const payload = [];
  for (const file of files) {
    if (file.size > MAX_FILE_BYTES) {
      throw new Error(
        `“${file.name}” is larger than 30MB. Please upload a smaller file.`,
      );
    }
    total += file.size;
    if (total > MAX_TOTAL_BYTES) {
      throw new Error("Your uploads must total less than 60MB.");
    }
    payload.push({
      originalFilename: file.name,
      mimeType: file.type || "application/octet-stream",
      base64Data: await readFileAsBase64(file),
    });
  }
  return payload;
}

export function StudentDashboard({ user }) {
  const { t } = useTranslation();
  const { refreshUser } = useAuth();
  const [activeTab, setActiveTab] = useState("overview");
  const [classes, setClasses] = useState([]);
  const [courses, setCourses] = useState([]);
  const [upcomingLessons, setUpcomingLessons] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [assessments, setAssessments] = useState([]);
  const [resources, setResources] = useState([]);
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [progressData, setProgressData] = useState(null);
  const [progressReports, setProgressReports] = useState([]);
  const [certificates, setCertificates] = useState([]);
  const [resultAttempts, setResultAttempts] = useState([]);
  const [attendanceSummary, setAttendanceSummary] = useState(null);
  const [attendanceClasses, setAttendanceClasses] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [feedback, setFeedback] = useState("");
  // Password change state
  const [securityForm, setSecurityForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [securityLoading, setSecurityLoading] = useState(false);
  // Submit Assignment Modal
  const [submitModal, setSubmitModal] = useState({
    open: false,
    assignment: null,
    textResponse: "",
    links: [{ label: "", url: "" }],
    files: [],
  });
  const [submitBusy, setSubmitBusy] = useState(false);
  // Take Assessment Modal
  const [quizModal, setQuizModal] = useState({
    open: false,
    assessment: null,
    answers: {},
    responseText: "",
    links: [{ label: "", url: "" }],
    files: [],
    result: null,
  });
  const [quizBusy, setQuizBusy] = useState(false);
  // Profile preferences form
  const [profileForm, setProfileForm] = useState({
    learningGoals: "",
    learningInterests: [],
    currentSkillLevel: "Beginner",
    preferredSchedule: "",
    preferredCourseIds: [],
    preferredCourseNotes: "",
    preferredLearningModes: [],
    courseSelectionUpdatedAt: null,
    weeklyStudyHours: 5,
    timeZone: "Africa/Addis_Ababa",
  });
  const [personalForm, setPersonalForm] = useState({
    fullName: user.fullName || "",
    phone: user.phone || "",
    bio: user.bio || "",
    avatarUrl: user.avatarUrl || "",
  });
  const loadStudentData = useCallback(async () => {
    try {
      const [
        dash,
        classesRes,
        assignRes,
        quizRes,
        resRes,
        attendRes,
        progRes,
        certRes,
        annRes,
        resultsRes,
      ] = await Promise.all([
        apiRequest("/api/student/dashboard"),
        apiRequest("/api/student/classes"),
        apiRequest("/api/student/assignments"),
        apiRequest("/api/student/assessments"),
        apiRequest("/api/resources"),
        apiRequest("/api/student/attendance"),
        apiRequest("/api/student/progress"),
        apiRequest("/api/student/certificates").catch(() => ({
          certificates: [],
        })),
        apiRequest("/api/student/announcements").catch(() => ({
          announcements: [],
        })),
        apiRequest("/api/student/results").catch(() => ({ attempts: [] })),
      ]);
      setClasses(classesRes.classes || []);
      setUpcomingLessons(dash.upcomingLessons || []);
      setAssignments(assignRes.assignments || []);
      setAssessments(quizRes.assessments || []);
      setResources(resRes.resources || []);
      setAttendanceRecords(attendRes.records || []);
      setAttendanceSummary(attendRes.summary || null);
      setAttendanceClasses(attendRes.classes || []);
      setProgressData(progRes.progress || null);
      setProgressReports(progRes.reports || []);
      setCertificates(certRes.certificates || []);
      setResultAttempts(resultsRes.attempts || []);
      setNotifications(dash.notifications || []);
      setAnnouncements(annRes.announcements || []);
      if (dash.student?.studentProfile) {
        setProfileForm({
          learningGoals: dash.student.studentProfile.learningGoals || "",
          learningInterests:
            dash.student.studentProfile.learningInterests || [],
          currentSkillLevel:
            dash.student.studentProfile.currentSkillLevel || "Beginner",
          preferredSchedule:
            dash.student.studentProfile.preferredSchedule || "",
          preferredCourseIds: (
            dash.student.studentProfile.preferredCourseIds || []
          ).map((courseId) => String(courseId?._id || courseId)),
          preferredCourseNotes:
            dash.student.studentProfile.preferredCourseNotes || "",
          preferredLearningModes:
            dash.student.studentProfile.preferredLearningModes || [],
          courseSelectionUpdatedAt:
            dash.student.studentProfile.courseSelectionUpdatedAt || null,
          weeklyStudyHours: dash.student.studentProfile.weeklyStudyHours || 5,
          timeZone:
            dash.student.studentProfile.timeZone || "Africa/Addis_Ababa",
        });
      }
    } catch (err) {
      setFeedback(err.message);
    }
  }, []);
  useEffect(() => {
    loadStudentData();
    const refreshTimer = window.setInterval(() => {
      void loadStudentData();
    }, 60_000);
    return () => window.clearInterval(refreshTimer);
  }, [loadStudentData]);
  useEffect(() => {
    let mounted = true;
    loadPublicCourses()
      .then((catalog) => {
        if (mounted) setCourses(catalog);
      })
      .catch((err) => {
        if (mounted) setFeedback(err.message);
      });
    return () => {
      mounted = false;
    };
  }, []);
  // Submit Assignment Action
  const handleSubmitAssignment = async (e) => {
    e.preventDefault();
    if (!submitModal.assignment) return;
    setSubmitBusy(true);
    setFeedback("");
    try {
      const files = await buildFilePayload(submitModal.files);
      const links = submitModal.links.filter((link) => link.url.trim());
      if (
        !submitModal.textResponse.trim() &&
        files.length === 0 &&
        links.length === 0
      ) {
        setFeedback(
          "Add a written response, a link, or a file before submitting.",
        );
        return;
      }
      await apiRequest(
        `/api/student/assignments/${submitModal.assignment._id}/submit`,
        {
          method: "POST",
          body: JSON.stringify({
            textResponse: submitModal.textResponse,
            links,
            files,
          }),
        },
      );
      setSubmitModal({
        open: false,
        assignment: null,
        textResponse: "",
        links: [{ label: "", url: "" }],
        files: [],
      });
      setFeedback(
        "Assignment submitted. Your teacher will review and return your result.",
      );
      void loadStudentData();
    } catch (err) {
      setFeedback(err.message);
    } finally {
      setSubmitBusy(false);
    }
  };
  // Open Assessment Modal
  const startQuiz = async (assessment) => {
    try {
      const res = await apiRequest(
        `/api/student/assessments/${assessment._id}`,
      );
      setQuizModal({
        open: true,
        assessment: res.assessment,
        answers: {},
        responseText: res.previousAttempt?.responseText || "",
        links: res.previousAttempt?.submissionLinks?.length
          ? res.previousAttempt.submissionLinks.map((link) => ({
              label: link.label || "",
              url: link.url,
            }))
          : [{ label: "", url: "" }],
        files: [],
        result: null,
      });
    } catch (err) {
      setFeedback(err.message);
    }
  };
  // Submit Assessment Action — the teacher releases the final result.
  const handleSubmitQuiz = async () => {
    if (!quizModal.assessment) return;
    setQuizBusy(true);
    setFeedback("");
    try {
      const answersPayload = Object.entries(quizModal.answers).map(
        ([questionId, selectedOption]) => ({
          questionId,
          selectedOption,
        }),
      );
      const files = await buildFilePayload(quizModal.files);
      const links = quizModal.links.filter((link) => link.url.trim());
      const res = await apiRequest(
        `/api/student/assessments/${quizModal.assessment._id}/attempt`,
        {
          method: "POST",
          body: JSON.stringify({
            answers: answersPayload,
            responseText: quizModal.responseText,
            links,
            files,
          }),
        },
      );
      setQuizModal((prev) => ({
        ...prev,
        result: res.attempt || { status: "submitted" },
      }));
      setFeedback(
        "Assessment submitted. Your teacher will review and release your result.",
      );
      void loadStudentData();
    } catch (err) {
      setFeedback(err.message);
    } finally {
      setQuizBusy(false);
    }
  };
  // Save Preferences Action
  const handleSaveProfile = async (e) => {
    e.preventDefault();
    try {
      await apiRequest("/api/student/profile", {
        method: "PATCH",
        body: JSON.stringify({
          learningGoals: profileForm.learningGoals,
          learningInterests: profileForm.learningInterests,
          currentSkillLevel: profileForm.currentSkillLevel,
          preferredSchedule: profileForm.preferredSchedule,
          preferredCourseIds: profileForm.preferredCourseIds,
          preferredCourseNotes: profileForm.preferredCourseNotes,
          preferredLearningModes: profileForm.preferredLearningModes,
          weeklyStudyHours: Number(profileForm.weeklyStudyHours),
          timeZone: profileForm.timeZone,
        }),
      });
      setFeedback("Course selection and learning preferences updated.");
      void loadStudentData();
    } catch (err) {
      setFeedback(err.message);
    }
  };

  const handleSavePersonalProfile = async (event) => {
    event.preventDefault();
    try {
      const response = await apiRequest("/api/auth/profile", {
        method: "PATCH",
        body: JSON.stringify(personalForm),
      });
      setPersonalForm((current) => ({ ...current, ...response.user }));
      await refreshUser();
      setFeedback("Personal profile updated.");
    } catch (err) {
      setFeedback(err.message || "Could not update personal profile.");
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

  const nextSession = upcomingLessons[0];
  const dashboardTabs = [
    { id: "overview", label: "Overview", icon: "📊" },
    { id: "courses", label: "Choose courses", icon: "🎯" },
    { id: "payments", label: "Payments & plans", icon: "💳" },
    { id: "classes", label: `My cohorts (${classes.length})`, icon: "🏫" },
    {
      id: "schedule",
      label: `Live classes (${upcomingLessons.length})`,
      icon: "📹",
    },
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
    {
      id: "resources",
      label: `Learning resources (${resources.length})`,
      icon: "📁",
    },
    { id: "progress", label: "My progress", icon: "📈" },
    {
      id: "results",
      label: `My results (${resultAttempts.length + progressReports.length})`,
      icon: "🏅",
    },
    {
      id: "certificates",
      label: `Certificates (${certificates.length})`,
      icon: "🎓",
    },
    { id: "profile", label: "My profile", icon: "👤" },
    { id: "settings", label: "Settings", icon: "⚙️" },
    { id: "security", label: "Account security", icon: "🔒" },
  ];
  return (
    <div className="student-workspace min-h-screen space-y-8 px-4 py-6 sm:px-6 lg:pl-72 lg:pr-8">
      <DashboardSidebar
        title="Student workspace"
        user={{
          ...user,
          fullName: personalForm.fullName,
          avatarUrl: personalForm.avatarUrl,
        }}
        tabs={dashboardTabs}
        activeTab={activeTab}
        onSelect={setActiveTab}
      />
      {/* Next Lesson Banner */}
      {nextSession ? (
        <div className="rounded-[var(--radius-3xl)] bg-gradient-to-br from-[var(--tlh-navy)] via-[var(--tlh-deep-blue)] to-[var(--tlh-navy)] p-8 text-white shadow-[var(--shadow-xl)] flex flex-wrap items-center justify-between gap-8 border border-white/5 relative overflow-hidden group">
          <div aria-hidden="true" className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-[var(--tlh-cyan)]/10 blur-3xl transition-all group-hover:bg-[var(--tlh-cyan)]/15" />
          
          <div className="relative space-y-3">
            <div className="inline-flex items-center gap-2.5 rounded-full bg-[var(--tlh-cyan)]/10 px-4 py-1.5 text-[11px] font-black uppercase tracking-[0.2em] text-[var(--tlh-cyan)] border border-[var(--tlh-cyan)]/20 shadow-sm">
              <span className="h-2 w-2 rounded-full bg-[var(--tlh-cyan)] animate-pulse shadow-[0_0_8px_var(--tlh-cyan)]"></span>
              <span>Next live session</span>
            </div>
            <h2 className="text-3xl font-black text-white leading-tight">
              {nextSession.title}
            </h2>
            <div className="flex flex-wrap items-center gap-6 text-[13px] font-medium text-white/70">
              <div className="flex items-center gap-2">
                <span className="text-lg">📅</span>
                <span>
                  {formatSessionTime(nextSession.startsAt)} —{" "}
                  {formatSessionTime(nextSession.endsAt)}
                </span>
              </div>
              <div className="flex items-center gap-2 text-[var(--tlh-gold)]">
                <span className="text-lg">🔒</span>
                <span className="font-bold">Link activates 10 mins prior</span>
              </div>
            </div>
          </div>
          <div className="relative shrink-0">
            {nextSession.meetingUrl ? (
              <LiveSessionButton session={nextSession} />
            ) : (
              <div className="rounded-[var(--radius-2xl)] bg-white/5 px-6 py-4 backdrop-blur-md border border-white/10 text-center">
                <p className="text-[11px] font-black uppercase tracking-wider text-white/50 mb-1">Status</p>
                <p className="text-sm font-bold text-white">Pending activation</p>
              </div>
            )}
          </div>
        </div>
      ) : null}

      {/* Verification notice if email not yet verified */}
      {!user.isVerified && !user.emailVerified ? (
        <div className="flex flex-wrap items-center justify-between gap-6 rounded-[var(--radius-2xl)] border border-[var(--tlh-cyan)]/20 bg-[var(--tlh-cyan)]/5 p-6 shadow-[var(--shadow-sm)]">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-[var(--radius-xl)] bg-white text-2xl shadow-sm border border-[var(--tlh-cyan)]/10">✉️</div>
            <div>
              <p className="text-sm font-black text-[var(--text-main)]">
                Email verification pending
              </p>
              <p className="mt-1 text-[13px] font-medium text-[var(--text-muted)] leading-relaxed">
                A 6-digit code was sent to{" "}
                <strong className="text-[var(--tlh-blue-primary)]">{user.email}</strong>. 
                Verify your account to unlock all platform features.
              </p>
            </div>
          </div>
          <Link
            to="/verify-code"
            state={{ email: user.email, purpose: "signup" }}
            className="rounded-[var(--radius-xl)] bg-[var(--tlh-blue-primary)] px-6 py-3 text-xs font-black uppercase tracking-wider text-white shadow-lg shadow-[var(--tlh-blue-primary)]/20 hover:shadow-xl transition-all hover:-translate-y-0.5"
          >
            Verify Now
          </Link>
        </div>
      ) : null}

      {/* Student Welcome Card */}
      <div className="relative overflow-hidden rounded-[var(--radius-3xl)] bg-gradient-to-br from-[var(--tlh-navy)] via-[var(--tlh-deep-blue)] to-[var(--tlh-navy)] p-8 text-white border border-white/5 shadow-[var(--shadow-xl)] flex flex-wrap items-center justify-between gap-8 group">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-[var(--tlh-blue-primary)]/10 blur-3xl transition-all group-hover:bg-[var(--tlh-blue-primary)]/15"
        />
        <div className="relative flex items-center gap-6">
          {personalForm.avatarUrl ? (
            <img
              src={personalForm.avatarUrl}
              alt=""
              className="h-20 w-20 rounded-[var(--radius-2xl)] object-cover ring-4 ring-white/10 shadow-2xl"
            />
          ) : (
            <div className="h-20 w-20 rounded-[var(--radius-2xl)] bg-gradient-to-br from-[var(--tlh-blue-primary)] to-[var(--tlh-sky)] flex items-center justify-center text-3xl font-black text-white shadow-2xl">
              {personalForm.fullName?.charAt(0)}
            </div>
          )}
          <div>
            <span className="text-[11px] font-black uppercase tracking-[0.25em] text-[var(--tlh-cyan)]">
              Welcome back, {t("studentOverview")}
            </span>
            <h1 className="mt-2 text-4xl font-black text-white tracking-tight leading-none">
              {personalForm.fullName}
            </h1>
            <p className="mt-2 text-sm font-medium text-white/50">{user.email}</p>
          </div>
        </div>
        <div className="relative">
          <Badge
            variant={
              user.studentProfile?.placementStatus === "assigned"
                ? "emerald"
                : "amber"
            }
          >
            {user.studentProfile?.placementStatus === "assigned"
              ? "Cohort assigned"
              : "Awaiting cohort placement"}
          </Badge>
        </div>
      </div>

      {!profileForm.preferredCourseIds.length ||
      !profileForm.preferredSchedule ? (
        <div className="flex flex-wrap items-center justify-between gap-6 rounded-[var(--radius-2xl)] border border-[var(--tlh-gold)]/20 bg-[var(--tlh-gold)]/5 p-6 shadow-[var(--shadow-sm)]">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-[var(--radius-xl)] bg-white text-2xl shadow-sm border border-[var(--tlh-gold)]/10">🎯</div>
            <p className="text-[13px] font-medium text-[var(--text-main)] leading-relaxed max-w-2xl">
              Complete your course choices and preferred study times so the
              TedbabeLearnHUB team can place you in a suitable cohort.
            </p>
          </div>
          <button
            onClick={() => setActiveTab("courses")}
            className="rounded-[var(--radius-xl)] bg-[var(--tlh-gold)] px-6 py-3 text-xs font-black uppercase tracking-wider text-white shadow-lg shadow-[var(--tlh-gold)]/20 hover:shadow-xl transition-all hover:-translate-y-0.5"
          >
            Choose Courses
          </button>
        </div>
      ) : null}

      {feedback ? (
        <div className="rounded-[var(--radius-2xl)] bg-[var(--tlh-blue-primary)]/5 p-5 text-[13px] font-bold text-[var(--tlh-blue-primary)] ring-1 ring-[var(--tlh-blue-primary)]/10 flex justify-between items-center shadow-sm">
          <div className="flex items-center gap-3">
            <span className="text-lg">ℹ️</span>
            <span>{feedback}</span>
          </div>
          <button
            onClick={() => setFeedback("")}
            className="h-8 w-8 flex items-center justify-center rounded-full hover:bg-[var(--tlh-blue-primary)]/10 transition-colors"
          >
            ✕
          </button>
        </div>
      ) : null}

      {/* 1. OVERVIEW */}
      {activeTab === "overview" ? (
        <div className="space-y-10">
          {(!profileForm.preferredCourseIds ||
            profileForm.preferredCourseIds.length === 0) &&
            classes.length === 0 && (
              <div className="rounded-[var(--radius-3xl)] border border-[var(--tlh-blue-primary)]/20 bg-gradient-to-br from-[var(--tlh-blue-primary)]/5 to-white p-8 shadow-[var(--shadow-md)] relative overflow-hidden">
                <div aria-hidden="true" className="absolute -right-10 -top-10 text-8xl opacity-[0.03] select-none">🎯</div>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-8 relative">
                  <div className="space-y-2">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">🚀</span>
                      <h3 className="text-xl font-black text-[var(--text-main)]">
                        Ready to start your journey?
                      </h3>
                    </div>
                    <p className="text-[15px] font-medium text-[var(--text-muted)] leading-relaxed max-w-2xl">
                      Select the courses you want to study right now. Once submitted, 
                      our academic team will match you with the appropriate cohort and schedule.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveTab("courses")}
                    className="golden-btn shrink-0 rounded-full px-8 py-4 text-[13px] font-bold text-white shadow-sm hover:shadow-md transition-all active:scale-95"
                  >
                    Select Courses Now →
                  </button>
                </div>
              </div>
            )}

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard label="My Cohorts" value={classes.length} icon="🏫" />
            <MetricCard
              label="Live Sessions"
              value={upcomingLessons.length}
              icon="📹"
            />
            <MetricCard
              label="Overall Grade"
              value={
                progressData?.overallScore != null
                  ? `${progressData.overallScore}%`
                  : "Pending"
              }
              icon="📈"
            />
            <MetricCard
              label="Attendance"
              value={
                progressData?.components?.find(
                  (component) => component.category === "attendance",
                )?.score != null
                  ? `${progressData.components.find((component) => component.category === "attendance").score}%`
                  : "Pending"
              }
              icon="✅"
            />
          </div>

          <div className="grid gap-8 lg:grid-cols-2">
            <DashboardCard title="My Active Cohorts">
              <div className="space-y-4">
                {classes.length === 0 ? (
                  <EmptyState
                    title="No active cohorts"
                    description="Our team is matching you with a cohort based on your course selection."
                  />
                ) : (
                  classes.map((c) => (
                    <div
                      key={c._id}
                      className="group rounded-[var(--radius-2xl)] border border-[var(--surface-border)]/60 bg-[var(--surface-page)] p-5 transition-all hover:border-[var(--tlh-blue-primary)]/40 hover:bg-white hover:shadow-[var(--shadow-md)]"
                    >
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="font-black text-[var(--text-main)] text-[15px]">{c.title}</h4>
                        <Badge variant="blue">
                          {c.course?.title || "Program"}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3 text-[13px] font-medium text-[var(--text-muted)]">
                        <span className="flex h-8 w-8 items-center justify-center rounded-[var(--radius-lg)] bg-white text-lg shadow-sm">👨‍🏫</span>
                        <div>
                          <p className="text-[var(--text-main)] font-bold">{c.teacher?.fullName || "To be assigned"}</p>
                          <p className="text-[11px] opacity-60">{c.teacher?.email || "Academic Team"}</p>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </DashboardCard>

            <DashboardCard title="Recent Activity">
              <div className="space-y-4">
                {notifications.length === 0 ? (
                  <EmptyState title="No recent activity" />
                ) : (
                  notifications.slice(0, 5).map((n) => (
                    <div
                      key={n._id}
                      className="relative rounded-[var(--radius-xl)] bg-[var(--surface-page)] p-4 text-[13px] border border-[var(--surface-border)]/40 transition-all hover:border-[var(--tlh-blue-primary)]/20"
                    >
                      <p className="font-black text-[var(--text-main)]">{n.title}</p>
                      <p className="mt-1 font-medium text-[var(--text-muted)] leading-relaxed">{n.message}</p>
                      <div className="mt-3 flex items-center justify-between text-[10px] font-black uppercase tracking-wider text-[var(--text-muted)]/50">
                        <span>{new Date(n.createdAt).toLocaleDateString()}</span>
                        <span className="h-1.5 w-1.5 rounded-full bg-[var(--tlh-blue-primary)]/40"></span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </DashboardCard>
          </div>

          {announcements.length > 0 && (
            <div className="rounded-[var(--radius-3xl)] border border-[var(--tlh-blue-primary)]/10 bg-[var(--tlh-blue-primary)]/5 p-8 space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">📢</span>
                  <h3 className="text-xl font-black text-[var(--text-main)]">
                    Academy Announcements
                  </h3>
                </div>
                <Badge variant="blue">{announcements.length} New</Badge>
              </div>
              <div className="grid gap-6 md:grid-cols-2">
                {announcements.slice(0, 4).map((ann) => (
                  <div
                    key={ann._id}
                    className="group rounded-[var(--radius-2xl)] bg-white p-6 shadow-[var(--shadow-sm)] border border-[var(--surface-border)]/60 transition-all hover:shadow-[var(--shadow-md)] hover:border-[var(--tlh-blue-primary)]/20"
                  >
                    <div className="flex items-center justify-between gap-4 mb-3">
                      <h4 className="font-black text-[var(--text-main)] text-[15px] group-hover:text-[var(--tlh-blue-primary)] transition-colors">
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
                    <p className="text-[13px] font-medium text-[var(--text-muted)] leading-relaxed mb-4">
                      {ann.content}
                    </p>
                    <div className="flex items-center justify-between pt-4 border-t border-[var(--surface-border)]/50">
                      <div className="flex items-center gap-2 text-[11px] font-bold text-[var(--text-muted)]">
                        <span>👤</span>
                        <span>{ann.author?.fullName || "Academy Admin"}</span>
                      </div>
                      <span className="text-[11px] font-black text-[var(--text-muted)]/50 uppercase tracking-tighter">
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

      {/* 2. CLASSES */}
      {activeTab === "classes" ? (
        <div className="space-y-8">
          <div className="grid gap-8 md:grid-cols-2">
            {classes.map((cls) => (
              <div
                key={cls._id}
                className="group relative rounded-[var(--radius-3xl)] bg-[var(--surface-card)] p-8 shadow-[var(--shadow-md)] border border-[var(--surface-border)]/60 transition-all hover:shadow-[var(--shadow-xl)] hover:border-[var(--tlh-blue-primary)]/20"
              >
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-4">
                    <div className="flex h-14 w-14 items-center justify-center rounded-[var(--radius-2xl)] bg-[var(--tlh-blue-primary)]/5 text-3xl shadow-sm border border-[var(--tlh-blue-primary)]/10 transition-transform group-hover:scale-110">🏫</div>
                    <div>
                      <h4 className="text-2xl font-black text-[var(--text-main)] group-hover:text-[var(--tlh-blue-primary)] transition-colors">
                        {cls.title}
                      </h4>
                      <p className="text-[13px] font-bold text-[var(--tlh-blue-primary)]">{cls.course?.title || "Academic Program"}</p>
                    </div>
                  </div>
                  <Badge variant="emerald">{cls.status}</Badge>
                </div>
                
                <p className="text-[15px] font-medium text-[var(--text-muted)] leading-relaxed mb-8">
                  {cls.description ||
                    "Live sessions and practical learning with your cohort. Access your curriculum, sessions, and community."}
                </p>
                
                <div className="grid grid-cols-2 gap-4 py-6 border-y border-[var(--surface-border)]/50 mb-8">
                  <div className="space-y-1">
                    <p className="text-[10px] font-black uppercase tracking-[0.15em] text-[var(--text-muted)]/60">Instructor</p>
                    <p className="text-[13px] font-bold text-[var(--text-main)]">{cls.teacher?.fullName || "Not assigned"}</p>
                  </div>
                  <div className="space-y-1 text-right">
                    <p className="text-[10px] font-black uppercase tracking-[0.15em] text-[var(--text-muted)]/60">Time Zone</p>
                    <p className="text-[13px] font-bold text-[var(--text-main)]">{cls.timeZone}</p>
                  </div>
                </div>

                <Link
                  to={`/workspace/${cls._id}`}
                  className="golden-btn flex items-center justify-center gap-3 w-full rounded-full py-4 text-[13px] font-bold text-white shadow-sm hover:shadow-md transition-all active:scale-95"
                >
                  Enter Learning Workspace
                  <span className="text-lg">→</span>
                </Link>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {/* 2b. COURSES SELECTION */}
      {activeTab === "courses" ? (
        <div className="max-w-4xl mx-auto space-y-8">
          <DashboardCard
            title="Design Your Learning Path"
            subtitle="Select the courses you want to study. Our coordinators will review your preferences and assign you to the best cohort."
          >
            <form onSubmit={handleSaveProfile} className="space-y-10">
              <div className="rounded-[var(--radius-2xl)] bg-[var(--tlh-blue-primary)]/5 p-6 border border-[var(--tlh-blue-primary)]/10 flex items-start gap-4">
                <span className="text-2xl">💡</span>
                <div className="text-[13px] text-[var(--text-main)] font-medium leading-relaxed">
                  <strong className="font-black text-[var(--tlh-blue-primary)]">Placement Process:</strong> Pick one or more
                  courses below. Our academic team will match you with the 
                  appropriate cohort, schedule, and instructor.
                </div>
              </div>

              {profileForm.preferredCourseIds.length > 0 ? (
                <div className="rounded-[var(--radius-2xl)] border border-emerald-200/50 bg-emerald-50/30 p-6">
                  <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
                    <h4 className="text-[11px] font-black uppercase tracking-[0.15em] text-emerald-900/60">
                      Current Selection
                    </h4>
                    {profileForm.courseSelectionUpdatedAt ? (
                      <span className="text-[11px] font-bold text-emerald-600/80">
                        Updated {new Date(profileForm.courseSelectionUpdatedAt).toLocaleDateString()}
                      </span>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap gap-3">
                    {profileForm.preferredCourseIds.map((courseId) => {
                      const course = courses.find(
                        (item) => String(item._id) === String(courseId),
                      );
                      return (
                        <span
                          key={courseId}
                          className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-white px-4 py-2 text-[13px] font-black text-emerald-700 shadow-sm"
                        >
                          <span className="text-emerald-400">✓</span>
                          {course?.title || "Program"}
                        </span>
                      );
                    })}
                  </div>
                </div>
              ) : null}

              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <label className="text-[15px] font-black text-[var(--text-main)]">
                    Browse Academic Programs
                  </label>
                  <Badge variant="blue">
                    {profileForm.preferredCourseIds?.length || 0} selected
                  </Badge>
                </div>
                <CategoryCoursePicker
                  courses={courses}
                  selectedCourseIds={profileForm.preferredCourseIds}
                  onChange={(preferredCourseIds) =>
                    setProfileForm({ ...profileForm, preferredCourseIds })
                  }
                />
              </div>

              <div className="border-t border-[var(--surface-border)]/50 pt-10 space-y-8">
                <div className="space-y-2">
                  <h4 className="text-lg font-black text-[var(--text-main)]">
                    Learning Preferences
                  </h4>
                  <p className="text-[13px] font-medium text-[var(--text-muted)]">Customize your experience to help us find the right fit for you.</p>
                </div>

                <div className="grid gap-6 sm:grid-cols-2">
                  <div>
                    <label className="block text-[11px] font-black uppercase tracking-[0.15em] text-[var(--text-muted)] mb-2">
                      {t("skillLevel")}
                    </label>
                    <select
                      value={profileForm.currentSkillLevel}
                      onChange={(e) =>
                        setProfileForm({
                          ...profileForm,
                          currentSkillLevel: e.target.value,
                        })
                      }
                      className="w-full rounded-[var(--radius-xl)] border border-[var(--surface-border)] bg-[var(--surface-page)] px-5 py-4 text-sm font-bold text-[var(--text-main)] outline-none transition-all focus:border-[var(--tlh-blue-primary)] focus:bg-white focus:ring-4 focus:ring-[var(--tlh-blue-primary)]/5"
                    >
                      <option value="Beginner">Beginner</option>
                      <option value="Intermediate">Intermediate</option>
                      <option value="Advanced">Advanced</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-black uppercase tracking-[0.15em] text-[var(--text-muted)] mb-2">
                      Study Commitment (Hours/Week)
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="80"
                      value={profileForm.weeklyStudyHours}
                      onChange={(e) =>
                        setProfileForm({
                          ...profileForm,
                          weeklyStudyHours: e.target.value,
                        })
                      }
                      className="w-full rounded-[var(--radius-xl)] border border-[var(--surface-border)] bg-[var(--surface-page)] px-5 py-4 text-sm font-bold text-[var(--text-main)] outline-none transition-all focus:border-[var(--tlh-blue-primary)] focus:bg-white focus:ring-4 focus:ring-[var(--tlh-blue-primary)]/5"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-black uppercase tracking-[0.15em] text-[var(--text-muted)] mb-3">
                    Preferred Schedule
                  </label>
                  <SchedulePreferenceSelector
                    value={profileForm.preferredSchedule}
                    onChange={(val) =>
                      setProfileForm({ ...profileForm, preferredSchedule: val })
                    }
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-black uppercase tracking-[0.15em] text-[var(--text-muted)] mb-4">
                    Preferred Learning Modes
                  </label>
                  <div className="grid gap-3 sm:grid-cols-3">
                    {LEARNING_MODE_OPTIONS.map((mode) => {
                      const isSelected =
                        profileForm.preferredLearningModes.includes(mode.value);
                      return (
                        <button
                          key={mode.value}
                          type="button"
                          onClick={() =>
                            setProfileForm({
                              ...profileForm,
                              preferredLearningModes: isSelected
                                ? profileForm.preferredLearningModes.filter(
                                    (value) => value !== mode.value,
                                  )
                                : [
                                    ...profileForm.preferredLearningModes,
                                    mode.value,
                                  ],
                            })
                          }
                          className={`flex items-center gap-3 rounded-[var(--radius-xl)] border p-4 text-left transition-all ${
                            isSelected
                              ? "border-[var(--tlh-blue-primary)] bg-[var(--tlh-blue-primary)]/5 ring-4 ring-[var(--tlh-blue-primary)]/10"
                              : "border-[var(--surface-border)] bg-white text-[var(--text-muted)] hover:border-[var(--tlh-blue-primary)]/40 hover:text-[var(--text-main)]"
                          }`}
                        >
                          <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition-all ${isSelected ? "border-[var(--tlh-blue-primary)] bg-[var(--tlh-blue-primary)] text-white" : "border-[var(--surface-border)]"}`}>
                            {isSelected && <span className="text-[10px] font-black">✓</span>}
                          </span>
                          <span className="text-[13px] font-black">{mode.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="grid gap-6 sm:grid-cols-2">
                  <div>
                    <label className="block text-[11px] font-black uppercase tracking-[0.15em] text-[var(--text-muted)] mb-2">
                      Notes for Coordinators
                    </label>
                    <textarea
                      rows={4}
                      maxLength={1200}
                      value={profileForm.preferredCourseNotes}
                      onChange={(e) =>
                        setProfileForm({
                          ...profileForm,
                          preferredCourseNotes: e.target.value,
                        })
                      }
                      className="w-full rounded-[var(--radius-xl)] border border-[var(--surface-border)] bg-[var(--surface-page)] px-5 py-4 text-sm font-semibold text-[var(--text-main)] outline-none transition-all focus:border-[var(--tlh-blue-primary)] focus:bg-white focus:ring-4 focus:ring-[var(--tlh-blue-primary)]/5"
                      placeholder="Share your specific goals or preferred start dates."
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-black uppercase tracking-[0.15em] text-[var(--text-muted)] mb-2">
                      Your Primary Learning Goals
                    </label>
                    <textarea
                      rows={4}
                      value={profileForm.learningGoals}
                      onChange={(e) =>
                        setProfileForm({
                          ...profileForm,
                          learningGoals: e.target.value,
                        })
                      }
                      className="w-full rounded-[var(--radius-xl)] border border-[var(--surface-border)] bg-[var(--surface-page)] px-5 py-4 text-sm font-semibold text-[var(--text-main)] outline-none transition-all focus:border-[var(--tlh-blue-primary)] focus:bg-white focus:ring-4 focus:ring-[var(--tlh-blue-primary)]/5"
                      placeholder="What do you hope to achieve?"
                    />
                  </div>
                </div>
              </div>

              <button
                type="submit"
                className="golden-btn w-full rounded-full py-4 text-[14px] font-bold text-white shadow-sm hover:shadow-md transition-all active:scale-95"
              >
                Save Preferences & Submit Application
              </button>
            </form>
          </DashboardCard>
        </div>
      ) : null}

      {activeTab === "payments" ? (
        <StudentPaymentsPanel courses={courses} />
      ) : null}

      {activeTab === "schedule" ? (
        <DashboardCard
          title="Live class schedule"
          subtitle="Times are shown in your device's local time. You can also compare with the cohort time zone."
        >
          <SessionSchedule sessions={upcomingLessons} />
        </DashboardCard>
      ) : null}

      {/* 3. ASSIGNMENTS */}
      {activeTab === "assignments" ? (
        <div className="space-y-8">
          <div className="grid gap-8 md:grid-cols-2">
            {assignments.length === 0 ? (
              <div className="md:col-span-2">
                <EmptyState title="No assignments yet." />
              </div>
            ) : (
              assignments.map((asgn) => {
                const sub = asgn.submission;
                return (
                  <div
                    key={asgn._id}
                    className="group relative rounded-[var(--radius-3xl)] bg-[var(--surface-card)] p-8 shadow-[var(--shadow-md)] border border-[var(--surface-border)]/60 transition-all hover:shadow-[var(--shadow-xl)] hover:border-[var(--tlh-blue-primary)]/20"
                  >
                    <div className="flex items-center justify-between gap-4 mb-6">
                      <h4 className="text-xl font-black text-[var(--text-main)] group-hover:text-[var(--tlh-blue-primary)] transition-colors">{asgn.title}</h4>
                      <Badge
                        variant={
                          sub
                            ? sub.status === "graded"
                              ? "emerald"
                              : "blue"
                            : "amber"
                        }
                      >
                        {sub
                          ? sub.status === "graded"
                            ? `Score: ${sub.score}/${asgn.maxScore}`
                            : "Review Pending"
                          : "Not Submitted"}
                      </Badge>
                    </div>
                    
                    <p className="text-[15px] font-medium text-[var(--text-muted)] leading-relaxed mb-8">
                      {asgn.instructions}
                    </p>
                    
                    <div className="flex justify-between items-center py-4 border-y border-[var(--surface-border)]/50 mb-8">
                      <div className="space-y-1">
                        <p className="text-[10px] font-black uppercase tracking-[0.15em] text-[var(--text-muted)]/60">Due Date</p>
                        <p className="text-[13px] font-bold text-[var(--text-main)]">{new Date(asgn.dueDate).toLocaleDateString()}</p>
                      </div>
                      <div className="space-y-1 text-right">
                        <p className="text-[10px] font-black uppercase tracking-[0.15em] text-[var(--text-muted)]/60">Max Points</p>
                        <p className="text-[13px] font-bold text-[var(--text-main)]">{asgn.maxScore}</p>
                      </div>
                    </div>

                    {sub?.textResponse && (
                      <div className="mb-6 rounded-[var(--radius-xl)] bg-[var(--surface-page)] p-5 border border-[var(--surface-border)]/60">
                        <p className="text-[11px] font-black uppercase tracking-[0.15em] text-[var(--text-muted)]/60 mb-2">Your Response</p>
                        <p className="text-[13px] font-medium text-[var(--text-main)] whitespace-pre-wrap">{sub.textResponse}</p>
                      </div>
                    )}

                    <div className="space-y-4 mb-8">
                      {sub?.attachments?.length ? (
                        <div className="flex flex-wrap gap-2">
                          {sub.attachments.map((file, fileIndex) => (
                            <span
                              key={file.key || fileIndex}
                              className="inline-flex items-center gap-2 rounded-full border border-[var(--surface-border)] bg-white px-4 py-2 text-[12px] font-bold text-[var(--text-main)] shadow-sm"
                            >
                              📎 {file.filename}
                            </span>
                          ))}
                        </div>
                      ) : null}

                      {sub?.submissionLinks?.length ? (
                        <div className="space-y-2">
                          {sub.submissionLinks.map((link, linkIndex) => (
                            <a
                              key={linkIndex}
                              href={link.url}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[var(--tlh-blue-primary)]/5 text-[12px] font-bold text-[var(--tlh-blue-primary)] hover:bg-[var(--tlh-blue-primary)]/10 transition-colors"
                            >
                              🔗 {link.label || link.url}
                            </a>
                          ))}
                        </div>
                      ) : null}
                    </div>

                    {sub?.feedback && (
                      <div className="mb-8 rounded-[var(--radius-xl)] bg-[var(--tlh-blue-primary)]/5 p-5 border border-[var(--tlh-blue-primary)]/10">
                        <p className="text-[11px] font-black uppercase tracking-[0.15em] text-[var(--tlh-blue-primary)]/60 mb-2">Instructor Feedback</p>
                        <p className="text-[13px] font-bold text-[var(--tlh-navy)]">{sub.feedback}</p>
                      </div>
                    )}

                    {!sub || sub.status !== "graded" ? (
                      <button
                        onClick={() =>
                          setSubmitModal({
                            open: true,
                            assignment: asgn,
                            textResponse: sub?.textResponse || "",
                            links: sub?.submissionLinks?.length
                              ? sub.submissionLinks.map((link) => ({
                                  label: link.label || "",
                                  url: link.url,
                                }))
                              : [{ label: "", url: "" }],
                            files: [],
                          })
                        }
                        className="golden-btn w-full rounded-full py-4 text-[13px] font-bold text-white shadow-sm hover:shadow-md transition-all active:scale-95"
                      >
                        {sub ? "Resubmit Work" : t("submitWork")}
                      </button>
                    ) : null}
                  </div>
                );
              })
            )}
          </div>
        </div>
      ) : null}

      {/* 4. ASSESSMENTS / QUIZZES */}
      {activeTab === "assessments" ? (
        <div className="space-y-8">
          <div className="grid gap-8 md:grid-cols-2">
            {assessments.length === 0 ? (
              <div className="md:col-span-2">
                <EmptyState title="No assessments yet." />
              </div>
            ) : (
              assessments.map((qz) => {
                const att = qz.latestAttempt;
                return (
                  <div
                    key={qz._id}
                    className="group relative rounded-[var(--radius-3xl)] bg-[var(--surface-card)] p-8 shadow-[var(--shadow-md)] border border-[var(--surface-border)]/60 transition-all hover:shadow-[var(--shadow-xl)] hover:border-[var(--tlh-cyan)]/20"
                  >
                    <div className="flex items-center justify-between gap-4 mb-6">
                      <h4 className="text-xl font-black text-[var(--text-main)] group-hover:text-[var(--tlh-cyan)] transition-colors">{qz.title}</h4>
                      {att?.status === "reviewed" ? (
                        <Badge variant={att.passed ? "emerald" : "rose"}>
                          {att.percentage}% ({att.passed ? "Passed" : "Failed"})
                        </Badge>
                      ) : att ? (
                        <Badge variant="amber">Review Pending</Badge>
                      ) : (
                        <Badge variant="cyan">
                          {qz.assessmentType?.replace("_", " ") || "Standard"}
                        </Badge>
                      )}
                    </div>
                    
                    <p className="text-[15px] font-medium text-[var(--text-muted)] leading-relaxed mb-8">
                      {qz.description}
                    </p>
                    
                    <div className="flex justify-between items-center py-4 border-y border-[var(--surface-border)]/50 mb-8 text-[13px] font-bold text-[var(--text-main)]">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">📋</span>
                        <span>{qz.questions?.length || 0} Questions</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-lg">⏱️</span>
                        <span>{qz.timeLimitMinutes} Minutes</span>
                      </div>
                    </div>

                    {att?.status !== "reviewed" && (
                      <button
                        onClick={() => startQuiz(qz)}
                        className="golden-btn w-full rounded-full py-4 text-[13px] font-bold text-white shadow-sm hover:shadow-md transition-all active:scale-95"
                      >
                        {att ? "Resume Assessment" : t("takeAssessment")}
                      </button>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      ) : null}

      {/* 5. RESOURCES */}
      {activeTab === "resources" ? (
        <div className="space-y-8">
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {resources.length === 0 ? (
              <div className="sm:col-span-2 lg:col-span-3">
                <EmptyState title="No learning resources available." />
              </div>
            ) : (
              resources.map((res) => (
                <div
                  key={res._id}
                  className="group relative rounded-[var(--radius-2xl)] bg-[var(--surface-card)] p-6 shadow-[var(--shadow-sm)] border border-[var(--surface-border)]/60 transition-all hover:shadow-[var(--shadow-md)] hover:border-[var(--tlh-blue-primary)]/20 flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <Badge variant="indigo">{res.category}</Badge>
                      <span className="text-[11px] font-black text-[var(--text-muted)]/40 uppercase">{(res.fileSize / 1024).toFixed(1)} KB</span>
                    </div>
                    <h4 className="text-lg font-black text-[var(--text-main)] group-hover:text-[var(--tlh-blue-primary)] transition-colors mb-2">
                      {res.title}
                    </h4>
                    <p className="text-[13px] font-medium text-[var(--text-muted)] leading-relaxed line-clamp-2">
                      {res.description}
                    </p>
                  </div>
                  <div className="mt-6 pt-5 border-t border-[var(--surface-border)]/50">
                    {res.classroom?._id || res.classroom || classrooms[0]?._id ? (
                      <Link
                        to={`/workspace/${res.classroom?._id || res.classroom || classrooms[0]?._id}?resourceId=${res._id}`}
                        className="flex items-center justify-center gap-2 w-full rounded-xl bg-[var(--surface-page)] py-3 text-[12px] font-black text-[var(--tlh-blue-primary)] border border-[var(--surface-border)]/60 transition-all hover:bg-[var(--tlh-blue-primary)] hover:text-white hover:border-transparent"
                      >
                        Open Workspace →
                      </Link>
                    ) : (
                      <div className="text-center text-[12px] font-bold text-[var(--text-muted)]/50">View only access</div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      ) : null}

      {/* 6. TEACHER-PUBLISHED PROGRESS & ATTENDANCE */}
      {activeTab === "progress" ? (
        <div className="space-y-10">
          {progressReports.length === 0 ? (
            <DashboardCard title="Progress Reports">
              <EmptyState
                title="No reports published yet"
                description="Your academic performance and feedback will appear here once released by your teacher."
              />
            </DashboardCard>
          ) : (
            progressReports.map((report) => (
              <DashboardCard
                key={report._id}
                title={`${report.classroom?.title || "Cohort"} · ${report.period}`}
                subtitle={`Released by ${report.teacher?.fullName || "Instructor"}${report.publishedAt ? ` on ${new Date(report.publishedAt).toLocaleDateString()}` : ""}`}
              >
                <div className="space-y-8">
                  <div className="rounded-[var(--radius-2xl)] bg-gradient-to-br from-[var(--tlh-blue-primary)]/5 to-white p-8 border border-[var(--tlh-blue-primary)]/10">
                    <p className="text-[11px] font-black uppercase tracking-[0.2em] text-[var(--tlh-blue-primary)]/60 mb-2">Overall Performance</p>
                    <div className="flex items-baseline gap-2">
                      <span className="text-5xl font-black text-[var(--text-main)] tracking-tighter">
                        {report.overallScore}%
                      </span>
                      <span className="text-sm font-bold text-[var(--tlh-blue-primary)] uppercase">Success Rate</span>
                    </div>
                  </div>

                  {report.components?.length ? (
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      {report.components.map((component) => (
                        <div
                          key={component._id}
                          className="rounded-[var(--radius-xl)] border border-[var(--surface-border)]/60 bg-[var(--surface-page)] p-5 transition-all hover:border-[var(--tlh-blue-primary)]/20"
                        >
                          <p className="text-[11px] font-black uppercase tracking-wider text-[var(--text-muted)]/60 mb-3">
                            {component.title}
                          </p>
                          <div className="flex items-baseline gap-1 mb-2">
                            <span className="text-2xl font-black text-[var(--text-main)]">{component.score}</span>
                            <span className="text-sm font-bold text-[var(--text-muted)]/50">/ {component.maxScore}</span>
                          </div>
                          {component.feedback ? (
                            <p className="text-[12px] font-medium text-[var(--text-muted)] leading-relaxed italic border-t border-[var(--surface-border)]/50 pt-3 mt-3">
                              "{component.feedback}"
                            </p>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  ) : null}

                  <div className="grid gap-8 lg:grid-cols-2">
                    {report.selfAssessment && (
                      <div className="space-y-3">
                        <h4 className="text-[11px] font-black uppercase tracking-[0.2em] text-[var(--text-main)]">Self-Assessment Summary</h4>
                        <div className="rounded-[var(--radius-xl)] bg-white p-6 border border-[var(--surface-border)]/60 text-[14px] font-medium text-[var(--text-muted)] leading-relaxed shadow-sm">
                          {report.selfAssessment}
                        </div>
                      </div>
                    )}
                    {report.feedback && (
                      <div className="space-y-3">
                        <h4 className="text-[11px] font-black uppercase tracking-[0.2em] text-[var(--tlh-blue-primary)]">Instructor Commentary</h4>
                        <div className="rounded-[var(--radius-xl)] bg-[var(--tlh-blue-primary)]/5 p-6 border border-[var(--tlh-blue-primary)]/10 text-[14px] font-bold text-[var(--tlh-navy)] leading-relaxed shadow-sm">
                          {report.feedback}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </DashboardCard>
            ))
          )}

          <DashboardCard
            title="Attendance Analytics"
            subtitle="Track your participation and engagement across all active learning cohorts."
          >
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-5 mb-10">
              <MetricCard
                label="Average Rate"
                value={`${attendanceSummary?.attendanceRate ?? 0}%`}
                icon="📊"
              />
              <MetricCard label="Present" value={attendanceSummary?.present ?? 0} icon="✅" />
              <MetricCard label="Late" value={attendanceSummary?.late ?? 0} icon="🕒" />
              <MetricCard label="Absent" value={attendanceSummary?.absent ?? 0} icon="❌" />
              <MetricCard
                label="Excused"
                value={attendanceSummary?.excused ?? 0}
                icon="📝"
              />
            </div>

            {attendanceClasses.length > 0 ? (
              <div className="rounded-[var(--radius-2xl)] border border-[var(--surface-border)]/60 overflow-hidden bg-[var(--surface-page)]/30">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[600px] text-left">
                    <thead>
                      <tr className="border-b border-[var(--surface-border)]/60 bg-[var(--surface-page)]/50">
                        <th className="py-4 px-6 text-[11px] font-black uppercase tracking-wider text-[var(--text-muted)]">Cohort Program</th>
                        <th className="py-4 px-6 text-[11px] font-black uppercase tracking-wider text-[var(--text-muted)] text-center">Sessions</th>
                        <th className="py-4 px-6 text-[11px] font-black uppercase tracking-wider text-[var(--text-muted)] text-center">Present</th>
                        <th className="py-4 px-6 text-[11px] font-black uppercase tracking-wider text-[var(--text-muted)] text-center">Late</th>
                        <th className="py-4 px-6 text-[11px] font-black uppercase tracking-wider text-[var(--text-muted)] text-center">Absent</th>
                        <th className="py-4 px-6 text-[11px] font-black uppercase tracking-wider text-[var(--text-muted)] text-right">Success Rate</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--surface-border)]/40">
                      {attendanceClasses.map((row) => (
                        <tr key={row.classroom?._id} className="hover:bg-white transition-colors group">
                          <td className="py-5 px-6">
                            <p className="text-[14px] font-black text-[var(--text-main)] group-hover:text-[var(--tlh-blue-primary)] transition-colors">
                              {row.classroom?.courseTitle || row.classroom?.title}
                            </p>
                            <p className="text-[11px] font-bold text-[var(--text-muted)]/50 mt-0.5 uppercase tracking-tighter">
                              {row.classroom?.title}
                            </p>
                          </td>
                          <td className="py-5 px-6 text-center text-[13px] font-bold text-[var(--text-muted)]">
                            {row.sessionsHeld ?? 0}
                          </td>
                          <td className="py-5 px-6 text-center">
                            <span className="inline-flex items-center justify-center w-10 h-8 rounded-lg bg-emerald-50 text-emerald-700 text-[13px] font-black">
                              {row.present ?? 0}
                            </span>
                          </td>
                          <td className="py-5 px-6 text-center">
                            <span className="inline-flex items-center justify-center w-10 h-8 rounded-lg bg-amber-50 text-amber-700 text-[13px] font-black">
                              {row.late ?? 0}
                            </span>
                          </td>
                          <td className="py-5 px-6 text-center">
                            <span className="inline-flex items-center justify-center w-10 h-8 rounded-lg bg-rose-50 text-rose-700 text-[13px] font-black">
                              {row.absent ?? 0}
                            </span>
                          </td>
                          <td className="py-5 px-6 text-right">
                            <div className="flex flex-col items-end">
                              <span className="text-[15px] font-black text-[var(--text-main)]">{row.attendanceRate ?? 0}%</span>
                              <div className="w-20 h-1.5 bg-[var(--surface-border)]/40 rounded-full mt-2 overflow-hidden">
                                <div 
                                  className="h-full bg-gradient-to-r from-[var(--tlh-blue-primary)] to-[var(--tlh-sky)] rounded-full transition-all duration-1000"
                                  style={{ width: `${row.attendanceRate ?? 0}%` }}
                                />
                              </div>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}

            <div className="mt-12">
              <div className="flex items-center gap-3 mb-6">
                <div className="h-px flex-1 bg-[var(--surface-border)]/50" />
                <h4 className="text-[11px] font-black uppercase tracking-[0.25em] text-[var(--text-muted)]/60">
                  Recent Participation Log
                </h4>
                <div className="h-px flex-1 bg-[var(--surface-border)]/50" />
              </div>
              <div className="grid gap-4">
                {attendanceRecords.length === 0 ? (
                  <EmptyState title="No participation records found." />
                ) : (
                  attendanceRecords.slice(0, 10).map((rec) => (
                    <div
                      key={rec._id}
                      className="group flex justify-between items-center p-4 rounded-[var(--radius-xl)] border border-[var(--surface-border)]/40 bg-[var(--surface-page)]/30 hover:bg-white hover:shadow-sm transition-all"
                    >
                      <div className="flex items-center gap-4">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white border border-[var(--surface-border)]/60 text-lg shadow-sm">🗓️</div>
                        <div>
                          <p className="text-[14px] font-black text-[var(--text-main)] group-hover:text-[var(--tlh-blue-primary)] transition-colors">
                            {rec.session?.title || "Class Session"}
                          </p>
                          <p className="text-[11px] font-bold text-[var(--text-muted)]/50 uppercase tracking-tighter mt-0.5">
                            {rec.classroom?.title ? `${rec.classroom.title} · ` : ""}
                            {new Date(rec.session?.startsAt || rec.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <Badge
                        variant={
                          rec.status === "present"
                            ? "emerald"
                            : rec.status === "absent"
                              ? "rose"
                              : "amber"
                        }
                      >
                        {t(rec.status)}
                      </Badge>
                    </div>
                  ))
                )}
              </div>
            </div>
          </DashboardCard>
        </div>
      ) : null}

      {activeTab === "results" ? (
        <div className="space-y-6">
          <DashboardCard
            title="Published results"
            subtitle="Results released by your teachers for this account."
          >
            {resultAttempts.length === 0 && progressReports.length === 0 ? (
              <EmptyState
                title="No results published yet."
                description="Assessment and exam results appear here once your teacher reviews and publishes them."
              />
            ) : (
              <div className="space-y-4">
                {resultAttempts.map((attempt) => (
                  <div
                    key={attempt._id}
                    className="rounded-2xl border border-slate-200 p-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <h4 className="font-bold text-slate-900">
                          {attempt.assessment?.title || "Assessment"}
                        </h4>
                        <p className="text-xs text-slate-500">
                          {attempt.classroom?.title || "Cohort"} ·{" "}
                          {attempt.assessment?.assessmentType || "Assessment"}
                        </p>
                      </div>
                      <span className="rounded-xl bg-blue-50 px-3 py-1 text-sm font-black text-[var(--tlh-blue-hover)]">
                        {attempt.score ?? 0}/{attempt.maxScore ?? 100}
                      </span>
                    </div>
                    {attempt.feedback ? (
                      <p className="mt-2 text-xs text-slate-600">
                        Feedback: {attempt.feedback}
                      </p>
                    ) : null}
                  </div>
                ))}
                {progressReports.map((report) => (
                  <div
                    key={report._id}
                    className="rounded-2xl border border-slate-200 p-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <h4 className="font-bold text-slate-900">
                          Progress report · {report.classroom?.title || "Cohort"}
                        </h4>
                        <p className="text-xs text-slate-500">
                          Period: {report.period} ·{" "}
                          {report.teacher?.fullName || "Teacher"}
                        </p>
                      </div>
                      <span className="rounded-xl bg-emerald-50 px-3 py-1 text-sm font-black text-emerald-700">
                        {report.overallScore}%
                      </span>
                    </div>
                    {report.components?.length ? (
                      <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                        {report.components.map((component) => (
                          <div
                            key={component._id}
                            className="rounded-xl bg-slate-50 p-2.5 text-xs"
                          >
                            <span className="font-bold text-slate-700">
                              {component.title}
                            </span>
                            <span className="ml-2 text-slate-600">
                              {component.score}/{component.maxScore}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </DashboardCard>
        </div>
      ) : null}

      {/* 7. PROFILE & PREFERENCES */}
      {activeTab === "profile" ? (
        <div className="max-w-xl mx-auto">
          <DashboardCard
            title="Personal profile"
            subtitle="Keep your contact information and profile photo current."
          >
            <form onSubmit={handleSavePersonalProfile} className="space-y-4">
              <ProfilePhotoField
                value={personalForm.avatarUrl}
                onChange={(avatarUrl) =>
                  setPersonalForm({ ...personalForm, avatarUrl })
                }
              />
              <label className="block text-xs font-bold text-slate-700">
                Full name
                <input
                  required
                  minLength={2}
                  maxLength={100}
                  value={personalForm.fullName}
                  onChange={(event) =>
                    setPersonalForm({
                      ...personalForm,
                      fullName: event.target.value,
                    })
                  }
                  className="mt-1 w-full rounded-xl border border-slate-200 p-2 text-sm"
                />
              </label>
              <label className="block text-xs font-bold text-slate-700">
                Phone number
                <input
                  type="tel"
                  maxLength={30}
                  value={personalForm.phone}
                  onChange={(event) =>
                    setPersonalForm({
                      ...personalForm,
                      phone: event.target.value,
                    })
                  }
                  className="mt-1 w-full rounded-xl border border-slate-200 p-2 text-sm"
                />
              </label>
              <label className="block text-xs font-bold text-slate-700">
                About me
                <textarea
                  rows={3}
                  maxLength={500}
                  value={personalForm.bio}
                  onChange={(event) =>
                    setPersonalForm({
                      ...personalForm,
                      bio: event.target.value,
                    })
                  }
                  className="mt-1 w-full rounded-xl border border-slate-200 p-2 text-sm"
                />
              </label>
              <p className="text-xs text-slate-500">
                Email: {user.email} (used for sign-in; contact support to change
                it)
              </p>
              <button
                type="submit"
                className="w-full rounded-xl bg-[var(--tlh-blue-primary)] py-2.5 text-xs font-bold text-white hover:bg-[var(--tlh-blue-hover)]"
              >
                Save personal profile
              </button>
            </form>
          </DashboardCard>
          <div className="mt-6">
            <DashboardCard title="Learning goals and preferences">
              <form onSubmit={handleSaveProfile} className="space-y-4">
                <div className="rounded-xl bg-amber-50 p-3 text-xs text-amber-900 border border-amber-200">
                  💡 <strong>Note:</strong>Updating your preferences does not
                  automatically change your cohort. Our team will review your
                  goals and follow up if a change is needed.
                </div>

                <div>
                  <p className="text-xs font-bold text-slate-700">
                    Courses by category
                  </p>
                  <CategoryCoursePicker
                    courses={courses}
                    selectedCourseIds={profileForm.preferredCourseIds}
                    onChange={(preferredCourseIds) =>
                      setProfileForm({ ...profileForm, preferredCourseIds })
                    }
                  />
                  <p className="mt-1 text-[11px] text-slate-500">
                    Digital Marketing is listed first. Choose one or more; the
                    team will use these when reviewing your placement.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700">
                    {t("learningInterests")} (comma-separated)
                  </label>
                  <input
                    value={profileForm.learningInterests.join(", ")}
                    onChange={(e) =>
                      setProfileForm({
                        ...profileForm,
                        learningInterests: e.target.value
                          .split(",")
                          .map((interest) => interest.trim())
                          .filter(Boolean),
                      })
                    }
                    className="mt-1 w-full rounded-xl border border-slate-200 p-2 text-sm outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700">
                    {t("skillLevel")}
                  </label>
                  <select
                    value={profileForm.currentSkillLevel}
                    onChange={(e) =>
                      setProfileForm({
                        ...profileForm,
                        currentSkillLevel: e.target.value,
                      })
                    }
                    className="mt-1 w-full rounded-xl border border-slate-200 p-2 text-xs outline-none bg-white"
                  >
                    <option value="Beginner">Beginner</option>
                    <option value="Intermediate">Intermediate</option>
                    <option value="Advanced">Advanced</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    {t("preferredSchedule")}
                  </label>
                  <SchedulePreferenceSelector
                    value={profileForm.preferredSchedule}
                    onChange={(val) =>
                      setProfileForm({ ...profileForm, preferredSchedule: val })
                    }
                  />
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block text-xs font-bold text-slate-700">
                    Hours available per week
                    <input
                      required
                      type="number"
                      min="1"
                      max="80"
                      value={profileForm.weeklyStudyHours}
                      onChange={(e) =>
                        setProfileForm({
                          ...profileForm,
                          weeklyStudyHours: e.target.value,
                        })
                      }
                      className="mt-1 w-full rounded-xl border border-slate-200 p-2 text-sm outline-none"
                    />
                  </label>
                  <label className="block text-xs font-bold text-slate-700">
                    Time zone
                    <select
                      required
                      value={profileForm.timeZone}
                      onChange={(e) =>
                        setProfileForm({
                          ...profileForm,
                          timeZone: e.target.value,
                        })
                      }
                      className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-2 text-sm outline-none"
                    >
                      {TIME_ZONES.map((tz) => (
                        <option key={tz.value} value={tz.value}>
                          {tz.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700">
                    {t("learningGoals")}
                  </label>
                  <textarea
                    rows={3}
                    value={profileForm.learningGoals}
                    onChange={(e) =>
                      setProfileForm({
                        ...profileForm,
                        learningGoals: e.target.value,
                      })
                    }
                    className="mt-1 w-full rounded-xl border border-slate-200 p-2 text-sm outline-none"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full rounded-xl bg-[var(--tlh-blue-primary)] py-2.5 text-xs font-bold text-white hover:bg-[var(--tlh-blue-hover)]"
                >
                  Save preferences
                </button>
              </form>
            </DashboardCard>
          </div>
        </div>
      ) : null}

      {activeTab === "settings" ? (
        <DashboardSettings
          user={user}
          sessions={upcomingLessons}
          onNavigateTab={(tab) => setActiveTab(tab)}
        />
      ) : null}

      {/* 8. CERTIFICATES */}
      {activeTab === "certificates" ? (
        <div className="space-y-8">
          <DashboardCard title="Your Verified Credentials">
            {certificates.length === 0 ? (
              <div className="space-y-6">
                <EmptyState
                  title="No certificates issued yet."
                  description="Certificates are issued by the academy. Once your teacher publishes your reviewed results, the administration verifies them and issues your certificate here automatically."
                />
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {attendanceClasses.map((row) => (
                    <div
                      key={row.classroom?._id}
                      className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                    >
                      <h4 className="font-bold text-slate-900">
                        {row.classroom?.courseTitle || row.classroom?.title}
                      </h4>
                      <p className="mt-1 text-xs text-slate-500">
                        Cohort: {row.classroom?.title}
                      </p>
                      <p className="mt-2 inline-flex rounded-lg bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-700">
                        Awaiting academy issuance
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="grid gap-6 md:grid-cols-2">
                {certificates.map((cert) => (
                  <div
                    key={cert._id}
                    className={`rounded-3xl border p-6 shadow-sm space-y-4 ${
                      cert.status === "revoked"
                        ? "border-rose-300 bg-rose-50/50"
                        : "border-amber-300 bg-amber-50/50"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span
                        className={`rounded-lg px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white ${
                          cert.status === "revoked"
                            ? "bg-rose-600"
                            : "bg-gradient-to-r from-[var(--tlh-blue-primary)] to-[var(--tlh-sky)]"
                        }`}
                      >
                        {cert.status === "revoked"
                          ? "Revoked"
                          : "Verified Credential"}
                      </span>
                      <span className="font-mono text-xs font-bold text-slate-600">
                        {cert.certificateNumber}
                      </span>
                    </div>
                    <h3 className="text-lg font-black text-slate-900">
                      {cert.courseTitle}
                    </h3>
                    <div className="text-xs text-slate-600 space-y-1">
                      <p>
                        Issued to: <strong>{cert.studentName}</strong>
                      </p>
                      <p>
                        Date: {new Date(cert.issueDate).toLocaleDateString()}
                      </p>
                      <p>
                        Overall Grade:{" "}
                        <strong className="text-[var(--tlh-blue-primary)]">
                          {cert.overallScore}%
                        </strong>
                      </p>
                      <p>
                        Signed by:{" "}
                        <strong>
                          {cert.signatureName || cert.instructorName}
                        </strong>
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          if (!printCertificate(cert)) {
                            window.open(
                              `/verify-certificate/${cert.certificateNumber}`,
                              "_blank",
                            );
                          }
                        }}
                        className="flex-1 rounded-xl bg-slate-900 py-2.5 text-center text-xs font-bold text-white hover:bg-slate-800 transition"
                      >
                        🖨️ Print
                      </button>
                      <button
                        type="button"
                        onClick={() => downloadCertificate(cert)}
                        className="flex-1 rounded-xl border border-slate-300 bg-white py-2.5 text-center text-xs font-bold text-slate-800 hover:bg-slate-50 transition"
                      >
                        ⬇️ Download
                      </button>
                    </div>
                    <Link
                      to={`/verify-certificate/${cert.certificateNumber}`}
                      target="_blank"
                      className="block text-center text-[11px] font-bold text-[var(--tlh-blue-primary)] hover:underline"
                    >
                      Open public verification page ↗
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </DashboardCard>
        </div>
      ) : null}

      {/* 9. ACCOUNT SECURITY */}
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

      {/* MODAL: Submit Assignment */}
      <Modal
        title={`Submit assignment: ${submitModal.assignment?.title || ""}`}
        isOpen={submitModal.open}
        onClose={() =>
          setSubmitModal({
            open: false,
            assignment: null,
            textResponse: "",
            links: [{ label: "", url: "" }],
            files: [],
          })
        }
      >
        <form onSubmit={handleSubmitAssignment} className="space-y-4">
          <p className="text-xs text-slate-600 leading-relaxed">
            {submitModal.assignment?.instructions}
          </p>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Your response
            </label>
            <textarea
              rows={4}
              value={submitModal.textResponse}
              onChange={(e) =>
                setSubmitModal({ ...submitModal, textResponse: e.target.value })
              }
              className="w-full rounded-xl border border-slate-200 p-3 text-sm outline-none"
              placeholder="Write your response…"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-bold text-slate-700">
                Links
              </label>
              <button
                type="button"
                onClick={() =>
                  setSubmitModal((prev) => ({
                    ...prev,
                    links: [...prev.links, { label: "", url: "" }],
                  }))
                }
                className="text-[11px] font-bold text-[var(--tlh-blue-primary)] hover:text-[var(--tlh-blue-hover)]"
              >
                + Add link
              </button>
            </div>
            <div className="space-y-2">
              {submitModal.links.map((link, index) => (
                <div key={index} className="flex gap-2">
                  <input
                    value={link.label}
                    onChange={(e) =>
                      setSubmitModal((prev) => ({
                        ...prev,
                        links: prev.links.map((item, i) =>
                          i === index
                            ? { ...item, label: e.target.value }
                            : item,
                        ),
                      }))
                    }
                    className="w-1/3 rounded-xl border border-slate-200 p-2 text-xs outline-none"
                    placeholder="Label"
                  />
                  <input
                    value={link.url}
                    onChange={(e) =>
                      setSubmitModal((prev) => ({
                        ...prev,
                        links: prev.links.map((item, i) =>
                          i === index ? { ...item, url: e.target.value } : item,
                        ),
                      }))
                    }
                    className="flex-1 rounded-xl border border-slate-200 p-2 text-xs outline-none"
                    placeholder="https://…"
                  />
                  {submitModal.links.length > 1 ? (
                    <button
                      type="button"
                      onClick={() =>
                        setSubmitModal((prev) => ({
                          ...prev,
                          links: prev.links.filter((_, i) => i !== index),
                        }))
                      }
                      className="rounded-xl border border-slate-200 px-3 text-xs font-bold text-slate-400 hover:text-rose-600"
                    >
                      ×
                    </button>
                  ) : null}
                </div>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Files
            </label>
            <input
              key={submitModal.open ? "open" : "closed"}
              type="file"
              multiple
              accept={SUBMISSION_FILE_TYPES}
              onChange={(e) =>
                setSubmitModal((prev) => ({ ...prev, files: e.target.files }))
              }
              className="w-full rounded-xl border border-dashed border-slate-300 p-2.5 text-xs text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-blue-50 file:px-3 file:py-1.5 file:text-xs file:font-bold file:text-[var(--tlh-blue-hover)]"
            />
            {submitModal.files?.length ? (
              <ul className="mt-2 space-y-1">
                {Array.from(submitModal.files).map((file, index) => (
                  <li
                    key={index}
                    className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-1.5 text-[11px] text-slate-600"
                  >
                    <span className="truncate">📎 {file.name}</span>
                    <span className="ml-2 shrink-0 text-slate-400">
                      {(file.size / (1024 * 1024)).toFixed(1)} MB
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}
            <p className="mt-1 text-[11px] text-slate-400">
              PDF, PPT, DOC, images, or video. Up to 30MB per file, 60MB total.
            </p>
          </div>

          <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-[11px] text-amber-900">
            Add a response, a link, or a file—at least one is required. Your
            teacher reviews every submission and releases the result.
          </div>

          <button
            type="submit"
            disabled={submitBusy}
            className="w-full rounded-xl bg-[var(--tlh-blue-primary)] py-2.5 text-xs font-bold text-white hover:bg-[var(--tlh-blue-hover)] disabled:opacity-60"
          >
            {submitBusy ? "Submitting…" : t("submitWork")}
          </button>
        </form>
      </Modal>

      {/* MODAL: Take Quiz */}
      <Modal
        title={`Assessment: ${quizModal.assessment?.title || ""}`}
        isOpen={quizModal.open}
        onClose={() =>
          setQuizModal({
            open: false,
            assessment: null,
            answers: {},
            responseText: "",
            links: [{ label: "", url: "" }],
            files: [],
            result: null,
          })
        }
      >
        {quizModal.result ? (
          <div className="space-y-4 text-center py-4">
            {quizModal.result.status === "reviewed" ? (
              <>
                <div
                  className={`mx-auto flex h-16 w-16 items-center justify-center rounded-full text-3xl ${quizModal.result.passed ? "bg-sky-100 text-[var(--tlh-blue-hover)]" : "bg-rose-100 text-rose-600"}`}
                >
                  {quizModal.result.passed ? "✓" : "!"}
                </div>
                <h3 className="text-xl font-bold text-slate-900">
                  Score: {quizModal.result.score} / {quizModal.result.maxScore}{" "}
                  ({quizModal.result.percentage}%)
                </h3>
                <p className="text-sm font-semibold text-slate-600">
                  {quizModal.result.passed
                    ? "Well done—you passed!"
                    : "You did not reach the passing score this time. Review your work and try again."}
                </p>
                {quizModal.result.feedback ? (
                  <p className="rounded-xl bg-slate-50 p-3 text-xs text-slate-600">
                    {quizModal.result.feedback}
                  </p>
                ) : null}
              </>
            ) : (
              <>
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-sky-100 text-3xl text-[var(--tlh-blue-hover)]">
                  ⏳
                </div>
                <h3 className="text-xl font-bold text-slate-900">
                  Submitted for review
                </h3>
                <p className="text-sm font-semibold text-slate-600">
                  Your teacher will review your work and release your result.
                </p>
              </>
            )}
            <button
              onClick={() =>
                setQuizModal({
                  open: false,
                  assessment: null,
                  answers: {},
                  responseText: "",
                  links: [{ label: "", url: "" }],
                  files: [],
                  result: null,
                })
              }
              className="rounded-xl bg-slate-900 px-6 py-2.5 text-xs font-bold text-white"
            >
              Done
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex justify-between items-center text-xs text-slate-500 border-b border-slate-100 pb-2">
              <span>
                Time limit: {quizModal.assessment?.timeLimitMinutes} min
              </span>
              <span>
                Passing score: {quizModal.assessment?.passingScorePercentage}%
              </span>
            </div>

            <div className="space-y-6 max-h-[60vh] overflow-y-auto pr-1">
              {quizModal.assessment?.instructions ? (
                <p className="text-xs text-slate-600 leading-relaxed">
                  {quizModal.assessment.instructions}
                </p>
              ) : null}

              {quizModal.assessment?.questions?.map((q, idx) => (
                <div
                  key={q._id}
                  className="space-y-3 rounded-2xl border border-slate-200 p-4"
                >
                  <p className="font-bold text-sm text-slate-900">
                    {idx + 1}. {q.prompt}
                  </p>
                  <div className="space-y-2">
                    {q.options?.map((opt, optIdx) => {
                      const isSelected = quizModal.answers[q._id] === optIdx;
                      return (
                        <button
                          key={optIdx}
                          type="button"
                          onClick={() =>
                            setQuizModal((prev) => ({
                              ...prev,
                              answers: { ...prev.answers, [q._id]: optIdx },
                            }))
                          }
                          className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left text-xs font-semibold transition-colors ${
                            isSelected
                              ? "border-[var(--tlh-blue-primary)] bg-blue-50 text-[var(--tlh-navy-deep)] ring-1 ring-[var(--tlh-blue-primary)]"
                              : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                          }`}
                        >
                          <span
                            className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${isSelected ? "bg-[var(--tlh-blue-primary)] text-white" : "border border-slate-300"}`}
                          >
                            {String.fromCharCode(65 + optIdx)}
                          </span>
                          <span>{opt}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Written response
                </label>
                <textarea
                  rows={3}
                  value={quizModal.responseText}
                  onChange={(e) =>
                    setQuizModal((prev) => ({
                      ...prev,
                      responseText: e.target.value,
                    }))
                  }
                  className="w-full rounded-xl border border-slate-200 p-3 text-sm outline-none"
                  placeholder="Add any written work or explanation…"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold text-slate-700">
                    Links
                  </label>
                  <button
                    type="button"
                    onClick={() =>
                      setQuizModal((prev) => ({
                        ...prev,
                        links: [...prev.links, { label: "", url: "" }],
                      }))
                    }
                    className="text-[11px] font-bold text-[var(--tlh-blue-primary)] hover:text-[var(--tlh-blue-hover)]"
                  >
                    + Add link
                  </button>
                </div>
                <div className="space-y-2">
                  {quizModal.links.map((link, index) => (
                    <div key={index} className="flex gap-2">
                      <input
                        value={link.label}
                        onChange={(e) =>
                          setQuizModal((prev) => ({
                            ...prev,
                            links: prev.links.map((item, i) =>
                              i === index
                                ? { ...item, label: e.target.value }
                                : item,
                            ),
                          }))
                        }
                        className="w-1/3 rounded-xl border border-slate-200 p-2 text-xs outline-none"
                        placeholder="Label"
                      />
                      <input
                        value={link.url}
                        onChange={(e) =>
                          setQuizModal((prev) => ({
                            ...prev,
                            links: prev.links.map((item, i) =>
                              i === index
                                ? { ...item, url: e.target.value }
                                : item,
                            ),
                          }))
                        }
                        className="flex-1 rounded-xl border border-slate-200 p-2 text-xs outline-none"
                        placeholder="https://…"
                      />
                      {quizModal.links.length > 1 ? (
                        <button
                          type="button"
                          onClick={() =>
                            setQuizModal((prev) => ({
                              ...prev,
                              links: prev.links.filter((_, i) => i !== index),
                            }))
                          }
                          className="rounded-xl border border-slate-200 px-3 text-xs font-bold text-slate-400 hover:text-rose-600"
                        >
                          ×
                        </button>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Files
                </label>
                <input
                  key={quizModal.open ? "open" : "closed"}
                  type="file"
                  multiple
                  accept={SUBMISSION_FILE_TYPES}
                  onChange={(e) =>
                    setQuizModal((prev) => ({ ...prev, files: e.target.files }))
                  }
                  className="w-full rounded-xl border border-dashed border-slate-300 p-2.5 text-xs text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-blue-50 file:px-3 file:py-1.5 file:text-xs file:font-bold file:text-[var(--tlh-blue-hover)]"
                />
                {quizModal.files?.length ? (
                  <ul className="mt-2 space-y-1">
                    {Array.from(quizModal.files).map((file, index) => (
                      <li
                        key={index}
                        className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-1.5 text-[11px] text-slate-600"
                      >
                        <span className="truncate">📎 {file.name}</span>
                        <span className="ml-2 shrink-0 text-slate-400">
                          {(file.size / (1024 * 1024)).toFixed(1)} MB
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : null}
                <p className="mt-1 text-[11px] text-slate-400">
                  PDF, PPT, DOC, images, or video. Up to 30MB per file, 60MB
                  total.
                </p>
              </div>

              <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-[11px] text-amber-900">
                Your teacher reviews every assessment and releases the final
                result.
              </div>
            </div>

            <button
              onClick={handleSubmitQuiz}
              disabled={quizBusy}
              className="w-full rounded-xl bg-[var(--tlh-cyan)] py-3 text-xs font-bold text-white hover:bg-cyan-700 shadow-sm disabled:opacity-60"
            >
              {quizBusy ? "Submitting…" : t("submitAnswers")}
            </button>
          </div>
        )}
      </Modal>
    </div>
  );
}
