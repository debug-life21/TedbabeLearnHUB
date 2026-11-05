import { useState } from "react";

const CATEGORY_ORDER = [
    "web development",
    "digital marketing",
    "university & college",
    "college",
    "programming",
    "data, ai & analytics",
    "cybersecurity & it",
    "design & multimedia",
    "business & entrepreneurship",
    "business",
    "secondary school",
    "middle school",
    "primary school",
    "languages",
];

function getCategoryRank(name = "") {
    const lower = name.toLowerCase();
    const index = CATEGORY_ORDER.findIndex((key) => lower.includes(key));
    return index !== -1 ? index : 999;
}

function getCategoryIcon(name = "") {
    const lower = name.toLowerCase();
    if (lower.includes("web dev")) return "💻";
    if (lower.includes("market") || lower.includes("biz") || lower.includes("business")) return "📈";
    if (lower.includes("university") || lower.includes("college")) return "🎓";
    if (lower.includes("programm")) return "⚙️";
    if (lower.includes("data") || lower.includes("ai")) return "📊";
    if (lower.includes("cyber") || lower.includes("security")) return "🛡️";
    if (lower.includes("design") || lower.includes("media")) return "🎨";
    if (lower.includes("secondary")) return "📐";
    if (lower.includes("middle")) return "🔬";
    if (lower.includes("primary")) return "🎒";
    if (lower.includes("lang")) return "🗣️";
    return "📚";
}

function groupCoursesByCategory(courses) {
    const groups = new Map();
    courses.forEach((course) => {
        const categoryName = course.category?.name || "Other courses";
        if (!groups.has(categoryName)) groups.set(categoryName, []);
        groups.get(categoryName).push(course);
    });

    return [...groups.entries()].sort(([first], [second]) => {
        const rankA = getCategoryRank(first);
        const rankB = getCategoryRank(second);
        if (rankA !== rankB) return rankA - rankB;
        return first.localeCompare(second);
    });
}

export function CategoryCoursePicker({ courses, selectedCourseIds, onChange }) {
    const groups = groupCoursesByCategory(courses);
    const selectedIds = new Set(selectedCourseIds);
    // Keep all categories collapsed by default; user clicks to expand
    const [openCategories, setOpenCategories] = useState({});

    function toggleCategory(categoryName) {
        setOpenCategories((prev) => ({
            ...prev,
            [categoryName]: !prev[categoryName],
        }));
    }

    function toggleCourse(courseId) {
        onChange(
            selectedIds.has(courseId)
                ? selectedCourseIds.filter((selectedId) => selectedId !== courseId)
                : [...selectedCourseIds, courseId],
        );
    }

    if (!courses.length) {
        return (
            <p className="mt-1.5 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                Course categories are loading or currently unavailable. Please try again shortly.
            </p>
        );
    }

    return (
        <div className="mt-2 space-y-2.5">
            {groups.map(([categoryName, categoryCourses]) => {
                const categorySelectedCount = categoryCourses.filter((course) => selectedIds.has(course._id)).length;
                const isOpen = Boolean(openCategories[categoryName]);
                const icon = getCategoryIcon(categoryName);

                return (
                    <div
                        key={categoryName}
                        className={`rounded-2xl border transition-all ${
                            categorySelectedCount > 0
                                ? "border-sky-300 bg-sky-50/40 shadow-sm"
                                : "border-slate-200 bg-white hover:border-slate-300"
                        }`}
                    >
                        <button
                            type="button"
                            onClick={() => toggleCategory(categoryName)}
                            aria-expanded={isOpen}
                            className="flex w-full cursor-pointer items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-50/80 rounded-2xl"
                        >
                            <span className="flex items-center gap-2.5 font-bold text-slate-800 text-sm">
                                <span className="text-base" aria-hidden="true">{icon}</span>
                                <span>{categoryName}</span>
                            </span>

                            <div className="flex items-center gap-2 text-xs">
                                {categorySelectedCount > 0 ? (
                                    <span className="rounded-full bg-gradient-to-r from-[var(--tlh-blue-primary)] to-[var(--tlh-sky)] px-2.5 py-0.5 font-bold text-white shadow-sm">
                                        ✓ {categorySelectedCount} selected
                                    </span>
                                ) : (
                                    <span className="text-slate-400 font-medium">
                                        {categoryCourses.length} courses
                                    </span>
                                )}
                                <span className="text-slate-400 font-bold text-sm transition-transform">
                                    {isOpen ? "▲" : "▼"}
                                </span>
                            </div>
                        </button>

                        {isOpen && (
                            <div className="border-t border-slate-100 p-3.5 bg-slate-50/50 rounded-b-2xl animate-fadeIn">
                                <div className="grid gap-2 sm:grid-cols-2">
                                    {categoryCourses.map((course) => {
                                        const isChecked = selectedIds.has(course._id);
                                        return (
                                            <label
                                                key={course._id}
                                                className={`flex cursor-pointer items-start gap-2.5 rounded-xl border p-2.5 text-xs transition-all ${
                                                    isChecked
                                                        ? "border-[var(--tlh-blue-primary)] bg-sky-50 text-slate-900 font-medium shadow-sm ring-1 ring-blue-500/20"
                                                        : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:border-slate-300"
                                                }`}
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={isChecked}
                                                    onChange={() => toggleCourse(course._id)}
                                                    className="mt-0.5 h-4 w-4 rounded accent-[var(--tlh-blue-primary)]"
                                                />
                                                <div className="min-w-0 flex-1">
                                                    <span className="block font-bold text-slate-900 leading-snug">
                                                        {course.title}
                                                    </span>
                                                    <span className="mt-0.5 block text-[11px] text-slate-500">
                                                        {course.skillLevel || "All levels"}
                                                    </span>
                                                </div>
                                            </label>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}

