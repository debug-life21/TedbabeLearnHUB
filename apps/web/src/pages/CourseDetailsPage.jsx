import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { apiRequest } from "../lib/api";
import { EmptyState } from "../components/UIComponents";

export function CourseDetailsPage() {
  const { t } = useTranslation();
  const { slug } = useParams();
  const [course, setCourse] = useState(null);
  const [activeCohortsCount, setActiveCohortsCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeModuleIndex, setActiveModuleIndex] = useState(0);

  useEffect(() => {
    setLoading(true);
    setError("");
    apiRequest(`/api/public/courses/${slug}`)
      .then((res) => {
        setCourse(res.course);
        setActiveCohortsCount(res.activeCohortsCount || 0);
      })
      .catch((err) => {
        setError(err.message || "Course details could not be loaded.");
      })
      .finally(() => {
        setLoading(false);
      });
  }, [slug]);

  if (loading) {
    return (
      <div className="editorial-page flex min-h-[60vh] items-center justify-center">
        <div className="flex items-center gap-3 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-600 border-t-transparent"></div>
          <span className="text-sm font-bold text-slate-700">
            {t("courseLoading")}
          </span>
        </div>
      </div>
    );
  }

  if (error || !course) {
    return (
      <div className="editorial-page mx-auto max-w-4xl px-4 py-20 text-center">
        <EmptyState
          title={t("courseNotFound")}
          description={error || t("courseNotFoundDescription")}
          action={
            <Link to="/courses" className="editorial-button text-xs">
              ← {t("courseReturnCatalog")}
            </Link>
          }
        />
      </div>
    );
  }

  // Default syllabus modules if none explicitly configured in DB
  const modules =
    course.modules && course.modules.length > 0
      ? course.modules
      : [
          {
            title: "Module 1: Foundations & Core Concepts",
            description:
              "Essential principles, key vocabulary, and foundational orientation.",
            lessons: [
              { title: "Introduction & Learning Roadmap", durationMinutes: 30 },
              { title: "Core Conceptual Deep-Dive", durationMinutes: 45 },
              { title: "Interactive Guided Practice", durationMinutes: 60 },
            ],
          },
          {
            title: "Module 2: Practical Application & Workflows",
            description:
              "Hands-on projects, real-world examples, and guided problem solving.",
            lessons: [
              { title: "Techniques and Best Practices", durationMinutes: 45 },
              { title: "Collaborative Cohort Exercise", durationMinutes: 60 },
              { title: "Knowledge Check & Feedback", durationMinutes: 30 },
            ],
          },
          {
            title: "Module 3: Advanced Mastery & Assessment",
            description:
              "Culminating tasks, comprehensive assessment, and certificate readiness.",
            lessons: [
              { title: "Specialized Topics & Synthesis", durationMinutes: 50 },
              { title: "Course Assignment & Review", durationMinutes: 60 },
              {
                title: "Final Evaluation & Certification",
                durationMinutes: 40,
              },
            ],
          },
        ];

  return (
    <div className="editorial-page min-h-screen pb-24">
      {/* Header Hero */}
      <div className="editorial-hero border-b border-slate-200/80 px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-5xl">
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <Link
              to="/courses"
              className="text-xs font-bold text-slate-500 hover:text-slate-900"
            >
              ← Courses
            </Link>
            <span className="text-slate-300">/</span>
            <span className="rounded-lg bg-sky-50 px-2.5 py-0.5 text-xs font-bold text-blue-700 ring-1 ring-sky-200/60">
              {course.category?.name || t("courseCategoryFallback")}
            </span>
            <span className="rounded-lg bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700">
              {course.skillLevel || "All levels"}
            </span>
          </div>

          <h1 className="editorial-display text-3xl font-extrabold text-slate-900 sm:text-4xl lg:text-5xl">
            {course.title}
          </h1>

          <p className="mt-4 max-w-3xl text-base text-slate-600 sm:text-lg leading-relaxed">
            {course.description}
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-6 text-xs font-semibold text-slate-600">
            <div className="flex items-center gap-2">
              <span className="text-base">⏱️</span>
              <span>
                {course.estimatedDuration || t("courseDurationFallback")}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-base">🏫</span>
              <span>
                {activeCohortsCount} {t("courseActiveCohorts")}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-base">🎓</span>
              <span>{t("courseCompletionCertificate")}</span>
            </div>
          </div>

          {/* Primary Call to Action */}
          <div className="mt-8 flex flex-wrap gap-4">
            <Link
              to={`/register/student`}
              className="editorial-button text-xs font-extrabold"
            >
              {t("courseRequestPlacement")} →
            </Link>
            <Link
              to="/how-it-works"
              className="editorial-button-secondary text-xs font-bold"
            >
              {t("coursePlacementInfo")}
            </Link>
          </div>
        </div>
      </div>

      {/* Content Sections */}
      <div className="mx-auto max-w-5xl px-4 pt-12 sm:px-6 lg:px-8 space-y-12">
        {/* Learning Objectives */}
        {course.learningObjectives && course.learningObjectives.length > 0 && (
          <div className="rounded-3xl bg-white p-8 shadow-sm ring-1 ring-slate-200">
            <h2 className="editorial-display text-2xl font-bold text-slate-900">
              {t("courseLearningOutcomes")}
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              {t("courseLearningOutcomesDescription")}
            </p>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              {course.learningObjectives.map((obj, i) => (
                <div
                  key={i}
                  className="flex items-start gap-3 rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200/60"
                >
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gradient-to-r from-[#0066ff] to-[#0099ff] text-xs font-bold text-white shadow-xs">
                    ✓
                  </span>
                  <span className="text-xs font-semibold text-slate-800 leading-relaxed">
                    {obj}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Course Syllabus / Curriculum Accordion */}
        <div className="rounded-3xl bg-white p-8 shadow-sm ring-1 ring-slate-200">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
            <div>
              <h2 className="editorial-display text-2xl font-bold text-slate-900">
                {t("courseSyllabusTitle")}
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                {t("courseSyllabusDescription")}
              </p>
            </div>
            <span className="rounded-xl bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-700">
              {modules.length} {t("courseModulesTotal")}
            </span>
          </div>

          <div className="space-y-4">
            {modules.map((mod, index) => {
              const isOpen = activeModuleIndex === index;
              return (
                <div
                  key={index}
                  className="overflow-hidden rounded-2xl border border-slate-200 transition"
                >
                  <button
                    type="button"
                    onClick={() => setActiveModuleIndex(isOpen ? -1 : index)}
                    className="flex w-full items-center justify-between bg-slate-50 px-6 py-4 text-left font-bold text-slate-900 hover:bg-slate-100 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-[#001b44] text-xs font-black text-sky-400">
                        {index + 1}
                      </span>
                      <div>
                        <div className="text-sm">{mod.title}</div>
                        <div className="text-[11px] font-normal text-slate-500">
                          {mod.description}
                        </div>
                      </div>
                    </div>
                    <span className="text-xs text-slate-400 font-mono">
                      {isOpen ? "▲" : "▼"}
                    </span>
                  </button>

                  {isOpen && mod.lessons && (
                    <div className="divide-y divide-slate-100 bg-white px-6 py-3">
                      {mod.lessons.map((lesson, lIdx) => (
                        <div
                          key={lIdx}
                          className="flex items-center justify-between py-3 text-xs"
                        >
                          <div className="flex items-center gap-3">
                            <span className="text-slate-400">📖</span>
                            <span className="font-semibold text-slate-800">
                              {lesson.title}
                            </span>
                          </div>
                          <span className="font-mono text-slate-400">
                            {lesson.durationMinutes} {t("courseLessonMinutes")}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Enrollment & Placement Notice — Brand Dark Layout */}
        <div className="rounded-3xl border border-sky-500/25 bg-gradient-to-br from-[#0c234b] via-[#091b3b] to-[#061124] p-8 text-white shadow-xl ring-1 ring-white/10">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
            <div>
              <span className="rounded-full border border-sky-400/30 bg-sky-500/15 px-3 py-1 text-xs font-bold text-sky-300">
                HOW ENROLLMENT WORKS
              </span>
              <h3 className="mt-3 text-2xl font-black text-white">
                Want to join this course?
              </h3>
              <p className="mt-2 text-xs leading-relaxed text-slate-300 max-w-2xl">
                To ensure high learning quality and personal teacher guidance,
                students register their interest and schedule preferences. The
                TedbabeLearnHUB administrator assigns you to an active cohort
                with an expert instructor.
              </p>
            </div>
            <Link
              to="/register/student"
              className="rounded-2xl bg-gradient-to-r from-[#0066ff] to-[#0099ff] px-6 py-3.5 text-xs font-black uppercase tracking-wider text-white shadow-md shadow-blue-500/25 hover:from-[#0052cc] hover:to-[#0088e6] transition-all hover:-translate-y-0.5 whitespace-nowrap shrink-0"
            >
              Register as Student →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
