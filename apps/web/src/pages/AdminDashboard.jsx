import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { API_BASE_URL, apiRequest } from "../lib/api";
import {
  dateTimeInputToISOString,
  formatDateTimeInput,
  formatSessionTime,
} from "../lib/sessionTime";
import { TIME_ZONES } from "../lib/timezones";
import { ProfilePhotoField } from "../components/ProfilePhotoField";
import { DashboardSettings } from "../components/DashboardSettings";
import { DashboardSidebar } from "../components/DashboardSidebar";
import { MonetizationPanel } from "../components/MonetizationPanel";
import { PaymentsAdminPanel } from "../components/PaymentsAdminPanel";
import {
  MetricCard,
  DashboardCard,
  EmptyState,
  Badge,
  Modal,
  AnalyticsColumnChart,
  AnalyticsTable,
  formatNumber,
} from "../components/UIComponents";
import { useAuth } from "../context/AuthContext";

// Percentages are nullable by design: null means "not applicable" (zero
// denominator) and is rendered as an em dash rather than a misleading 0%.
function formatPercent(value) {
  return value === null || value === undefined ? "—" : `${value}%`;
}

const RECENCY_VARIANTS = {
  active: "emerald",
  recent: "blue",
  dormant: "amber",
  cold: "rose",
};

