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
    <div className="min-h-screen space-y-8 px-4 py-6 sm:px-6 lg:pl-72 lg:pr-8">
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
        <div className="rounded-3xl bg-gradient-to-r from-blue-900 via-slate-900 to-cyan-950 p-6 sm:p-8 text-white shadow-xl flex flex-wrap items-center justify-between gap-6 border border-cyan-500/30">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-2 rounded-full bg-cyan-500/20 px-3 py-1 text-xs font-bold text-cyan-300 border border-cyan-500/30">
              <span className="h-2 w-2 rounded-full bg-cyan-400 animate-ping"></span>
              <span>Next live session</span>
            </div>
            <h2 className="text-2xl font-black text-white">
              {nextSession.title}
            </h2>
            <div className="flex flex-wrap items-center gap-4 text-xs text-slate-300">
              <p>
                📅 {formatSessionTime(nextSession.startsAt)} —{" "}
                {formatSessionTime(nextSession.endsAt)}
              </p>
              <span className="text-amber-300 font-medium">
                🔒 Meeting link activates 10 minutes prior
              </span>
            </div>
          </div>
          {nextSession.meetingUrl ? (
            <LiveSessionButton session={nextSession} />
          ) : null}
        </div>
      ) : null}

      {/* Verification notice if email not yet verified */}
      {!user.isVerified && !user.emailVerified ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-sky-200 bg-sky-50/90 p-4 text-xs font-medium text-slate-800">
          <div className="flex items-center gap-2.5">
            <span className="text-xl">✉️</span>
            <div>
              <p className="font-bold text-slate-900">
                Email verification pending
              </p>
              <p className="text-slate-600">
                A 6-digit code was sent to{" "}
                <strong className="text-[#0066ff]">{user.email}</strong>. You
                have full access to select your courses and prepare below.
              </p>
            </div>
          </div>
          <Link
            to="/verify-code"
            state={{ email: user.email, purpose: "signup" }}
            className="rounded-xl bg-[#0066ff] px-4 py-2 text-xs font-bold text-white hover:bg-[#0052cc] transition shadow-sm"
          >
            Enter code
          </Link>
        </div>
      ) : null}

      {/* Student Welcome Card */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#0c234b] via-[#091b3b] to-[#061124] p-6 sm:p-8 text-white border border-sky-500/25 shadow-xl flex flex-wrap items-center justify-between gap-6">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-blue-500/10 blur-3xl"
        />
        <div className="relative">
          <span className="text-xs font-extrabold uppercase tracking-[0.16em] text-sky-400">
            TedbabeLearnHUB · {t("studentOverview")}
          </span>
          <div className="mt-2 flex items-center gap-4">
            {personalForm.avatarUrl ? (
              <img
                src={personalForm.avatarUrl}
                alt=""
                className="h-14 w-14 rounded-full object-cover ring-2 ring-white/30"
              />
            ) : null}
            <h1 className="text-3xl font-black text-white sm:text-4xl">
              {personalForm.fullName}
            </h1>
          </div>
          <p className="mt-1 text-sm text-slate-300">{user.email}</p>
        </div>
        <div className="relative flex items-center gap-3">
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
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
          <p>
            Complete your course choices and preferred study times so the
            TedbabeLearnHUB team can place you in a suitable cohort.
          </p>
          <button
            onClick={() => setActiveTab("courses")}
            className="rounded-xl bg-amber-800 px-4 py-2 text-xs font-bold text-white hover:bg-amber-900 shadow-sm"
          >
            Choose courses now
          </button>
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
          {(!profileForm.preferredCourseIds ||
            profileForm.preferredCourseIds.length === 0) &&
            classes.length === 0 && (
              <div className="rounded-3xl border-2 border-blue-400/80 bg-gradient-to-r from-blue-50 via-indigo-50 to-sky-50 p-6 shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">🎯</span>
                      <h3 className="text-base font-bold text-blue-950">
                        Next Step: Select your courses
                      </h3>
                    </div>
                    <p className="text-xs text-blue-800 leading-relaxed max-w-xl">
                      You can select the courses you want to study right now.
                      Once submitted, our academic team will match you with the
                      appropriate cohort and schedule.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveTab("courses")}
                    className="shrink-0 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 px-5 py-2.5 text-xs font-bold text-white shadow-md shadow-blue-500/20 hover:from-blue-700 hover:to-indigo-700 transition"
                  >
                    Choose courses now →
                  </button>
                </div>
              </div>
            )}

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard label="My cohorts" value={classes.length} icon="📚" />
            <MetricCard
              label="Upcoming sessions"
              value={upcomingLessons.length}
              icon="📹"
            />
            <MetricCard
              label="Published progress"
              value={
                progressData?.overallScore != null
                  ? `${progressData.overallScore}%`
                  : "Not published"
              }
              icon="📈"
            />
            <MetricCard
              label="Published attendance"
              value={
                progressData?.components?.find(
                  (component) => component.category === "attendance",
                )?.score != null
                  ? `${progressData.components.find((component) => component.category === "attendance").score}%`
                  : "Not published"
              }
              icon="✅"
            />
          </div>

          <div className="grid gap-8 lg:grid-cols-2">
            <DashboardCard title="My cohorts">
              <div className="space-y-4">
                {classes.length === 0 ? (
                  <EmptyState
                    title="No cohort assigned yet."
                    description="Our team is reviewing your profile and will match you with a cohort soon."
                  />
                ) : (
                  classes.map((c) => (
                    <div
                      key={c._id}
                      className="rounded-2xl border border-slate-200 p-4 space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <h4 className="font-bold text-slate-900">{c.title}</h4>
                        <Badge variant="blue">
                          {c.course?.title || "General"}
                        </Badge>
                      </div>
                      <p className="text-xs text-slate-600">
                        👨‍🏫 Instructor:{" "}
                        <strong>
                          {c.teacher?.fullName || "To be assigned"}
                        </strong>{" "}
                        ({c.teacher?.email || ""})
                      </p>
                    </div>
                  ))
                )}
              </div>
            </DashboardCard>

            <DashboardCard title="Recent notifications">
              <div className="space-y-3">
                {notifications.length === 0 ? (
                  <EmptyState title="No new notifications." />
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
                className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200 space-y-4"
              >
                <div className="flex items-center justify-between">
                  <h4 className="text-xl font-bold text-slate-900">
                    {cls.title}
                  </h4>
                  <Badge variant="emerald">{cls.status}</Badge>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  {cls.description ||
                    "Live sessions and practical learning with your cohort."}
                </p>
                <div className="border-t border-slate-100 pt-3 space-y-1.5 text-xs text-slate-600">
                  <p>
                    <strong>Program:</strong> {cls.course?.title}
                  </p>
                  <p>
                    <strong>Instructor:</strong>{" "}
                    {cls.teacher?.fullName || "Not assigned"}
                  </p>
                  <p>
                    <strong>Time zone:</strong> {cls.timeZone}
                  </p>
                </div>
                <div className="pt-2 border-t border-slate-100">
                  <Link
                    to={`/workspace/${cls._id}`}
                    className="block w-full text-center rounded-2xl bg-gradient-to-r from-[#0066ff] to-[#0099ff] py-2.5 text-xs font-bold text-white shadow-md shadow-blue-500/25 transition hover:from-[#0052cc] hover:to-[#0088e6]"
                  >
                    Enter Learning Workspace →
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {/* 2b. COURSES SELECTION */}
      {activeTab === "courses" ? (
        <div className="max-w-3xl mx-auto space-y-6">
          <DashboardCard
            title="Choose your courses"
            subtitle="Select the courses you want to study. Our academic coordinators will assign you to the right cohort."
          >
            <form onSubmit={handleSaveProfile} className="space-y-6">
              <div className="rounded-2xl bg-blue-50/70 p-4 border border-blue-100 flex items-start gap-3">
                <span className="text-xl">💡</span>
                <div className="text-xs text-blue-900 leading-relaxed">
                  <strong>How course placement works:</strong> Pick one or more
                  courses below. After submitting, your request is reviewed by
                  the academic team and you will be added to your cohort
                  learning workspace.
                </div>
              </div>

              {profileForm.preferredCourseIds.length > 0 ? (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-900">
                      Your selection summary
                    </h4>
                    {profileForm.courseSelectionUpdatedAt ? (
                      <span className="text-[11px] font-semibold text-emerald-700">
                        Last updated{" "}
                        {new Date(
                          profileForm.courseSelectionUpdatedAt,
                        ).toLocaleString()}
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {profileForm.preferredCourseIds.map((courseId) => {
                      const course = courses.find(
                        (item) => String(item._id) === String(courseId),
                      );
                      return (
                        <span
                          key={courseId}
                          className="rounded-full border border-emerald-200 bg-white px-3 py-1 text-[11px] font-bold text-emerald-800"
                        >
                          {course?.title || "Selected course"}
                        </span>
                      );
                    })}
                  </div>
                </div>
              ) : null}

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold text-slate-800">
                    Available courses by category
                  </label>
                  <span className="text-[11px] font-semibold text-blue-600 bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-200">
                    {profileForm.preferredCourseIds?.length || 0} selected
                  </span>
                </div>
                <CategoryCoursePicker
                  courses={courses}
                  selectedCourseIds={profileForm.preferredCourseIds}
                  onChange={(preferredCourseIds) =>
                    setProfileForm({ ...profileForm, preferredCourseIds })
                  }
                />
              </div>

              <div className="border-t border-slate-100 pt-5 space-y-4">
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Your Learning Preferences
                </h4>

                <div className="grid gap-4 sm:grid-cols-2">
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
                      className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 text-xs outline-none bg-white"
                    >
                      <option value="Beginner">Beginner</option>
                      <option value="Intermediate">Intermediate</option>
                      <option value="Advanced">Advanced</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700">
                      Hours per week
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
                      className="mt-1 w-full rounded-xl border border-slate-200 p-2 text-sm outline-none"
                    />
                  </div>
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

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-2">
                    How would you like to learn?
                  </label>
                  <div className="grid gap-2 sm:grid-cols-3">
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
                          className={`rounded-xl border px-3 py-2.5 text-xs font-semibold transition ${
                            isSelected
                              ? "border-blue-600 bg-blue-50 text-blue-900 ring-1 ring-blue-600"
                              : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                          }`}
                        >
                          {isSelected ? "✓ " : ""}
                          {mode.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700">
                    Notes for the academic team
                  </label>
                  <textarea
                    rows={3}
                    maxLength={1200}
                    value={profileForm.preferredCourseNotes}
                    onChange={(e) =>
                      setProfileForm({
                        ...profileForm,
                        preferredCourseNotes: e.target.value,
                      })
                    }
                    className="mt-1 w-full rounded-xl border border-slate-200 p-2 text-sm outline-none"
                    placeholder="Share your goals, preferred start date, or anything that helps us build the right cohort for you."
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700">
                    {t("learningGoals")}
                  </label>
                  <textarea
                    rows={2}
                    value={profileForm.learningGoals}
                    onChange={(e) =>
                      setProfileForm({
                        ...profileForm,
                        learningGoals: e.target.value,
                      })
                    }
                    className="mt-1 w-full rounded-xl border border-slate-200 p-2 text-sm outline-none"
                    placeholder="What do you hope to achieve through this learning journey?"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 py-3 text-sm font-bold text-white shadow-lg shadow-blue-500/20 hover:from-blue-700 hover:to-indigo-700 transition"
              >
                Submit Selected Courses & Preferences
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
        <div className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            {assignments.length === 0 ? (
              <EmptyState title="No assignments yet." />
            ) : (
              assignments.map((asgn) => {
                const sub = asgn.submission;
                return (
                  <div
                    key={asgn._id}
                    className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200 space-y-4"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <h4 className="font-bold text-slate-900">{asgn.title}</h4>
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
                            : "Awaiting teacher review"
                          : "Not Submitted"}
                      </Badge>
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      {asgn.instructions}
                    </p>
                    <div className="flex justify-between items-center text-xs text-slate-500 border-t border-slate-100 pt-3">
                      <span>
                        Due: {new Date(asgn.dueDate).toLocaleDateString()}
                      </span>
                      <span>Max score: {asgn.maxScore}</span>
                    </div>

                    {sub?.textResponse ? (
                      <div className="rounded-xl bg-slate-50 p-3 text-xs text-slate-700">
                        <p className="font-bold text-slate-900 mb-1">
                          Your response
                        </p>
                        <p className="whitespace-pre-wrap">
                          {sub.textResponse}
                        </p>
                      </div>
                    ) : null}

                    {sub?.attachments?.length ? (
                      <div className="flex flex-wrap gap-2">
                        {sub.attachments.map((file, fileIndex) => (
                          <span
                            key={file.key || fileIndex}
                            className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold text-slate-700"
                          >
                            📎 {file.filename}
                          </span>
                        ))}
                      </div>
                    ) : null}

                    {sub?.submissionLinks?.length ? (
                      <div className="space-y-1">
                        {sub.submissionLinks.map((link, linkIndex) => (
                          <a
                            key={linkIndex}
                            href={link.url}
                            target="_blank"
                            rel="noreferrer"
                            className="block truncate text-xs font-semibold text-[#0066ff] hover:underline"
                          >
                            🔗 {link.label || link.url}
                          </a>
                        ))}
                      </div>
                    ) : null}

                    {sub?.feedback ? (
                      <div className="rounded-xl bg-blue-50 p-3 text-xs text-blue-900">
                        <strong>Instructor feedback:</strong> {sub.feedback}
                      </div>
                    ) : null}

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
                        className="w-full rounded-xl bg-blue-600 py-2.5 text-xs font-bold text-white hover:bg-blue-700 transition-colors"
                      >
                        {sub ? "Resubmit" : t("submitWork")}
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
        <div className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            {assessments.length === 0 ? (
              <EmptyState title="No assessments yet." />
            ) : (
              assessments.map((qz) => {
                const att = qz.latestAttempt;
                return (
                  <div
                    key={qz._id}
                    className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200 space-y-4"
                  >
                    <div className="flex items-center justify-between">
                      <h4 className="font-bold text-slate-900">{qz.title}</h4>
                      {att?.status === "reviewed" ? (
                        <Badge variant={att.passed ? "emerald" : "rose"}>
                          {att.percentage}% (
                          {att.passed ? t("passed") : t("failed")})
                        </Badge>
                      ) : att ? (
                        <Badge variant="amber">Awaiting teacher review</Badge>
                      ) : (
                        <Badge variant="cyan">
                          {qz.assessmentType?.replace("_", " ") ||
                            `${qz.timeLimitMinutes} min`}
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      {qz.description}
                    </p>
                    <div className="flex justify-between items-center text-xs text-slate-500 border-t border-slate-100 pt-3">
                      <span>Questions: {qz.questions?.length || 0}</span>
                      <span>Passing score: {qz.passingScorePercentage}%</span>
                    </div>

                    {att?.status !== "reviewed" && (
                      <button
                        onClick={() => startQuiz(qz)}
                        className="w-full rounded-xl bg-cyan-600 py-2.5 text-xs font-bold text-white hover:bg-cyan-700 transition-colors"
                      >
                        {att ? "Resubmit for review" : t("takeAssessment")}
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
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {resources.length === 0 ? (
              <EmptyState title="No resources have been added yet." />
            ) : (
              resources.map((res) => (
                <div
                  key={res._id}
                  className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 flex flex-col justify-between"
                >
                  <div>
                    <Badge variant="indigo">{res.category}</Badge>
                    <h4 className="font-bold text-slate-900 mt-2">
                      {res.title}
                    </h4>
                    <p className="text-xs text-slate-500 mt-1">
                      {res.description}
                    </p>
                  </div>
                  <div className="mt-4 pt-3 border-t border-slate-100 flex justify-between items-center text-xs">
                    <span className="text-slate-400">
                      {(res.fileSize / 1024).toFixed(1)} KB
                    </span>
                    {res.classroom?._id ||
                    res.classroom ||
                    classrooms[0]?._id ? (
                      <Link
                        to={`/workspace/${res.classroom?._id || res.classroom || classrooms[0]?._id}?resourceId=${res._id}`}
                        className="font-bold text-[#0066ff] hover:text-[#0052cc] flex items-center gap-1 hover:underline"
                      >
                        Open in Workspace →
                      </Link>
                    ) : (
                      <span className="font-semibold text-slate-500">
                        View only
                      </span>
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
        <div className="space-y-8">
          {progressReports.length === 0 ? (
            <DashboardCard title="Progress reports">
              <EmptyState
                title="Your teacher has not published a progress report yet."
                description="Grades, self-assessment, and progress details appear here after your teacher releases them."
              />
            </DashboardCard>
          ) : (
            progressReports.map((report) => (
              <DashboardCard
                key={report._id}
                title={`${report.classroom?.title || "Cohort"} · ${report.period}`}
                subtitle={`Published by ${report.teacher?.fullName || "your teacher"}${report.publishedAt ? ` on ${new Date(report.publishedAt).toLocaleDateString()}` : ""}`}
              >
                <div className="space-y-5">
                  <div className="rounded-xl bg-blue-50 p-4">
                    <p className="text-xs font-bold uppercase tracking-wide text-blue-800">
                      Overall result
                    </p>
                    <p className="mt-1 text-3xl font-black text-slate-900">
                      {report.overallScore}%
                    </p>
                  </div>
                  {report.components?.length ? (
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {report.components.map((component) => (
                        <div
                          key={component._id}
                          className="rounded-xl border border-slate-200 p-3"
                        >
                          <p className="text-xs font-bold text-slate-600">
                            {component.title}
                          </p>
                          <p className="mt-1 text-xl font-black text-slate-900">
                            {component.score}/{component.maxScore}
                          </p>
                          {component.feedback ? (
                            <p className="mt-1 text-xs text-slate-600">
                              {component.feedback}
                            </p>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  ) : null}
                  {report.selfAssessment ? (
                    <div>
                      <h4 className="text-xs font-bold text-slate-700">
                        Teacher self-assessment
                      </h4>
                      <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-slate-600">
                        {report.selfAssessment}
                      </p>
                    </div>
                  ) : null}
                  {report.feedback ? (
                    <div className="rounded-xl bg-slate-50 p-4">
                      <h4 className="text-xs font-bold text-slate-700">
                        Teacher feedback
                      </h4>
                      <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-slate-600">
                        {report.feedback}
                      </p>
                    </div>
                  ) : null}
                </div>
              </DashboardCard>
            ))
          )}

          <DashboardCard
            title="Attendance register"
            subtitle="Cumulative attendance across every cohort you are enrolled in."
          >
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              <MetricCard
                label="Attendance rate"
                value={`${attendanceSummary?.attendanceRate ?? 0}%`}
              />
              <MetricCard label="Present" value={attendanceSummary?.present ?? 0} />
              <MetricCard label="Late" value={attendanceSummary?.late ?? 0} />
              <MetricCard label="Absent" value={attendanceSummary?.absent ?? 0} />
              <MetricCard
                label="Excused"
                value={attendanceSummary?.excused ?? 0}
              />
            </div>

            {attendanceClasses.length > 0 ? (
              <div className="mt-6 overflow-x-auto">
                <table className="w-full min-w-[520px] text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500 uppercase tracking-wider">
                      <th className="py-2 pr-3 font-bold">Cohort</th>
                      <th className="py-2 px-3 font-bold">Sessions held</th>
                      <th className="py-2 px-3 font-bold">Present</th>
                      <th className="py-2 px-3 font-bold">Late</th>
                      <th className="py-2 px-3 font-bold">Absent</th>
                      <th className="py-2 pl-3 font-bold">Rate</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {attendanceClasses.map((row) => (
                      <tr key={row.classroom?._id}>
                        <td className="py-2.5 pr-3 font-semibold text-slate-900">
                          {row.classroom?.courseTitle || row.classroom?.title}
                          <span className="block text-[11px] font-normal text-slate-400">
                            {row.classroom?.title}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-slate-600">
                          {row.sessionsHeld ?? 0}
                        </td>
                        <td className="py-2.5 px-3 text-emerald-600 font-semibold">
                          {row.present ?? 0}
                        </td>
                        <td className="py-2.5 px-3 text-amber-600 font-semibold">
                          {row.late ?? 0}
                        </td>
                        <td className="py-2.5 px-3 text-rose-600 font-semibold">
                          {row.absent ?? 0}
                        </td>
                        <td className="py-2.5 pl-3 font-bold text-slate-900">
                          {row.attendanceRate ?? 0}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}

            <div className="mt-6">
              <h4 className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">
                Session-by-session
              </h4>
              <div className="divide-y divide-slate-100">
                {attendanceRecords.length === 0 ? (
                  <EmptyState title="No attendance records yet." />
                ) : (
                  attendanceRecords.map((rec) => (
                    <div
                      key={rec._id}
                      className="py-3 flex justify-between items-center text-xs"
                    >
                      <div>
                        <span className="font-bold text-slate-900">
                          {rec.session?.title || "Class Session"}
                        </span>
                        <p className="text-slate-400">
                          {rec.classroom?.title ? `${rec.classroom.title} · ` : ""}
                          {new Date(rec.session?.startsAt || rec.createdAt).toLocaleDateString()}
                        </p>
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
                      <span className="rounded-xl bg-blue-50 px-3 py-1 text-sm font-black text-blue-700">
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
                className="w-full rounded-xl bg-blue-600 py-2.5 text-xs font-bold text-white hover:bg-blue-700"
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
                  className="w-full rounded-xl bg-blue-600 py-2.5 text-xs font-bold text-white hover:bg-blue-700"
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
                            : "bg-gradient-to-r from-[#0066ff] to-[#0099ff]"
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
                        <strong className="text-[#0066ff]">
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
                      className="block text-center text-[11px] font-bold text-[#0066ff] hover:underline"
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
                className="text-[11px] font-bold text-blue-600 hover:text-blue-700"
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
              className="w-full rounded-xl border border-dashed border-slate-300 p-2.5 text-xs text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-blue-50 file:px-3 file:py-1.5 file:text-xs file:font-bold file:text-blue-700"
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
            className="w-full rounded-xl bg-blue-600 py-2.5 text-xs font-bold text-white hover:bg-blue-700 disabled:opacity-60"
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
                  className={`mx-auto flex h-16 w-16 items-center justify-center rounded-full text-3xl ${quizModal.result.passed ? "bg-sky-100 text-blue-700" : "bg-rose-100 text-rose-600"}`}
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
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-sky-100 text-3xl text-blue-700">
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
                              ? "border-blue-600 bg-blue-50 text-blue-900 ring-1 ring-blue-600"
                              : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                          }`}
                        >
                          <span
                            className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${isSelected ? "bg-blue-600 text-white" : "border border-slate-300"}`}
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
                    className="text-[11px] font-bold text-blue-600 hover:text-blue-700"
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
                  className="w-full rounded-xl border border-dashed border-slate-300 p-2.5 text-xs text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-blue-50 file:px-3 file:py-1.5 file:text-xs file:font-bold file:text-blue-700"
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
              className="w-full rounded-xl bg-cyan-600 py-3 text-xs font-bold text-white hover:bg-cyan-700 shadow-sm disabled:opacity-60"
            >
              {quizBusy ? "Submitting…" : t("submitAnswers")}
            </button>
          </div>
        )}
      </Modal>
    </div>
  );
}
