import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { apiRequest } from "../lib/api";
import { SectionHeading, EmptyState } from "../components/UIComponents";
export function ExplorePage() {
    const { t } = useTranslation();
    const [searchParams, setSearchParams] = useSearchParams();
    const selectedCat = searchParams.get("selected") || "";
    const [categories, setCategories] = useState([]);
    const [courses, setCourses] = useState([]);
    const [searchQuery, setSearchQuery] = useState("");
    useEffect(() => {
        Promise.all([
            apiRequest("/api/public/categories"),
            apiRequest("/api/public/home"),
        ])
            .then(([catsRes, homeRes]) => {
            setCategories(catsRes.categories);
            setCourses(homeRes.featuredCourses);
        })
            .catch((err) => console.error(err));
    }, []);
    const filteredCourses = courses.filter((c) => {
        const matchesCat = selectedCat ? c.category?._id === selectedCat : true;
        const matchesQuery = searchQuery
            ? c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                c.description.toLowerCase().includes(searchQuery.toLowerCase())
            : true;
        return matchesCat && matchesQuery;
    });
    return (<div className="editorial-page mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 space-y-12">
      {/* Header and Search */}
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 border-b border-slate-200 pb-8">
        <div>
          <SectionHeading badge="EXPLORE LEARNHUB" title={t("categoriesTitle")} subtitle={t("categoriesSubtitle")}/>
        </div>

        {/* Search Input */}
        <div className="relative w-full md:w-80">
          <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search courses..." className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 pl-11 text-xs font-semibold shadow-xs outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"/>
          <span className="absolute left-3.5 top-3 text-slate-400 text-sm">🔍</span>
        </div>
      </div>

      {/* Category Pills Filter */}
      <div className="flex flex-wrap gap-2">
        <button onClick={() => setSearchParams({})} type="button" className={`rounded-full px-4 py-2 text-xs font-bold transition-all ${!selectedCat
            ? "bg-[#C59B27] text-white shadow-sm"
            : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700"}`}>
          {t("allCategories")}
        </button>
        {categories.map((cat) => (<button key={cat._id} onClick={() => setSearchParams({ selected: cat._id })} type="button" className={`rounded-full px-4 py-2 text-xs font-bold transition-all ${selectedCat === cat._id
                ? "bg-[#C59B27] text-white shadow-sm"
                : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700"}`}>
            {cat.name}
          </button>))}
      </div>

      {/* Courses Grid */}
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-black text-slate-900 tracking-tight">
            {t("allCourses")} ({filteredCourses.length})
          </h3>
          <span className="text-xs font-semibold text-slate-500">
            Practical programs. Live guidance. A cohort to grow with.
          </span>
        </div>

        {filteredCourses.length === 0 ? (<EmptyState title="No programs match that search" description="Try another keyword or topic. Your next learning path may be just one search away."/>) : (<div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {filteredCourses.map((course) => (<div key={course._id} className="group flex flex-col justify-between rounded-3xl bg-white p-7 shadow-sm ring-1 ring-slate-200/90 hover:shadow-xl hover:ring-blue-500/40 transition-all duration-300">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="rounded-full bg-sky-50 dark:bg-sky-500/15 px-3 py-1 text-xs font-bold text-blue-700 dark:text-sky-300 border border-sky-200/60 dark:border-sky-500/30">
                      {course.category?.name ?? "General"}
                    </span>
                    <span className="text-xs text-slate-500 font-semibold">
                      {course.skillLevel || "All Levels"}
                    </span>
                  </div>
                  <h4 className="mt-4 text-xl font-bold text-slate-900 leading-snug group-hover:text-blue-600 transition-colors">
                    {course.title}
                  </h4>
                  <p className="mt-2.5 text-sm text-slate-600 leading-relaxed line-clamp-3">
                    {course.description}
                  </p>

                  <div className="mt-5 space-y-2 border-t border-slate-100 pt-4">
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                      {t("objectives")}:
                    </p>
                    {course.learningObjectives?.slice(0, 3).map((obj, i) => (<div key={i} className="flex items-start gap-2 text-xs text-slate-600 font-medium">
                        <span className="text-blue-600 font-bold">✓</span>
                        <span>{obj}</span>
                      </div>))}
                  </div>
                </div>

                <div className="mt-6 border-t border-slate-100 dark:border-slate-800 pt-5">
                  <Link to="/register/student" className="golden-btn inline-flex w-full items-center justify-center rounded-full px-4 py-3 text-xs font-bold text-white shadow-sm hover:shadow-md transition-all active:scale-95">
                    {t("registerAndRequest")}
                  </Link>
                </div>
              </div>))}
          </div>)}
      </div>
    </div>);
}
