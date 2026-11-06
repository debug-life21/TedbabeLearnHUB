import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { apiRequest } from "../lib/api";

export function InstructorsPage() {
  const { t } = useTranslation();
  const [instructors, setInstructors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    setLoading(true);
    apiRequest("/api/public/instructors")
      .then((res) => setInstructors(res.instructors || []))
      .catch((err) => setError(err.message || t("instructorsLoadError")))
      .finally(() => setLoading(false));
  }, []);

  // Filter instructors by search query
  const filteredInstructors = instructors.filter((instructor) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      (instructor.name || "").toLowerCase().includes(q) ||
      (instructor.qualifications || "").toLowerCase().includes(q) ||
      (instructor.bio || "").toLowerCase().includes(q) ||
      (instructor.expertise || []).some((e) => e.toLowerCase().includes(q))
    );
  });

  return (
    <div className="editorial-page min-h-screen pb-24">
      {/* Header Hero */}
      <div className="relative overflow-hidden bg-[var(--tlh-navy)] py-20 sm:py-28 text-white">
        {/* Background glows */}
        <div className="absolute top-1/6 left-1/12 w-80 h-80 rounded-full bg-[var(--tlh-cyan)]/20 blur-3xl pointer-events-none" />
        <div className="absolute bottom-1/6 right-1/12 w-96 h-96 rounded-full bg-[var(--tlh-blue-primary)]/25 blur-3xl pointer-events-none" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] rounded-full bg-[var(--tlh-cyan)]/10 blur-[100px] pointer-events-none" />

        <div className="relative mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-[var(--tlh-cyan)]/30 bg-slate-950/60 px-4 py-1.5 text-xs font-black tracking-wider uppercase text-[var(--tlh-cyan)] backdrop-blur-md shadow-lg">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--tlh-cyan)] opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[var(--tlh-cyan)]" />
            </span>
            {t("instructorsKicker")}
          </span>
          <h1 className="mt-5 text-4xl font-black text-white sm:text-5xl lg:text-6xl tracking-tight leading-tight">
            {t("instructorsTitle")}
          </h1>
          <p className="mx-auto mt-4 max-w-3xl text-base text-slate-300 sm:text-lg leading-relaxed">
            {t("instructorsDescription")}
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-4">
            <Link
              to="/courses"
              className="rounded-full bg-gradient-to-r from-[var(--tlh-blue-primary)] to-[var(--tlh-sky)] px-8 py-3 text-sm font-extrabold text-white shadow-lg shadow-blue-500/25 hover:from-[var(--tlh-blue-hover)] hover:to-[var(--tlh-sky)] transition-all hover:-translate-y-0.5"
            >
              {t("instructorsExploreCourses")} →
            </Link>
            <Link
              to="/apply/teacher"
              className="rounded-full border border-white/20 bg-white/10 px-8 py-3 text-sm font-bold text-white hover:bg-white/20 transition-all hover:-translate-y-0.5 backdrop-blur-sm"
            >
              {t("instructorsJoinTeam")}
            </Link>
          </div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 -mt-6 relative z-10">
        <div className="rounded-2xl bg-white dark:bg-slate-900 p-3 shadow-xl ring-1 ring-slate-200/80 dark:ring-slate-800 flex items-center gap-3">
          <span className="text-lg pl-2">🔍</span>
          <input
            type="text"
            placeholder="Search instructors by name, expertise, or subject..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 bg-transparent text-sm text-slate-900 dark:text-white placeholder:text-slate-400 outline-none py-2"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="text-xs font-bold text-slate-400 hover:text-slate-700 dark:hover:text-white px-2 py-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              Clear
            </button>
          )}
          <span className="text-xs font-bold text-slate-500 dark:text-slate-400 pr-2">
            {filteredInstructors.length} instructor{filteredInstructors.length !== 1 ? "s" : ""}
          </span>
        </div>
      </div>

      {/* Instructors Grid */}
      <div className="mx-auto max-w-6xl px-4 pt-12 sm:px-6 lg:px-8">
        {loading ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="animate-pulse rounded-2xl bg-white dark:bg-slate-900 p-4 ring-1 ring-slate-200 dark:ring-slate-800"
              >
                <div className="flex flex-col items-center">
                  <div className="h-16 w-16 rounded-full bg-slate-200 dark:bg-slate-700 mb-3" />
                  <div className="h-4 w-3/4 rounded bg-slate-200 dark:bg-slate-700 mb-2" />
                  <div className="h-3 w-1/2 rounded bg-slate-100 dark:bg-slate-800 mb-3" />
                  <div className="h-10 w-full rounded bg-slate-100 dark:bg-slate-800" />
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="rounded-3xl bg-rose-50 dark:bg-rose-950/30 p-8 text-center ring-1 ring-rose-200 dark:ring-rose-800">
            <p className="font-bold text-rose-700 dark:text-rose-400">{error}</p>
          </div>
        ) : filteredInstructors.length === 0 ? (
          <div className="rounded-3xl bg-white dark:bg-slate-900 p-12 text-center ring-1 ring-slate-200 dark:ring-slate-800 shadow-sm">
            <span className="text-4xl mb-3 block">👩‍🏫</span>
            <h3 className="text-xl font-bold text-slate-900 dark:text-white">
              {searchQuery
                ? "No instructors match your search"
                : t("instructorsEmptyTitle")}
            </h3>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto">
              {searchQuery
                ? "Try different keywords or clear the search to see all instructors."
                : t("instructorsEmptyDescription")}
            </p>
            {!searchQuery && (
              <Link
                to="/apply/teacher"
                className="golden-btn inline-flex items-center justify-center rounded-full px-6 py-3 text-xs font-bold text-white shadow-sm hover:shadow-md transition-all active:scale-95 mt-6"
              >
                {t("instructorsApplyButton")} →
              </Link>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {filteredInstructors.map((instructor) => (
              <div
                key={instructor.id}
                className="group flex flex-col justify-between rounded-2xl bg-white dark:bg-slate-900 p-4 text-center shadow-sm ring-1 ring-slate-200/80 dark:ring-slate-800 transition-all hover:shadow-lg hover:ring-[var(--tlh-blue-primary)]/30"
              >
                <div>
                  {/* Avatar */}
                  <div className="relative mx-auto mb-3 h-16 w-16">
                    <div className="absolute -inset-1.5 rounded-full bg-gradient-to-tr from-[var(--tlh-blue-primary)] to-[var(--tlh-cyan)] opacity-0 blur-md transition-opacity group-hover:opacity-100" />
                    {instructor.avatarUrl ? (
                      <img
                        src={instructor.avatarUrl}
                        alt={instructor.name}
                        className="relative h-full w-full rounded-full border-2 border-white object-cover shadow-md dark:border-slate-800"
                        onError={(e) => {
                          e.currentTarget.src = "/learnhub-icon.png";
                        }}
                      />
                    ) : (
                      <div className="relative flex h-full w-full items-center justify-center rounded-full border-2 border-white bg-gradient-to-br from-[var(--tlh-navy)] to-[var(--tlh-blue-primary)] text-sm font-black text-white dark:border-slate-800">
                        {instructor.name
                          ? instructor.name.slice(0, 2).toUpperCase()
                          : "TLH"}
                      </div>
                    )}
                  </div>

                  {/* Name & Badge */}
                  <div className="mb-0.5 flex items-center justify-center gap-1">
                    <h3 className="text-sm font-bold leading-snug text-slate-900 dark:text-white">
                      {instructor.name}
                    </h3>
                    <span
                      className="flex h-4 w-4 items-center justify-center rounded-full bg-[var(--tlh-blue-primary)] text-[9px] font-bold text-white shadow-sm"
                      title="Verified Instructor"
                    >
                      ✓
                    </span>
                  </div>

                  {/* Title/Qualifications */}
                  <p className="text-[10px] font-black uppercase tracking-wider text-[var(--tlh-blue-primary)] dark:text-amber-400">
                    {instructor.qualifications}
                  </p>

                  {/* Experience */}
                  {instructor.experience && (
                    <p className="mt-1 text-[10px] font-bold text-slate-500 dark:text-slate-400">
                      🎖️ {instructor.experience}
                    </p>
                  )}

                  {/* Bio */}
                  <p className="mt-2 text-[11px] leading-relaxed text-slate-500 dark:text-slate-300 line-clamp-2">
                    {instructor.bio}
                  </p>

                  {/* Expertise Tags */}
                  {instructor.expertise &&
                    instructor.expertise.length > 0 && (
                      <div className="mt-3 flex flex-wrap justify-center gap-1">
                        {instructor.expertise.slice(0, 2).map((exp, eIdx) => (
                          <span
                            key={eIdx}
                            className="rounded-md border border-[var(--tlh-blue-primary)]/15 bg-[var(--primary-light)] px-2 py-0.5 text-[9px] font-bold text-[var(--tlh-blue-primary)] dark:border-sky-500/20 dark:bg-[var(--tlh-blue-primary)]/15 dark:text-sky-300"
                          >
                            {exp}
                          </span>
                        ))}
                      </div>
                    )}
                </div>

                {/* Footer */}
                <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3 dark:border-slate-800">
                  <span className="inline-flex items-center gap-1 text-[9px] font-semibold text-[var(--tlh-blue-primary)]">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    {t("instructorLabel")}
                  </span>
                  <Link
                    to="/register/student"
                    className="text-[10px] font-bold text-slate-900 dark:text-white hover:text-[var(--tlh-blue-primary)] transition-colors"
                  >
                    {t("instructorLearnCohort")} →
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* CTA at the bottom */}
        {!loading && !error && filteredInstructors.length > 0 && (
          <div className="mt-16 text-center">
            <div className="rounded-3xl bg-gradient-to-br from-[var(--tlh-navy)] via-[var(--tlh-navy-deep)] to-slate-950 p-8 sm:p-12 text-white shadow-xl ring-1 ring-white/10">
              <span className="rounded-full bg-[var(--tlh-orange)]/20 px-3.5 py-1 text-xs font-bold text-[var(--tlh-orange)] border border-[var(--tlh-orange)]/30">
                BECOME AN INSTRUCTOR
              </span>
              <h3 className="mt-4 text-2xl sm:text-3xl font-black text-white">
                Share Your Expertise with Learners
              </h3>
              <p className="mt-3 text-sm text-slate-300 max-w-xl mx-auto leading-relaxed">
                Join our team of verified educators. Teach live cohort-based classes, build your professional brand, and help shape the next generation of skilled professionals.
              </p>
              <div className="mt-6 flex flex-wrap justify-center gap-4">
                <Link
                  to="/apply/teacher"
                  className="golden-btn inline-flex items-center gap-2 rounded-full px-7 py-3 text-xs font-bold text-white transition-all shadow-sm hover:shadow-md active:scale-95"
                >
                  Apply to Teach →
                </Link>
                <Link
                  to="/courses"
                  className="rounded-full border border-white/20 bg-white/10 px-7 py-3 text-xs font-bold text-white hover:bg-white/20 transition-all backdrop-blur-sm"
                >
                  Explore Courses
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