export function AdminDashboard({ user }) {
  const { t } = useTranslation();
  const { refreshUser } = useAuth();
  const [activeTab, setActiveTab] = useState("overview");
  // State collections
  const [metrics, setMetrics] = useState({});
  const [applications, setApplications] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [students, setStudents] = useState([]);
  const [administrators, setAdministrators] = useState([]);
  const [categories, setCategories] = useState([]);
  const [courses, setCourses] = useState([]);
  const [classes, setClasses] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [learningResources, setLearningResources] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [faqs, setFaqs] = useState([]);
  const [inquiries, setInquiries] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [reportsData, setReportsData] = useState(null);
  const [reportsLoaded, setReportsLoaded] = useState(false);
  const [isReportsLoading, setIsReportsLoading] = useState(false);
  // Certificates & published results review
  const [certificates, setCertificates] = useState([]);
  const [eligibleCertificates, setEligibleCertificates] = useState([]);
  const [certificateThreshold, setCertificateThreshold] = useState(70);
  const [certificatesLoading, setCertificatesLoading] = useState(false);
  const [certificateBusyKey, setCertificateBusyKey] = useState("");
  const [certificateForm, setCertificateForm] = useState({
    studentId: "",
    classroomId: "",
    overallScore: "",
    notes: "",
    signatureName: "",
    signatureTitle: "",
    signatureImage: "",
  });
  const [publishedResults, setPublishedResults] = useState({
    attempts: [],
    reports: [],
  });
  // Teacher attendance tracking
  const [teacherAttendance, setTeacherAttendance] = useState({
    records: [],
    summary: [],
  });
  const [teacherAttendanceLoading, setTeacherAttendanceLoading] = useState(false);
  const [teacherAttendanceForm, setTeacherAttendanceForm] = useState({
    teacherId: "",
    sessionId: "",
    status: "present",
    notes: "",
  });
  const [teacherAttendanceSaving, setTeacherAttendanceSaving] = useState(false);
  // Cohort attendance register
  const [registerClassroomId, setRegisterClassroomId] = useState("");
  const [cohortRegister, setCohortRegister] = useState(null);
  const [registerLoading, setRegisterLoading] = useState(false);
  // Analytics (Module 1). Loaded on demand so the main dashboard payload stays lean.
  const [analyticsData, setAnalyticsData] = useState(null);
  const [analyticsActivity, setAnalyticsActivity] = useState([]);
  const [analyticsLoaded, setAnalyticsLoaded] = useState(false);
  const [isAnalyticsLoading, setIsAnalyticsLoading] = useState(false);
  const [analyticsGranularity, setAnalyticsGranularity] = useState("day");
  const [analyticsWindowDays, setAnalyticsWindowDays] = useState(30);
  const [feedback, setFeedback] = useState("");
  const [adminProfile, setAdminProfile] = useState({
    fullName: user.fullName || "",
    phone: user.phone || "",
    bio: user.bio || "",
    avatarUrl: user.avatarUrl || "",
  });
  const [securityForm, setSecurityForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [securityLoading, setSecurityLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [teacherSearch, setTeacherSearch] = useState("");
  const [studentSearch, setStudentSearch] = useState("");
  const [courseSearch, setCourseSearch] = useState("");
  const [courseCategory, setCourseCategory] = useState("");
  const [coursePage, setCoursePage] = useState(1);
  // Modals
  const [rejectionModal, setRejectionModal] = useState({
    open: false,
    appId: "",
    reason: "",
  });
  const [placementModal, setPlacementModal] = useState({
    open: false,
    studentId: "",
    studentName: "",
    classId: "",
  });
  const [teacherAssignmentModal, setTeacherAssignmentModal] = useState({
    open: false,
    classId: "",
    classTitle: "",
    teacherId: "",
  });
  const [deleteUserModal, setDeleteUserModal] = useState(null);
  const [deleteUserPurge, setDeleteUserPurge] = useState(false);
  const [isDeletingUser, setIsDeletingUser] = useState(false);
  const [removingStudentId, setRemovingStudentId] = useState("");
  const [deleteUserError, setDeleteUserError] = useState("");
  const [createCourseModal, setCreateCourseModal] = useState(false);
  const [createClassModal, setCreateClassModal] = useState(false);
  const [createCategoryModal, setCreateCategoryModal] = useState(false);
  const [createSessionModal, setCreateSessionModal] = useState(false);
  const [createResourceModal, setCreateResourceModal] = useState(false);
  const [createAnnouncementModal, setCreateAnnouncementModal] = useState(false);
  const [createAdministratorModal, setCreateAdministratorModal] =
    useState(false);
  const [createUserModal, setCreateUserModal] = useState(false);
  const [createFaqModal, setCreateFaqModal] = useState(false);
  const [deleteRecord, setDeleteRecord] = useState(null);
  const [deleteRecordError, setDeleteRecordError] = useState("");
  const [currentTime, setCurrentTime] = useState(() => Date.now());
  const [editingCourseId, setEditingCourseId] = useState("");
  const [editingCategoryId, setEditingCategoryId] = useState("");
  const [editingClassId, setEditingClassId] = useState("");
  const [editingSessionId, setEditingSessionId] = useState("");
  const [updatingSessionId, setUpdatingSessionId] = useState("");
  const [isUploadingResource, setIsUploadingResource] = useState(false);
  const [editingAnnouncementId, setEditingAnnouncementId] = useState("");
  const [editingFaqId, setEditingFaqId] = useState("");
  const [administratorForm, setAdministratorForm] = useState({
    fullName: "",
    email: "",
    password: "",
  });
  const [userForm, setUserForm] = useState({
    fullName: "",
    email: "",
    password: "",
    role: "student",
  });
  const [faqForm, setFaqForm] = useState({
    question: "",
    answer: "",
    isPublished: true,
    sortOrder: 0,
  });
  const [inquiryFeedback, setInquiryFeedback] = useState("");
  // Submissions & assessment attempts storage management
  const [submissionData, setSubmissionData] = useState({
    submissions: [],
    attempts: [],
    storage: { fileCount: 0, totalBytes: 0 },
  });
  const [submissionsLoading, setSubmissionsLoading] = useState(false);
  const [submissionFilter, setSubmissionFilter] = useState("all");
  const [contentData, setContentData] = useState({
    assignments: [],
    assessments: [],
  });
  const [adminFilePreview, setAdminFilePreview] = useState({
    open: false,
    title: "",
    url: "",
    mimeType: "",
  });
  const [adminFileBusy, setAdminFileBusy] = useState(false);
  // Forms
  const [courseForm, setCourseForm] = useState({
    title: "",
    description: "",
    categoryId: "",
    skillLevel: "Beginner",
    objectives: "",
    status: "published",
  });
  const [classForm, setClassForm] = useState({
    title: "",
    courseId: "",
    teacherId: "",
    capacity: 20,
    timeZone: "Africa/Addis_Ababa",
    description: "",
    status: "active",
  });
  const [categoryForm, setCategoryForm] = useState({
    name: "",
    description: "",
  });
  const [sessionForm, setSessionForm] = useState({
    classId: "",
    title: "",
    description: "",
    startsAt: "",
    endsAt: "",
    meetingUrl: "",
    status: "scheduled",
    recurrencePattern: "none",
    recurrenceInterval: 1,
    recurrenceOccurrences: 4,
  });
  const [resourceForm, setResourceForm] = useState({
    title: "",
    description: "",
    classroomId: "",
    sourceType: "youtube",
    sourceUrl: "",
    category: "video",
    visibility: "class_only",
    originalFilename: "",
    mimeType: "",
    base64Data: "",
  });
  const [announcementForm, setAnnouncementForm] = useState({
    title: "",
    content: "",
    target: "all_students",
    classroomId: "",
    priority: "normal",
  });
  const [showcaseModal, setShowcaseModal] = useState({
    open: false,
    teacherId: "",
    teacherOriginalName: "",
    displayName: "",
    photoUrl: "",
    subjectTitle: "",
    experience: "",
    bio: "",
    isPublished: false,
    displayOrder: 1,
  });
  const [savingShowcase, setSavingShowcase] = useState(false);
  const [showcaseFeedback, setShowcaseFeedback] = useState("");
  const availableClasses = useMemo(
    () =>
      classes.filter(
        (classroom) => classroom.students?.length < classroom.capacity,
      ),
    [classes],
  );
  const schedulableClasses = useMemo(
    () => classes.filter((classroom) => classroom.teacher?._id),
    [classes],
  );
  const selectedSessionClass = classes.find(
    (classroom) => classroom._id === sessionForm.classId,
  );
  const sessionTimeZone =
    selectedSessionClass?.timeZone ||
    Intl.DateTimeFormat().resolvedOptions().timeZone;
  const activeTeachers = useMemo(
    () => teachers.filter((teacher) => teacher.accountStatus === "active"),
    [teachers],
  );
  const getPlacementClasses = useCallback(
    (studentId) =>
      availableClasses.filter(
        (classroom) =>
          !classroom.students?.some(
            (student) => String(student?._id ?? student) === studentId,
          ),
      ),
    [availableClasses],
  );
  const placementClasses = useMemo(
    () => getPlacementClasses(placementModal.studentId),
    [getPlacementClasses, placementModal.studentId],
  );
  const visibleTeachers = useMemo(() => {
    const query = teacherSearch.trim().toLowerCase();
    return teachers.filter((teacher) =>
      `${teacher.fullName} ${teacher.email}`.toLowerCase().includes(query),
    );
  }, [teacherSearch, teachers]);
  const visibleStudents = useMemo(() => {
    const query = studentSearch.trim().toLowerCase();
    return students.filter((student) =>
      `${student.fullName} ${student.email}`.toLowerCase().includes(query),
    );
  }, [studentSearch, students]);
  const pendingApplications = useMemo(
    () =>
      applications.filter((application) => application.status === "pending"),
    [applications],
  );
  const pendingStudents = useMemo(
    () =>
      students.filter(
        (student) => student.studentProfile?.placementStatus === "pending",
      ),
    [students],
  );
  const visibleCourses = useMemo(() => {
    const query = courseSearch.trim().toLowerCase();
    return courses.filter((course) => {
      const matchesCategory =
        !courseCategory || course.category?._id === courseCategory;
      const matchesSearch =
        !query ||
        `${course.title} ${course.description} ${course.category?.name || ""}`
          .toLowerCase()
          .includes(query);
      return matchesCategory && matchesSearch;
    });
  }, [courseCategory, courseSearch, courses]);
  const coursesPerPage = 12;
  const totalCoursePages = Math.ceil(visibleCourses.length / coursesPerPage);
  const pagedCourses = visibleCourses.slice(
    (coursePage - 1) * coursesPerPage,
    coursePage * coursesPerPage,
  );

  const loadAll = useCallback(async () => {
    setIsLoading(true);
    setLoadError("");
    try {
      const [
        dash,
        appsRes,
        teachRes,
        studRes,
        adminRes,
        catRes,
        courseRes,
        classRes,
        resourceRes,
        annRes,
        faqRes,
        inquiryRes,
      ] = await Promise.all([
        apiRequest("/api/admin/dashboard"),
        apiRequest("/api/admin/teacher-applications"),
        apiRequest("/api/admin/teachers"),
        apiRequest("/api/admin/students"),
        apiRequest("/api/admin/administrators"),
        apiRequest("/api/admin/categories"),
        apiRequest("/api/admin/courses"),
        apiRequest("/api/admin/classes"),
        apiRequest("/api/resources"),
        apiRequest("/api/admin/announcements"),
        apiRequest("/api/admin/faqs"),
        apiRequest("/api/admin/contact-inquiries"),
      ]);
      setMetrics(dash.metrics);
      setApplications(appsRes.applications);
      setTeachers(teachRes.teachers);
      setStudents(studRes.students);
      setAdministrators(adminRes.administrators);
      setCategories(catRes.categories);
      setCourses(courseRes.courses);
      setClasses(classRes.classes);
      setSessions(classRes.sessions || []);
      setLearningResources(resourceRes.resources || []);
      setAnnouncements(annRes.announcements);
      setFaqs(faqRes.faqs);
      setInquiries(inquiryRes.inquiries);
      return true;
    } catch (err) {
      setLoadError(
        err instanceof Error
          ? err.message
          : "Unable to load admin dashboard data.",
      );
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);
  const loadReports = useCallback(async () => {
    setIsReportsLoading(true);
    setLoadError("");
    try {
      const [auditRes, reportsRes] = await Promise.all([
        apiRequest("/api/admin/audit-logs"),
        apiRequest("/api/admin/reports"),
      ]);
      setAuditLogs(auditRes.logs);
      setReportsData(reportsRes);
      setReportsLoaded(true);
    } catch (err) {
      setLoadError(
        err instanceof Error
          ? err.message
          : "Unable to load reports and activity.",
      );
    } finally {
      setIsReportsLoading(false);
    }
  }, []);
  const loadSubmissions = useCallback(async () => {
    setSubmissionsLoading(true);
    try {
      const [res, contentRes] = await Promise.all([
        apiRequest("/api/admin/submissions"),
        apiRequest("/api/admin/content").catch(() => ({
          assignments: [],
          assessments: [],
        })),
      ]);
      setSubmissionData({
        submissions: res.submissions || [],
        attempts: res.attempts || [],
        storage: res.storage || { fileCount: 0, totalBytes: 0 },
      });
      setContentData({
        assignments: contentRes.assignments || [],
        assessments: contentRes.assessments || [],
      });
    } catch (err) {
      setFeedback(
        err instanceof Error ? err.message : "Unable to load submissions.",
      );
    } finally {
      setSubmissionsLoading(false);
    }
  }, []);
  const loadCertificates = useCallback(async () => {
    setCertificatesLoading(true);
    try {
      const [certRes, resultsRes] = await Promise.all([
        apiRequest("/api/admin/certificates"),
        apiRequest("/api/admin/results").catch(() => ({
          attempts: [],
          reports: [],
        })),
      ]);
      setCertificates(certRes.certificates || []);
      setEligibleCertificates(certRes.eligible || []);
      setCertificateThreshold(certRes.threshold ?? 70);
      setPublishedResults({
        attempts: resultsRes.attempts || [],
        reports: resultsRes.reports || [],
      });
    } catch (err) {
      setFeedback(
        err instanceof Error ? err.message : "Unable to load certificates.",
      );
    } finally {
      setCertificatesLoading(false);
    }
  }, []);
  const loadTeacherAttendance = useCallback(async () => {
    setTeacherAttendanceLoading(true);
    try {
      const res = await apiRequest("/api/admin/teacher-attendance");
      setTeacherAttendance({
        records: res.records || [],
        summary: res.summary || [],
      });
    } catch (err) {
      setFeedback(
        err instanceof Error
          ? err.message
          : "Unable to load teacher attendance.",
      );
    } finally {
      setTeacherAttendanceLoading(false);
    }
  }, []);
  const handleRecordTeacherAttendance = async () => {
    if (!teacherAttendanceForm.sessionId) {
      setFeedback("Select a teaching day to record attendance.");
      return;
    }
    setTeacherAttendanceSaving(true);
    try {
      const res = await apiRequest("/api/admin/teacher-attendance", {
        method: "POST",
        body: {
          sessionId: teacherAttendanceForm.sessionId,
          status: teacherAttendanceForm.status,
          notes: teacherAttendanceForm.notes,
        },
      });
      setFeedback(res.message || "Teacher attendance recorded.");
      setTeacherAttendanceForm((prev) => ({
        ...prev,
        sessionId: "",
        status: "present",
        notes: "",
      }));
      await loadTeacherAttendance();
    } catch (err) {
      setFeedback(
        err instanceof Error
          ? err.message
          : "Unable to record teacher attendance.",
      );
    } finally {
      setTeacherAttendanceSaving(false);
    }
  };
  const loadCohortRegister = useCallback(async (classroomId) => {
    setRegisterClassroomId(classroomId);
    if (!classroomId) {
      setCohortRegister(null);
      return;
    }
    setRegisterLoading(true);
    try {
      const res = await apiRequest(
        `/api/admin/classes/${classroomId}/attendance`,
      );
      setCohortRegister(res.register || null);
    } catch (err) {
      setFeedback(
        err instanceof Error ? err.message : "Unable to load attendance.",
      );
    } finally {
      setRegisterLoading(false);
    }
  }, []);
  const handleIssueCertificate = async (
    studentId,
    classroomId,
    overallScore,
    options = {},
  ) => {
    const {
      notes = "",
      action = "publish",
      signatureName = "",
      signatureTitle = "",
      signatureImage = "",
    } = options;
    const key = `${studentId}-${classroomId}`;
    setCertificateBusyKey(key);
    try {
      const res = await apiRequest("/api/admin/certificates", {
        method: "POST",
        body: JSON.stringify({
          studentId,
          classroomId,
          overallScore:
            overallScore === "" || overallScore === undefined
              ? undefined
              : Number(overallScore),
          notes,
          action,
          signatureName,
          signatureTitle,
          signatureImage,
        }),
      });
      setFeedback(res.message || "Certificate saved.");
      await loadCertificates();
    } catch (err) {
      setFeedback(err.message);
    } finally {
      setCertificateBusyKey("");
    }
  };
  const handleCertificateStatus = async (certificate, status) => {
    setCertificateBusyKey(certificate._id);
    try {
      const res = await apiRequest(
        `/api/admin/certificates/${certificate._id}/status`,
        { method: "PATCH", body: JSON.stringify({ status }) },
      );
      setFeedback(res.message || "Certificate updated.");
      await loadCertificates();
    } catch (err) {
      setFeedback(err.message);
    } finally {
      setCertificateBusyKey("");
    }
  };
  const handleSignatureUpload = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > 1_500_000) {
      setFeedback("Signature image must be smaller than 1.5 MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () =>
      setCertificateForm((prev) => ({
        ...prev,
        signatureImage: String(reader.result || ""),
      }));
    reader.readAsDataURL(file);
  };
  const handleManualIssueCertificate = async (event, action = "publish") => {
    event.preventDefault();
    if (!certificateForm.studentId || !certificateForm.classroomId) {
      setFeedback("Select both a learner and a cohort.");
      return;
    }
    await handleIssueCertificate(
      certificateForm.studentId,
      certificateForm.classroomId,
      certificateForm.overallScore,
      {
        notes: certificateForm.notes,
        action,
        signatureName: certificateForm.signatureName,
        signatureTitle: certificateForm.signatureTitle,
        signatureImage: certificateForm.signatureImage,
      },
    );
    setCertificateForm({
      studentId: "",
      classroomId: "",
      overallScore: "",
      notes: "",
      signatureName: "",
      signatureTitle: "",
      signatureImage: "",
    });
  };
  const loadAnalytics = useCallback(
    async (
      granularity = analyticsGranularity,
      windowDays = analyticsWindowDays,
    ) => {
      setIsAnalyticsLoading(true);
      setLoadError("");
      try {
        const to = new Date();
        const from = new Date(to.getTime() - windowDays * 24 * 60 * 60 * 1000);
        const query = new URLSearchParams({
          granularity,
          from: from.toISOString(),
          to: to.toISOString(),
          limit: "25",
        });
        const [dashboard, activity] = await Promise.all([
          apiRequest(`/api/admin/analytics/dashboard?${query.toString()}`),
          apiRequest(
            `/api/admin/analytics/activity/students?${query.toString()}`,
          ),
        ]);
        setAnalyticsData(dashboard);
        setAnalyticsActivity(activity.rows || []);
        setAnalyticsLoaded(true);
      } catch (err) {
        setLoadError(
          err instanceof Error ? err.message : "Unable to load analytics.",
        );
      } finally {
        setIsAnalyticsLoading(false);
      }
    },
    [analyticsGranularity, analyticsWindowDays],
  );
  useEffect(() => {
    void loadAll();
  }, [loadAll]);
  useEffect(() => {
    const timer = window.setInterval(() => setCurrentTime(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);
  // Action: Approve / Reject teacher
  const handleTeacherApprove = async (appId) => {
    try {
      await apiRequest(`/api/admin/teacher-applications/${appId}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "approved" }),
      });
      setFeedback("Instructor approved.");
      void loadAll();
    } catch (err) {
      setFeedback(err.message);
    }
  };
  const handleTeacherReject = async () => {
    try {
      await apiRequest(
        `/api/admin/teacher-applications/${rejectionModal.appId}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            status: "rejected",
            rejectionReason: rejectionModal.reason,
          }),
        },
      );
      setRejectionModal({ open: false, appId: "", reason: "" });
      setFeedback("Application declined.");
      void loadAll();
    } catch (err) {
      setFeedback(err.message);
    }
  };
  // Action: Toggle teacher status
  const handleToggleTeacherStatus = async (teacherId, currentStatus) => {
    const nextStatus = currentStatus === "active" ? "suspended" : "active";
    try {
      await apiRequest(`/api/admin/teachers/${teacherId}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: nextStatus }),
      });
      setFeedback(`Instructor status updated: ${nextStatus}`);
      void loadAll();
    } catch (err) {
      setFeedback(err.message);
    }
  };
  const handleDeleteUser = async () => {
    if (!deleteUserModal || isDeletingUser) return;
    setIsDeletingUser(true);
    setDeleteUserError("");
    try {
      const response = await apiRequest(
        `/api/admin/users/${deleteUserModal.id}${deleteUserPurge ? "?purge=true" : ""}`,
        { method: "DELETE" },
      );
      setDeleteUserModal(null);
      setDeleteUserPurge(false);
      setFeedback(response.message);
      await loadAll();
    } catch (err) {
      setDeleteUserError(
        err instanceof Error
          ? err.message
          : "Could not delete the account. Please try again.",
      );
    } finally {
      setIsDeletingUser(false);
    }
  };
  const handleDeleteRecord = async () => {
    if (!deleteRecord) return;
    setDeleteRecordError("");
    try {
      const response = await apiRequest(deleteRecord.endpoint, {
        method: "DELETE",
      });
      setFeedback(response.message || `${deleteRecord.label} deleted.`);
      const wasSubmissionRecord =
        deleteRecord.endpoint.startsWith("/api/admin/submissions/") ||
        deleteRecord.endpoint.startsWith("/api/admin/attempts/") ||
        deleteRecord.endpoint.startsWith("/api/admin/assessments/") ||
        deleteRecord.endpoint.startsWith("/api/admin/assignments/");
      const wasResultRecord =
        deleteRecord.endpoint.startsWith("/api/admin/attempts/") ||
        deleteRecord.endpoint.startsWith("/api/admin/certificates/") ||
        deleteRecord.endpoint.startsWith("/api/admin/progress-reports/");
      setDeleteRecord(null);
      await loadAll();
      if (wasSubmissionRecord) await loadSubmissions();
      if (wasResultRecord) await loadCertificates();
    } catch (err) {
      setDeleteRecordError(
        err instanceof Error
          ? err.message
          : `Could not delete ${deleteRecord.label.toLowerCase()}.`,
      );
    }
  };
  // Load a protected submission/attempt file via an authenticated blob
  const openAdminSubmissionFile = async (fileUrl, file) => {
    setAdminFileBusy(true);
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
      setAdminFilePreview((prev) => {
        if (prev.url) URL.revokeObjectURL(prev.url);
        return {
          open: true,
          title: file?.filename || "Submission file",
          url: objectUrl,
          mimeType: file?.mimeType || typed.type,
        };
      });
    } catch (err) {
      setFeedback(
        err instanceof Error ? err.message : "Could not open this file.",
      );
    } finally {
      setAdminFileBusy(false);
    }
  };
  const closeAdminFilePreview = () => {
    setAdminFilePreview((prev) => {
      if (prev.url) URL.revokeObjectURL(prev.url);
      return { open: false, title: "", url: "", mimeType: "" };
    });
  };
  const handleCreateAdministrator = async (event) => {
    event.preventDefault();
    try {
      await apiRequest("/api/admin/administrators", {
        method: "POST",
        body: JSON.stringify(administratorForm),
      });
      setCreateAdministratorModal(false);
      setAdministratorForm({ fullName: "", email: "", password: "" });
      setFeedback("Administrator created.");
      await loadAll();
    } catch (err) {
      setFeedback(
        err instanceof Error ? err.message : "Could not create administrator.",
      );
    }
  };
  const handleCreateUser = async (event) => {
    event.preventDefault();
    try {
      await apiRequest("/api/admin/users", {
        method: "POST",
        body: JSON.stringify(userForm),
      });
      setCreateUserModal(false);
      setUserForm({ fullName: "", email: "", password: "", role: "student" });
      setFeedback(
        `${userForm.role === "student" ? "Student" : "Teacher"} account created.`,
      );
      await loadAll();
    } catch (err) {
      setFeedback(
        err instanceof Error ? err.message : "Could not create account.",
      );
    }
  };
  const handleToggleUserStatus = async (account) => {
    const status = account.accountStatus === "active" ? "suspended" : "active";
    try {
      const response = await apiRequest(
        `/api/admin/users/${account._id}/status`,
        {
          method: "PATCH",
          body: JSON.stringify({ status }),
        },
      );
      setFeedback(response.message);
      await loadAll();
    } catch (err) {
      setFeedback(
        err instanceof Error ? err.message : "Could not update account status.",
      );
    }
  };
  const handleVerifyUserEmail = async (account) => {
    try {
      const response = await apiRequest(
        `/api/admin/users/${account._id}/verify-email`,
        {
          method: "PATCH",
        },
      );
      setFeedback(response.message);
      await loadAll();
    } catch (err) {
      setFeedback(
        err instanceof Error ? err.message : "Could not verify email.",
      );
    }
  };
  const handleToggleAdministratorStatus = async (administrator) => {
    const status =
      administrator.accountStatus === "active" ? "suspended" : "active";
    try {
      const response = await apiRequest(
        `/api/admin/administrators/${administrator._id}/status`,
        {
          method: "PATCH",
          body: JSON.stringify({ status }),
        },
      );
      setFeedback(response.message);
      await loadAll();
    } catch (err) {
      setFeedback(
        err instanceof Error
          ? err.message
          : "Could not update administrator status.",
      );
    }
  };
  const handleToggleCategory = async (category) => {
    try {
      await apiRequest(`/api/admin/categories/${category._id}`, {
        method: "PATCH",
        body: JSON.stringify({ isActive: !category.isActive }),
      });
      setFeedback(`Category ${category.isActive ? "hidden" : "published"}.`);
      await loadAll();
    } catch (err) {
      setFeedback(
        err instanceof Error
          ? err.message
          : "Could not update category visibility.",
      );
    }
  };
  // Action: Place Student
  const handlePlaceStudent = async () => {
    if (!placementModal.classId) return;
    try {
      await apiRequest(
        `/api/admin/classes/${placementModal.classId}/assign-student`,
        {
          method: "POST",
          body: JSON.stringify({ studentId: placementModal.studentId }),
        },
      );
      setPlacementModal({
        open: false,
        studentId: "",
        studentName: "",
        classId: "",
      });
      setFeedback("Learner placed in the cohort.");
      void loadAll();
    } catch (err) {
      setFeedback(err.message);
    }
  };
  const handleRemoveStudentFromClass = async (classroom, student) => {
    if (
      !window.confirm(
        `Remove ${student.fullName} from ${classroom.title}? Their past submissions and results will be retained.`,
      )
    ) {
      return;
    }
    setRemovingStudentId(student._id);
    try {
      const response = await apiRequest(
        `/api/admin/classes/${classroom._id}/students/${student._id}`,
        { method: "DELETE" },
      );
      setFeedback(response.message);
      await loadAll();
    } catch (err) {
      setFeedback(
        err instanceof Error
          ? err.message
          : "Could not remove learner from cohort.",
      );
    } finally {
      setRemovingStudentId("");
    }
  };
  const handleAssignTeacher = async (event) => {
    event.preventDefault();
    if (!teacherAssignmentModal.classId || !teacherAssignmentModal.teacherId)
      return;
    try {
      await apiRequest(
        `/api/admin/classes/${teacherAssignmentModal.classId}/assign-teacher`,
        {
          method: "POST",
          body: JSON.stringify({ teacherId: teacherAssignmentModal.teacherId }),
        },
      );
      setTeacherAssignmentModal({
        open: false,
        classId: "",
        classTitle: "",
        teacherId: "",
      });
      setFeedback("Instructor assigned.");
      void loadAll();
    } catch (err) {
      setFeedback(err.message);
    }
  };
  // Action: Create Course
  const handleCreateCourse = async (e) => {
    e.preventDefault();
    try {
      await apiRequest(
        editingCourseId
          ? `/api/admin/courses/${editingCourseId}`
          : "/api/admin/courses",
        {
          method: editingCourseId ? "PATCH" : "POST",
          body: JSON.stringify({
            title: courseForm.title,
            description: courseForm.description,
            categoryId: courseForm.categoryId || categories[0]?._id,
            skillLevel: courseForm.skillLevel,
            learningObjectives: courseForm.objectives
              .split("\n")
              .filter((o) => o.trim()),
            status: courseForm.status,
          }),
        },
      );
      setCreateCourseModal(false);
      setEditingCourseId("");
      setCourseForm({
        title: "",
        description: "",
        categoryId: "",
        skillLevel: "Beginner",
        objectives: "",
        status: "published",
      });
      setFeedback(editingCourseId ? "Program updated." : "Program created.");
      void loadAll();
    } catch (err) {
      setFeedback(err.message);
    }
  };
  // Action: Create Category
  const handleCreateCategory = async (e) => {
    e.preventDefault();
    try {
      await apiRequest(
        editingCategoryId
          ? `/api/admin/categories/${editingCategoryId}`
          : "/api/admin/categories",
        {
          method: editingCategoryId ? "PATCH" : "POST",
          body: JSON.stringify({
            name: categoryForm.name,
            description: categoryForm.description,
          }),
        },
      );
      setCreateCategoryModal(false);
      setEditingCategoryId("");
      setCategoryForm({ name: "", description: "" });
      setFeedback(
        editingCategoryId ? "Category updated." : "Category created.",
      );
      void loadAll();
    } catch (err) {
      setFeedback(err.message);
    }
  };
  // Action: Create Class
  const handleCreateClass = async (e) => {
    e.preventDefault();
    try {
      await apiRequest(
        editingClassId
          ? `/api/admin/classes/${editingClassId}`
          : "/api/admin/classes",
        {
          method: editingClassId ? "PATCH" : "POST",
          body: JSON.stringify({
            title: classForm.title,
            courseId: classForm.courseId || courses[0]?._id,
            teacherId:
              classForm.teacherId || (editingClassId ? null : undefined),
            capacity: Number(classForm.capacity),
            timeZone: classForm.timeZone,
            description: classForm.description,
            status: classForm.status,
          }),
        },
      );
      setCreateClassModal(false);
      setEditingClassId("");
      setClassForm({
        title: "",
        courseId: "",
        teacherId: "",
        capacity: 20,
        timeZone: "Africa/Addis_Ababa",
        description: "",
        status: "active",
      });
      setFeedback(editingClassId ? "Cohort updated." : "Cohort created.");
      void loadAll();
    } catch (err) {
      setFeedback(err.message);
    }
  };
  // Action: Schedule Session
  const handleScheduleSession = async (e) => {
    e.preventDefault();
    try {
      const response = await apiRequest(
        editingSessionId
          ? `/api/admin/sessions/${editingSessionId}`
          : "/api/admin/sessions",
        {
          method: editingSessionId ? "PATCH" : "POST",
          body: JSON.stringify({
            classId: sessionForm.classId || classes[0]?._id,
            title: sessionForm.title,
            description: sessionForm.description,
            startsAt: dateTimeInputToISOString(
              sessionForm.startsAt,
              sessionTimeZone,
            ),
            endsAt: dateTimeInputToISOString(
              sessionForm.endsAt,
              sessionTimeZone,
            ),
            meetingUrl: sessionForm.meetingUrl,
            ...(editingSessionId ? { status: sessionForm.status } : {}),
            ...(editingSessionId
              ? {}
              : {
                  recurrence: {
                    pattern: sessionForm.recurrencePattern,
                    interval: Number(sessionForm.recurrenceInterval) || 1,
                    occurrences: Number(sessionForm.recurrenceOccurrences) || 1,
                  },
                }),
          }),
        },
      );
      setCreateSessionModal(false);
      setEditingSessionId("");
      setSessionForm({
        classId: "",
        title: "",
        description: "",
        startsAt: "",
        endsAt: "",
        meetingUrl: "",
        status: "scheduled",
        recurrencePattern: "none",
        recurrenceInterval: 1,
        recurrenceOccurrences: 4,
      });
      setFeedback(
        editingSessionId
          ? "Session updated."
          : response?.occurrences > 1
            ? `Recurring schedule created — ${response.occurrences} sessions were added.`
            : "Session scheduled.",
      );
      void loadAll();
    } catch (err) {
      setFeedback(err.message);
    }
  };
  const handleSessionStatusChange = async (session, status) => {
    if (
      status === "cancelled" &&
      !window.confirm(
        `Cancel “${session.title}”? The teacher and learners will be notified.`,
      )
    ) {
      return;
    }
    setUpdatingSessionId(session._id);
    try {
      await apiRequest(`/api/admin/sessions/${session._id}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      setFeedback(
        status === "completed"
          ? "Session marked complete."
          : "Session cancelled. Participants were notified.",
      );
      await loadAll();
    } catch (err) {
      setFeedback(err.message || "Could not update this session.");
    } finally {
      setUpdatingSessionId("");
    }
  };
  const handleResourceFileChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > 18 * 1024 * 1024) {
      setFeedback(
        "Choose a resource smaller than 18MB so it can be uploaded reliably.",
      );
      event.target.value = "";
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== "string" || !result.includes(",")) {
        setFeedback(
          "The selected file could not be read. Please choose it again.",
        );
        return;
      }
      const isVideo = file.type.startsWith("video/");
      setResourceForm((form) => ({
        ...form,
        title: form.title || file.name.replace(/\.[^.]+$/, ""),
        originalFilename: file.name,
        mimeType: file.type,
        base64Data: result.split(",")[1],
        category: isVideo
          ? "video"
          : file.type === "application/pdf"
            ? "pdf"
            : form.category === "video"
              ? "document"
              : form.category,
      }));
    };
    reader.onerror = () =>
      setFeedback(
        "The selected file could not be read. Please choose it again.",
      );
    reader.readAsDataURL(file);
  };
  const handleUploadResource = async (event) => {
    event.preventDefault();
    if (resourceForm.sourceType === "upload" && !resourceForm.base64Data) {
      setFeedback("Select a video or document file before uploading.");
      return;
    }
    if (
      resourceForm.sourceType !== "upload" &&
      !resourceForm.sourceUrl.trim()
    ) {
      setFeedback("Enter a YouTube or Google Drive link.");
      return;
    }
    if (resourceForm.visibility === "class_only" && !resourceForm.classroomId) {
      setFeedback(
        "Choose a cohort for a class-only resource, or change visibility to public.",
      );
      return;
    }
    setIsUploadingResource(true);
    try {
      const response = await apiRequest("/api/resources/upload", {
        method: "POST",
        body: JSON.stringify({
          title: resourceForm.title,
          description: resourceForm.description,
          sourceType: resourceForm.sourceType,
          ...(resourceForm.sourceType !== "upload"
            ? { sourceUrl: resourceForm.sourceUrl }
            : {}),
          ...(resourceForm.classroomId
            ? { classroomId: resourceForm.classroomId }
            : {}),
          category: resourceForm.category,
          visibility: resourceForm.visibility,
          ...(resourceForm.sourceType === "upload"
            ? {
                originalFilename: resourceForm.originalFilename,
                mimeType: resourceForm.mimeType,
                base64Data: resourceForm.base64Data,
              }
            : {}),
        }),
      });
      setFeedback(response.message || "Learning resource uploaded.");
      setCreateResourceModal(false);
      setResourceForm({
        title: "",
        description: "",
        classroomId: "",
        sourceType: "youtube",
        sourceUrl: "",
        category: "video",
        visibility: "class_only",
        originalFilename: "",
        mimeType: "",
        base64Data: "",
      });
      await loadAll();
    } catch (err) {
      setFeedback(err.message || "Could not upload the learning resource.");
    } finally {
      setIsUploadingResource(false);
    }
  };
  // Action: Create Announcement
  const handleCreateAnnouncement = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        title: announcementForm.title.trim(),
        content: announcementForm.content.trim(),
        target: announcementForm.target,
        priority: announcementForm.priority,
        classroomId:
          announcementForm.target === "classroom" &&
          announcementForm.classroomId
            ? announcementForm.classroomId
            : null,
      };
      await apiRequest(
        editingAnnouncementId
          ? `/api/admin/announcements/${editingAnnouncementId}`
          : "/api/admin/announcements",
        {
          method: editingAnnouncementId ? "PATCH" : "POST",
          body: JSON.stringify(payload),
        },
      );
      setCreateAnnouncementModal(false);
      setEditingAnnouncementId("");
      setAnnouncementForm({
        title: "",
        content: "",
        target: "all_students",
        classroomId: "",
        priority: "normal",
      });
      setFeedback(
        editingAnnouncementId ? "Announcement updated." : "Announcement sent.",
      );
      void loadAll();
    } catch (err) {
      setFeedback(err.message);
    }
  };
  const handleSaveFaq = async (event) => {
    event.preventDefault();
    try {
      await apiRequest(
        editingFaqId ? `/api/admin/faqs/${editingFaqId}` : "/api/admin/faqs",
        {
          method: editingFaqId ? "PATCH" : "POST",
          body: JSON.stringify({
            ...faqForm,
            sortOrder: Number(faqForm.sortOrder),
          }),
        },
      );
      setCreateFaqModal(false);
      setEditingFaqId("");
      setFaqForm({ question: "", answer: "", isPublished: true, sortOrder: 0 });
      setFeedback(editingFaqId ? "FAQ updated." : "FAQ created.");
      await loadAll();
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : "Could not save FAQ.");
    }
  };
  const handleInquiryStatus = async (inquiry, status) => {
    setInquiryFeedback("");
    try {
      await apiRequest(`/api/admin/contact-inquiries/${inquiry._id}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      setInquiryFeedback("Inquiry status updated.");
      await loadAll();
    } catch (err) {
      setInquiryFeedback(
        err instanceof Error ? err.message : "Could not update inquiry.",
      );
    }
  };
  const [deletingAuditLogId, setDeletingAuditLogId] = useState("");
  const [auditLogDeleteConfirm, setAuditLogDeleteConfirm] = useState("");
  const handleDeleteAuditLog = async (logId) => {
    if (auditLogDeleteConfirm !== logId) {
      setAuditLogDeleteConfirm(logId);
      return;
    }
    setDeletingAuditLogId(logId);
    setAuditLogDeleteConfirm("");
    try {
      await apiRequest(`/api/admin/audit-logs/${logId}`, { method: "DELETE" });
      setAuditLogs((prev) => prev.filter((l) => l._id !== logId));
      setFeedback("Activity entry removed.");
    } catch (err) {
      setFeedback(
        err instanceof Error ? err.message : "Could not delete activity entry.",
      );
    } finally {
      setDeletingAuditLogId("");
    }
  };
  const handleSaveAdminProfile = async (event) => {
    event.preventDefault();
    try {
      const response = await apiRequest("/api/auth/profile", {
        method: "PATCH",
        body: JSON.stringify(adminProfile),
      });
      setAdminProfile((current) => ({ ...current, ...response.user }));
      await refreshUser();
      setFeedback("Profile updated.");
    } catch (error) {
      setFeedback(error.message || "Could not update your profile.");
    }
  };
  const handleChangeAdminPassword = async (event) => {
    event.preventDefault();
    if (securityForm.newPassword !== securityForm.confirmPassword) {
      setFeedback("New passwords do not match.");
      return;
    }
    setSecurityLoading(true);
    try {
      const response = await apiRequest("/api/auth/change-password", {
        method: "POST",
        body: JSON.stringify({
          currentPassword: securityForm.currentPassword,
          newPassword: securityForm.newPassword,
        }),
      });
      setSecurityForm({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
      setFeedback(response.message || "Password updated successfully.");
    } catch (error) {
      setFeedback(error.message || "Could not update password.");
    } finally {
      setSecurityLoading(false);
    }
  };

  const openTeacherShowcaseModal = (teacher) => {
    const sc = teacher.showcaseProfile || {};
    setShowcaseModal({
      open: true,
      teacherId: teacher._id,
      teacherOriginalName: teacher.fullName || teacher.name,
      displayName: sc.displayName || teacher.fullName || teacher.name,
      photoUrl: sc.photoUrl || teacher.avatarUrl || "",
      subjectTitle: sc.subjectTitle || teacher.teacherProfile?.expertise?.[0] || "",
      experience: sc.experience || (teacher.teacherProfile?.experienceYears ? `${teacher.teacherProfile.experienceYears}+ years experience` : ""),
      bio: sc.bio || teacher.bio || teacher.teacherProfile?.bio || "",
      isPublished: Boolean(sc.isPublished),
      displayOrder: sc.displayOrder || 1,
    });
    setShowcaseFeedback("");
  };

  const handleSaveShowcase = async (e) => {
    e.preventDefault();
    if (!showcaseModal.teacherId) return;
    try {
      setSavingShowcase(true);
      setShowcaseFeedback("");
      const payload = {
        displayName: showcaseModal.displayName,
        photoUrl: showcaseModal.photoUrl,
        subjectTitle: showcaseModal.subjectTitle,
        experience: showcaseModal.experience,
        bio: showcaseModal.bio,
        isPublished: Boolean(showcaseModal.isPublished),
        displayOrder: Number(showcaseModal.displayOrder) || 1,
      };
      const res = await apiRequest(`/api/admin/teachers/${showcaseModal.teacherId}/showcase`, {
        method: "PUT",
        body: JSON.stringify(payload),
      });
      // Update local teachers array
      setTeachers((prev) =>
        prev.map((t) =>
          t._id === showcaseModal.teacherId
            ? { ...t, showcaseProfile: payload }
            : t,
        ),
      );
      setShowcaseFeedback(res?.message || "Showcase profile updated successfully!");
      setTimeout(() => {
        setShowcaseModal((prev) => ({ ...prev, open: false }));
        setShowcaseFeedback("");
      }, 1000);
    } catch (err) {
      setShowcaseFeedback(`Error: ${err?.message || "Failed to update showcase profile."}`);
    } finally {
      setSavingShowcase(false);
    }
  };
  // Derived analytics view-model — every value comes straight from the API.
  const analyticsOverview = analyticsData?.overview;
  const analyticsRegistrationPoints = (
    analyticsData?.registrations?.all?.buckets ?? []
  ).map((bucket) => ({ key: bucket.key, value: bucket.count }));
  const analyticsCourseRows = analyticsData?.topCourses ?? [];
  const analyticsTeacherRows = analyticsData?.topTeachers ?? [];
  const analyticsClassRows = analyticsData?.classes ?? [];
  const analyticsStages = analyticsData?.funnel?.stages ?? [];
  const analyticsEngagement = analyticsData?.engagement;
  const analyticsFunnelBase = Math.max(1, analyticsStages[0]?.count ?? 0);
  const dashboardTabs = [
    { id: "overview", label: "Overview", icon: "📊" },
    { id: "analytics", label: "Analytics", icon: "📈" },
    { id: "monetization", label: "Monetization", icon: "💰" },
    { id: "payments", label: "Payments", icon: "💳" },
    { id: "teachers", label: `Instructors (${teachers.length})`, icon: "👨‍🏫" },
    { id: "students", label: `Learners (${students.length})`, icon: "🎓" },
    {
      id: "administrators",
      label: `Admins (${administrators.length})`,
      icon: "🛡️",
    },
    { id: "courses", label: `Programs (${courses.length})`, icon: "📚" },
    { id: "classes", label: `Cohorts (${classes.length})`, icon: "🏫" },
    { id: "certificates", label: "Certificates", icon: "🎓" },
    { id: "class_attendance", label: "Cohort attendance", icon: "🧾" },
    {
      id: "teacher_attendance",
      label: "Teacher attendance",
      icon: "🕒",
    },
    { id: "submissions", label: "Submissions", icon: "🗂️" },
    {
      id: "resources",
      label: `Resources (${learningResources.length})`,
      icon: "📁",
    },
    {
      id: "announcements",
      label: `Updates (${announcements.length})`,
      icon: "📢",
    },
    { id: "faqs", label: `FAQs (${faqs.length})`, icon: "❓" },
    {
      id: "support",
      label: `Inbox (${inquiries.filter((item) => item.status !== "closed").length})`,
      icon: "✉️",
    },
    { id: "reports", label: "Reports & activity", icon: "📑" },
    { id: "profile", label: "My profile", icon: "👤" },
    { id: "settings", label: "Settings", icon: "⚙️" },
    { id: "security", label: "Account security", icon: "🔒" },
  ];
  return (
    <div className="admin-workspace min-h-screen w-full px-4 py-6 sm:px-6 lg:pl-72 lg:pr-8">
      <DashboardSidebar
        title="Admin workspace"
        user={{
          ...user,
          fullName: adminProfile.fullName,
          avatarUrl: adminProfile.avatarUrl,
        }}
        tabs={dashboardTabs}
        activeTab={activeTab}
        onSelect={(tabId) => {
          setActiveTab(tabId);
          if (tabId === "analytics" && !analyticsLoaded) void loadAnalytics();
          if (tabId === "reports" && !reportsLoaded) void loadReports();
          if (tabId === "submissions") void loadSubmissions();
          if (tabId === "certificates") void loadCertificates();
          if (tabId === "teacher_attendance") void loadTeacherAttendance();
          if (tabId === "class_attendance") {
            if (classes[0]?._id && !registerClassroomId) {
              void loadCohortRegister(classes[0]._id);
            }
          }
        }}
      />
      <div className="mx-auto max-w-7xl space-y-8">
        {/* Top Welcome Card */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[var(--tlh-navy)] via-[var(--tlh-navy-deep)] to-slate-950 p-6 sm:p-8 text-white border border-[var(--tlh-cyan)]/25 shadow-xl">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-blue-500/10 blur-3xl"
          />
          <div className="relative flex flex-wrap items-center justify-between gap-6">
            <div>
              <span className="text-xs font-extrabold uppercase tracking-[0.16em] text-[var(--tlh-cyan)]">
                TedbabeLearnHUB · {t("adminOverview")}
              </span>
              <div className="flex items-center gap-4">
                {adminProfile.avatarUrl ? (
                  <img
                    src={adminProfile.avatarUrl}
                    alt=""
                    className="h-14 w-14 rounded-full object-cover ring-2 ring-white/30"
                  />
                ) : null}
                <h1 className="mt-3 text-3xl font-black text-white sm:text-4xl">
                  Good to see you, {adminProfile.fullName?.split(" ")[0]}.
                </h1>
              </div>
              <p className="mt-2 text-sm text-slate-300">
                Your learning community, at a glance.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() =>
                  activeTab === "reports" ? void loadReports() : void loadAll()
                }
                disabled={isLoading || isReportsLoading}
                type="button"
                className="rounded-full border border-white/20 bg-white/10 px-4 py-2.5 text-xs font-bold text-white transition hover:bg-white/20 disabled:cursor-wait disabled:opacity-60"
              >
                {isLoading || isReportsLoading ? "Refreshing..." : "↻ Refresh"}
              </button>
              <button
                onClick={() => setCreateCategoryModal(true)}
                type="button"
                className="rounded-full border border-[var(--tlh-cyan)]/40 bg-[var(--tlh-sky)]/15 px-4 py-2.5 text-xs font-bold text-sky-200 transition-colors hover:bg-[var(--tlh-sky)]/25"
              >
                + {t("createCategory")}
              </button>
              <button
                onClick={() => setCreateCourseModal(true)}
                className="rounded-full bg-gradient-to-r from-[var(--tlh-blue-primary)] to-[var(--tlh-sky)] px-5 py-2.5 text-xs font-extrabold text-white shadow-md shadow-blue-500/25 transition-all hover:from-[var(--tlh-blue-hover)] hover:to-[var(--tlh-sky)] hover:-translate-y-0.5"
              >
                + {t("createCourse")}
              </button>
              <button
                onClick={() => setCreateClassModal(true)}
                className="rounded-full bg-gradient-to-r from-[#6366f1] to-[#8b5cf6] px-5 py-2.5 text-xs font-extrabold text-white shadow-md shadow-indigo-500/25 transition-all hover:from-[#4f46e5] hover:to-[#7c3aed] hover:-translate-y-0.5"
              >
                + {t("createClass")}
              </button>
              <button
                onClick={() => {
                  setSessionForm((form) => ({
                    ...form,
                    classId: schedulableClasses[0]?._id || "",
                  }));
                  setCreateSessionModal(true);
                }}
                disabled={schedulableClasses.length === 0}
                title={
                  schedulableClasses.length === 0
                    ? "Assign an active teacher to a class before scheduling a session."
                    : undefined
                }
                className="rounded-full border border-cyan-400/40 bg-cyan-500/15 px-4 py-2.5 text-xs font-bold text-cyan-200 transition-colors hover:bg-cyan-500/25 disabled:cursor-not-allowed disabled:opacity-50"
              >
                + {t("scheduleSession")}
              </button>
            </div>
          </div>
        </div>

        {isLoading && (
          <div
            role="status"
            className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm font-medium text-blue-800"
          >
            Loading the latest admin data...
          </div>
        )}
        {loadError && (
          <div
            role="alert"
            className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-800"
          >
            <span>Dashboard data could not be loaded: {loadError}</span>
            <button
              onClick={() =>
                activeTab === "reports" ? void loadReports() : void loadAll()
              }
              type="button"
              className="rounded-lg bg-rose-700 px-3 py-1.5 text-xs font-bold text-white hover:bg-rose-800"
            >
              Retry
            </button>
          </div>
        )}

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

        {/* 1. OVERVIEW TAB */}
        {activeTab === "overview" ? (
          <div className="space-y-8">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              <MetricCard
                label="Learners"
                value={metrics.totalStudents ?? 0}
                icon="🎓"
              />
              <MetricCard
                label="Active instructors"
                value={metrics.activeTeachers ?? 0}
                icon="👨‍🏫"
              />
              <MetricCard
                label="Active administrators"
                value={
                  administrators.filter(
                    (item) => item.accountStatus === "active",
                  ).length
                }
                icon="🛡️"
              />
              <MetricCard
                label="Cohorts"
                value={metrics.activeClasses ?? 0}
                icon="🏫"
              />
              <MetricCard
                label="Awaiting placement"
                value={metrics.pendingStudentPlacement ?? 0}
                icon="⏳"
              />
            </div>

            <div className="grid gap-8 lg:grid-cols-2">
              <DashboardCard
                title="Instructor applications awaiting review"
                subtitle="Pending Teacher Applications"
              >
                <div className="space-y-4">
                  {pendingApplications.length === 0 ? (
                    <EmptyState title="No applications are waiting for review." />
                  ) : (
                    pendingApplications.map((app) => (
                      <div
                        key={app._id}
                        className="rounded-2xl border border-slate-200 p-4 space-y-3"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <h4 className="font-bold text-slate-900">
                              {app.user?.fullName}
                            </h4>
                            <p className="text-xs text-slate-500">
                              {app.user?.email}
                            </p>
                          </div>
                          <Badge variant="amber">Pending</Badge>
                        </div>
                        <p className="text-xs text-slate-600 line-clamp-2">
                          <strong>Qualifications:</strong> {app.qualifications}
                        </p>
                        <p className="text-xs text-slate-600 line-clamp-2">
                          <strong>Experience:</strong> {app.experience}
                        </p>
                        {app.teachingStatement ? (
                          <p className="text-xs text-slate-600 line-clamp-2">
                            <strong>Teaching statement:</strong>{" "}
                            {app.teachingStatement}
                          </p>
                        ) : null}
                        <p className="text-xs text-slate-600">
                          <strong>Years:</strong> {app.experienceYears ?? 0} ·{" "}
                          <strong>Subjects:</strong>{" "}
                          {app.teachingCategories?.join(", ") ||
                            "Not specified"}
                        </p>
                        <p className="text-xs text-slate-600">
                          <strong>Availability:</strong>{" "}
                          {app.availability || "Not specified"}
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {app.documents?.cv?.key ? (
                            <a
                              href={`${API_BASE_URL}/api/admin/teacher-applications/${app._id}/documents/cv`}
                              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold text-[var(--tlh-blue-hover)] hover:bg-blue-50"
                            >
                              Download CV: {app.documents.cv.filename}
                            </a>
                          ) : null}
                          {app.documents?.certificates?.map(
                            (document, index) => (
                              <a
                                key={document.key}
                                href={`${API_BASE_URL}/api/admin/teacher-applications/${app._id}/documents/certificate-${index}`}
                                className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold text-[var(--tlh-blue-hover)] hover:bg-blue-50"
                              >
                                Certificate: {document.filename}
                              </a>
                            ),
                          )}
                        </div>
                        <div className="flex gap-2 pt-2 border-t border-slate-100">
                          <button
                            onClick={() => handleTeacherApprove(app._id)}
                            className="rounded-lg bg-[var(--tlh-blue-primary)] px-3.5 py-1.5 text-xs font-bold text-white hover:bg-[var(--tlh-blue-hover)] shadow-xs"
                          >
                            ✓ {t("approve")}
                          </button>
                          <button
                            onClick={() =>
                              setRejectionModal({
                                open: true,
                                appId: app._id,
                                reason: "",
                              })
                            }
                            className="rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-rose-700"
                          >
                            ✕ {t("reject")}
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </DashboardCard>

              <DashboardCard
                title="Learners awaiting placement"
                subtitle="Students Awaiting Placement"
              >
                <div className="space-y-4">
                  {pendingStudents.length === 0 ? (
                    <EmptyState title="All learners have been placed." />
                  ) : (
                    pendingStudents.map((stud) => (
                      <div
                        key={stud._id}
                        className="flex items-center justify-between rounded-2xl border border-slate-200 p-4"
                      >
                        <div>
                          <h4 className="font-bold text-slate-900">
                            {stud.fullName}
                          </h4>
                          <p className="text-xs text-slate-500">{stud.email}</p>
                          <p className="mt-1 text-xs text-slate-600">
                            Interests:{" "}
                            {stud.studentProfile?.learningInterests?.join(
                              ", ",
                            ) || "General"}
                          </p>
                          <p className="mt-1 text-xs text-slate-600">
                            Courses:{" "}
                            {stud.studentProfile?.preferredCourseIds
                              ?.map(
                                (course) => course.title || "Selected course",
                              )
                              .join(", ") || "Not selected"}
                          </p>
                          <p className="mt-1 text-xs text-slate-600">
                            Schedule:{" "}
                            {stud.studentProfile?.preferredSchedule ||
                              "Not specified"}{" "}
                            · {stud.studentProfile?.weeklyStudyHours || 0}{" "}
                            hrs/week · Level:{" "}
                            {stud.studentProfile?.currentSkillLevel ||
                              "Not specified"}
                          </p>
                          {stud.studentProfile?.learningGoals ? (
                            <p className="mt-1 text-xs text-slate-600">
                              Goals: {stud.studentProfile.learningGoals}
                            </p>
                          ) : null}
                        </div>
                        <button
                          onClick={() => {
                            const classesForStudent = getPlacementClasses(
                              stud._id,
                            );
                            setPlacementModal({
                              open: true,
                              studentId: stud._id,
                              studentName: stud.fullName,
                              classId: classesForStudent[0]?._id || "",
                            });
                          }}
                          disabled={getPlacementClasses(stud._id).length === 0}
                          className="rounded-xl bg-[var(--tlh-blue-primary)] px-3.5 py-2 text-xs font-bold text-white hover:bg-[var(--tlh-blue-hover)] disabled:cursor-not-allowed disabled:bg-slate-300"
                          title={
                            getPlacementClasses(stud._id).length === 0
                              ? "Create a class with available capacity first."
                              : undefined
                          }
                        >
                          Assign cohort
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </DashboardCard>
            </div>
          </div>
        ) : null}

        {/* 2. TEACHERS TAB */}
        {activeTab === "teachers" ? (
          <div className="space-y-6">
            <DashboardCard
              title="All instructors"
              subtitle="All Registered Teachers"
              action={
                <div className="flex flex-wrap gap-2">
                  <input
                    value={teacherSearch}
                    onChange={(event) => setTeacherSearch(event.target.value)}
                    aria-label="Search teachers"
                    placeholder="Search name or email"
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm sm:w-56"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setUserForm({
                        fullName: "",
                        email: "",
                        password: "",
                        role: "teacher",
                      });
                      setCreateUserModal(true);
                    }}
                    className="rounded-xl bg-gradient-to-r from-[var(--tlh-blue-primary)] to-[var(--tlh-sky)] px-4 py-2 text-xs font-bold text-white shadow-sm shadow-blue-500/20 hover:from-[var(--tlh-blue-hover)] hover:to-[var(--tlh-sky)]"
                  >
                    + Add teacher
                  </button>
                </div>
              }
            >
              <div className="divide-y divide-slate-100">
                {visibleTeachers.map((teach) => (
                  <div
                    key={teach._id}
                    className="flex flex-wrap items-center justify-between gap-4 py-4"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-bold text-slate-900">
                          {teach.fullName}
                        </h4>
                        {teach.showcaseProfile?.isPublished && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 dark:bg-emerald-950/80 px-2.5 py-0.5 text-[10px] font-bold text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-600/40">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            Public Showcase
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 mt-0.5">
                        <span>✉️ {teach.email}</span>
                        <span className="font-semibold text-slate-800 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">
                          📞 {teach.phone || "No phone added"}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-slate-600">
                        Expertise:{" "}
                        {teach.teacherProfile?.expertise?.join(", ") ||
                          "General"}
                        {teach.showcaseProfile?.subjectTitle ? ` · Showcase: “${teach.showcaseProfile.subjectTitle}”` : ""}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => openTeacherShowcaseModal(teach)}
                        className="golden-btn rounded-xl px-3 py-1.5 text-xs font-bold text-white shadow-xs inline-flex items-center gap-1.5"
                        title="Customize and publish public profile (does not change teacher personal dashboard)"
                      >
                        <span>✨</span>
                        <span>{teach.showcaseProfile?.isPublished ? "Edit Showcase" : "Customize & Publish"}</span>
                      </button>
                      <Badge
                        variant={
                          teach.accountStatus === "active" ? "emerald" : "rose"
                        }
                      >
                        {teach.accountStatus}
                      </Badge>
                      <button
                        onClick={() =>
                          handleToggleTeacherStatus(
                            teach._id,
                            teach.accountStatus,
                          )
                        }
                        className={`rounded-lg px-3 py-1.5 text-xs font-bold ${
                          teach.accountStatus === "active"
                            ? "bg-rose-100 text-rose-700 hover:bg-rose-200"
                            : "bg-sky-100 text-[var(--tlh-blue-hover)] hover:bg-sky-200"
                        }`}
                      >
                        {teach.accountStatus === "active"
                          ? "Suspend"
                          : "Activate"}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setDeleteUserError("");
                          setDeleteUserPurge(false);
                          setDeleteUserModal({
                            id: teach._id,
                            name: teach.fullName,
                            role: "teacher",
                          });
                        }}
                        className="rounded-lg border border-rose-200 px-3 py-1.5 text-xs font-bold text-rose-700 transition hover:bg-rose-50"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
                {visibleTeachers.length === 0 && (
                  <EmptyState
                    title={
                      teachers.length
                        ? "No teachers match your search"
                        : "No teachers yet"
                    }
                  />
                )}
              </div>
            </DashboardCard>
          </div>
        ) : null}

        {/* 3. STUDENTS TAB */}
        {activeTab === "students" ? (
          <div className="space-y-6">
            <DashboardCard
              title="All learners"
              subtitle="All Registered Students"
              action={
                <div className="flex flex-wrap gap-2">
                  <input
                    value={studentSearch}
                    onChange={(event) => setStudentSearch(event.target.value)}
                    aria-label="Search students"
                    placeholder="Search name or email"
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm sm:w-56"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setUserForm({
                        fullName: "",
                        email: "",
                        password: "",
                        role: "student",
                      });
                      setCreateUserModal(true);
                    }}
                    className="rounded-xl bg-gradient-to-r from-[var(--tlh-blue-primary)] to-[var(--tlh-sky)] px-4 py-2 text-xs font-bold text-white shadow-sm shadow-blue-500/20 hover:from-[var(--tlh-blue-hover)] hover:to-[var(--tlh-sky)]"
                  >
                    + Add learner
                  </button>
                </div>
              }
            >
              <div className="divide-y divide-slate-100">
                {visibleStudents.map((stud) => (
                  <div
                    key={stud._id}
                    className="flex flex-wrap items-center justify-between gap-4 py-4"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-bold text-slate-900">
                          {stud.fullName}
                        </h4>
                        <Badge
                          variant={
                            stud.studentProfile?.placementStatus === "assigned"
                              ? "emerald"
                              : "amber"
                          }
                        >
                          {stud.studentProfile?.placementStatus || "pending"}
                        </Badge>
                        <Badge
                          variant={
                            stud.accountStatus === "active" ? "cyan" : "rose"
                          }
                        >
                          {stud.accountStatus}
                        </Badge>
                      </div>
                      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 mt-0.5">
                        <span>✉️ {stud.email}</span>
                        <span className="font-semibold text-slate-800 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">
                          📞 {stud.phone || "No phone added"}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-slate-600">
                        Goals:{" "}
                        {stud.studentProfile?.learningGoals || "None specified"}{" "}
                        | Level:{" "}
                        {stud.studentProfile?.currentSkillLevel || "Beginner"}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {!stud.isVerified && !stud.emailVerified && (
                        <button
                          type="button"
                          onClick={() => void handleVerifyUserEmail(stud)}
                          className="mb-2 rounded-lg bg-[var(--primary-light)] dark:bg-slate-800 text-[var(--tlh-blue-primary)] dark:text-cyan-300 border border-transparent dark:border-slate-700 hover:bg-blue-100 dark:hover:bg-slate-700 px-3 py-1.5 text-xs font-bold shadow-sm"
                        >
                          ✓ Verify email
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => void handleToggleUserStatus(stud)}
                        className={`mb-2 rounded-lg px-3 py-1.5 text-xs font-bold ${stud.accountStatus === "active" ? "bg-amber-100 text-amber-900 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-300 dark:border-amber-500/30 hover:bg-amber-200" : "golden-btn"}`}
                      >
                        {stud.accountStatus === "active"
                          ? "Suspend"
                          : "Activate"}
                      </button>
                      <button
                        onClick={() => {
                          const classesForStudent = getPlacementClasses(
                            stud._id,
                          );
                          setPlacementModal({
                            open: true,
                            studentId: stud._id,
                            studentName: stud.fullName,
                            classId: classesForStudent[0]?._id || "",
                          });
                        }}
                        disabled={getPlacementClasses(stud._id).length === 0}
                        className="rounded-xl bg-slate-900 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                        title={
                          availableClasses.length === 0
                            ? "No classes have available capacity."
                            : undefined
                        }
                      >
                        {stud.studentProfile?.placementStatus === "assigned"
                          ? "Add another class"
                          : "Assign to class"}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setDeleteUserError("");
                          setDeleteUserPurge(false);
                          setDeleteUserModal({
                            id: stud._id,
                            name: stud.fullName,
                            role: "student",
                          });
                        }}
                        className="ml-2 rounded-lg border border-rose-200 px-3 py-1.5 text-xs font-bold text-rose-700 transition hover:bg-rose-50"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
                {visibleStudents.length === 0 && (
                  <EmptyState
                    title={
                      students.length
                        ? "No students match your search"
                        : "No students yet"
                    }
                  />
                )}
              </div>
            </DashboardCard>
          </div>
        ) : null}

        {/* 4. COURSES TAB */}
        {activeTab === "administrators" ? (
          <div className="space-y-6">
            <DashboardCard
              title="Administrator access"
              subtitle="Create and manage trusted administrator accounts"
              action={
                <button
                  type="button"
                  onClick={() => setCreateAdministratorModal(true)}
                  className="rounded-xl bg-gradient-to-r from-[var(--tlh-blue-primary)] to-[var(--tlh-sky)] px-4 py-2 text-sm font-bold text-white shadow-md shadow-blue-500/25 hover:from-[var(--tlh-blue-hover)] hover:to-[var(--tlh-sky)]"
                >
                  + Add administrator
                </button>
              }
            >
              <div className="divide-y divide-slate-100">
                {administrators.map((administrator) => {
                  const isCurrentUser = administrator._id === user.id;
                  const activeCount = administrators.filter(
                    (item) => item.accountStatus === "active",
                  ).length;
                  const canDisable =
                    !isCurrentUser &&
                    !(
                      administrator.accountStatus === "active" &&
                      activeCount <= 1
                    );
                  return (
                    <div
                      key={administrator._id}
                      className="flex flex-wrap items-center justify-between gap-4 py-4"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-slate-900">
                            {administrator.fullName}
                          </h4>
                          {isCurrentUser && <Badge variant="cyan">You</Badge>}
                        </div>
                        <p className="text-sm text-slate-500">
                          {administrator.email}
                        </p>
                        <p className="mt-1 text-xs text-slate-400">
                          Added{" "}
                          {new Date(
                            administrator.createdAt,
                          ).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge
                          variant={
                            administrator.accountStatus === "active"
                              ? "emerald"
                              : "rose"
                          }
                        >
                          {administrator.accountStatus}
                        </Badge>
                        {!isCurrentUser && (
                          <button
                            type="button"
                            disabled={!canDisable}
                            onClick={() =>
                              void handleToggleAdministratorStatus(
                                administrator,
                              )
                            }
                            className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            {administrator.accountStatus === "active"
                              ? "Suspend"
                              : "Activate"}
                          </button>
                        )}
                        {!isCurrentUser && (
                          <button
                            type="button"
                            onClick={() => {
                              setDeleteUserPurge(false);
                              setDeleteUserModal({
                                id: administrator._id,
                                name: administrator.fullName,
                                role: "admin",
                              });
                            }}
                            className="rounded-lg border border-rose-200 px-3 py-2 text-xs font-bold text-rose-700 hover:bg-rose-50"
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
                {administrators.length === 0 && (
                  <EmptyState title="No administrator accounts found." />
                )}
              </div>
              <p className="mt-4 rounded-xl bg-amber-50 p-3 text-xs leading-5 text-amber-900 ring-1 ring-amber-200">
                For account safety, you cannot suspend or delete yourself, and
                the last active administrator cannot be removed.
              </p>
            </DashboardCard>
          </div>
        ) : null}

        {activeTab === "courses" ? (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="text-xl font-bold text-slate-900">
                Programs and categories
              </h3>
              <div className="flex gap-2">
                <button
                  onClick={() => setCreateCategoryModal(true)}
                  className="rounded-xl bg-white border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50"
                >
                  + {t("createCategory")}
                </button>
                <button
                  onClick={() => setCreateCourseModal(true)}
                  disabled={categories.length === 0}
                  title={
                    categories.length === 0
                      ? "Create a category first."
                      : undefined
                  }
                  className="rounded-xl bg-[var(--tlh-blue-primary)] px-3.5 py-1.5 text-xs font-bold text-white hover:bg-[var(--tlh-blue-hover)] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  + {t("createCourse")}
                </button>
              </div>
            </div>

            <DashboardCard
              title="Learning categories"
              subtitle="Organize the public course catalog"
            >
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {categories.map((category) => (
                  <div
                    key={category._id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-stone-200 p-4"
                  >
                    <div className="min-w-0">
                      <h4 className="truncate text-sm font-bold text-slate-900">
                        {category.name}
                      </h4>
                      <p className="mt-1 line-clamp-2 text-xs text-slate-500">
                        {category.description || "No description"}
                      </p>
                      <Badge variant={category.isActive ? "emerald" : "slate"}>
                        {category.isActive ? "Active" : "Hidden"}
                      </Badge>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <button
                        type="button"
                        onClick={() => void handleToggleCategory(category)}
                        className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50"
                      >
                        {category.isActive ? "Hide" : "Publish"}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingCategoryId(category._id);
                          setCategoryForm({
                            name: category.name,
                            description: category.description || "",
                          });
                          setCreateCategoryModal(true);
                        }}
                        className="rounded-lg border border-stone-200 px-2.5 py-1.5 text-xs font-bold text-slate-700 hover:bg-stone-50"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setDeleteRecord({
                            endpoint: `/api/admin/categories/${category._id}`,
                            label: `Category “${category.name}”`,
                          })
                        }
                        className="rounded-lg border border-rose-200 px-2.5 py-1.5 text-xs font-bold text-rose-700 hover:bg-rose-50"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
                {categories.length === 0 && (
                  <EmptyState title="Create a category to organize courses." />
                )}
              </div>
            </DashboardCard>

            <div className="flex flex-col gap-3 rounded-2xl border border-stone-200 bg-white p-4 sm:flex-row">
              <input
                value={courseSearch}
                onChange={(event) => {
                  setCourseSearch(event.target.value);
                  setCoursePage(1);
                }}
                aria-label="Search courses"
                placeholder="Search title, description, or category"
                className="min-w-0 flex-1 rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm"
              />
              <select
                value={courseCategory}
                onChange={(event) => {
                  setCourseCategory(event.target.value);
                  setCoursePage(1);
                }}
                aria-label="Filter courses by category"
                className="rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm"
              >
                <option value="">All categories ({courses.length})</option>
                {categories.map((category) => {
                  const count = courses.filter(
                    (course) => course.category?._id === category._id,
                  ).length;
                  return count > 0 ? (
                    <option key={category._id} value={category._id}>
                      {category.name} ({count})
                    </option>
                  ) : null;
                })}
              </select>
            </div>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {pagedCourses.map((course) => (
                <div
                  key={course._id}
                  className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <Badge variant="cyan">
                      {course.category?.name || "General"}
                    </Badge>
                    <Badge
                      variant={
                        course.status === "published" ? "emerald" : "slate"
                      }
                    >
                      {course.status}
                    </Badge>
                  </div>
                  <h4 className="text-base font-bold text-slate-900">
                    {course.title}
                  </h4>
                  <p className="text-xs font-semibold text-slate-500">
                    {course.skillLevel}
                  </p>
                  <p className="text-xs text-slate-600 line-clamp-3">
                    {course.description}
                  </p>
                  <div className="border-t border-slate-100 pt-3">
                    <p className="text-[11px] font-bold text-slate-500">
                      Objectives:
                    </p>
                    <ul className="mt-1 space-y-1 text-xs text-slate-600">
                      {course.learningObjectives?.slice(0, 2).map((o, idx) => (
                        <li key={idx} className="flex gap-1">
                          <span>•</span>
                          <span>{o}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="flex gap-2 border-t border-slate-100 pt-3">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingCourseId(course._id);
                        setCourseForm({
                          title: course.title,
                          description: course.description,
                          categoryId: course.category?._id || "",
                          skillLevel: course.skillLevel || "Beginner",
                          objectives: (course.learningObjectives || []).join(
                            "\n",
                          ),
                          status: course.status || "draft",
                        });
                        setCreateCourseModal(true);
                      }}
                      className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
                    >
                      Edit program
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setDeleteRecord({
                          endpoint: `/api/admin/courses/${course._id}`,
                          label: `Program “${course.title}”`,
                        })
                      }
                      className="rounded-lg border border-rose-200 px-3 py-2 text-xs font-bold text-rose-700 hover:bg-rose-50"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
              {visibleCourses.length === 0 && (
                <EmptyState
                  title={
                    courses.length
                      ? "No courses match those filters"
                      : "No courses yet"
                  }
                  description={
                    courses.length
                      ? "Try a different search or category."
                      : "Run the catalog seed or create a course after setting up a learning category."
                  }
                />
              )}
            </div>
            {totalCoursePages > 1 && (
              <div className="flex items-center justify-between rounded-2xl border border-stone-200 bg-white px-4 py-3">
                <p className="text-xs font-medium text-stone-500">
                  Showing {(coursePage - 1) * coursesPerPage + 1}–
                  {Math.min(coursePage * coursesPerPage, visibleCourses.length)}{" "}
                  of {visibleCourses.length}
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={coursePage === 1}
                    onClick={() => setCoursePage((page) => page - 1)}
                    className="rounded-lg border border-stone-200 px-3 py-1.5 text-xs font-bold text-stone-700 disabled:opacity-40"
                  >
                    Previous
                  </button>
                  <button
                    type="button"
                    disabled={coursePage === totalCoursePages}
                    onClick={() => setCoursePage((page) => page + 1)}
                    className="rounded-lg border border-stone-200 px-3 py-1.5 text-xs font-bold text-stone-700 disabled:opacity-40"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : null}

        {/* 5. CLASSES TAB */}
        {activeTab === "classes" ? (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                Active cohorts
              </h3>
              <button
                onClick={() => setCreateClassModal(true)}
                className="golden-btn px-4 py-2 text-xs font-bold text-white shadow-sm"
              >
                + {t("createClass")}
              </button>
            </div>

            <div className="grid gap-6 md:grid-cols-2 items-start">
              {classes.map((cls) => (
                <div
                  key={cls._id}
                  className="rounded-2xl bg-white dark:bg-slate-900 p-6 shadow-sm ring-1 ring-slate-200 dark:ring-slate-800 space-y-4"
                >
                  <div className="flex items-center justify-between">
                    <h4 className="text-lg font-bold text-slate-900 dark:text-white">
                      {cls.title}
                    </h4>
                    <Badge
                      variant={cls.status === "active" ? "emerald" : "slate"}
                    >
                      {cls.status}
                    </Badge>
                  </div>
                  <div className="space-y-1.5 text-xs text-slate-600 dark:text-slate-300">
                    <p>
                      <strong className="text-slate-800 dark:text-white">Program:</strong>{" "}
                      {cls.course?.title || "Unassigned"}
                    </p>
                    <p>
                      <strong className="text-slate-800 dark:text-white">Instructor:</strong>{" "}
                      {cls.teacher?.fullName || "Unassigned"}
                    </p>
                    <p>
                      <strong className="text-slate-800 dark:text-white">Learners:</strong> {cls.students?.length || 0} /{" "}
                      {cls.capacity} (capacity)
                    </p>
                    <p>
                      <strong className="text-slate-800 dark:text-white">Time zone:</strong> {cls.timeZone}
                    </p>
                  </div>
                  <details className="rounded-xl border border-slate-200 dark:border-slate-800 px-3 py-2">
                    <summary className="cursor-pointer text-xs font-bold text-slate-700 dark:text-slate-200">
                      Manage learner roster ({cls.students?.length || 0})
                    </summary>
                    <div className="mt-3 divide-y divide-slate-100 dark:divide-slate-800">
                      {cls.students?.length ? (
                        cls.students.map((student) => (
                          <div
                            key={student._id}
                            className="flex flex-wrap items-center justify-between gap-2 py-2"
                          >
                            <div className="min-w-0">
                              <p className="truncate text-xs font-bold text-slate-800 dark:text-white">
                                {student.fullName}
                              </p>
                              <p className="truncate text-[11px] text-slate-500 dark:text-slate-400">
                                {student.email}
                              </p>
                            </div>
                            <button
                              type="button"
                              disabled={removingStudentId === student._id}
                              onClick={() =>
                                void handleRemoveStudentFromClass(cls, student)
                              }
                              className="shrink-0 rounded-lg border border-rose-200 dark:border-rose-500/40 px-2.5 py-1.5 text-[11px] font-bold text-rose-700 dark:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/40 disabled:cursor-wait disabled:opacity-50 transition"
                            >
                              {removingStudentId === student._id
                                ? "Removing…"
                                : "Remove from cohort"}
                            </button>
                          </div>
                        ))
                      ) : (
                        <p className="py-2 text-xs text-slate-500 dark:text-slate-400">
                          No learners are assigned.
                        </p>
                      )}
                    </div>
                    <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">
                      To move a learner, remove them here, then use Assign to
                      class in the Students tab.
                    </p>
                  </details>
                  <a
                    href={`${(import.meta.env.VITE_PUBLIC_URL || "").replace(/\/$/, "")}/workspace/${cls._id}?tab=tracking`}
                    className="golden-btn flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-white shadow-sm transition active:scale-[0.99]"
                  >
                    <span>🎓 Enter Learning Space & Track Cohort</span>
                    <span className="text-sm">→</span>
                  </a>
                  <button
                    type="button"
                    onClick={() =>
                      setTeacherAssignmentModal({
                        open: true,
                        classId: cls._id,
                        classTitle: cls.title,
                        teacherId: cls.teacher?._id || "",
                      })
                    }
                    className="w-full rounded-xl border border-blue-200 dark:border-slate-700 bg-blue-50 dark:bg-slate-800 px-3 py-2 text-sm font-bold text-[var(--tlh-blue-hover)] dark:text-cyan-300 transition hover:bg-blue-100 dark:hover:bg-slate-700"
                  >
                    {cls.teacher ? "Change teacher" : "Assign teacher"}
                  </button>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingClassId(cls._id);
                        setClassForm({
                          title: cls.title,
                          courseId: cls.course?._id || "",
                          teacherId: cls.teacher?._id || "",
                          capacity: cls.capacity,
                          timeZone: cls.timeZone || "Africa/Addis_Ababa",
                          description: cls.description || "",
                          status: cls.status,
                        });
                        setCreateClassModal(true);
                      }}
                      className="flex-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition"
                    >
                      Edit cohort
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setDeleteRecord({
                          endpoint: `/api/admin/classes/${cls._id}`,
                          label: `Cohort “${cls.title}” and its related learning records`,
                        })
                      }
                      className="rounded-xl border border-rose-200 dark:border-rose-500/40 bg-white dark:bg-rose-950/30 px-3 py-2 text-sm font-bold text-rose-700 dark:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-900/40 transition"
                    >
                      Delete
                    </button>
                  </div>
                  <div className="border-t border-slate-100 pt-3">
                    <div className="mb-2 flex items-center justify-between">
                      <h5 className="text-xs font-extrabold uppercase tracking-wide text-slate-500">
                        Sessions
                      </h5>
                      <button
                        type="button"
                        disabled={!cls.teacher?._id}
                        onClick={() => {
                          setEditingSessionId("");
                          setSessionForm({
                            classId: cls._id,
                            title: "",
                            description: "",
                            startsAt: "",
                            endsAt: "",
                            meetingUrl: "",
                            status: "scheduled",
                            recurrencePattern: "none",
                            recurrenceInterval: 1,
                            recurrenceOccurrences: 4,
                          });
                          setCreateSessionModal(true);
                        }}
                        className="golden-btn rounded-lg px-2.5 py-1 text-[11px] font-bold text-white shadow-xs transition disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        + Schedule
                      </button>
                    </div>
                    <div className="space-y-2 max-h-[460px] overflow-y-auto pr-1">
                      {sessions
                        .filter(
                          (session) =>
                            String(
                              session.classroom?._id ?? session.classroom,
                            ) === cls._id,
                        )
                        .map((session) => {
                          const startsAt = new Date(session.startsAt).getTime();
                          const endsAt = new Date(session.endsAt).getTime();
                          const isLive =
                            session.status === "scheduled" &&
                            startsAt <= currentTime &&
                            endsAt > currentTime;
                          const statusLabel = isLive
                            ? "Live now"
                            : session.status;
                          return (
                            <div
                              key={session._id}
                              className="rounded-lg bg-stone-50 dark:bg-slate-800/80 border border-slate-200/90 dark:border-slate-700 p-3"
                            >
                              <div className="flex flex-wrap items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <p className="truncate text-xs font-bold text-slate-800 dark:text-white">
                                    {session.title}
                                  </p>
                                  <p className="text-[11px] text-slate-500">
                                    {formatSessionTime(
                                      session.startsAt,
                                      cls.timeZone,
                                    )}{" "}
                                    ·{" "}
                                    {formatSessionTime(
                                      session.endsAt,
                                      cls.timeZone,
                                    )}
                                  </p>
                                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                                    <span
                                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                                        isLive
                                          ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-400/40"
                                          : session.status === "completed"
                                          ? "golden-btn text-white shadow-xs"
                                          : session.status === "scheduled"
                                          ? "bg-amber-100 text-amber-900 dark:bg-[#C59B27]/25 dark:text-[#E8C766] border border-amber-300 dark:border-[#C59B27]/50"
                                          : "bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                                      }`}
                                    >
                                      {statusLabel}
                                    </span>
                                    {session.recurrencePattern &&
                                    session.recurrencePattern !== "none" ? (
                                      <span className="inline-flex rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-bold text-indigo-700">
                                        {{
                                          daily: "Daily",
                                          weekly: "Weekly",
                                          biweekly: "Every 2 weeks",
                                          monthly: "Monthly",
                                        }[session.recurrencePattern] ||
                                          session.recurrencePattern}
                                        {typeof session.recurrenceIndex ===
                                        "number"
                                          ? ` · ${session.recurrenceIndex + 1}${session.recurrenceCount ? `/${session.recurrenceCount}` : ""}`
                                          : ""}
                                      </span>
                                    ) : null}
                                  </div>
                                  <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                                    {cls.teacher?.fullName || "No teacher"} ·{" "}
                                    {cls.students?.length || 0} learners ·{" "}
                                    {cls.timeZone}
                                  </p>
                                </div>
                                {session.meetingUrl ? (
                                  <a
                                    href={session.meetingUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="golden-btn px-3 py-1.5 text-[11px] font-bold text-white shadow-sm inline-flex items-center gap-1"
                                  >
                                    <span>📹</span>
                                    <span>Open Meet</span>
                                  </a>
                                ) : (
                                  <span className="text-[10px] font-semibold text-amber-700 dark:text-amber-400">
                                    Meet link missing
                                  </span>
                                )}
                              </div>
                              <div className="mt-2 flex flex-wrap gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingSessionId(session._id);
                                    setSessionForm({
                                      classId: cls._id,
                                      title: session.title,
                                      description: session.description || "",
                                      startsAt: formatDateTimeInput(
                                        session.startsAt,
                                        cls.timeZone,
                                      ),
                                      endsAt: formatDateTimeInput(
                                        session.endsAt,
                                        cls.timeZone,
                                      ),
                                      meetingUrl: session.meetingUrl || "",
                                      status: session.status,
                                      recurrencePattern: "none",
                                      recurrenceInterval: 1,
                                      recurrenceOccurrences: 4,
                                    });
                                    setCreateSessionModal(true);
                                  }}
                                  className="rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-1 text-[11px] font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition"
                                >
                                  Edit / control
                                </button>
                                {session.status === "scheduled" && (
                                  <>
                                    <button
                                      type="button"
                                      disabled={
                                        updatingSessionId === session._id
                                      }
                                      onClick={() =>
                                        handleSessionStatusChange(
                                          session,
                                          "completed",
                                        )
                                      }
                                      className="golden-btn rounded-md px-2.5 py-1 text-[11px] font-bold text-white shadow-xs disabled:opacity-50 transition"
                                    >
                                      Mark complete
                                    </button>
                                    <button
                                      type="button"
                                      disabled={
                                        updatingSessionId === session._id
                                      }
                                      onClick={() =>
                                        handleSessionStatusChange(
                                          session,
                                          "cancelled",
                                        )
                                      }
                                      className="rounded-md border border-amber-300 dark:border-amber-500/40 bg-amber-50/60 dark:bg-amber-950/40 px-2 py-1 text-[11px] font-bold text-amber-900 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/40 disabled:opacity-50 transition"
                                    >
                                      Cancel session
                                    </button>
                                  </>
                                )}
                                <button
                                  type="button"
                                  onClick={() =>
                                    setDeleteRecord({
                                      endpoint: `/api/admin/sessions/${session._id}`,
                                      label: `Session “${session.title}” and its attendance`,
                                    })
                                  }
                                  className="rounded-md border border-rose-300 dark:border-rose-500/40 bg-rose-50/60 dark:bg-rose-950/40 px-2 py-1 text-[11px] font-bold text-rose-800 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-900/40 transition"
                                >
                                  Delete
                                </button>
                                {session.seriesId ? (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setDeleteRecord({
                                        endpoint: `/api/admin/sessions/${session._id}?series=true`,
                                        label: `The entire weekly series for “${session.title}”`,
                                      })
                                    }
                                    className="rounded-md border border-purple-300 dark:border-purple-500/40 bg-purple-50/60 dark:bg-purple-950/40 px-2 py-1 text-[11px] font-bold text-purple-800 dark:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-900/40 transition"
                                  >
                                    Delete series
                                  </button>
                                ) : null}
                              </div>
                            </div>
                          );
                        })}
                      {!sessions.some(
                        (session) =>
                          String(
                            session.classroom?._id ?? session.classroom,
                          ) === cls._id,
                      ) && (
                        <p className="text-xs text-slate-400">
                          No sessions scheduled.
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              {classes.length === 0 && (
                <EmptyState
                  title="No classes yet"
                  description="Create a class and assign an active teacher to begin scheduling lessons."
                />
              )}
            </div>
          </div>
        ) : null}

        {/* CERTIFICATES & RESULTS REVIEW TAB */}
        {activeTab === "certificates" ? (
          <div className="space-y-6">
            <DashboardCard
              title="Certificate management"
              subtitle="Review results published by teachers and issue verified certificates."
            >
              <div className="flex flex-wrap items-center gap-3">
                <MetricCard
                  label="Issued certificates"
                  value={certificates.length}
                />
                <MetricCard
                  label="Awaiting issuance"
                  value={eligibleCertificates.length}
                />
                <MetricCard
                  label="Pass mark"
                  value={`${certificateThreshold}%`}
                />
              </div>

              {certificatesLoading ? (
                <p className="mt-4 text-sm text-slate-500">
                  Loading certificates and results…
                </p>
              ) : null}

              <form
                onSubmit={handleManualIssueCertificate}
                className="mt-6 grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 lg:grid-cols-3"
              >
                <label className="block text-xs font-bold text-slate-700">
                  Cohort
                  <select
                    value={certificateForm.classroomId}
                    onChange={(e) =>
                      setCertificateForm({
                        ...certificateForm,
                        classroomId: e.target.value,
                        studentId: "",
                      })
                    }
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-2.5 text-sm"
                  >
                    <option value="">Select a cohort</option>
                    {classes.map((cls) => (
                      <option key={cls._id} value={cls._id}>
                        {cls.title}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-xs font-bold text-slate-700">
                  Learner
                  <select
                    value={certificateForm.studentId}
                    onChange={(e) =>
                      setCertificateForm({
                        ...certificateForm,
                        studentId: e.target.value,
                      })
                    }
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-2.5 text-sm"
                  >
                    <option value="">Select a learner</option>
                    {(
                      classes.find(
                        (cls) => cls._id === certificateForm.classroomId,
                      )?.students || []
                    ).map((student) => (
                      <option key={student._id} value={student._id}>
                        {student.fullName}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-xs font-bold text-slate-700">
                  Overall score (optional)
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={certificateForm.overallScore}
                    onChange={(e) =>
                      setCertificateForm({
                        ...certificateForm,
                        overallScore: e.target.value,
                      })
                    }
                    className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 text-sm"
                    placeholder="Defaults to published score"
                  />
                </label>
                <label className="block text-xs font-bold text-slate-700">
                  Notes (optional)
                  <input
                    type="text"
                    maxLength={500}
                    value={certificateForm.notes}
                    onChange={(e) =>
                      setCertificateForm({
                        ...certificateForm,
                        notes: e.target.value,
                      })
                    }
                    className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 text-sm"
                    placeholder="Recorded on the credential"
                  />
                </label>
                <label className="block text-xs font-bold text-slate-700">
                  Signatory name
                  <input
                    type="text"
                    maxLength={120}
                    value={certificateForm.signatureName}
                    onChange={(e) =>
                      setCertificateForm({
                        ...certificateForm,
                        signatureName: e.target.value,
                      })
                    }
                    className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 text-sm"
                    placeholder="e.g. Dr. Abebe Tadesse"
                  />
                </label>
                <label className="block text-xs font-bold text-slate-700">
                  Signatory title
                  <input
                    type="text"
                    maxLength={120}
                    value={certificateForm.signatureTitle}
                    onChange={(e) =>
                      setCertificateForm({
                        ...certificateForm,
                        signatureTitle: e.target.value,
                      })
                    }
                    className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 text-sm"
                    placeholder="e.g. Academy Director"
                  />
                </label>
                <label className="block text-xs font-bold text-slate-700 lg:col-span-2">
                  Signature image (optional)
                  <input
                    type="file"
                    accept="image/png,image/jpeg"
                    onChange={handleSignatureUpload}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-2 text-xs file:mr-3 file:rounded-lg file:border-0 file:bg-slate-900 file:px-3 file:py-1.5 file:text-xs file:font-bold file:text-white"
                  />
                  {certificateForm.signatureImage ? (
                    <span className="mt-1 flex items-center gap-2 text-[11px] font-semibold text-emerald-700">
                      <img
                        src={certificateForm.signatureImage}
                        alt="Signature preview"
                        className="h-8 object-contain"
                      />
                      Signature attached
                    </span>
                  ) : null}
                </label>
                <div className="flex items-end gap-2">
                  <button
                    type="button"
                    disabled={Boolean(certificateBusyKey)}
                    onClick={(e) =>
                      void handleManualIssueCertificate(e, "draft")
                    }
                    className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-xs font-bold text-slate-800 hover:bg-slate-100 disabled:opacity-60"
                  >
                    Save as draft
                  </button>
                  <button
                    type="submit"
                    disabled={Boolean(certificateBusyKey)}
                    className="w-full rounded-xl bg-gradient-to-r from-[var(--tlh-blue-primary)] to-[var(--tlh-sky)] px-4 py-2.5 text-xs font-bold text-white shadow-md shadow-blue-500/25 hover:from-[var(--tlh-blue-hover)] hover:to-[var(--tlh-sky)] disabled:opacity-60"
                  >
                    Publish certificate
                  </button>
                </div>
              </form>

              <div className="mt-8">
                <h4 className="text-sm font-bold text-slate-900">
                  Awaiting issuance
                </h4>
                {eligibleCertificates.length === 0 ? (
                  <p className="mt-2 text-xs text-slate-500">
                    No learners have a published result at or above the pass
                    mark awaiting a certificate.
                  </p>
                ) : (
                  <div className="mt-3 space-y-3">
                    {eligibleCertificates.map((item) => {
                      const key = `${item.student._id}-${item.classroom._id}`;
                      return (
                        <div
                          key={key}
                          className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50/50 p-4"
                        >
                          <div>
                            <p className="text-sm font-bold text-slate-900">
                              {item.student.fullName}
                            </p>
                            <p className="text-xs text-slate-500">
                              {item.course?.title || item.classroom.title} ·{" "}
                              {item.classroom.title} · Period {item.period}
                            </p>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="rounded-xl bg-white px-3 py-1 text-sm font-black text-emerald-700">
                              {item.overallScore}%
                            </span>
                            <button
                              type="button"
                              disabled={certificateBusyKey === key}
                              onClick={() =>
                                void handleIssueCertificate(
                                  item.student._id,
                                  item.classroom._id,
                                  item.overallScore,
                                )
                              }
                              className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white hover:bg-slate-800 disabled:opacity-60"
                            >
                              {certificateBusyKey === key
                                ? "Issuing…"
                                : "Issue certificate"}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="mt-8">
                <h4 className="text-sm font-bold text-slate-900">
                  Issued certificates
                </h4>
                {certificates.length === 0 ? (
                  <p className="mt-2 text-xs text-slate-500">
                    No certificates have been issued yet.
                  </p>
                ) : (
                  <div className="mt-3 overflow-x-auto">
                    <table className="w-full min-w-[720px] text-left text-xs">
                      <thead>
                        <tr className="border-b border-slate-200 text-slate-500 uppercase tracking-wider">
                          <th className="py-2 pr-3 font-bold">Number</th>
                          <th className="py-2 px-3 font-bold">Learner</th>
                          <th className="py-2 px-3 font-bold">Course</th>
                          <th className="py-2 px-3 font-bold">Score</th>
                          <th className="py-2 px-3 font-bold">Issued</th>
                          <th className="py-2 px-3 font-bold">Status</th>
                          <th className="py-2 pl-3 font-bold">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {certificates.map((cert) => (
                          <tr key={cert._id}>
                            <td className="py-2.5 pr-3 font-mono font-semibold text-slate-700">
                              {cert.certificateNumber}
                            </td>
                            <td className="py-2.5 px-3 text-slate-800">
                              {cert.student?.fullName || cert.studentName}
                            </td>
                            <td className="py-2.5 px-3 text-slate-600">
                              {cert.courseTitle}
                            </td>
                            <td className="py-2.5 px-3 font-bold text-slate-900">
                              {cert.overallScore}%
                            </td>
                            <td className="py-2.5 px-3 text-slate-600">
                              {new Date(cert.issueDate).toLocaleDateString()}
                            </td>
                            <td className="py-2.5 px-3">
                              <Badge
                                variant={
                                  cert.status === "revoked"
                                    ? "rose"
                                    : cert.status === "draft"
                                      ? "amber"
                                      : "emerald"
                                }
                              >
                                {cert.status === "valid"
                                  ? "published"
                                  : cert.status}
                              </Badge>
                            </td>
                            <td className="py-2.5 pl-3">
                              <div className="flex items-center gap-2">
                                {cert.status === "draft" && (
                                  <button
                                    type="button"
                                    disabled={certificateBusyKey === cert._id}
                                    onClick={() =>
                                      void handleCertificateStatus(
                                        cert,
                                        "published",
                                      )
                                    }
                                    className="golden-btn rounded-lg px-3 py-1.5 text-[11px] font-bold text-white shadow-xs disabled:opacity-60"
                                  >
                                    Publish
                                  </button>
                                )}
                                <button
                                  type="button"
                                  disabled={certificateBusyKey === cert._id}
                                  onClick={() =>
                                    void handleCertificateStatus(
                                      cert,
                                      cert.status === "revoked"
                                        ? "published"
                                        : "revoked",
                                    )
                                  }
                                  className={`rounded-lg px-3 py-1.5 text-[11px] font-bold disabled:opacity-60 ${
                                    cert.status === "revoked"
                                      ? "bg-[var(--primary-light)] text-[var(--tlh-blue-primary)] hover:bg-blue-100"
                                      : "bg-rose-50 text-rose-700 hover:bg-rose-100"
                                  }`}
                                >
                                  {cert.status === "revoked"
                                    ? "Reinstate"
                                    : "Revoke"}
                                </button>
                                <button
                                  type="button"
                                  disabled={certificateBusyKey === cert._id}
                                  onClick={() =>
                                    setDeleteRecord({
                                      endpoint: `/api/admin/certificates/${cert._id}`,
                                      label: `Certificate ${cert.certificateNumber} for “${cert.student?.fullName || cert.studentName}”`,
                                    })
                                  }
                                  className="rounded-lg border border-rose-200 px-3 py-1.5 text-[11px] font-bold text-rose-700 hover:bg-rose-50 disabled:opacity-60"
                                >
                                  Delete
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </DashboardCard>

            <DashboardCard
              title="Published results"
              subtitle="Results teachers released to the academy and learners."
            >
              {publishedResults.attempts.length === 0 &&
              publishedResults.reports.length === 0 ? (
                <EmptyState
                  title="No results published yet."
                  description="Assessment and progress results appear here as soon as teachers release them."
                />
              ) : (
                <div className="space-y-3">
                  {publishedResults.attempts.map((attempt) => (
                    <div
                      key={attempt._id}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 p-4"
                    >
                      <div>
                        <p className="text-sm font-bold text-slate-900">
                          {attempt.student?.fullName} ·{" "}
                          {attempt.assessment?.title}
                        </p>
                        <p className="text-xs text-slate-500">
                          {attempt.classroom?.title} ·{" "}
                          {attempt.assessment?.assessmentType || "Assessment"}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="rounded-xl bg-blue-50 px-3 py-1 text-sm font-black text-[var(--tlh-blue-hover)]">
                          {attempt.score ?? 0}/{attempt.maxScore ?? 100}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            setDeleteRecord({
                              endpoint: `/api/admin/attempts/${attempt._id}`,
                              label: `Assessment submission by “${attempt.student?.fullName || "learner"}”`,
                            })
                          }
                          className="rounded-lg border border-rose-200 px-3 py-1.5 text-[11px] font-bold text-rose-700 hover:bg-rose-50"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                  {publishedResults.reports.map((report) => (
                    <div
                      key={report._id}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 p-4"
                    >
                      <div>
                        <p className="text-sm font-bold text-slate-900">
                          {report.student?.fullName} · Progress report
                        </p>
                        <p className="text-xs text-slate-500">
                          {report.classroom?.title} · Period {report.period} ·{" "}
                          {report.teacher?.fullName || "Teacher"}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="rounded-xl bg-emerald-50 px-3 py-1 text-sm font-black text-emerald-700">
                          {report.overallScore}%
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            setDeleteRecord({
                              endpoint: `/api/admin/progress-reports/${report._id}`,
                              label: `Progress report for “${report.student?.fullName || "learner"}” (${report.period})`,
                            })
                          }
                          className="rounded-lg border border-rose-200 px-3 py-1.5 text-[11px] font-bold text-rose-700 hover:bg-rose-50"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </DashboardCard>
          </div>
        ) : null}

        {/* COHORT ATTENDANCE REGISTER TAB */}
        {activeTab === "class_attendance" ? (
          <DashboardCard
            title="Cohort attendance register"
            subtitle="Total attendance per cohort with cumulative totals for every learner."
          >
            <select
              value={registerClassroomId}
              onChange={(e) => void loadCohortRegister(e.target.value)}
              className="w-full sm:w-96 rounded-xl border border-slate-200 bg-white p-2.5 text-xs outline-none"
            >
              <option value="">Select a cohort</option>
              {classes.map((cls) => (
                <option key={cls._id} value={cls._id}>
                  {cls.title}
                </option>
              ))}
            </select>

            {registerLoading ? (
              <p className="mt-4 text-sm text-slate-500">Loading register…</p>
            ) : cohortRegister ? (
              <div className="mt-5 space-y-6">
                <div className="flex flex-wrap gap-3">
                  <MetricCard
                    label="Sessions held"
                    value={cohortRegister.summary?.sessions ?? 0}
                  />
                  <MetricCard
                    label="Records marked"
                    value={cohortRegister.summary?.records ?? 0}
                  />
                  <MetricCard
                    label="Cohort rate"
                    value={`${cohortRegister.summary?.attendanceRate ?? 0}%`}
                  />
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[720px] text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-500 uppercase tracking-wider">
                        <th className="py-2 pr-3 font-bold">Learner</th>
                        {cohortRegister.sessions?.map((session, index) => (
                          <th
                            key={session._id}
                            className="py-2 px-2 text-center font-bold"
                            title={session.title}
                          >
                            S{index + 1}
                          </th>
                        ))}
                        <th className="py-2 px-3 font-bold">Present</th>
                        <th className="py-2 px-3 font-bold">Absent</th>
                        <th className="py-2 pl-3 font-bold">Rate</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {cohortRegister.students?.map((row) => (
                        <tr key={row._id}>
                          <td className="py-2.5 pr-3 font-semibold text-slate-900">
                            {row.fullName || row.name}
                          </td>
                          {cohortRegister.sessions?.map((session) => {
                            const status =
                              row.bySession?.[session._id] || undefined;
                            return (
                              <td
                                key={session._id}
                                className={`py-2.5 px-2 text-center font-bold ${
                                  status === "present"
                                    ? "text-emerald-600"
                                    : status === "absent"
                                      ? "text-rose-600"
                                      : status === "late"
                                        ? "text-amber-600"
                                        : status === "excused"
                                          ? "text-slate-500"
                                          : "text-slate-300"
                                }`}
                              >
                                {status
                                  ? status.charAt(0).toUpperCase()
                                  : "–"}
                              </td>
                            );
                          })}
                          <td className="py-2.5 px-3 font-semibold text-emerald-600">
                            {row.present}
                          </td>
                          <td className="py-2.5 px-3 font-semibold text-rose-600">
                            {row.absent}
                          </td>
                          <td className="py-2.5 pl-3 font-bold text-slate-900">
                            {row.attendanceRate}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="text-[11px] text-slate-500">
                  Legend: P = present, L = late, A = absent, E = excused, – = not
                  marked.
                </p>
              </div>
            ) : (
              <p className="mt-4 text-sm text-slate-500">
                Select a cohort to view its attendance register.
              </p>
            )}
          </DashboardCard>
        ) : null}

        {/* TEACHER ATTENDANCE TAB */}
        {activeTab === "teacher_attendance" ? (
          <DashboardCard
            title="Teacher attendance"
            subtitle="Attendance recorded by teachers for each teaching day (session)."
          >
            <div className="mb-6 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <h4 className="text-sm font-bold text-slate-900">
                Record teaching attendance
              </h4>
              <p className="mt-1 text-xs text-slate-500">
                Mark whether an instructor attended a scheduled teaching day.
                Recording an existing day updates that entry.
              </p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <select
                  value={teacherAttendanceForm.teacherId}
                  onChange={(e) =>
                    setTeacherAttendanceForm((prev) => ({
                      ...prev,
                      teacherId: e.target.value,
                      sessionId: "",
                    }))
                  }
                  className="rounded-xl border border-slate-200 bg-white p-2.5 text-xs outline-none"
                >
                  <option value="">Select instructor</option>
                  {teachers.map((teacher) => (
                    <option key={teacher._id} value={teacher._id}>
                      {teacher.fullName || teacher.name}
                    </option>
                  ))}
                </select>
                <select
                  value={teacherAttendanceForm.sessionId}
                  onChange={(e) =>
                    setTeacherAttendanceForm((prev) => ({
                      ...prev,
                      sessionId: e.target.value,
                    }))
                  }
                  disabled={!teacherAttendanceForm.teacherId}
                  className="rounded-xl border border-slate-200 bg-white p-2.5 text-xs outline-none disabled:opacity-60"
                >
                  <option value="">Select teaching day</option>
                  {sessions
                    .filter(
                      (session) =>
                        String(session.teacher) ===
                        teacherAttendanceForm.teacherId,
                    )
                    .map((session) => (
                      <option key={session._id} value={session._id}>
                        {new Date(session.startsAt).toLocaleDateString()} ·{" "}
                        {session.classroom?.title || ""} · {session.title}
                      </option>
                    ))}
                </select>
                <select
                  value={teacherAttendanceForm.status}
                  onChange={(e) =>
                    setTeacherAttendanceForm((prev) => ({
                      ...prev,
                      status: e.target.value,
                    }))
                  }
                  className="rounded-xl border border-slate-200 bg-white p-2.5 text-xs outline-none"
                >
                  <option value="present">Present</option>
                  <option value="late">Late</option>
                  <option value="absent">Absent</option>
                  <option value="excused">Excused</option>
                </select>
                <button
                  type="button"
                  disabled={
                    teacherAttendanceSaving ||
                    !teacherAttendanceForm.sessionId
                  }
                  onClick={() => void handleRecordTeacherAttendance()}
                  className="rounded-xl bg-gradient-to-r from-[var(--tlh-blue-primary)] to-[var(--tlh-sky)] px-4 py-2.5 text-xs font-bold text-white shadow-md shadow-blue-500/25 hover:from-[var(--tlh-blue-hover)] hover:to-[var(--tlh-sky)] disabled:opacity-50"
                >
                  {teacherAttendanceSaving ? "Recording…" : "Record"}
                </button>
              </div>
              <input
                type="text"
                value={teacherAttendanceForm.notes}
                onChange={(e) =>
                  setTeacherAttendanceForm((prev) => ({
                    ...prev,
                    notes: e.target.value,
                  }))
                }
                placeholder="Optional note (e.g. arrived 10 minutes late)"
                className="mt-3 w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs outline-none"
              />
            </div>
            {teacherAttendanceLoading ? (
              <p className="text-sm text-slate-500">
                Loading teacher attendance…
              </p>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[720px] text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-500 uppercase tracking-wider">
                        <th className="py-2 pr-3 font-bold">Teacher</th>
                        <th className="py-2 px-3 font-bold">Present</th>
                        <th className="py-2 px-3 font-bold">Late</th>
                        <th className="py-2 px-3 font-bold">Absent</th>
                        <th className="py-2 px-3 font-bold">Excused</th>
                        <th className="py-2 px-3 font-bold">Logged days</th>
                        <th className="py-2 px-3 font-bold">Upcoming</th>
                        <th className="py-2 pl-3 font-bold">Rate</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {teacherAttendance.summary?.map((row) => (
                        <tr key={row.teacher?._id}>
                          <td className="py-2.5 pr-3 font-semibold text-slate-900">
                            {row.teacher?.fullName}
                            <span className="block text-[11px] font-normal text-slate-400">
                              {row.teacher?.email}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 font-semibold text-emerald-600">
                            {row.present}
                          </td>
                          <td className="py-2.5 px-3 font-semibold text-amber-600">
                            {row.late}
                          </td>
                          <td className="py-2.5 px-3 font-semibold text-rose-600">
                            {row.absent}
                          </td>
                          <td className="py-2.5 px-3 text-slate-600">
                            {row.excused}
                          </td>
                          <td className="py-2.5 px-3 text-slate-600">
                            {row.loggedSessions}
                          </td>
                          <td className="py-2.5 px-3 text-slate-600">
                            {row.scheduledTeachingDays}
                          </td>
                          <td className="py-2.5 pl-3 font-bold text-slate-900">
                            {row.attendanceRate}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="mt-8">
                  <h4 className="text-sm font-bold text-slate-900">
                    Recent records
                  </h4>
                  {teacherAttendance.records.length === 0 ? (
                    <p className="mt-2 text-xs text-slate-500">
                      No teaching attendance has been recorded yet.
                    </p>
                  ) : (
                    <div className="mt-3 divide-y divide-slate-100">
                      {teacherAttendance.records.slice(0, 25).map((rec) => (
                        <div
                          key={rec._id}
                          className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-xs"
                        >
                          <div>
                            <span className="font-bold text-slate-900">
                              {rec.teacher?.fullName} ·{" "}
                              {rec.session?.title || "Teaching day"}
                            </span>
                            <p className="text-slate-400">
                              {rec.classroom?.title
                                ? `${rec.classroom.title} · `
                                : ""}
                              {new Date(
                                rec.teachingDate || rec.createdAt,
                              ).toLocaleDateString()}
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
                            {rec.status}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </DashboardCard>
        ) : null}

        {/* SUBMISSIONS & STORAGE TAB */}
        {activeTab === "submissions" ? (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-xl font-bold text-slate-900">
                  Submissions &amp; uploaded files
                </h3>
                <p className="mt-1 text-sm text-slate-600">
                  Review or permanently remove learner assignment uploads and
                  assessment submissions to keep storage lean.
                </p>
              </div>
              <button
                type="button"
                disabled={submissionsLoading}
                onClick={() => void loadSubmissions()}
                className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                {submissionsLoading ? "Refreshing…" : "Refresh"}
              </button>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <MetricCard
                label="Assignment submissions"
                value={submissionData.submissions.length}
                icon="📝"
              />
              <MetricCard
                label="Assessment submissions"
                value={submissionData.attempts.length}
                icon="✅"
              />
              <MetricCard
                label="Stored files"
                value={`${submissionData.storage.fileCount} · ${(submissionData.storage.totalBytes / (1024 * 1024)).toFixed(1)} MB`}
                icon="💾"
              />
            </div>

            <div className="flex flex-wrap gap-2">
              {[
                { id: "all", label: "All" },
                { id: "assignments", label: "Assignments" },
                { id: "assessments", label: "Assessments" },
              ].map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setSubmissionFilter(option.id)}
                  className={`rounded-xl px-4 py-2 text-xs font-bold ${submissionFilter === option.id ? "bg-slate-900 text-white" : "border border-slate-200 text-slate-700 hover:bg-slate-50"}`}
                >
                  {option.label}
                </button>
              ))}
            </div>

            {submissionFilter !== "assessments" ? (
              <div className="space-y-3">
                <h4 className="text-xs font-extrabold uppercase tracking-wide text-slate-500">
                  Assignment submissions
                </h4>
                {submissionData.submissions.length === 0 ? (
                  <EmptyState title="No assignment submissions yet." />
                ) : (
                  submissionData.submissions.map((sub) => (
                    <div
                      key={sub._id}
                      className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-bold text-slate-900">
                            {sub.student?.fullName ||
                              sub.student?.name ||
                              "Learner"}
                          </p>
                          <p className="text-xs text-slate-500">
                            {sub.assignment?.title || "Assignment"} ·{" "}
                            {sub.classroom?.title || "Cohort"} ·{" "}
                            {sub.student?.email || ""}
                          </p>
                        </div>
                        <span
                          className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${sub.status === "graded" ? "bg-[var(--primary-light)] text-[var(--tlh-blue-primary)]" : "bg-amber-100 text-amber-700"}`}
                        >
                          {sub.status === "graded"
                            ? `Graded ${sub.score}/${sub.assignment?.maxScore ?? ""}`
                            : "Awaiting review"}
                        </span>
                      </div>
                      {sub.textResponse ? (
                        <p className="whitespace-pre-wrap text-xs text-slate-600">
                          {sub.textResponse}
                        </p>
                      ) : null}
                      {sub.submissionLinks?.length ? (
                        <div className="flex flex-wrap gap-2">
                          {sub.submissionLinks.map((link, index) => (
                            <a
                              key={index}
                              href={link.url}
                              target="_blank"
                              rel="noreferrer"
                              className="rounded-lg bg-blue-50 dark:bg-slate-800 border border-transparent dark:border-slate-700 px-2 py-1 text-[11px] font-semibold text-[var(--tlh-blue-hover)] dark:text-cyan-300 hover:bg-blue-100 dark:hover:bg-slate-700"
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
                              disabled={adminFileBusy}
                              onClick={() =>
                                openAdminSubmissionFile(
                                  `/api/admin/submissions/${sub._id}/files/${index}`,
                                  file,
                                )
                              }
                              className="rounded-lg bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-200 disabled:opacity-60"
                            >
                              📎 {file.filename}
                            </button>
                          ))}
                        </div>
                      ) : null}
                      <div className="flex justify-end border-t border-slate-100 pt-2">
                        <button
                          type="button"
                          onClick={() =>
                            setDeleteRecord({
                              endpoint: `/api/admin/submissions/${sub._id}`,
                              label: `Submission by “${sub.student?.fullName || sub.student?.name || "learner"}” and its ${sub.attachments?.length || 0} file(s)`,
                            })
                          }
                          className="rounded-lg border border-rose-200 px-3 py-1.5 text-[11px] font-bold text-rose-700 hover:bg-rose-50"
                        >
                          Delete submission
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            ) : null}

            {submissionFilter !== "assignments" ? (
              <div className="space-y-3">
                <h4 className="text-xs font-extrabold uppercase tracking-wide text-slate-500">
                  Assessment submissions
                </h4>
                {submissionData.attempts.length === 0 ? (
                  <EmptyState title="No assessment submissions yet." />
                ) : (
                  submissionData.attempts.map((attempt) => (
                    <div
                      key={attempt._id}
                      className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-bold text-slate-900">
                            {attempt.student?.fullName ||
                              attempt.student?.name ||
                              "Learner"}
                          </p>
                          <p className="text-xs text-slate-500">
                            {attempt.assessment?.title || "Assessment"} ·{" "}
                            {attempt.classroom?.title || "Cohort"} ·{" "}
                            {attempt.student?.email || ""}
                          </p>
                        </div>
                        <span
                          className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${attempt.status === "reviewed" ? "bg-[var(--primary-light)] text-[var(--tlh-blue-primary)]" : "bg-amber-100 text-amber-700"}`}
                        >
                          {attempt.status === "reviewed"
                            ? `Released ${attempt.score}/${attempt.maxScore}`
                            : "Awaiting review"}
                        </span>
                      </div>
                      {attempt.responseText ? (
                        <p className="whitespace-pre-wrap text-xs text-slate-600">
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
                              className="rounded-lg bg-blue-50 dark:bg-slate-800 border border-transparent dark:border-slate-700 px-2 py-1 text-[11px] font-semibold text-[var(--tlh-blue-hover)] dark:text-cyan-300 hover:bg-blue-100 dark:hover:bg-slate-700"
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
                              disabled={adminFileBusy}
                              onClick={() =>
                                openAdminSubmissionFile(
                                  `/api/admin/attempts/${attempt._id}/files/${index}`,
                                  file,
                                )
                              }
                              className="rounded-lg bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-200 disabled:opacity-60"
                            >
                              📎 {file.filename}
                            </button>
                          ))}
                        </div>
                      ) : null}
                      <div className="flex justify-end border-t border-slate-100 pt-2">
                        <button
                          type="button"
                          onClick={() =>
                            setDeleteRecord({
                              endpoint: `/api/admin/attempts/${attempt._id}`,
                              label: `Assessment submission by “${attempt.student?.fullName || attempt.student?.name || "learner"}” and its ${attempt.attachments?.length || 0} file(s)`,
                            })
                          }
                          className="rounded-lg border border-rose-200 px-3 py-1.5 text-[11px] font-bold text-rose-700 hover:bg-rose-50"
                        >
                          Delete submission
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            ) : null}

            {(contentData.assignments.length > 0 ||
              contentData.assessments.length > 0) && (
              <div className="space-y-3">
                <div>
                  <h4 className="text-xs font-extrabold uppercase tracking-wide text-slate-500">
                    Course content
                  </h4>
                  <p className="mt-1 text-xs text-slate-500">
                    Permanently remove an assignment or assessment together with
                    every learner submission and uploaded file for it.
                  </p>
                </div>
                {contentData.assignments.map((item) => (
                  <div
                    key={`assignment-${item._id}`}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4"
                  >
                    <div className="min-w-0">
                      <p className="font-bold text-slate-900">{item.title}</p>
                      <p className="text-xs text-slate-500">
                        Assignment · {item.classroom?.title || "Cohort"} ·{" "}
                        {item.teacher?.fullName || item.teacher?.name || "Teacher"}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setDeleteRecord({
                          endpoint: `/api/admin/assignments/${item._id}`,
                          label: `Assignment “${item.title}” and all its submissions`,
                        })
                      }
                      className="rounded-lg border border-rose-200 px-3 py-1.5 text-[11px] font-bold text-rose-700 hover:bg-rose-50"
                    >
                      Delete assignment
                    </button>
                  </div>
                ))}
                {contentData.assessments.map((item) => (
                  <div
                    key={`assessment-${item._id}`}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4"
                  >
                    <div className="min-w-0">
                      <p className="font-bold text-slate-900">{item.title}</p>
                      <p className="text-xs text-slate-500">
                        Assessment · {item.classroom?.title || "Cohort"} ·{" "}
                        {item.teacher?.fullName || item.teacher?.name || "Teacher"}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setDeleteRecord({
                          endpoint: `/api/admin/assessments/${item._id}`,
                          label: `Assessment “${item.title}” and all its submissions`,
                        })
                      }
                      className="rounded-lg border border-rose-200 px-3 py-1.5 text-[11px] font-bold text-rose-700 hover:bg-rose-50"
                    >
                      Delete assessment
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : null}
        {activeTab === "resources" ? (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-xl font-bold text-slate-900">
                  Learning resources
                </h3>
                <p className="mt-1 text-sm text-slate-600">
                  Add videos and PDF, Word, Excel, or PowerPoint materials to a
                  cohort. Learners open them in the learning-space Course
                  Materials tab.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setResourceForm({
                    title: "",
                    description: "",
                    classroomId: "",
                    sourceType: "youtube",
                    sourceUrl: "",
                    category: "video",
                    visibility: "class_only",
                    originalFilename: "",
                    mimeType: "",
                    base64Data: "",
                  });
                  setCreateResourceModal(true);
                }}
                className="rounded-xl bg-gradient-to-r from-[var(--tlh-blue-primary)] to-[var(--tlh-sky)] px-4 py-2.5 text-xs font-bold text-white shadow-md shadow-blue-500/25 hover:from-[var(--tlh-blue-hover)] hover:to-[var(--tlh-sky)]"
              >
                + Add resource
              </button>
            </div>
            <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm leading-6 text-blue-950">
              <strong>YouTube:</strong> Copy the video URL and add it here.
              TedbabeLearnHUB embeds the video using YouTube&apos;s
              privacy-enhanced player and limits related videos to the same
              channel when YouTube supports it.
              <br />
              <strong>Google Drive documents:</strong> Add PDF, Word, Excel, or
              PowerPoint files in Drive, choose{" "}
              <em>Share → General access → Anyone with the link → Viewer</em>,
              then paste the sharing link here. The selected file previews
              inside the learning space. Anyone with the link may also open it
              outside TedbabeLearnHUB.
              <br />
              <strong>Privacy:</strong> Use public or unlisted YouTube videos
              only. YouTube may still show creator-added end screens or
              recommendations; YouTube does not let TedbabeLearnHUB remove every
              YouTube overlay.
            </div>
            <div className="grid gap-3">
              {learningResources.map((resource) => {
                const cohortTitle =
                  resource.classroom?.title || "Public resource";
                return (
                  <article
                    key={resource._id}
                    className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-4"
                  >
                    <div className="flex min-w-0 items-start gap-3">
                      <span className="text-2xl" aria-hidden="true">
                        {resource.sourceType === "youtube" ||
                        resource.category === "video"
                          ? "🎬"
                          : "📄"}
                      </span>
                      <div className="min-w-0">
                        <h4 className="truncate font-bold text-slate-900">
                          {resource.title}
                        </h4>
                        <p className="mt-1 text-xs text-slate-600">
                          {cohortTitle} ·{" "}
                          {resource.sourceType === "youtube"
                            ? "YouTube video"
                            : resource.sourceType === "google_drive"
                              ? `Google Drive ${resource.category}`
                              : resource.category}
                        </p>
                        <p className="mt-1 truncate text-xs text-slate-500">
                          {resource.description ||
                            resource.originalFilename ||
                            resource.sourceUrl}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <a
                        href={
                          resource.sourceUrl ||
                          `${API_BASE_URL}/api/resources/${resource._id}/download`
                        }
                        target={
                          resource.sourceType === "upload" ? "_blank" : "_blank"
                        }
                        rel="noopener noreferrer"
                        className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
                        download={resource.sourceType === "upload" || undefined}
                      >
                        {resource.sourceType === "upload"
                          ? "Download"
                          : "Open link"}
                      </a>
                      <button
                        type="button"
                        onClick={() =>
                          setDeleteRecord({
                            endpoint: `/api/resources/${resource._id}`,
                            label: `Resource “${resource.title}”`,
                          })
                        }
                        className="rounded-lg border border-rose-200 px-3 py-2 text-xs font-bold text-rose-700 hover:bg-rose-50"
                      >
                        Delete
                      </button>
                    </div>
                  </article>
                );
              })}
              {learningResources.length === 0 && (
                <EmptyState
                  title="No learning resources yet"
                  description="Add a video lesson or course document to make it available in a cohort learning space."
                />
              )}
            </div>
          </div>
        ) : null}

        {/* 7. ANNOUNCEMENTS TAB */}
        {activeTab === "announcements" ? (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="text-xl font-bold text-slate-900">
                Announcements
              </h3>
              <button
                onClick={() => setCreateAnnouncementModal(true)}
                className="rounded-xl bg-gradient-to-r from-[var(--tlh-blue-primary)] to-[var(--tlh-sky)] px-3.5 py-1.5 text-xs font-bold text-white shadow-sm hover:from-[var(--tlh-blue-hover)] hover:to-[var(--tlh-sky)]"
              >
                + New announcement
              </button>
            </div>

            <div className="space-y-4">
              {announcements.length === 0 ? (
                <EmptyState title="No announcements yet." />
              ) : (
                announcements.map((ann) => (
                  <div
                    key={ann._id}
                    className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200"
                  >
                    <div className="flex items-center justify-between">
                      <h4 className="font-bold text-slate-900">{ann.title}</h4>
                      <Badge
                        variant={
                          ann.priority === "urgent"
                            ? "rose"
                            : ann.priority === "high"
                              ? "amber"
                              : "slate"
                        }
                      >
                        {ann.priority}
                      </Badge>
                    </div>
                    <p className="mt-2 text-sm text-slate-700 leading-relaxed">
                      {ann.content}
                    </p>
                    <div className="mt-4 flex items-center gap-4 text-xs text-slate-400">
                      <span>Audience: {ann.target}</span>
                      <span>•</span>
                      <span>
                        Date: {new Date(ann.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="mt-4 flex gap-2 border-t border-slate-100 pt-3">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingAnnouncementId(ann._id);
                          setAnnouncementForm({
                            title: ann.title,
                            content: ann.content,
                            target: ann.target,
                            classroomId: ann.classroom?._id || "",
                            priority: ann.priority,
                          });
                          setCreateAnnouncementModal(true);
                        }}
                        className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setDeleteRecord({
                            endpoint: `/api/admin/announcements/${ann._id}`,
                            label: `Announcement “${ann.title}”`,
                          })
                        }
                        className="rounded-lg border border-rose-200 px-3 py-2 text-xs font-bold text-rose-700 hover:bg-rose-50"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        ) : null}

        {activeTab === "faqs" ? (
          <div className="space-y-6">
            <DashboardCard
              title="Frequently asked questions"
              subtitle="Manage the answers shown in the public help center"
              action={
                <button
                  type="button"
                  onClick={() => {
                    setEditingFaqId("");
                    setFaqForm({
                      question: "",
                      answer: "",
                      isPublished: true,
                      sortOrder: faqs.length,
                    });
                    setCreateFaqModal(true);
                  }}
                  className="rounded-xl bg-gradient-to-r from-[var(--tlh-blue-primary)] to-[var(--tlh-sky)] px-4 py-2 text-sm font-bold text-white shadow-md shadow-blue-500/25 hover:from-[var(--tlh-blue-hover)] hover:to-[var(--tlh-sky)]"
                >
                  + Add FAQ
                </button>
              }
            >
              <div className="divide-y divide-slate-100">
                {faqs.map((faq) => (
                  <div
                    key={faq._id}
                    className="flex flex-wrap items-start justify-between gap-4 py-4"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="font-bold text-slate-900">
                          {faq.question}
                        </h4>
                        <Badge variant={faq.isPublished ? "emerald" : "slate"}>
                          {faq.isPublished ? "Published" : "Draft"}
                        </Badge>
                      </div>
                      <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-600">
                        {faq.answer}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingFaqId(faq._id);
                          setFaqForm({
                            question: faq.question,
                            answer: faq.answer,
                            isPublished: faq.isPublished,
                            sortOrder: faq.sortOrder || 0,
                          });
                          setCreateFaqModal(true);
                        }}
                        className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setDeleteRecord({
                            endpoint: `/api/admin/faqs/${faq._id}`,
                            label: "FAQ",
                          })
                        }
                        className="rounded-lg border border-rose-200 px-3 py-2 text-xs font-bold text-rose-700 hover:bg-rose-50"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
                {faqs.length === 0 && (
                  <EmptyState
                    title="No FAQs yet."
                    description="Add an answer to help learners and instructors."
                  />
                )}
              </div>
            </DashboardCard>
          </div>
        ) : null}

        {activeTab === "support" ? (
          <div className="space-y-6">
            <DashboardCard
              title="Contact inbox"
              subtitle={`${inquiries.filter((inquiry) => inquiry.status !== "closed").length} inquiries need follow-up`}
            >
              {inquiryFeedback && (
                <p
                  role="status"
                  className="mb-4 rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-sm font-semibold text-blue-900"
                >
                  {inquiryFeedback}
                </p>
              )}
              <div className="space-y-4">
                {inquiries.map((inquiry) => (
                  <article
                    key={inquiry._id}
                    className="rounded-2xl border border-slate-200 p-5"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h4 className="font-bold text-slate-900">
                          {inquiry.subject}
                        </h4>
                        <p className="mt-1 text-xs text-slate-500">
                          {inquiry.fullName} ·{" "}
                          <a
                            className="text-[var(--tlh-blue-hover)] hover:underline"
                            href={`mailto:${inquiry.email}`}
                          >
                            {inquiry.email}
                          </a>
                        </p>
                      </div>
                      <Badge
                        variant={
                          inquiry.status === "closed"
                            ? "slate"
                            : inquiry.status === "in_progress"
                              ? "amber"
                              : "cyan"
                        }
                      >
                        {inquiry.status.replace("_", " ")}
                      </Badge>
                    </div>
                    <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                      {inquiry.message}
                    </p>
                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3">
                      <span className="text-xs text-slate-400">
                        {new Date(inquiry.createdAt).toLocaleString()}
                      </span>
                      <div className="flex gap-2">
                        {inquiry.status !== "in_progress" && (
                          <button
                            type="button"
                            onClick={() =>
                              void handleInquiryStatus(inquiry, "in_progress")
                            }
                            className="rounded-lg border border-amber-200 px-3 py-1.5 text-xs font-bold text-amber-800 hover:bg-amber-50"
                          >
                            Mark in progress
                          </button>
                        )}
                        {inquiry.status !== "closed" && (
                          <button
                            type="button"
                            onClick={() =>
                              void handleInquiryStatus(inquiry, "closed")
                            }
                            className="rounded-lg bg-gradient-to-r from-[var(--tlh-blue-primary)] to-[var(--tlh-sky)] px-3.5 py-1.5 text-xs font-bold text-white hover:from-[var(--tlh-blue-hover)] hover:to-[var(--tlh-sky)]"
                          >
                            Close inquiry
                          </button>
                        )}
                        {inquiry.status !== "new" && (
                          <button
                            type="button"
                            onClick={() =>
                              void handleInquiryStatus(inquiry, "new")
                            }
                            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50"
                          >
                            Reopen
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() =>
                            setDeleteRecord({
                              endpoint: `/api/admin/contact-inquiries/${inquiry._id}`,
                              label: "Contact inquiry",
                            })
                          }
                          className="rounded-lg border border-rose-200 px-3 py-1.5 text-xs font-bold text-rose-700 hover:bg-rose-50"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
                {inquiries.length === 0 && (
                  <EmptyState
                    title="Inbox is clear."
                    description="New contact submissions will appear here."
                  />
                )}
              </div>
            </DashboardCard>
          </div>
        ) : null}

        {/* 6b. ANALYTICS TAB (Module 1) */}
        {activeTab === "analytics" ? (
          <div className="space-y-8">
            {isAnalyticsLoading && !analyticsData && (
              <div
                role="status"
                className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm font-medium text-blue-800"
              >
                Computing analytics from live platform data…
              </div>
            )}

            <DashboardCard
              title="Learning analytics"
              subtitle="Live figures computed from platform data. Day boundaries use Africa/Addis_Ababa (UTC+03:00)."
              action={
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={analyticsGranularity}
                    onChange={(event) => {
                      const next = event.target.value;
                      setAnalyticsGranularity(next);
                      void loadAnalytics(next, analyticsWindowDays);
                    }}
                    className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700"
                  >
                    <option value="day">Daily</option>
                    <option value="week">Weekly</option>
                    <option value="month">Monthly</option>
                    <option value="year">Yearly</option>
                  </select>
                  <select
                    value={analyticsWindowDays}
                    onChange={(event) => {
                      const next = Number(event.target.value);
                      setAnalyticsWindowDays(next);
                      void loadAnalytics(analyticsGranularity, next);
                    }}
                    className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700"
                  >
                    <option value={7}>Last 7 days</option>
                    <option value={30}>Last 30 days</option>
                    <option value={90}>Last 90 days</option>
                    <option value={365}>Last 12 months</option>
                  </select>
                  <button
                    type="button"
                    onClick={() => void loadAnalytics()}
                    disabled={isAnalyticsLoading}
                    className="rounded-xl bg-gradient-to-r from-[var(--tlh-blue-primary)] to-[var(--tlh-sky)] px-4 py-2 text-xs font-extrabold text-white shadow-sm transition-all hover:from-[var(--tlh-blue-hover)] hover:to-[var(--tlh-sky)] disabled:cursor-wait disabled:opacity-60"
                  >
                    {isAnalyticsLoading ? "Refreshing…" : "↻ Refresh"}
                  </button>
                </div>
              }
            >
              {!analyticsOverview ? (
                <EmptyState
                  title="Analytics are not loaded yet."
                  description="Use the refresh action to compute the latest figures."
                />
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
                  <MetricCard
                    label="Learners"
                    value={formatNumber(analyticsOverview.students.total)}
                    subtext={`${formatNumber(analyticsOverview.students.active)} active`}
                    icon="🎓"
                  />
                  <MetricCard
                    label="New in window"
                    value={formatNumber(analyticsOverview.students.newInRange)}
                    subtext={`${formatNumber(analyticsOverview.students.newToday)} today`}
                    icon="✨"
                  />
                  <MetricCard
                    label="Instructors"
                    value={formatNumber(analyticsOverview.teachers.total)}
                    subtext={`${formatNumber(analyticsOverview.teachers.active)} active`}
                    icon="👨‍🏫"
                  />
                  <MetricCard
                    label="Cohorts"
                    value={formatNumber(analyticsOverview.classes.total)}
                    subtext={`${formatNumber(analyticsOverview.classes.upcomingSessions)} upcoming sessions`}
                    icon="🏫"
                  />
                  <MetricCard
                    label="Attendance rate"
                    value={formatPercent(
                      analyticsOverview.learning.attendanceRate,
                    )}
                    subtext={`${formatNumber(analyticsOverview.learning.attendanceRecords)} records`}
                    icon="✅"
                  />
                </div>
              )}
            </DashboardCard>

            <DashboardCard
              title="Registration statistics"
              subtitle={`${analyticsData?.registrations?.totals?.all ?? 0} accounts created in the selected window`}
            >
              <AnalyticsColumnChart points={analyticsRegistrationPoints} />
              <div className="mt-6 grid gap-4 sm:grid-cols-3">
                <div className="rounded-2xl bg-slate-50 p-4">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    New learners
                  </p>
                  <p className="mt-1 text-2xl font-black text-slate-900">
                    {formatNumber(
                      analyticsData?.registrations?.totals?.students ?? 0,
                    )}
                  </p>
                </div>
                <div className="rounded-2xl bg-slate-50 p-4">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    New instructors
                  </p>
                  <p className="mt-1 text-2xl font-black text-slate-900">
                    {formatNumber(
                      analyticsData?.registrations?.totals?.teachers ?? 0,
                    )}
                  </p>
                </div>
                <div className="rounded-2xl bg-slate-50 p-4">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    All new accounts
                  </p>
                  <p className="mt-1 text-2xl font-black text-slate-900">
                    {formatNumber(
                      analyticsData?.registrations?.totals?.all ?? 0,
                    )}
                  </p>
                </div>
              </div>
            </DashboardCard>

            <div className="grid gap-8 lg:grid-cols-2">
              <DashboardCard
                title="Registration conversion funnel"
                subtitle="Stages are measured over learners who registered inside the selected window."
              >
                {analyticsStages.length === 0 ? (
                  <EmptyState title="No funnel data in this window." />
                ) : (
                  <div className="space-y-3">
                    {analyticsStages.map((stage) => (
                      <div key={stage.key}>
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-slate-700">
                            {stage.label}
                          </span>
                          <span className="font-extrabold text-slate-900">
                            {formatNumber(stage.count)}
                            <span className="ml-2 font-medium text-slate-400">
                              {formatPercent(stage.conversionFromTop)} of top
                            </span>
                          </span>
                        </div>
                        <div className="mt-1.5 h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-[var(--tlh-blue-primary)] to-[var(--tlh-cyan)]"
                            style={{
                              width: `${Math.round((stage.count / analyticsFunnelBase) * 100)}%`,
                            }}
                          />
                        </div>
                        <p className="mt-1 text-[10px] font-medium text-slate-400">
                          {formatPercent(stage.conversionFromPrevious)} from
                          previous step
                          {stage.dropOffFromPrevious
                            ? ` · ${formatNumber(stage.dropOffFromPrevious)} dropped off`
                            : ""}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </DashboardCard>

              <DashboardCard
                title="Engagement and retention"
                subtitle="Activity signals, at-risk learners and assessment outcomes."
              >
                {!analyticsEngagement ? (
                  <EmptyState title="No engagement data yet." />
                ) : (
                  <div className="space-y-6">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-2xl border border-slate-100 p-3">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          Active learners
                        </p>
                        <p className="mt-1 text-xl font-black text-slate-900">
                          {formatNumber(
                            analyticsEngagement.students?.active ?? 0,
                          )}
                        </p>
                      </div>
                      <div className="rounded-2xl border border-slate-100 p-3">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          At risk
                        </p>
                        <p className="mt-1 text-xl font-black text-slate-900">
                          {formatNumber(
                            analyticsEngagement.engagement?.atRisk ?? 0,
                          )}{" "}
                          <span className="text-xs font-bold text-slate-400">
                            (
                            {formatPercent(
                              analyticsEngagement.engagement?.atRiskRate,
                            )}
                            )
                          </span>
                        </p>
                      </div>
                      <div className="rounded-2xl border border-slate-100 p-3">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          Assessment attempts
                        </p>
                        <p className="mt-1 text-xl font-black text-slate-900">
                          {formatNumber(
                            analyticsEngagement.assessments?.attempts ?? 0,
                          )}
                        </p>
                      </div>
                      <div className="rounded-2xl border border-slate-100 p-3">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          Pass rate
                        </p>
                        <p className="mt-1 text-xl font-black text-slate-900">
                          {formatPercent(
                            analyticsEngagement.assessments?.passRate,
                          )}
                        </p>
                      </div>
                    </div>
                    <div>
                      <p className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">
                        Recency spread
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {Object.entries(analyticsEngagement.students ?? {})
                          .filter(([key]) => key !== "total")
                          .map(([key, value]) => (
                            <Badge
                              key={key}
                              variant={RECENCY_VARIANTS[key] ?? "slate"}
                            >
                              {key}: {formatNumber(value)}
                            </Badge>
                          ))}
                      </div>
                    </div>
                    <div>
                      <p className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">
                        Submission trend
                      </p>
                      <AnalyticsColumnChart
                        height={110}
                        points={(
                          analyticsEngagement.submissionTrend?.buckets ?? []
                        ).map((bucket) => ({
                          key: bucket.key,
                          value: bucket.count,
                        }))}
                      />
                    </div>
                  </div>
                )}
              </DashboardCard>
            </div>

            <DashboardCard
              title="Course popularity and performance"
              subtitle="Top 10 programmes in the selected window."
            >
              <AnalyticsTable
                rows={analyticsCourseRows}
                columns={[
                  {
                    key: "title",
                    label: "Programme",
                    render: (row) => (
                      <div>
                        <p className="font-bold text-slate-900">{row.title}</p>
                        <p className="text-[10px] text-slate-400">
                          {row.category}
                        </p>
                      </div>
                    ),
                  },
                  {
                    key: "students",
                    label: "Learners",
                    align: "text-right",
                    render: (row) => formatNumber(row.students),
                  },
                  { key: "cohorts", label: "Cohorts", align: "text-right" },
                  {
                    key: "fillRate",
                    label: "Fill rate",
                    align: "text-right",
                    render: (row) => formatPercent(row.fillRate),
                  },
                  {
                    key: "attendanceRate",
                    label: "Attendance",
                    align: "text-right",
                    render: (row) => formatPercent(row.attendanceRate),
                  },
                  {
                    key: "averageGradePercentage",
                    label: "Avg grade",
                    align: "text-right",
                    render: (row) => formatPercent(row.averageGradePercentage),
                  },
                  {
                    key: "completionRate",
                    label: "Completion",
                    align: "text-right",
                    render: (row) => formatPercent(row.completionRate),
                  },
                ]}
              />
            </DashboardCard>

            <DashboardCard
              title="Instructor performance"
              subtitle="Top 10 instructors by enrolment in the selected window."
            >
              <AnalyticsTable
                rows={analyticsTeacherRows}
                columns={[
                  {
                    key: "name",
                    label: "Instructor",
                    render: (row) => (
                      <div>
                        <p className="font-bold text-slate-900">{row.name}</p>
                        <p className="text-[10px] text-slate-400">
                          {row.email}
                        </p>
                      </div>
                    ),
                  },
                  {
                    key: "students",
                    label: "Learners",
                    align: "text-right",
                    render: (row) => formatNumber(row.students),
                  },
                  { key: "cohorts", label: "Cohorts", align: "text-right" },
                  { key: "sessions", label: "Sessions", align: "text-right" },
                  {
                    key: "gradingRate",
                    label: "Grading rate",
                    align: "text-right",
                    render: (row) => formatPercent(row.gradingRate),
                  },
                  {
                    key: "averageGradePercentage",
                    label: "Avg grade",
                    align: "text-right",
                    render: (row) => formatPercent(row.averageGradePercentage),
                  },
                  {
                    key: "attendanceRate",
                    label: "Attendance",
                    align: "text-right",
                    render: (row) => formatPercent(row.attendanceRate),
                  },
                ]}
              />
            </DashboardCard>

            <DashboardCard
              title="Class performance"
              subtitle="Top 10 cohorts in the selected window."
            >
              <AnalyticsTable
                rows={analyticsClassRows}
                columns={[
                  {
                    key: "title",
                    label: "Cohort",
                    render: (row) => (
                      <div>
                        <p className="font-bold text-slate-900">{row.title}</p>
                        <p className="text-[10px] text-slate-400">
                          {row.course} · {row.teacher}
                        </p>
                      </div>
                    ),
                  },
                  {
                    key: "status",
                    label: "Status",
                    render: (row) => <Badge variant="blue">{row.status}</Badge>,
                  },
                  {
                    key: "students",
                    label: "Learners",
                    align: "text-right",
                    render: (row) =>
                      `${formatNumber(row.students)} / ${formatNumber(row.capacity)}`,
                  },
                  {
                    key: "fillRate",
                    label: "Fill rate",
                    align: "text-right",
                    render: (row) => formatPercent(row.fillRate),
                  },
                  { key: "sessions", label: "Sessions", align: "text-right" },
                  {
                    key: "attendanceRate",
                    label: "Attendance",
                    align: "text-right",
                    render: (row) => formatPercent(row.attendanceRate),
                  },
                  {
                    key: "submissions",
                    label: "Submissions",
                    align: "text-right",
                  },
                ]}
              />
            </DashboardCard>

            <DashboardCard
              title="Student activity monitoring"
              subtitle="Recency is derived from the latest platform activity for each learner."
            >
              <AnalyticsTable
                rows={analyticsActivity}
                emptyLabel="No learner activity recorded in this window."
                columns={[
                  {
                    key: "name",
                    label: "Learner",
                    render: (row) => (
                      <div>
                        <p className="font-bold text-slate-900">{row.name}</p>
                        <p className="text-[10px] text-slate-400">
                          {row.email}
                        </p>
                      </div>
                    ),
                  },
                  {
                    key: "recency",
                    label: "Recency",
                    render: (row) => (
                      <Badge variant={RECENCY_VARIANTS[row.recency] ?? "slate"}>
                        {row.recency}
                      </Badge>
                    ),
                  },
                  {
                    key: "placementStatus",
                    label: "Placement",
                    className: "capitalize text-slate-600",
                  },
                  {
                    key: "lastActiveAt",
                    label: "Last active",
                    render: (row) =>
                      row.lastActiveAt
                        ? new Date(row.lastActiveAt).toLocaleString()
                        : "Never",
                  },
                  {
                    key: "submissions",
                    label: "Submissions",
                    align: "text-right",
                  },
                  {
                    key: "attendanceRate",
                    label: "Attendance",
                    align: "text-right",
                    render: (row) => formatPercent(row.attendanceRate),
                  },
                  {
                    key: "certificates",
                    label: "Certificates",
                    align: "text-right",
                  },
                ]}
              />
            </DashboardCard>
          </div>
        ) : null}

        {/* 6c. MONETIZATION TAB (Module 2). Self-loading: the panel fetches its own data. */}
        {activeTab === "monetization" ? <MonetizationPanel /> : null}
        {activeTab === "payments" ? <PaymentsAdminPanel /> : null}

        {/* 7. REPORTS & AUDIT LOGS TAB */}
        {activeTab === "reports" ? (
          <div className="space-y-8">
            {isReportsLoading && (
              <div
                role="status"
                className="rounded-xl border border-stone-200 bg-white px-4 py-3 text-sm font-medium text-stone-600"
              >
                Loading reports and recent activity…
              </div>
            )}
            <DashboardCard title="System overview and workloads">
              <div className="grid gap-6 md:grid-cols-2">
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
                    Cohort placement and capacity
                  </h4>
                  <div className="space-y-2">
                    {reportsData?.classes?.map((c) => (
                      <div
                        key={c._id}
                        className="rounded-xl border border-slate-200 p-3 text-xs flex justify-between"
                      >
                        <div>
                          <span className="font-bold text-slate-900">
                            {c.title}
                          </span>
                          <p className="text-slate-500">
                            Instructor: {c.teacher}
                          </p>
                        </div>
                        <div className="text-right">
                          <span className="font-extrabold text-[var(--tlh-blue-primary)]">
                            {c.enrolledCount} / {c.capacity}
                          </span>
                          <p className="text-[10px] text-slate-400">
                            {Math.round((c.enrolledCount / c.capacity) * 100)}%
                            filled
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
                    Attendance overview
                  </h4>
                  <div className="space-y-2">
                    {reportsData?.attendanceStats?.map((s) => (
                      <div
                        key={s._id}
                        className="rounded-xl bg-slate-50 p-3 text-xs flex justify-between"
                      >
                        <span className="font-bold capitalize text-slate-800">
                          {s._id}:
                        </span>
                        <span className="font-extrabold text-slate-900">
                          {s.count} sessions
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </DashboardCard>

            <DashboardCard
              title="Recent activity"
              subtitle={`${auditLogs.length} entr${auditLogs.length === 1 ? "y" : "ies"} — click the trash icon to remove an entry`}
            >
              <div className="divide-y divide-slate-100 max-h-[480px] overflow-y-auto">
                {auditLogs.length === 0 ? (
                  <EmptyState title="No activity recorded yet." />
                ) : (
                  auditLogs.map((log) => (
                    <div
                      key={log._id}
                      className="py-3 text-xs flex items-center justify-between gap-4 group"
                    >
                      <div className="min-w-0 flex-1">
                        <span className="font-bold text-slate-900 break-words">
                          {log.action.replace(/_/g, " ")}
                        </span>
                        <span className="text-slate-400 ml-2">
                          ({log.targetType})
                        </span>
                        <p className="text-slate-400 mt-0.5">
                          By: {log.actor?.fullName || "System"} &mdash;{" "}
                          {new Date(log.createdAt).toLocaleString()}
                        </p>
                      </div>
                      <button
                        id={`delete-audit-${log._id}`}
                        title={
                          auditLogDeleteConfirm === log._id
                            ? "Click again to confirm deletion"
                            : "Remove this activity entry"
                        }
                        onClick={() => handleDeleteAuditLog(log._id)}
                        disabled={deletingAuditLogId === log._id}
                        className={`shrink-0 rounded-lg px-2.5 py-1.5 text-[11px] font-bold transition-all ${
                          auditLogDeleteConfirm === log._id
                            ? "bg-rose-600 text-white animate-pulse"
                            : "bg-slate-100 text-slate-500 opacity-0 group-hover:opacity-100 hover:bg-rose-50 hover:text-rose-600"
                        } disabled:opacity-40`}
                      >
                        {deletingAuditLogId === log._id
                          ? "…"
                          : auditLogDeleteConfirm === log._id
                            ? "Confirm delete"
                            : "🗑"}
                      </button>
                    </div>
                  ))
                )}
              </div>
            </DashboardCard>
          </div>
        ) : null}

        {activeTab === "profile" ? (
          <div className="mx-auto max-w-2xl">
            <DashboardCard
              title="Administrator profile"
              subtitle="Manage the personal and contact information shown on your account."
            >
              <form onSubmit={handleSaveAdminProfile} className="space-y-4">
                <ProfilePhotoField
                  value={adminProfile.avatarUrl}
                  onChange={(avatarUrl) =>
                    setAdminProfile({ ...adminProfile, avatarUrl })
                  }
                />
                <label className="block text-xs font-bold text-slate-700">
                  Full name
                  <input
                    required
                    minLength={2}
                    maxLength={100}
                    value={adminProfile.fullName}
                    onChange={(event) =>
                      setAdminProfile({
                        ...adminProfile,
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
                    value={adminProfile.phone}
                    onChange={(event) =>
                      setAdminProfile({
                        ...adminProfile,
                        phone: event.target.value,
                      })
                    }
                    className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 text-sm"
                  />
                </label>
                <label className="block text-xs font-bold text-slate-700">
                  About me
                  <textarea
                    rows={3}
                    maxLength={500}
                    value={adminProfile.bio}
                    onChange={(event) =>
                      setAdminProfile({
                        ...adminProfile,
                        bio: event.target.value,
                      })
                    }
                    className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 text-sm"
                  />
                </label>
                <p className="text-xs text-slate-500">
                  Email: {user.email} (used for sign-in; contact support to
                  change it)
                </p>
                <button
                  type="submit"
                  className="w-full rounded-xl bg-gradient-to-r from-[var(--tlh-blue-primary)] to-[var(--tlh-sky)] py-2.5 text-xs font-bold text-white hover:from-[var(--tlh-blue-hover)] hover:to-[var(--tlh-sky)] shadow-sm"
                >
                  Save profile
                </button>
              </form>
            </DashboardCard>
          </div>
        ) : null}

        {activeTab === "settings" ? (
          <DashboardSettings
            user={user}
            sessions={sessions.filter(
              (session) => session.status === "scheduled",
            )}
            onNavigateTab={(tab) => setActiveTab(tab)}
            onSaved={() => {
              void loadAll();
            }}
          />
        ) : null}

        {activeTab === "security" ? (
          <div className="max-w-xl">
            <DashboardCard
              title="Account security"
              subtitle="Change your password to keep your administrator account secure."
            >
              <form onSubmit={handleChangeAdminPassword} className="space-y-4">
                <label className="block text-xs font-bold text-slate-700">
                  Current password
                  <input
                    required
                    type="password"
                    value={securityForm.currentPassword}
                    onChange={(event) =>
                      setSecurityForm({
                        ...securityForm,
                        currentPassword: event.target.value,
                      })
                    }
                    className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 text-sm"
                  />
                </label>
                <label className="block text-xs font-bold text-slate-700">
                  New password (minimum 8 characters)
                  <input
                    required
                    minLength={8}
                    maxLength={128}
                    type="password"
                    value={securityForm.newPassword}
                    onChange={(event) =>
                      setSecurityForm({
                        ...securityForm,
                        newPassword: event.target.value,
                      })
                    }
                    className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 text-sm"
                  />
                </label>
                <label className="block text-xs font-bold text-slate-700">
                  Confirm new password
                  <input
                    required
                    minLength={8}
                    maxLength={128}
                    type="password"
                    value={securityForm.confirmPassword}
                    onChange={(event) =>
                      setSecurityForm({
                        ...securityForm,
                        confirmPassword: event.target.value,
                      })
                    }
                    className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 text-sm"
                  />
                </label>
                <button
                  type="submit"
                  disabled={securityLoading}
                  className="w-full rounded-xl bg-slate-900 py-3 text-xs font-bold text-white disabled:opacity-50"
                >
                  {securityLoading ? "Updating…" : "Update password"}
                </button>
              </form>
            </DashboardCard>
          </div>
        ) : null}

        {/* MODAL: Reject Teacher */}
        <Modal
          title={t("reject")}
          isOpen={rejectionModal.open}
          onClose={() =>
            setRejectionModal({ open: false, appId: "", reason: "" })
          }
        >
          <div className="space-y-4">
            <p className="text-xs text-slate-600">
              Please tell us why this application is being declined.
            </p>
            <textarea
              required
              minLength={5}
              rows={3}
              value={rejectionModal.reason}
              onChange={(e) =>
                setRejectionModal({ ...rejectionModal, reason: e.target.value })
              }
              className="w-full rounded-xl border border-slate-200 p-3 text-sm outline-none"
              placeholder="Add a reason…"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() =>
                  setRejectionModal({ open: false, appId: "", reason: "" })
                }
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600"
              >
                Cancel
              </button>
              <button
                onClick={handleTeacherReject}
                disabled={rejectionModal.reason.trim().length < 5}
                className="rounded-xl bg-rose-600 px-4 py-2 text-xs font-bold text-white disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                Decline application
              </button>
            </div>
          </div>
        </Modal>

        {/* MODAL: Place Student */}
        <Modal
          title="Place learner in a cohort"
          isOpen={placementModal.open}
          onClose={() =>
            setPlacementModal({
              open: false,
              studentId: "",
              studentName: "",
              classId: "",
            })
          }
        >
          <div className="space-y-4">
            <p className="text-sm font-semibold text-slate-900">
              Learner: {placementModal.studentName}
            </p>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Select a cohort
              </label>
              <select
                value={placementModal.classId}
                onChange={(e) =>
                  setPlacementModal({
                    ...placementModal,
                    classId: e.target.value,
                  })
                }
                className="w-full rounded-xl border border-slate-200 p-3 text-xs outline-none bg-white"
              >
                {placementClasses.map((c) => (
                  <option key={c._id} value={c._id}>
                    {c.title} — ({c.students?.length || 0}/{c.capacity}{" "}
                    learners)
                  </option>
                ))}
              </select>
              {placementClasses.length === 0 && (
                <p className="mt-2 text-sm text-rose-700">
                  There are no classes with open capacity. Increase class
                  capacity or create another class before placing students.
                </p>
              )}
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() =>
                  setPlacementModal({
                    open: false,
                    studentId: "",
                    studentName: "",
                    classId: "",
                  })
                }
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600"
              >
                Cancel
              </button>
              <button
                onClick={handlePlaceStudent}
                disabled={
                  !placementModal.classId || placementClasses.length === 0
                }
                className="rounded-xl bg-[var(--tlh-blue-primary)] px-4 py-2 text-xs font-bold text-white hover:bg-[var(--tlh-blue-hover)] disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                Confirm placement
              </button>
            </div>
          </div>
        </Modal>

        <Modal
          title={`Assign teacher · ${teacherAssignmentModal.classTitle}`}
          isOpen={teacherAssignmentModal.open}
          onClose={() =>
            setTeacherAssignmentModal({
              open: false,
              classId: "",
              classTitle: "",
              teacherId: "",
            })
          }
        >
          {activeTeachers.length === 0 ? (
            <div className="space-y-4">
              <p className="text-sm text-slate-600">
                There are no active teachers available. Approve a teacher
                application or reactivate a teacher before assigning this class.
              </p>
              <button
                type="button"
                onClick={() => {
                  setTeacherAssignmentModal({
                    open: false,
                    classId: "",
                    classTitle: "",
                    teacherId: "",
                  });
                  setActiveTab("teachers");
                }}
                className="rounded-xl bg-[var(--tlh-blue-primary)] px-4 py-2 text-sm font-bold text-white hover:bg-[var(--tlh-blue-hover)]"
              >
                View teachers
              </button>
            </div>
          ) : (
            <form onSubmit={handleAssignTeacher} className="space-y-4">
              <label
                className="block text-sm font-semibold text-slate-700"
                htmlFor="class-teacher"
              >
                Active teacher
              </label>
              <select
                id="class-teacher"
                required
                value={teacherAssignmentModal.teacherId}
                onChange={(event) =>
                  setTeacherAssignmentModal({
                    ...teacherAssignmentModal,
                    teacherId: event.target.value,
                  })
                }
                className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm"
              >
                <option value="">Choose a teacher</option>
                {activeTeachers.map((teacher) => (
                  <option key={teacher._id} value={teacher._id}>
                    {teacher.fullName} ({teacher.email})
                  </option>
                ))}
              </select>
              <button
                type="submit"
                className="w-full rounded-xl bg-[var(--tlh-blue-primary)] py-2.5 text-sm font-bold text-white hover:bg-[var(--tlh-blue-hover)]"
              >
                Save teacher assignment
              </button>
            </form>
          )}
        </Modal>

        <Modal
          title={`Delete ${deleteUserModal?.role === "teacher" ? "instructor" : deleteUserModal?.role === "admin" || deleteUserModal?.role === "hub_admin" ? "administrator" : "learner"} account?`}
          isOpen={Boolean(deleteUserModal)}
          onClose={() => {
            if (!isDeletingUser) setDeleteUserModal(null);
          }}
        >
          <div className="space-y-4">
            <p className="text-sm leading-6 text-slate-700">
              This will deactivate <strong>{deleteUserModal?.name}</strong>’s
              sign-in access, anonymize their profile, and remove them from
              active class rosters. Historical learning records will be
              retained.
            </p>
            <p className="text-xs leading-5 text-rose-700">
              This cannot be undone. You cannot delete your own administrator
              account or the last active administrator.
            </p>
            <label className="flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50/60 p-3 text-xs leading-5 text-rose-900">
              <input
                type="checkbox"
                checked={deleteUserPurge}
                onChange={(e) => setDeleteUserPurge(e.target.checked)}
                className="mt-0.5 h-4 w-4 accent-rose-700"
              />
              <span>
                <strong>Also permanently delete all linked records.</strong>{" "}
                Removes attendance, results, submissions and their uploaded
                files, certificates and other records. Use this to free up
                database and storage space. This cannot be undone.
              </span>
            </label>
            {deleteUserError && (
              <p
                role="alert"
                className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-800"
              >
                {deleteUserError}
              </p>
            )}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                disabled={isDeletingUser}
                onClick={() => setDeleteUserModal(null)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeletingUser}
                onClick={() => void handleDeleteUser()}
                className="rounded-xl bg-rose-700 px-4 py-2 text-xs font-bold text-white hover:bg-rose-800 disabled:cursor-wait disabled:opacity-60"
              >
                {isDeletingUser ? "Deleting…" : "Delete account"}
              </button>
            </div>
          </div>
        </Modal>

        <Modal
          title={`Create ${userForm.role === "student" ? "learner" : "teacher"} account`}
          isOpen={createUserModal}
          onClose={() => {
            setCreateUserModal(false);
            setUserForm({
              fullName: "",
              email: "",
              password: "",
              role: "student",
            });
          }}
        >
          <form onSubmit={handleCreateUser} className="space-y-4">
            <p className="rounded-xl bg-blue-50 p-3 text-xs leading-5 text-blue-900 ring-1 ring-blue-200">
              This account will be email-verified and active. New learners still
              need placement into a cohort.
            </p>
            <label className="block text-xs font-bold text-slate-700">
              Full name
              <input
                required
                minLength={2}
                maxLength={100}
                value={userForm.fullName}
                onChange={(event) =>
                  setUserForm({ ...userForm, fullName: event.target.value })
                }
                className="mt-1 w-full rounded-xl border border-slate-200 p-3 text-sm font-normal"
              />
            </label>
            <label className="block text-xs font-bold text-slate-700">
              Email address
              <input
                required
                type="email"
                value={userForm.email}
                onChange={(event) =>
                  setUserForm({ ...userForm, email: event.target.value })
                }
                className="mt-1 w-full rounded-xl border border-slate-200 p-3 text-sm font-normal"
              />
            </label>
            <label className="block text-xs font-bold text-slate-700">
              Temporary password
              <input
                required
                type="password"
                minLength={12}
                maxLength={128}
                autoComplete="new-password"
                value={userForm.password}
                onChange={(event) =>
                  setUserForm({ ...userForm, password: event.target.value })
                }
                className="mt-1 w-full rounded-xl border border-slate-200 p-3 text-sm font-normal"
              />
              <span className="mt-1 block text-[11px] font-normal text-slate-500">
                At least 12 characters. Share it securely with the account
                owner.
              </span>
            </label>
            <button
              type="submit"
              className="w-full rounded-xl bg-gradient-to-r from-[var(--tlh-blue-primary)] to-[var(--tlh-sky)] py-3 text-sm font-bold text-white hover:from-[var(--tlh-blue-hover)] hover:to-[var(--tlh-sky)] shadow-sm"
            >
              Create account
            </button>
          </form>
        </Modal>

        <Modal
          title="Create administrator"
          isOpen={createAdministratorModal}
          onClose={() => {
            setCreateAdministratorModal(false);
            setAdministratorForm({ fullName: "", email: "", password: "" });
          }}
        >
          <form onSubmit={handleCreateAdministrator} className="space-y-4">
            <p className="rounded-xl bg-amber-50 p-3 text-xs leading-5 text-amber-900 ring-1 ring-amber-200">
              Administrators can manage users and platform data. Only add people
              you trust.
            </p>
            <label className="block text-xs font-bold text-slate-700">
              Full name
              <input
                required
                minLength={2}
                maxLength={100}
                value={administratorForm.fullName}
                onChange={(event) =>
                  setAdministratorForm({
                    ...administratorForm,
                    fullName: event.target.value,
                  })
                }
                className="mt-1 w-full rounded-xl border border-slate-200 p-3 text-sm font-normal"
              />
            </label>
            <label className="block text-xs font-bold text-slate-700">
              Email address
              <input
                required
                type="email"
                value={administratorForm.email}
                onChange={(event) =>
                  setAdministratorForm({
                    ...administratorForm,
                    email: event.target.value,
                  })
                }
                className="mt-1 w-full rounded-xl border border-slate-200 p-3 text-sm font-normal"
              />
            </label>
            <label className="block text-xs font-bold text-slate-700">
              Temporary password
              <input
                required
                type="password"
                minLength={12}
                maxLength={128}
                autoComplete="new-password"
                value={administratorForm.password}
                onChange={(event) =>
                  setAdministratorForm({
                    ...administratorForm,
                    password: event.target.value,
                  })
                }
                className="mt-1 w-full rounded-xl border border-slate-200 p-3 text-sm font-normal"
              />
              <span className="mt-1 block text-[11px] font-normal text-slate-500">
                At least 12 characters. Share it securely and ask the new
                administrator to change it.
              </span>
            </label>
            <button
              type="submit"
              className="w-full rounded-xl bg-gradient-to-r from-[var(--tlh-blue-primary)] to-[var(--tlh-sky)] py-3 text-sm font-bold text-white hover:from-[var(--tlh-blue-hover)] hover:to-[var(--tlh-sky)] shadow-sm"
            >
              Create administrator
            </button>
          </form>
        </Modal>

        <Modal
          title={editingFaqId ? "Edit FAQ" : "Add FAQ"}
          isOpen={createFaqModal}
          onClose={() => {
            setCreateFaqModal(false);
            setEditingFaqId("");
            setFaqForm({
              question: "",
              answer: "",
              isPublished: true,
              sortOrder: 0,
            });
          }}
        >
          <form onSubmit={handleSaveFaq} className="space-y-4">
            <label className="block text-xs font-bold text-slate-700">
              Question
              <input
                required
                minLength={5}
                value={faqForm.question}
                onChange={(event) =>
                  setFaqForm({ ...faqForm, question: event.target.value })
                }
                className="mt-1 w-full rounded-xl border border-slate-200 p-3 text-sm font-normal"
              />
            </label>
            <label className="block text-xs font-bold text-slate-700">
              Answer
              <textarea
                required
                minLength={10}
                rows={5}
                value={faqForm.answer}
                onChange={(event) =>
                  setFaqForm({ ...faqForm, answer: event.target.value })
                }
                className="mt-1 w-full rounded-xl border border-slate-200 p-3 text-sm font-normal"
              />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-xs font-bold text-slate-700">
                Sort order
                <input
                  type="number"
                  value={faqForm.sortOrder}
                  onChange={(event) =>
                    setFaqForm({
                      ...faqForm,
                      sortOrder: Number(event.target.value),
                    })
                  }
                  className="mt-1 w-full rounded-xl border border-slate-200 p-3 text-sm font-normal"
                />
              </label>
              <label className="flex items-center gap-2 self-end rounded-xl border border-slate-200 p-3 text-xs font-bold text-slate-700">
                <input
                  type="checkbox"
                  checked={faqForm.isPublished}
                  onChange={(event) =>
                    setFaqForm({
                      ...faqForm,
                      isPublished: event.target.checked,
                    })
                  }
                />
                Publish publicly
              </label>
            </div>
            <button
              type="submit"
              className="w-full rounded-xl bg-gradient-to-r from-[var(--tlh-blue-primary)] to-[var(--tlh-sky)] py-3 text-sm font-bold text-white hover:from-[var(--tlh-blue-hover)] hover:to-[var(--tlh-sky)] shadow-sm"
            >
              {editingFaqId ? "Save FAQ" : "Create FAQ"}
            </button>
          </form>
        </Modal>

        <Modal
          title={`Delete ${deleteRecord?.label || "record"}?`}
          isOpen={Boolean(deleteRecord)}
          onClose={() => {
            setDeleteRecord(null);
            setDeleteRecordError("");
          }}
        >
          <div className="space-y-4">
            <p className="text-sm leading-6 text-slate-700">
              This action cannot be undone. Related learning data will be
              removed only where stated.
            </p>
            {deleteRecordError && (
              <p
                role="alert"
                className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-semibold text-rose-800"
              >
                {deleteRecordError}
              </p>
            )}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteRecord(null)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleDeleteRecord()}
                className="rounded-xl bg-rose-700 px-4 py-2 text-sm font-bold text-white hover:bg-rose-800"
              >
                Delete permanently
              </button>
            </div>
          </div>
        </Modal>

        {/* MODAL: Authenticated submission file preview */}
        <Modal
          title={adminFilePreview.title || "Submission file"}
          isOpen={adminFilePreview.open}
          onClose={closeAdminFilePreview}
        >
          {adminFilePreview.mimeType?.startsWith("image/") ? (
            <img
              src={adminFilePreview.url}
              alt={adminFilePreview.title}
              className="mx-auto max-h-[70vh] rounded-xl"
            />
          ) : adminFilePreview.mimeType?.startsWith("video/") ? (
            <video
              src={adminFilePreview.url}
              controls
              className="mx-auto max-h-[70vh] w-full rounded-xl"
            />
          ) : adminFilePreview.mimeType?.startsWith("audio/") ? (
            <audio
              src={adminFilePreview.url}
              controls
              className="mx-auto w-full"
            />
          ) : (
            <iframe
              src={adminFilePreview.url}
              title={adminFilePreview.title}
              className="h-[70vh] w-full rounded-xl border border-slate-200"
            />
          )}
          <a
            href={adminFilePreview.url}
            download={adminFilePreview.title}
            className="mt-3 block rounded-xl bg-slate-900 py-2 text-center text-xs font-bold text-white hover:bg-slate-800"
          >
            Download
          </a>
        </Modal>

        {/* MODAL: Create Course */}
        <Modal
          title={editingCourseId ? "Edit program" : t("createCourse")}
          isOpen={createCourseModal}
          onClose={() => {
            setCreateCourseModal(false);
            setEditingCourseId("");
            setCourseForm({
              title: "",
              description: "",
              categoryId: "",
              skillLevel: "Beginner",
              objectives: "",
              status: "published",
            });
          }}
        >
          <form onSubmit={handleCreateCourse} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700">
                {t("title")}
              </label>
              <input
                required
                minLength={3}
                type="text"
                value={courseForm.title}
                onChange={(e) =>
                  setCourseForm({ ...courseForm, title: e.target.value })
                }
                className="mt-1 w-full rounded-xl border border-slate-200 p-2 text-sm outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700">
                {t("description")}
              </label>
              <textarea
                required
                minLength={10}
                rows={2}
                value={courseForm.description}
                onChange={(e) =>
                  setCourseForm({ ...courseForm, description: e.target.value })
                }
                className="mt-1 w-full rounded-xl border border-slate-200 p-2 text-sm outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700">
                {t("category")}
              </label>
              <select
                required
                value={courseForm.categoryId}
                onChange={(e) =>
                  setCourseForm({ ...courseForm, categoryId: e.target.value })
                }
                className="mt-1 w-full rounded-xl border border-slate-200 p-2 text-xs outline-none bg-white"
              >
                <option value="">Select a category</option>
                {categories.map((c) => (
                  <option key={c._id} value={c._id}>
                    {c.name}
                  </option>
                ))}
              </select>
              {categories.length === 0 && (
                <p className="mt-1 text-xs text-rose-700">
                  Create a category before creating a course.
                </p>
              )}
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700">
                {t("skillLevel")}
              </label>
              <select
                value={courseForm.skillLevel}
                onChange={(e) =>
                  setCourseForm({ ...courseForm, skillLevel: e.target.value })
                }
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-2 text-sm"
              >
                <option value="Beginner">Beginner</option>
                <option value="Intermediate">Intermediate</option>
                <option value="Advanced">Advanced</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700">
                Objectives (one per line)
              </label>
              <textarea
                rows={2}
                value={courseForm.objectives}
                onChange={(e) =>
                  setCourseForm({ ...courseForm, objectives: e.target.value })
                }
                className="mt-1 w-full rounded-xl border border-slate-200 p-2 text-sm outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700">
                Visibility
              </label>
              <select
                value={courseForm.status}
                onChange={(e) =>
                  setCourseForm({ ...courseForm, status: e.target.value })
                }
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-2 text-sm"
              >
                <option value="draft">Draft</option>
                <option value="published">Published</option>
                <option value="archived">Archived</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
            <button
              type="submit"
              disabled={categories.length === 0}
              className="w-full rounded-xl bg-[var(--tlh-blue-primary)] py-2.5 text-xs font-bold text-white disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {editingCourseId ? "Save program" : t("createCourse")}
            </button>
          </form>
        </Modal>

        {/* MODAL: Create Class */}
        <Modal
          title={editingClassId ? "Edit cohort" : t("createClass")}
          isOpen={createClassModal}
          onClose={() => {
            setCreateClassModal(false);
            setEditingClassId("");
            setClassForm({
              title: "",
              courseId: "",
              teacherId: "",
              capacity: 20,
              timeZone: "Africa/Addis_Ababa",
              description: "",
              status: "active",
            });
          }}
        >
          <form onSubmit={handleCreateClass} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700">
                {t("title")}
              </label>
              <input
                required
                minLength={3}
                type="text"
                value={classForm.title}
                onChange={(e) =>
                  setClassForm({ ...classForm, title: e.target.value })
                }
                className="mt-1 w-full rounded-xl border border-slate-200 p-2 text-sm outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700">
                {t("course")}
              </label>
              <select
                required
                value={classForm.courseId}
                onChange={(e) =>
                  setClassForm({ ...classForm, courseId: e.target.value })
                }
                className="mt-1 w-full rounded-xl border border-slate-200 p-2 text-xs outline-none bg-white"
              >
                <option value="">Select a course</option>
                {courses.map((c) => (
                  <option key={c._id} value={c._id}>
                    {c.title}
                  </option>
                ))}
              </select>
              {courses.length === 0 && (
                <p className="mt-1 text-xs text-rose-700">
                  Create a course before creating a class.
                </p>
              )}
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700">
                {t("teacher")}
              </label>
              <select
                value={classForm.teacherId}
                onChange={(e) =>
                  setClassForm({ ...classForm, teacherId: e.target.value })
                }
                className="mt-1 w-full rounded-xl border border-slate-200 p-2 text-xs outline-none bg-white"
              >
                <option value="">-- Select an instructor --</option>
                {teachers
                  .filter((t) => t.accountStatus === "active")
                  .map((tch) => (
                    <option key={tch._id} value={tch._id}>
                      {tch.fullName} ({tch.email})
                    </option>
                  ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700">
                Cohort capacity
              </label>
              <input
                type="number"
                min={1}
                max={100}
                value={classForm.capacity}
                onChange={(e) =>
                  setClassForm({
                    ...classForm,
                    capacity: Number(e.target.value),
                  })
                }
                className="mt-1 w-full rounded-xl border border-slate-200 p-2 text-sm outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700">
                Time zone
              </label>
              <select
                value={classForm.timeZone}
                onChange={(e) =>
                  setClassForm({ ...classForm, timeZone: e.target.value })
                }
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-2 text-sm outline-none"
              >
                {TIME_ZONES.map((tz) => (
                  <option key={tz.value} value={tz.value}>
                    {tz.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700">
                Description
              </label>
              <textarea
                rows={2}
                value={classForm.description}
                onChange={(e) =>
                  setClassForm({ ...classForm, description: e.target.value })
                }
                className="mt-1 w-full rounded-xl border border-slate-200 p-2 text-sm outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700">
                Status
              </label>
              <select
                value={classForm.status}
                onChange={(e) =>
                  setClassForm({ ...classForm, status: e.target.value })
                }
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-2 text-sm"
              >
                <option value="planned">Planned</option>
                <option value="active">Active</option>
                <option value="completed">Completed</option>
                <option value="archived">Archived</option>
              </select>
            </div>
            <button
              type="submit"
              disabled={courses.length === 0}
              className="w-full rounded-xl bg-[var(--tlh-cyan)] py-2.5 text-xs font-bold text-white disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {editingClassId ? "Save cohort" : t("createClass")}
            </button>
          </form>
        </Modal>

        {/* MODAL: Create Category */}
        <Modal
          title={editingCategoryId ? "Edit category" : t("createCategory")}
          isOpen={createCategoryModal}
          onClose={() => {
            setCreateCategoryModal(false);
            setEditingCategoryId("");
            setCategoryForm({ name: "", description: "" });
          }}
        >
          <form onSubmit={handleCreateCategory} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700">
                Category name
              </label>
              <input
                required
                minLength={2}
                type="text"
                value={categoryForm.name}
                onChange={(e) =>
                  setCategoryForm({ ...categoryForm, name: e.target.value })
                }
                className="mt-1 w-full rounded-xl border border-slate-200 p-2 text-sm outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700">
                Description
              </label>
              <textarea
                rows={2}
                value={categoryForm.description}
                onChange={(e) =>
                  setCategoryForm({
                    ...categoryForm,
                    description: e.target.value,
                  })
                }
                className="mt-1 w-full rounded-xl border border-slate-200 p-2 text-sm outline-none"
              />
            </div>
            <button
              type="submit"
              className="w-full rounded-xl bg-[var(--tlh-blue-primary)] py-2.5 text-xs font-bold text-white"
            >
              {editingCategoryId ? "Save category" : t("createCategory")}
            </button>
          </form>
        </Modal>

        <Modal
          title="Add learning resource"
          isOpen={createResourceModal}
          onClose={() => {
            if (isUploadingResource) return;
            setCreateResourceModal(false);
            setResourceForm({
              title: "",
              description: "",
              classroomId: "",
              sourceType: "youtube",
              sourceUrl: "",
              category: "video",
              visibility: "class_only",
              originalFilename: "",
              mimeType: "",
              base64Data: "",
            });
          }}
        >
          <form onSubmit={handleUploadResource} className="space-y-4">
            <p className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-xs leading-5 text-blue-900">
              Add a YouTube video or Google Drive document link. The resource
              appears inside the selected cohort&apos;s learning space; no R2
              account is needed.
            </p>
            <label className="block text-xs font-bold text-slate-700">
              Resource title
              <input
                required
                minLength={2}
                maxLength={120}
                value={resourceForm.title}
                onChange={(event) =>
                  setResourceForm({
                    ...resourceForm,
                    title: event.target.value,
                  })
                }
                className="mt-1 w-full rounded-xl border border-slate-200 p-3 text-sm font-normal"
                placeholder="Example: Week 1 introduction video"
              />
            </label>
            <label className="block text-xs font-bold text-slate-700">
              Description
              <textarea
                rows={2}
                maxLength={1000}
                value={resourceForm.description}
                onChange={(event) =>
                  setResourceForm({
                    ...resourceForm,
                    description: event.target.value,
                  })
                }
                className="mt-1 w-full rounded-xl border border-slate-200 p-3 text-sm font-normal"
                placeholder="What will students learn from this resource?"
              />
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-xs font-bold text-slate-700">
                Resource source
                <select
                  value={resourceForm.sourceType}
                  onChange={(event) => {
                    const sourceType = event.target.value;
                    setResourceForm({
                      ...resourceForm,
                      sourceType,
                      category:
                        sourceType === "youtube"
                          ? "video"
                          : sourceType === "google_drive"
                            ? "video"
                            : "document",
                      sourceUrl: "",
                      originalFilename: "",
                      mimeType: "",
                      base64Data: "",
                    });
                  }}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-3 text-sm font-normal"
                >
                  <option value="youtube">YouTube video</option>
                  <option value="google_drive">
                    Google Drive (Video or Document)
                  </option>
                  <option value="upload">
                    Upload a file to server (PDF, Document, Media)
                  </option>
                </select>
              </label>
              <label className="block text-xs font-bold text-slate-700">
                Cohort
                <select
                  value={resourceForm.classroomId}
                  onChange={(event) =>
                    setResourceForm({
                      ...resourceForm,
                      classroomId: event.target.value,
                    })
                  }
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-3 text-sm font-normal"
                >
                  <option value="">Choose a cohort</option>
                  {classes.map((classroom) => (
                    <option key={classroom._id} value={classroom._id}>
                      {classroom.title}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {resourceForm.sourceType === "upload" ? (
              <label className="block text-xs font-bold text-slate-700">
                Choose file
                <input
                  required
                  type="file"
                  accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.jpg,.jpeg,.png,.webp,.mp4,.webm,.mp3,.wav,.txt"
                  onChange={handleResourceFileChange}
                  className="mt-1 w-full rounded-xl border border-slate-200 p-3 text-xs font-normal"
                />
                <span className="mt-1 block font-normal text-slate-500">
                  {resourceForm.originalFilename
                    ? `Selected: ${resourceForm.originalFilename}`
                    : "Files are stored safely on the platform server."}
                </span>
              </label>
            ) : (
              <>
                {resourceForm.sourceType === "google_drive" && (
                  <label className="block text-xs font-bold text-slate-700">
                    Google Drive format
                    <select
                      value={resourceForm.category}
                      onChange={(event) =>
                        setResourceForm({
                          ...resourceForm,
                          category: event.target.value,
                        })
                      }
                      className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-3 text-sm font-normal"
                    >
                      <option value="video">
                        🎬 Video (MP4 / Google Drive Video Player)
                      </option>
                      <option value="pdf">📕 PDF Document</option>
                      <option value="document">📄 Word document</option>
                      <option value="spreadsheet">📊 Excel spreadsheet</option>
                      <option value="slide">📑 PowerPoint presentation</option>
                    </select>
                  </label>
                )}
                <label className="block text-xs font-bold text-slate-700">
                  {resourceForm.sourceType === "youtube"
                    ? "YouTube video link"
                    : resourceForm.category === "video"
                      ? "Google Drive video sharing link"
                      : "Google Drive sharing link"}
                  <input
                    required
                    type="url"
                    value={resourceForm.sourceUrl}
                    onChange={(event) =>
                      setResourceForm({
                        ...resourceForm,
                        sourceUrl: event.target.value,
                      })
                    }
                    className="mt-1 w-full rounded-xl border border-slate-200 p-3 text-sm font-normal"
                    placeholder={
                      resourceForm.sourceType === "youtube"
                        ? "https://www.youtube.com/watch?v=..."
                        : "https://drive.google.com/file/d/.../view"
                    }
                  />
                  <span className="mt-1 block font-normal leading-5 text-slate-500">
                    {resourceForm.sourceType === "youtube"
                      ? "Use a public or unlisted YouTube video. It will stream directly in the student workspace."
                      : resourceForm.category === "video"
                        ? "Supports Google Drive videos. In Drive, set General access to 'Anyone with the link' and 'Viewer'. Students can watch it directly in the learning workspace."
                        : "Supports PDF, Word, Excel, and PowerPoint. In Drive, set General access to 'Anyone with the link' and 'Viewer'."}
                  </span>
                </label>
              </>
            )}
            <label className="flex items-center gap-2 text-xs font-semibold text-slate-700">
              <input
                type="checkbox"
                checked={resourceForm.visibility === "public"}
                onChange={(event) =>
                  setResourceForm({
                    ...resourceForm,
                    visibility: event.target.checked ? "public" : "class_only",
                  })
                }
                className="accent-[var(--tlh-blue-primary)]"
              />
              Make this resource public instead of cohort-only
            </label>
            <button
              type="submit"
              disabled={
                isUploadingResource ||
                (resourceForm.sourceType === "upload"
                  ? !resourceForm.base64Data
                  : !resourceForm.sourceUrl.trim())
              }
              className="w-full rounded-xl bg-gradient-to-r from-[var(--tlh-blue-primary)] to-[var(--tlh-sky)] py-3 text-sm font-bold text-white hover:from-[var(--tlh-blue-hover)] hover:to-[var(--tlh-sky)] shadow-sm disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {isUploadingResource
                ? "Saving…"
                : resourceForm.sourceType === "upload"
                  ? "Upload resource"
                  : "Add resource"}
            </button>
          </form>
        </Modal>

        {/* MODAL: Schedule Session */}
        <Modal
          title={editingSessionId ? "Edit session" : t("scheduleSession")}
          isOpen={createSessionModal}
          onClose={() => {
            setCreateSessionModal(false);
            setEditingSessionId("");
            setSessionForm({
              classId: "",
              title: "",
              description: "",
              startsAt: "",
              endsAt: "",
              meetingUrl: "",
              status: "scheduled",
              recurrencePattern: "none",
              recurrenceInterval: 1,
              recurrenceOccurrences: 4,
            });
          }}
        >
          <form onSubmit={handleScheduleSession} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700">
                {t("course")} / cohort
              </label>
              <select
                value={sessionForm.classId}
                onChange={(e) =>
                  setSessionForm({ ...sessionForm, classId: e.target.value })
                }
                className="mt-1 w-full rounded-xl border border-slate-200 p-2 text-xs outline-none bg-white"
              >
                <option value="">Select a class with a teacher</option>
                {schedulableClasses.map((c) => (
                  <option key={c._id} value={c._id}>
                    {c.title}
                  </option>
                ))}
              </select>
              {schedulableClasses.length === 0 && (
                <p className="mt-1 text-xs text-rose-700">
                  Assign an active teacher to a class before scheduling
                  sessions.
                </p>
              )}
              {selectedSessionClass && (
                <p className="mt-1 text-xs text-slate-500">
                  Schedule times use this cohort&apos;s time zone:{" "}
                  <strong>{sessionTimeZone}</strong>.
                </p>
              )}
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700">
                {t("title")}
              </label>
              <input
                required
                minLength={3}
                type="text"
                value={sessionForm.title}
                onChange={(e) =>
                  setSessionForm({ ...sessionForm, title: e.target.value })
                }
                className="mt-1 w-full rounded-xl border border-slate-200 p-2 text-sm outline-none"
                placeholder="Example: Live session 1 — Introduction to React"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700">
                {t("description")}
              </label>
              <textarea
                rows={2}
                value={sessionForm.description}
                onChange={(e) =>
                  setSessionForm({
                    ...sessionForm,
                    description: e.target.value,
                  })
                }
                className="mt-1 w-full rounded-xl border border-slate-200 p-2 text-sm outline-none"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700">
                  {t("startTime")}
                </label>
                <input
                  required
                  type="datetime-local"
                  value={sessionForm.startsAt}
                  onChange={(e) =>
                    setSessionForm({ ...sessionForm, startsAt: e.target.value })
                  }
                  className="mt-1 w-full rounded-xl border border-slate-200 p-2 text-xs outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700">
                  {t("endTime")}
                </label>
                <input
                  required
                  type="datetime-local"
                  min={sessionForm.startsAt || undefined}
                  value={sessionForm.endsAt}
                  onChange={(e) =>
                    setSessionForm({ ...sessionForm, endsAt: e.target.value })
                  }
                  className="mt-1 w-full rounded-xl border border-slate-200 p-2 text-xs outline-none"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700">
                {t("meetingUrl")}
              </label>
              <input
                type="url"
                value={sessionForm.meetingUrl}
                onChange={(e) =>
                  setSessionForm({ ...sessionForm, meetingUrl: e.target.value })
                }
                className="mt-1 w-full rounded-xl border border-slate-200 p-2 text-sm outline-none"
                placeholder="https://meet.google.com/..."
              />
            </div>
            {!editingSessionId && (
              <div className="rounded-2xl border border-indigo-200 bg-indigo-50/60 p-4 space-y-3">
                <label className="block text-xs font-bold text-slate-700">
                  Repeat schedule
                </label>
                <select
                  value={sessionForm.recurrencePattern}
                  onChange={(e) =>
                    setSessionForm({
                      ...sessionForm,
                      recurrencePattern: e.target.value,
                    })
                  }
                  className="w-full rounded-xl border border-slate-200 bg-white p-2 text-sm outline-none"
                >
                  <option value="none">One-time session</option>
                  <option value="daily">Every day</option>
                  <option value="weekly">Every week</option>
                  <option value="biweekly">Every 2 weeks</option>
                  <option value="monthly">Every month</option>
                </select>
                {sessionForm.recurrencePattern !== "none" && (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-bold text-slate-700">
                          {sessionForm.recurrencePattern === "daily"
                            ? "Every (days)"
                            : sessionForm.recurrencePattern === "weekly"
                              ? "Every (weeks)"
                              : sessionForm.recurrencePattern === "biweekly"
                                ? "Every (2-week blocks)"
                                : "Every (months)"}
                        </label>
                        <input
                          type="number"
                          min="1"
                          max={sessionForm.recurrencePattern === "daily" ? 12 : 12}
                          value={sessionForm.recurrenceInterval}
                          onChange={(e) =>
                            setSessionForm({
                              ...sessionForm,
                              recurrenceInterval: e.target.value,
                            })
                          }
                          className="mt-1 w-full rounded-xl border border-slate-200 p-2 text-xs outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-700">
                          Number of sessions
                        </label>
                        <input
                          type="number"
                          min="1"
                          max="120"
                          value={sessionForm.recurrenceOccurrences}
                          onChange={(e) =>
                            setSessionForm({
                              ...sessionForm,
                              recurrenceOccurrences: e.target.value,
                            })
                          }
                          className="mt-1 w-full rounded-xl border border-slate-200 p-2 text-xs outline-none"
                        />
                      </div>
                    </div>
                    <p className="text-[11px] text-slate-600">
                      Creates a{" "}
                      {
                        {
                          daily: "daily",
                          weekly: "weekly",
                          biweekly: "bi-weekly",
                          monthly: "monthly",
                        }[sessionForm.recurrencePattern]
                      }{" "}
                      chart of {Number(sessionForm.recurrenceOccurrences) || 1}{" "}
                      session
                      {Number(sessionForm.recurrenceOccurrences) === 1
                        ? ""
                        : "s"}
                      , each {Number(sessionForm.recurrenceInterval) || 1}{" "}
                      {{
                        daily: "day",
                        weekly: "week",
                        biweekly: "2-week block",
                        monthly: "month",
                      }[sessionForm.recurrencePattern] || "period"}
                      {Number(sessionForm.recurrenceInterval) === 1 ? "" : "s"}{" "}
                      apart, starting from the time above. The teacher must be
                      free for every occurrence.
                    </p>
                  </>
                )}
              </div>
            )}
            {editingSessionId && (
              <div>
                <label className="block text-xs font-bold text-slate-700">
                  Session status
                </label>
                <select
                  value={sessionForm.status}
                  onChange={(e) =>
                    setSessionForm({ ...sessionForm, status: e.target.value })
                  }
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-2 text-sm"
                >
                  <option value="scheduled">Scheduled</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
            )}
            <button
              type="submit"
              disabled={schedulableClasses.length === 0}
              className="golden-btn w-full rounded-xl py-2.5 text-xs font-bold text-white shadow-md disabled:cursor-not-allowed disabled:opacity-40"
            >
              {editingSessionId ? "Save session" : "Schedule session"}
            </button>
          </form>
        </Modal>

        {/* MODAL: Create Announcement */}
        <Modal
          title={
            editingAnnouncementId ? "Edit announcement" : "Send an announcement"
          }
          isOpen={createAnnouncementModal}
          onClose={() => {
            setCreateAnnouncementModal(false);
            setEditingAnnouncementId("");
            setAnnouncementForm({
              title: "",
              content: "",
              target: "all_students",
              classroomId: "",
              priority: "normal",
            });
          }}
        >
          <form onSubmit={handleCreateAnnouncement} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700">
                {t("title")}
              </label>
              <input
                required
                minLength={3}
                type="text"
                value={announcementForm.title}
                onChange={(e) =>
                  setAnnouncementForm({
                    ...announcementForm,
                    title: e.target.value,
                  })
                }
                className="mt-1 w-full rounded-xl border border-slate-200 p-2 text-sm outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700">
                {t("message")}
              </label>
              <textarea
                required
                minLength={5}
                rows={3}
                value={announcementForm.content}
                onChange={(e) =>
                  setAnnouncementForm({
                    ...announcementForm,
                    content: e.target.value,
                  })
                }
                className="mt-1 w-full rounded-xl border border-slate-200 p-2 text-sm outline-none"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700">
                  Audience
                </label>
                <select
                  value={announcementForm.target}
                  onChange={(e) =>
                    setAnnouncementForm({
                      ...announcementForm,
                      target: e.target.value,
                    })
                  }
                  className="mt-1 w-full rounded-xl border border-slate-200 p-2 text-xs outline-none bg-white"
                >
                  <option value="all_students">All learners</option>
                  <option value="all_teachers">All instructors</option>
                  <option value="all">All users</option>
                  <option value="classroom">Specific cohort</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700">
                  Priority
                </label>
                <select
                  value={announcementForm.priority}
                  onChange={(e) =>
                    setAnnouncementForm({
                      ...announcementForm,
                      priority: e.target.value,
                    })
                  }
                  className="mt-1 w-full rounded-xl border border-slate-200 p-2 text-xs outline-none bg-white"
                >
                  <option value="normal">Normal</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>
            </div>
            {announcementForm.target === "classroom" && (
              <div>
                <label className="block text-xs font-bold text-slate-700">
                  Cohort
                </label>
                <select
                  required
                  value={announcementForm.classroomId}
                  onChange={(e) =>
                    setAnnouncementForm({
                      ...announcementForm,
                      classroomId: e.target.value,
                    })
                  }
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-2 text-xs"
                >
                  <option value="">Select a cohort</option>
                  {classes.map((classroom) => (
                    <option key={classroom._id} value={classroom._id}>
                      {classroom.title}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <button
              type="submit"
              className="w-full rounded-xl bg-gradient-to-r from-[var(--tlh-blue-primary)] to-[var(--tlh-sky)] py-2.5 text-xs font-bold text-white shadow-sm hover:from-[var(--tlh-blue-hover)] hover:to-[var(--tlh-sky)]"
            >
              {editingAnnouncementId
                ? "Save announcement"
                : "Send announcement"}
            </button>
          </form>
        </Modal>

        {/* MODAL: Customize & Publish Teacher Public Showcase Profile */}
        <Modal
          title="✨ Customize Instructor Public Showcase Profile"
          isOpen={showcaseModal.open}
          onClose={() => setShowcaseModal((prev) => ({ ...prev, open: false }))}
        >
          <form onSubmit={handleSaveShowcase} className="space-y-4">
            <div className="rounded-2xl border border-amber-200/80 dark:border-amber-500/30 bg-amber-50/70 dark:bg-amber-950/30 p-3.5 text-xs text-amber-900 dark:text-amber-200">
              <p className="font-bold flex items-center gap-1.5">
                <span>ℹ️</span>
                <span>Public Visitor & Guest Showcase</span>
              </p>
              <p className="mt-1 leading-relaxed text-[11px] text-amber-800 dark:text-amber-300">
                This customizes how this instructor appears to public guests in the <strong>“Learn from Industry Professionals”</strong> section on the homepage and instructors page.
                <br />
                <strong className="underline">Note:</strong> These public showcase customizations do <strong>NOT</strong> change the instructor’s personal profile in their private teacher dashboard.
              </p>
            </div>

            {showcaseFeedback && (
              <div
                className={`rounded-xl p-3 text-xs font-bold ${
                  showcaseFeedback.startsWith("Error")
                    ? "bg-rose-100 text-rose-800 border border-rose-200"
                    : "bg-emerald-100 text-emerald-800 border border-emerald-200"
                }`}
              >
                {showcaseFeedback}
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                Public Display Name
              </label>
              <input
                required
                type="text"
                value={showcaseModal.displayName}
                onChange={(e) =>
                  setShowcaseModal({ ...showcaseModal, displayName: e.target.value })
                }
                placeholder="e.g. Dr. Abebe Kebede"
                className="mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-2 text-xs outline-none"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                  Subject Title / Headline
                </label>
                <input
                  required
                  type="text"
                  value={showcaseModal.subjectTitle}
                  onChange={(e) =>
                    setShowcaseModal({ ...showcaseModal, subjectTitle: e.target.value })
                  }
                  placeholder="e.g. Senior Full-Stack & Cloud Architecture Instructor"
                  className="mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-2 text-xs outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                  Experience & Credentials
                </label>
                <input
                  type="text"
                  value={showcaseModal.experience}
                  onChange={(e) =>
                    setShowcaseModal({ ...showcaseModal, experience: e.target.value })
                  }
                  placeholder="e.g. 8+ Years Industry Experience · Ex-Fintech Lead"
                  className="mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-2 text-xs outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                Public Profile Photo URL
              </label>
              <div className="mt-1 flex items-center gap-3">
                <img
                  src={showcaseModal.photoUrl || "/learnhub-icon.png"}
                  alt="Preview"
                  className="h-12 w-12 rounded-full object-cover border-2 border-amber-400 shadow-sm shrink-0"
                  onError={(e) => { e.currentTarget.src = "/learnhub-icon.png"; }}
                />
                <input
                  type="text"
                  value={showcaseModal.photoUrl}
                  onChange={(e) =>
                    setShowcaseModal({ ...showcaseModal, photoUrl: e.target.value })
                  }
                  placeholder="Paste image URL (https://...)"
                  className="flex-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-2 text-xs outline-none font-mono text-[11px]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                Professional Bio & Impact Summary
              </label>
              <textarea
                rows={3}
                value={showcaseModal.bio}
                onChange={(e) =>
                  setShowcaseModal({ ...showcaseModal, bio: e.target.value })
                }
                placeholder="Brief description highlighting real-world expertise and dedication to students..."
                className="mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-2 text-xs outline-none"
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-4 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showcaseModal.isPublished}
                  onChange={(e) =>
                    setShowcaseModal({ ...showcaseModal, isPublished: e.target.checked })
                  }
                  className="h-4 w-4 rounded text-amber-600 focus:ring-amber-500"
                />
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  Publish to Public Page & Homepage
                </span>
              </label>

              <div className="flex items-center gap-2">
                <label className="text-xs font-bold text-slate-600 dark:text-slate-400">
                  Order:
                </label>
                <input
                  type="number"
                  min="1"
                  max="50"
                  value={showcaseModal.displayOrder}
                  onChange={(e) =>
                    setShowcaseModal({ ...showcaseModal, displayOrder: e.target.value })
                  }
                  className="w-16 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 p-1 text-xs text-center font-bold"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowcaseModal((prev) => ({ ...prev, open: false }))}
                className="rounded-xl border border-slate-200 dark:border-slate-700 px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-300"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={savingShowcase}
                className="golden-btn rounded-xl px-5 py-2 text-xs font-bold text-white shadow-md disabled:opacity-50"
              >
                {savingShowcase ? "Saving..." : "Save & Publish Showcase"}
              </button>
            </div>
          </form>
        </Modal>
      </div>
    </div>
  );
}
