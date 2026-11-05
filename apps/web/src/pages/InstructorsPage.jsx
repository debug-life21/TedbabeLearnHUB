import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { apiRequest } from "../lib/api";

export function InstructorsPage() {
  const { t } = useTranslation();
  const [instructors, setInstructors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setLoading(true);
    apiRequest("/api/public/instructors")
      .then((res) => setInstructors(res.instructors || []))
      .catch((err) => setError(err.message || t("instructorsLoadError")))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="editorial-page min-h-screen pb-24">
      {/* Header Hero */}
      <div className="editorial-hero border-b border-slate-200/80 px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-5xl text-center">
          <span className="editorial-kicker text-blue-600 font-extrabold tracking-widest">
            {t("instructorsKicker")}
          </span>
          <h1 className="editorial-display mt-3 text-4xl font-extrabold text-slate-900 sm:text-5xl">
            {t("instructorsTitle")}
          </h1>
          <p className="mx-auto mt-4 max-w-3xl text-base text-slate-600 sm:text-lg leading-relaxed">
            {t("instructorsDescription")}
          </p>
          <div className="mt-8 flex justify-center gap-4">
            <Link to="/courses" className="editorial-button text-xs font-black">
              {t("instructorsExploreCourses")} →
            </Link>
            <Link
              to="/apply/teacher"
              className="editorial-button-secondary text-xs font-bold"
            >
              {t("instructorsJoinTeam")}
            </Link>
          </div>
        </div>
      </div>

      {/* Instructors Grid */}
      <div className="mx-auto max-w-6xl px-4 pt-16 sm:px-6 lg:px-8">
        {loading ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="animate-pulse rounded-3xl bg-white p-7 ring-1 ring-slate-200"
              >
                <div className="h-16 w-16 rounded-2xl bg-slate-200 mb-4"></div>
                <div className="h-5 w-3/4 rounded bg-slate-200 mb-2"></div>
                <div className="h-12 w-full rounded bg-slate-100"></div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="rounded-3xl bg-rose-50 p-8 text-center ring-1 ring-rose-200">
            <p className="font-bold text-rose-700">{error}</p>
          </div>
        ) : instructors.length === 0 ? (
          <div className="rounded-3xl bg-white p-12 text-center ring-1 ring-slate-200">
            <span className="text-4xl mb-3 block">👩‍🏫</span>
            <h3 className="editorial-display text-xl font-bold text-slate-900">
              {t("instructorsEmptyTitle")}
            </h3>
            <p className="mt-2 text-xs text-slate-500 max-w-md mx-auto">
              {t("instructorsEmptyDescription")}
            </p>
            <Link to="/apply/teacher" className="golden-btn inline-flex items-center justify-center rounded-full px-6 py-3 text-xs font-bold text-white shadow-sm hover:shadow-md transition-all active:scale-95 mt-6">
              {t("instructorsApplyButton")} →
            </Link>
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {instructors.map((instructor) => (
              <div
                key={instructor.id}
                className="flex flex-col justify-between rounded-3xl bg-white p-7 shadow-sm ring-1 ring-slate-200/80 transition hover:shadow-lg"
              >
                <div>
                  <div className="flex items-center gap-4 mb-4">
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[var(--tlh-navy)] to-[var(--tlh-blue-primary)] text-base font-black text-white shadow-md">
                      {instructor.name
                        ? instructor.name.slice(0, 2).toUpperCase()
                        : "TLH"}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-slate-900">
                          {instructor.name}
                        </h3>
                        <span
                          className="text-blue-600 font-bold text-xs"
                          title={t("instructorLabel")}
                        >
                          ✓
                        </span>
                      </div>
                      <p className="text-xs text-slate-500">
                        {instructor.qualifications}
                      </p>
                    </div>
                  </div>

                  <p className="text-xs text-slate-600 leading-relaxed line-clamp-3">
                    {instructor.bio}
                  </p>

                  {instructor.expertise && instructor.expertise.length > 0 && (
                    <div className="mt-4 flex flex-wrap gap-1.5">
                      {instructor.expertise.map((exp, eIdx) => (
                        <span
                          key={eIdx}
                          className="rounded-lg bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-700"
                        >
                          {exp}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-blue-600">
                    {t("instructorLabel")}
                  </span>
                  <Link
                    to="/register/student"
                    className="text-xs font-bold text-slate-900 hover:text-blue-600"
                  >
                    {t("instructorLearnCohort")} →
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
