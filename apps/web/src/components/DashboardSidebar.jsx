import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

export function DashboardSidebar({ title, user, tabs, activeTab, onSelect, backHref, backLabel = "Back to dashboard" }) {
    const [isOpen, setIsOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");

    const currentTab = useMemo(
        () => tabs.find((tab) => tab.id === activeTab) || tabs[0],
        [tabs, activeTab],
    );

    const filteredTabs = useMemo(() => {
        const query = searchQuery.trim().toLowerCase();
        if (!query) return tabs;
        return tabs.filter((tab) => tab.label.toLowerCase().includes(query));
    }, [tabs, searchQuery]);

    useEffect(() => {
        if (!isOpen) return undefined;
        const originalOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";

        function handleKeyDown(event) {
            if (event.key === "Escape") {
                setIsOpen(false);
            }
        }
        window.addEventListener("keydown", handleKeyDown);
        return () => {
            document.body.style.overflow = originalOverflow;
            window.removeEventListener("keydown", handleKeyDown);
        };
    }, [isOpen]);

    return (
        <>
            {/* Small Device Bar with Menu Button */}
            <div className="mb-6 w-full lg:hidden">
                <div className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200/90 bg-white/95 p-3 shadow-xs backdrop-blur-md">
                    <button
                        type="button"
                        onClick={() => setIsOpen(true)}
                        aria-expanded={isOpen}
                        aria-controls="mobile-sidebar-drawer"
                        className="golden-btn inline-flex shrink-0 items-center gap-2 rounded-full px-3.5 py-2.5 text-xs font-bold text-white shadow-sm hover:shadow-md transition active:scale-95"
                    >
                        <svg
                            aria-hidden="true"
                            className="h-4 w-4 shrink-0"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        >
                            <line x1="3" y1="12" x2="21" y2="12" />
                            <line x1="3" y1="6" x2="21" y2="6" />
                            <line x1="3" y1="18" x2="21" y2="18" />
                        </svg>
                        <span>Menu</span>
                        <span className="rounded-full bg-white/20 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                            {tabs.length}
                        </span>
                    </button>

                    <div className="flex min-w-0 flex-1 items-center gap-2 px-1">
                        <span className="shrink-0 text-base" aria-hidden="true">{currentTab?.icon}</span>
                        <div className="min-w-0">
                            <p className="truncate text-[10px] font-bold uppercase tracking-wider text-slate-400">{title}</p>
                            <p className="truncate text-xs font-bold text-slate-900">{currentTab?.label}</p>
                        </div>
                    </div>

                    {user?.avatarUrl ? (
                        <img src={user.avatarUrl} alt="" className="h-9 w-9 shrink-0 rounded-full object-cover ring-2 ring-slate-100" />
                    ) : (
                        <span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-sm">👤</span>
                    )}
                </div>
            </div>

            {/* Small Device Drawer Overlay */}
            {isOpen ? (
                <div
                    id="mobile-sidebar-drawer"
                    role="dialog"
                    aria-modal="true"
                    aria-label={`${title} navigation menu`}
                    className="fixed inset-0 z-50 lg:hidden"
                >
                    {/* Backdrop */}
                    <div
                        className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs transition-opacity"
                        onClick={() => setIsOpen(false)}
                        aria-hidden="true"
                    />

                    {/* Slide-over panel */}
                    <div className="fixed inset-y-0 left-0 flex w-full max-w-xs flex-col bg-white shadow-2xl shadow-slate-900/20 transition-transform sm:max-w-sm">
                        {/* Header */}
                        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-4">
                            <div className="min-w-0">
                                <p className="truncate text-[10px] font-black uppercase tracking-[0.18em] text-[var(--tlh-blue-primary)]">TedbabeLearnHUB (TLH)</p>
                                <h2 className="mt-0.5 truncate text-sm font-bold text-slate-900">{title}</h2>
                            </div>
                            <button
                                type="button"
                                onClick={() => setIsOpen(false)}
                                aria-label="Close navigation menu"
                                className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 active:scale-95"
                            >
                                <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="h-5 w-5">
                                    <path d="m6 6 12 12M18 6 6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                                </svg>
                            </button>
                        </div>

                        {/* Search input for large tab lists */}
                        {tabs.length > 7 ? (
                            <div className="border-b border-slate-100 px-3 py-2">
                                <input
                                    type="search"
                                    placeholder="Filter sections…"
                                    value={searchQuery}
                                    onChange={(event) => setSearchQuery(event.target.value)}
                                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-[var(--tlh-blue-primary)] focus:bg-white focus:outline-none"
                                />
                            </div>
                        ) : null}

                        {/* Navigation list */}
                        <div className="flex-1 overflow-y-auto p-3">
                            <nav aria-label={`${title} navigation`} className="space-y-1">
                                {filteredTabs.map((tab) => {
                                    const isCurrent = activeTab === tab.id;
                                    return (
                                        <button
                                            key={tab.id}
                                            type="button"
                                            aria-current={isCurrent ? "page" : undefined}
                                            onClick={() => {
                                                onSelect(tab.id);
                                                setIsOpen(false);
                                            }}
                                            className={`flex w-full items-center gap-3 rounded-xl px-3.5 py-3 text-left text-xs font-semibold transition ${
                                                isCurrent
                                                    ? "bg-gradient-to-r from-[var(--tlh-blue-primary)] to-[var(--tlh-sky)] dark:from-slate-800 dark:to-slate-900 text-white dark:text-[#FBBF24] dark:border dark:border-[#C59B27]/40 shadow-sm font-bold"
                                                    : "text-slate-600 dark:text-slate-300 hover:bg-[var(--primary-light)] dark:hover:bg-slate-800/60 hover:text-[var(--tlh-blue-primary)] dark:hover:text-white"
                                            }`}
                                        >
                                            <span className="text-base" aria-hidden="true">{tab.icon}</span>
                                            <span className="truncate">{tab.label}</span>
                                            {isCurrent ? (
                                                <span className="ml-auto text-xs opacity-75">●</span>
                                            ) : null}
                                        </button>
                                    );
                                })}
                                {filteredTabs.length === 0 ? (
                                    <p className="py-6 text-center text-xs text-slate-400">No matching sections found.</p>
                                ) : null}
                            </nav>
                        </div>

                        {/* Footer */}
                        <div className="border-t border-slate-100 p-4">
                            {backHref ? (
                                <Link
                                    to={backHref}
                                    onClick={() => setIsOpen(false)}
                                    className="mb-3 flex items-center justify-center rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                                >
                                    ← {backLabel}
                                </Link>
                            ) : null}
                            <div className="flex items-center gap-3">
                                {user?.avatarUrl ? (
                                    <img src={user.avatarUrl} alt="" className="h-9 w-9 shrink-0 rounded-full object-cover ring-2 ring-slate-100" />
                                ) : (
                                    <span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-sm">👤</span>
                                )}
                                <div className="min-w-0">
                                    <p className="truncate text-xs font-bold text-slate-800">{user?.fullName || user?.name || "User"}</p>
                                    <p className="mt-0.5 truncate text-[11px] text-slate-500">{user?.email || ""}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            ) : null}

            {/* Desktop Fixed Left Sidebar */}
            <aside className="hidden lg:fixed lg:bottom-0 lg:left-0 lg:top-[4.5rem] lg:z-40 lg:block lg:w-64 lg:overflow-y-auto lg:border-r lg:border-slate-200 lg:bg-white/95 lg:px-4 lg:py-6 lg:shadow-none lg:backdrop-blur">
                <div className="mb-7 flex items-center justify-between gap-3 px-2">
                    <div className="min-w-0">
                        <p className="truncate text-[10px] font-black uppercase tracking-[0.18em] text-[var(--tlh-blue-primary)]">TedbabeLearnHUB (TLH)</p>
                        <h2 className="mt-1 truncate text-sm font-bold text-slate-900">{title}</h2>
                    </div>
                    {user?.avatarUrl ? (
                        <img src={user.avatarUrl} alt="" className="h-10 w-10 shrink-0 rounded-full object-cover ring-2 ring-slate-100" />
                    ) : (
                        <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-lg">👤</span>
                    )}
                </div>
                <nav aria-label={`${title} navigation`} className="flex flex-col gap-1">
                    {tabs.map((tab) => (
                        <button
                            key={tab.id}
                            type="button"
                            aria-current={activeTab === tab.id ? "page" : undefined}
                            onClick={() => onSelect(tab.id)}
                            className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-xs font-semibold transition ${
                                activeTab === tab.id
                                    ? "bg-gradient-to-r from-[var(--tlh-blue-primary)] to-[var(--tlh-sky)] dark:from-slate-800 dark:to-slate-900 text-white dark:text-[#FBBF24] dark:border dark:border-[#C59B27]/40 shadow-sm font-bold"
                                    : "text-slate-600 dark:text-slate-300 hover:bg-[var(--primary-light)] dark:hover:bg-slate-800/60 hover:text-[var(--tlh-blue-primary)] dark:hover:text-white"
                            }`}
                        >
                            <span className="text-base" aria-hidden="true">{tab.icon}</span>
                            <span>{tab.label}</span>
                        </button>
                    ))}
                </nav>
                {backHref ? (
                    <Link to={backHref} className="mt-5 block rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50">
                        ← {backLabel}
                    </Link>
                ) : null}
                <div className="mt-6 border-t border-slate-100 px-2 pt-4">
                    <p className="truncate text-xs font-bold text-slate-800">{user?.fullName || user?.name || ""}</p>
                    <p className="mt-1 truncate text-[11px] text-slate-500">{user?.email || ""}</p>
                </div>
            </aside>
        </>
    );
}
